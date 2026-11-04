import {
  EMPTY_LEVELS,
  SKINS,
  UPGRADES,
  upgradeCost,
  type Levels,
  type Skin,
  type Upgrade,
} from "../shared/rules";
export interface Progress {
  version: 1;
  score: number;
  totalScore: number;
  power: number;
  distance: number;
  bestCombo: number;
  flips: number;
  perfects: number;
  levels: Levels;
  skins: Skin[];
  skin: Skin;
  daily: Record<string, number>;
}
export const freshProgress = (): Progress => ({
  version: 1,
  score: 0,
  totalScore: 0,
  power: 0,
  distance: 0,
  bestCombo: 0,
  flips: 0,
  perfects: 0,
  levels: { ...EMPTY_LEVELS },
  skins: ["classic"],
  skin: "classic",
  daily: {},
});
const KEY = "squeek.runner.v1";
const validNumber = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e12;
export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      !p ||
      p.version !== 1 ||
      ![
        "score",
        "totalScore",
        "power",
        "distance",
        "bestCombo",
        "flips",
        "perfects",
      ].every((k) => validNumber(p[k]))
    )
      return freshProgress();
    if (
      !UPGRADES.every(
        (u) =>
          Number.isInteger(p.levels?.[u.id]) &&
          p.levels[u.id] >= 0 &&
          p.levels[u.id] <= 5,
      )
    )
      return freshProgress();
    if (
      !Array.isArray(p.skins) ||
      !p.skins.every((s: string) => SKINS.some((x) => x.id === s)) ||
      !p.skins.includes("classic") ||
      !p.skins.includes(p.skin)
    )
      return freshProgress();
    if (
      !p.daily ||
      typeof p.daily !== "object" ||
      Object.entries(p.daily).some(
        ([k, v]) => !/^\d{4}-\d{2}-\d{2}$/.test(k) || !validNumber(v),
      )
    )
      return freshProgress();
    return p;
  } catch {
    return freshProgress();
  }
}
export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
export function purchaseUpgrade(p: Progress, id: Upgrade): Progress | null {
  if (p.levels[id] >= 5) return null;
  const cost = upgradeCost(id, p.levels);
  if (p.score < cost) return null;
  return {
    ...p,
    score: p.score - cost,
    levels: { ...p.levels, [id]: p.levels[id] + 1 },
  };
}
export function purchaseSkin(p: Progress, skin: Skin): Progress | null {
  const cost = SKINS.find((s) => s.id === skin)!.cost;
  if (p.skins.includes(skin)) return { ...p, skin };
  if (p.score < cost) return null;
  return { ...p, score: p.score - cost, skins: [...p.skins, skin], skin };
}
export const today = () => new Date().toISOString().slice(0, 10);
export function addPoints(p: Progress, points: number): Progress {
  const key = today();
  return {
    ...p,
    score: p.score + points,
    totalScore: p.totalScore + points,
    daily: { ...p.daily, [key]: (p.daily[key] ?? 0) + points },
  };
}
