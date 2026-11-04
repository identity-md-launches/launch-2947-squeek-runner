import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_LEVELS,
  FEVER_MS,
  MAX_CHARGE_MS,
  evaluateLanding,
  landingForCharge,
  launch,
  replay,
  upgradeCost,
  UPGRADES,
  SKINS,
  type Action,
} from "../src/shared/rules";
import {
  addPoints,
  freshProgress,
  loadProgress,
  purchaseSkin,
  purchaseUpgrade,
  saveProgress,
  upgradePowerRequired,
} from "../src/lib/progression";
import { Runner } from "../src/game/Runner";
import { validateSubmission } from "../server/validation";
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
  },
  configurable: true,
});
function advance(r: Runner, ms: number) {
  for (let left = ms; left > 0; left -= 10) r.tick(Math.min(10, left));
}
function flip(r: Runner, charge = 1296) {
  r.press();
  advance(r, charge);
  r.release();
  advance(r, launch(charge).flightMs + 560);
}
test("landing windows reward precise releases and tolerate small errors", () => {
  assert.equal(landingForCharge(1296), "PERFECT");
  for (const charge of [220, 400, 800, 1000])
    assert.equal(landingForCharge(charge), "MISS");
  assert.equal(landingForCharge(1150), "NICE");
  assert.equal(landingForCharge(1650), "MISS");
  assert.equal(landingForCharge(MAX_CHARGE_MS), "MISS");
  assert.equal(evaluateLanding(360, 900, 400), "MISS");
  assert.equal(evaluateLanding(360, 375, 1000), "MISS");
  assert.equal(evaluateLanding(372, 375, 432), "PERFECT");
});
test("live tap / landing progression matches authoritative replay", () => {
  const r = new Runner(freshProgress());
  r.tap();
  advance(r, 150);
  flip(r);
  flip(r, 1150);
  flip(r, 1700);
  const p = r.getSnapshot().progress,
    result = replay(r.actions);
  assert.equal(p.totalScore, result.score);
  assert.equal(p.flips, 3);
  assert.equal(p.perfects, 1);
  assert.equal(p.bestCombo, 2);
  assert.equal(r.getSnapshot().combo, 0);
  assert.ok(Math.abs(p.power - result.power) < 0.0001);
  assert.ok(Math.abs(p.distance - result.distance) < 0.0001);
  const before = p.totalScore;
  flip(r, 1750);
  assert.equal(r.getSnapshot().progress.totalScore, before);
});
test("five consecutive landings trigger ten seconds of Fever and double subsequent points", () => {
  const r = new Runner(freshProgress());
  for (let i = 0; i < 5; i++) flip(r);
  assert.equal(r.getSnapshot().combo, 5);
  assert.ok(r.getSnapshot().fever > 9000 && r.getSnapshot().fever <= FEVER_MS);
  const before = r.getSnapshot().progress.totalScore;
  flip(r);
  assert.equal(r.getSnapshot().progress.totalScore - before, 320);
  assert.equal(replay(r.actions).score, r.getSnapshot().progress.totalScore);
  advance(r, FEVER_MS);
  assert.equal(r.getSnapshot().fever, 0);
});
test("background pause freezes charge and Fever; interrupted holds are cancelled", () => {
  const r = new Runner(freshProgress());
  r.press();
  advance(r, 800);
  r.setPaused(true);
  const before = r.getElapsed();
  advance(r, 10000);
  assert.equal(r.getElapsed(), before);
  r.release();
  assert.equal(r.actions.length, 0);
  r.setPaused(false);
  r.tap();
  assert.equal(r.actions.length, 1);
});
test("maximum charge launches automatically, release cannot double-submit it", () => {
  const r = new Runner(freshProgress());
  r.press();
  advance(r, 1900);
  r.release();
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].charge, 1800);
  advance(r, 2000);
  assert.equal(r.getSnapshot().result, "MISS");
});
test("purchases enforce balances and level caps without removing lifetime score", () => {
  let p = { ...addPoints(freshProgress(), 10000), power: 1000 };
  const lifetime = p.totalScore;
  for (let i = 0; i < 5; i++) {
    const cost = upgradeCost("wheel", p.levels),
      balance = p.score;
    p = purchaseUpgrade(p, "wheel")!;
    assert.equal(p.score, balance - cost);
  }
  assert.equal(purchaseUpgrade(p, "wheel"), null);
  assert.equal(p.totalScore, lifetime);
  const q = purchaseSkin(p, "miner")!;
  assert.equal(q.skin, "miner");
  assert.equal(q.score, p.score - 250);
  assert.equal(purchaseSkin(q, "miner")!.score, q.score);
  assert.equal(purchaseUpgrade(freshProgress(), "wheel"), null);
  assert.equal(purchaseSkin(freshProgress(), "golden"), null);
});
test("Power unlocks every upgrade tier at its boundary and only Score is spent", () => {
  for (const { id } of UPGRADES) {
    for (let level = 0; level < 5; level++) {
      const required = upgradePowerRequired(level);
      const p = {
        ...addPoints(freshProgress(), 100000),
        power: required - 0.01,
        levels: { ...EMPTY_LEVELS, [id]: level },
      };
      assert.equal(purchaseUpgrade(p, id), null);
      const atBoundary = { ...p, power: required };
      const bought = purchaseUpgrade(atBoundary, id)!;
      assert.equal(bought.levels[id], level + 1);
      assert.equal(bought.power, required);
      assert.equal(bought.score, p.score - upgradeCost(id, p.levels));
      assert.equal(bought.totalScore, p.totalScore);
      assert.equal(purchaseUpgrade({ ...atBoundary, score: 0 }, id), null);
    }
  }
});
test("equal-Score Runner fixtures progress differently with low and high Power", () => {
  for (const [power, expected] of [
    [0, 0],
    [1000000, 25],
  ]) {
    const r = new Runner({ ...addPoints(freshProgress(), 100000), power });
    let purchases = 0;
    for (const u of UPGRADES)
      for (let level = 0; level < 5; level++)
        purchases += Number(r.buyUpgrade(u.id));
    assert.equal(purchases, expected);
    // Cosmetics remain Score purchases, and existing ownership is preserved.
    for (const s of SKINS.filter((s) => s.cost > 0))
      assert.equal(r.equipSkin(s.id), true);
    assert.equal(r.getSnapshot().progress.power, power);
    saveProgress(r.getSnapshot().progress);
    assert.deepEqual(loadProgress(), r.getSnapshot().progress);
  }
});
test("saved progress survives reload and malformed storage resets safely", () => {
  const p = addPoints(freshProgress(), 123);
  saveProgress(p);
  assert.deepEqual(loadProgress(), p);
  localStorage.setItem("squeek.runner.v1", '{"version":1,"score":-1}');
  assert.deepEqual(loadProgress(), freshProgress());
  localStorage.setItem("squeek.runner.v1", "no json");
  assert.deepEqual(loadProgress(), freshProgress());
});
test("replay rejects impossible input rates, overlapping flights and charge tampering", () => {
  assert.throws(() =>
    replay([
      { at: 100, type: "tap" },
      { at: 110, type: "tap" },
    ]),
  );
  assert.throws(() =>
    replay([
      { at: 1300, type: "launch", charge: 1296 },
      { at: 1400, type: "tap" },
    ]),
  );
  assert.throws(() => replay([{ at: 1000, type: "launch", charge: 1800 }]));
  assert.throws(() => replay([{ at: 2000, type: "launch", charge: 1801 }]));
  assert.throws(() => replay([{ at: -1, type: "tap" }]));
});
test("server refuses claimed scores, unfinished flights and actions beyond the wall clock", () => {
  const actions: Action[] = [{ at: 1300, type: "launch", charge: 1296 }];
  assert.equal(
    validateSubmission({ actions, duration: 2800 }, 3000).score,
    110,
  );
  assert.throws(() =>
    validateSubmission({ actions, duration: 2800, score: 99999 }, 3000),
  );
  assert.throws(() => validateSubmission({ actions, duration: 1400 }, 3000));
  assert.throws(() => validateSubmission({ actions, duration: 2800 }, 1000));
  assert.throws(() => validateSubmission({ actions, duration: 2800 }, 700000));
});
test("ranked mode uses standard levels even when local upgrades are owned", () => {
  const p = freshProgress();
  p.levels = { wheel: 5, capacity: 5, sprint: 5, recovery: 5, combo: 5 };
  const r = new Runner(p);
  r.setRanked(true);
  flip(r);
  assert.equal(r.getSnapshot().progress.totalScore, 110);
  assert.equal(replay(r.actions, EMPTY_LEVELS).score, 110);
});

test("starting a new run resets the HUD update clock and keeps earned progression", () => {
  const r = new Runner(freshProgress());
  r.tap();
  advance(r, 8000);
  const earned = r.getSnapshot().progress.totalScore;
  r.resetSession();
  let updates = 0;
  const unsubscribe = r.subscribe(() => updates++);
  r.press();
  advance(r, 500);
  assert.ok(updates >= 5);
  assert.ok(r.getSnapshot().charge > 0.25);
  assert.equal(r.getSnapshot().progress.totalScore, earned);
  assert.equal(r.actions.length, 0);
  unsubscribe();
});
