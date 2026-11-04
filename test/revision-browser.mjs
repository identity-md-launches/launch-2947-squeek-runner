// Regression checks use explicit local fixtures, never live chain readings.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";

const root = resolve("dist");
const out = resolve("test/scratch/revision-check");
await mkdir(out, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!path.startsWith("/preview/")) throw 0;
    let file = resolve(root, "." + decodeURIComponent(path.slice(8)));
    if (file !== root && !file.startsWith(root + "/")) throw 0;
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
const checks = [];
const errors = [];
const pass = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
let browser;
try {
  browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://api.squeekchain.com/**", (r) =>
    r.fulfill({ status: 503, body: "{}" }),
  );
  await page.goto(base);
  await page.locator("canvas").waitFor();
  await page.locator(".game-cover").waitFor({ state: "hidden" });
  for (const name of ["How to play", "Connect wallet"]) {
    const button = page.getByRole("button", { name, exact: true }).first();
    await button.focus();
    await page.keyboard.press("Space");
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.locator("dialog[open]").count(), 1);
    if (name === "How to play") {
      await page.locator("dialog .modal-head button").focus();
      await page.keyboard.press("Space");
    } else await page.keyboard.press("Escape");
    await page.locator("dialog").waitFor({ state: "detached" });
    assert.equal(
      await button.evaluate((el) => el === document.activeElement),
      true,
    );
    const resume = page.getByRole("button", {
      name: "Resume game",
      exact: true,
    });
    if (await resume.isVisible()) {
      await resume.focus();
      await page.keyboard.press("Space");
    }
  }
  const sound = page.getByRole("button", { name: "Enable sound", exact: true });
  await sound.focus();
  await page.keyboard.press("Space");
  assert.equal(
    await page
      .getByRole("button", { name: "Mute sound", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Pause game", exact: true }).focus();
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "Resume game", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Resume game", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.locator(".paused-cover").waitFor({ state: "detached" });
  assert.equal(Number(await page.getByTestId("score").textContent()), 0);
  pass(
    "Space activates help, wallet, sound, pause, resume and dialog close exactly once without playing",
  );
  await page.locator(".sprint-button").focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(80);
  await page.keyboard.up("Space");
  assert.equal(Number(await page.getByTestId("score").textContent()), 1);
  pass("Gameplay Space still produces one tap");
  await context.close();

  // High Score with zero Power is an explicitly seeded local test fixture.
  const progression = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await progression.addInitScript(() => {
    if (localStorage.getItem("squeek.runner.v1")) return;
    localStorage.setItem(
      "squeek.runner.v1",
      JSON.stringify({
        version: 1,
        score: 100000,
        totalScore: 100000,
        power: 0,
        distance: 0,
        bestCombo: 0,
        flips: 0,
        perfects: 0,
        levels: { wheel: 0, capacity: 0, sprint: 0, recovery: 0, combo: 0 },
        skins: ["classic"],
        skin: "classic",
        daily: {},
      }),
    );
  });
  const shop = await progression.newPage();
  shop.on("pageerror", (e) => errors.push(e.message));
  await shop.route("https://api.squeekchain.com/**", (r) =>
    r.fulfill({ status: 503, body: "{}" }),
  );
  await shop.goto(base + "#upgrades");
  assert.equal(await shop.locator(".upgrade-buy:disabled").count(), 5);
  assert.equal(
    await shop
      .getByText("25 Power required · You have 0", { exact: true })
      .count(),
    5,
  );
  await shop.screenshot({
    path: resolve(out, "power-locked-390.png"),
    fullPage: true,
  });
  await shop.evaluate(() => {
    location.hash = "play";
  });
  await shop.locator("canvas").waitFor();
  await shop.getByRole("button", { name: "Resume game", exact: true }).click();
  for (let i = 0; i < 13; i++) {
    await shop.locator(".sprint-button").click();
    await shop.waitForTimeout(140);
  }
  const readProgress = () =>
    shop.evaluate(() => JSON.parse(localStorage.getItem("squeek.runner.v1")));
  const earned = await readProgress();
  assert.ok(earned.power >= 25);
  await shop.evaluate(() => {
    location.hash = "upgrades";
  });
  const wheel = shop.locator(".upgrade-row").filter({ hasText: "Wheel speed" });
  await wheel.getByRole("button").click();
  await shop
    .getByText("Wheel speed upgraded to level 1.", { exact: true })
    .waitFor();
  const purchased = await readProgress();
  assert.equal(purchased.score, earned.score - 80);
  assert.equal(purchased.power, earned.power);
  assert.equal(purchased.totalScore, earned.totalScore);
  assert.equal(await wheel.getByRole("button").isDisabled(), true);
  await wheel
    .getByText(`100 Power required · You have ${Math.floor(earned.power)}`, {
      exact: true,
    })
    .waitFor();
  await shop.reload();
  assert.equal((await readProgress()).levels.wheel, 1);
  assert.equal((await readProgress()).power, earned.power);
  for (const width of [320, 390, 768, 1440]) {
    await shop.setViewportSize({ width, height: 844 });
    assert.equal(
      await shop.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  pass(
    "Power gates purchases despite sufficient Score; real taps unlock tier one, spending and reload preserve Power",
  );
  await progression.close();

  const chain = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const dashboard = await chain.newPage();
  dashboard.on("pageerror", (e) => errors.push(e.message));
  await dashboard.clock.install();
  const calls = [];
  await dashboard.route("https://api.squeekchain.com/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    calls.push(path);
    return r.fulfill({
      status: path === "/v1/status" ? 503 : 429,
      headers: { "Retry-After": "120", "Access-Control-Expose-Headers": "Retry-After" },
      body: "{}",
    });
  });
  const count = (path) => calls.filter((v) => v === "/v1" + path).length;
  await dashboard.goto(base + "#chain");
  await dashboard
    .getByText("Rate-limited readings will retry", { exact: false })
    .waitFor();
  await dashboard
    .getByText("Loading…", { exact: true })
    .first()
    .waitFor({ state: "hidden" });
  assert.equal(count("/core"), 1);
  assert.equal(count("/economy/state"), 1);
  const statusBefore = count("/status");
  await dashboard
    .getByRole("button", { name: "Refresh data", exact: true })
    .click();
  await dashboard
    .getByRole("button", { name: "Refresh data", exact: true })
    .waitFor();
  await dashboard.clock.runFor(100);
  assert.equal(count("/status"), statusBefore + 1);
  assert.equal(count("/core"), 1);
  assert.equal(count("/economy/state"), 1);
  // Mount the Play strip and return; its shared /core observer cannot bypass cooldown.
  await dashboard.evaluate(() => {
    location.hash = "play";
  });
  await dashboard.clock.runFor(100);
  await dashboard.evaluate(() => {
    location.hash = "chain";
  });
  await dashboard.clock.runFor(100);
  await dashboard.clock.fastForward(100000);
  await dashboard.clock.runFor(100);
  assert.equal(count("/core"), 1);
  assert.equal(count("/economy/state"), 1);
  await dashboard.clock.fastForward(21000);
  await dashboard.clock.runFor(100);
  if (count("/core") === 1 || count("/economy/state") === 1) {
    await dashboard
      .getByRole("button", { name: "Refresh data", exact: true })
      .click();
    await dashboard.clock.runFor(100);
  }
  assert.equal(count("/core"), 2);
  assert.equal(count("/economy/state"), 2);
  pass(
    "Mixed 503/429 refresh and observer remount respect each endpoint's original 120-second deadline; refresh recovers",
  );
  await chain.close();

  const tokens = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const lookup = await tokens.newPage();
  lookup.on("pageerror", (e) => errors.push(e.message));
  await lookup.clock.install();
  const tokenCalls = [];
  let releaseRetry;
  let tokenTwoReady = false;
  const pendingRetry = new Promise((r) => {
    releaseRetry = r;
  });
  const tokenFixture = (id) => ({
    schemaVersion: 2,
    status: "available",
    chain: { target: "sepolia", chainId: "11155111" },
    tokenId: id,
    custody: { owner: "0x" + "1".repeat(40), depositor: null, burned: false },
    level: 1,
    basePower: "10",
    mergeState: "unmerged",
    metadata: { status: "available", name: `Local test Squeek ${id}` },
  });
  await lookup.route("https://api.squeekchain.com/**", async (r) => {
    const id = new URL(r.request().url()).pathname.match(
      /\/squeeks\/(\d+)$/,
    )?.[1];
    if (!id) return r.fulfill({ status: 503, body: "{}" });
    tokenCalls.push(id);
    if (id === "1" && tokenCalls.filter((v) => v === id).length === 2) {
      await pendingRetry;
      return r.fulfill({ json: tokenFixture(id) });
    }
    if (id === "2")
      return tokenTwoReady
        ? r.fulfill({ json: tokenFixture(id) })
        : r.fulfill({
            status: 429,
            headers: { "Retry-After": "120", "Access-Control-Expose-Headers": "Retry-After" },
            body: "{}",
          });
    return r.fulfill({ status: 503, body: "{}" });
  });
  await lookup.goto(base + "#chain");
  const input = lookup.getByLabel("Look up a Squeek", { exact: true });
  const submit = lookup.locator(".token-form button");
  await input.fill("1");
  await submit.click();
  await lookup
    .locator(".token-result")
    .filter({ hasText: "Chain data is unavailable" })
    .waitFor();
  await input.fill("0001");
  await submit.click();
  await lookup.getByText("Reading Squeek…", { exact: true }).waitFor();
  assert.equal(await submit.isDisabled(), true);
  assert.equal(tokenCalls.filter((v) => v === "1").length, 2);
  releaseRetry();
  await lookup.getByText("Local test Squeek 1", { exact: true }).waitFor();
  pass(
    "Same normalized token ID retries a 503, visibly loads, then renders a schema-valid local fixture",
  );
  await input.fill("2");
  await submit.click();
  await lookup
    .locator(".token-result")
    .filter({ hasText: "The official API is busy" })
    .waitFor();
  assert.equal(await submit.isDisabled(), true);
  await input.press("Enter");
  assert.equal(tokenCalls.filter((v) => v === "2").length, 1);
  await input.fill("3");
  await submit.click();
  await lookup
    .locator(".token-result")
    .filter({ hasText: "Chain data is unavailable" })
    .waitFor();
  await input.fill("0002");
  await submit.click();
  await lookup.clock.runFor(100);
  assert.equal(tokenCalls.filter((v) => v === "2").length, 1);
  await lookup.clock.fastForward(100000);
  await lookup.clock.runFor(100);
  assert.equal(tokenCalls.filter((v) => v === "2").length, 1);
  tokenTwoReady = true;
  await lookup.clock.fastForward(21000);
  await lookup.clock.runFor(100);
  if (tokenCalls.filter((v) => v === "2").length === 1) {
    assert.equal(await submit.isDisabled(), false);
    await submit.click();
  }
  await lookup.getByText("Local test Squeek 2", { exact: true }).waitFor();
  assert.equal(tokenCalls.filter((v) => v === "2").length, 2);
  assert.equal(await submit.isDisabled(), false);
  pass(
    "Token Retry-After survives Enter submissions and changing away/back, then recovers at the deadline",
  );
  await tokens.close();
  assert.deepEqual(errors, []);
  pass("No uncaught page errors in revision interactions");
  await writeFile(
    resolve(out, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
