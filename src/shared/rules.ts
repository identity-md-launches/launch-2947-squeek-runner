export type Upgrade = "wheel" | "capacity" | "sprint" | "recovery" | "combo";
export type Skin = "classic" | "miner" | "golden" | "cyber" | "squeektoshi";
export type Landing = "MISS" | "NICE" | "PERFECT";
export type Levels = Record<Upgrade, number>;
export const EMPTY_LEVELS: Levels = {
  wheel: 0,
  capacity: 0,
  sprint: 0,
  recovery: 0,
  combo: 0,
};
export const UPGRADES: {
  id: Upgrade;
  name: string;
  detail: string;
  base: number;
  icon: string;
}[] = [
  {
    id: "wheel",
    name: "Wheel speed",
    detail: "+15% running speed and distance per level.",
    base: 80,
    icon: "wheel",
  },
  {
    id: "capacity",
    name: "Energy capacity",
    detail: "+20% virtual Power from every tap.",
    base: 100,
    icon: "bolt",
  },
  {
    id: "sprint",
    name: "Sprint boost",
    detail: "+20% landing points per level.",
    base: 120,
    icon: "rocket",
  },
  {
    id: "recovery",
    name: "Recovery",
    detail: "Recover 50 ms faster after a landing.",
    base: 90,
    icon: "heart",
  },
  {
    id: "combo",
    name: "Combo bonus",
    detail: "+5% score for each active combo step.",
    base: 150,
    icon: "flame",
  },
];
export const SKINS: {
  id: Skin;
  name: string;
  cost: number;
  description: string;
  color: string;
}[] = [
  {
    id: "classic",
    name: "Classic Hamster",
    cost: 0,
    description: "Small paws. Unreasonably big dreams.",
    color: "#d4a469",
  },
  {
    id: "miner",
    name: "Miner Hamster",
    cost: 250,
    description: "Hard hat on. Ready for the night shift.",
    color: "#e9d171",
  },
  {
    id: "golden",
    name: "Golden Hamster",
    cost: 600,
    description: "A little extra shine in the mineshaft.",
    color: "#efbf4a",
  },
  {
    id: "cyber",
    name: "Cyber Hamster",
    cost: 1000,
    description: "Neon whiskers. Maximum squeek.",
    color: "#86dcbb",
  },
  {
    id: "squeektoshi",
    name: "Squeektoshi Special",
    cost: 1800,
    description: "The wheel has a new mysterious regular.",
    color: "#b6aad5",
  },
];
export const upgradeCost = (id: Upgrade, levels: Levels) =>
  Math.round(
    UPGRADES.find((u) => u.id === id)!.base * Math.pow(1.7, levels[id]),
  );
export const MAX_CHARGE_MS = 1800;
export const TAP_THRESHOLD_MS = 220;
export const GRAVITY = 900;
export const FEVER_MS = 10000;
export const recoveryMs = (levels: Levels) => 550 - levels.recovery * 50;
export const tapPower = (levels: Levels) => 2 + levels.capacity * 0.4;
export const normalizedAngle = (angle: number) =>
  (((angle % 360) + 540) % 360) - 180;
export function launch(chargeMs: number) {
  const q = Math.max(0, Math.min(1, chargeMs / MAX_CHARGE_MS));
  const velocity = 260 + q * 160;
  const flightMs = ((2 * velocity) / GRAVITY) * 1000;
  // The spring always imparts at least half a turn; a short hop cannot
  // score as an upright zero-rotation landing.
  const rotation = Math.max(180, 360 + (q - 0.72) * 720);
  return {
    q,
    velocity,
    flightMs,
    rotation,
    angularVelocity: rotation / (flightMs / 1000),
  };
}
export function evaluateLanding(
  angle: number,
  speed: number,
  angularSpeed: number,
): Landing {
  const tilt = Math.abs(normalizedAngle(angle));
  const stability = Math.abs(Math.sin((tilt * Math.PI) / 180)) * speed;
  if (
    tilt <= 15 &&
    speed <= 405 &&
    stability <= 105 &&
    Math.abs(angularSpeed) <= 600
  )
    return "PERFECT";
  if (
    tilt <= 95 &&
    speed <= 420 &&
    stability <= 420 &&
    Math.abs(angularSpeed) <= 720
  )
    return "NICE";
  return "MISS";
}
export function landingForCharge(ms: number) {
  const l = launch(ms);
  return evaluateLanding(l.rotation, l.velocity, l.angularVelocity);
}
export function landingPoints(
  result: Landing,
  combo: number,
  fever: boolean,
  levels: Levels,
) {
  if (result === "MISS") return 0;
  return Math.round(
    (result === "PERFECT" ? 100 : 40) *
      (1 + levels.sprint * 0.2) *
      (1 + Math.min(combo, 20) * (0.1 + levels.combo * 0.05)) *
      (fever ? 2 : 1),
  );
}
export interface Action {
  at: number;
  type: "tap" | "launch";
  charge?: number;
}
export interface RunResult {
  score: number;
  power: number;
  distance: number;
  bestCombo: number;
  perfects: number;
  flips: number;
}
// Pure replay shared with the server. No client score, result, combo or multiplier is accepted.
export function replay(
  actions: Action[],
  levels: Levels = EMPTY_LEVELS,
): RunResult {
  let score = 0,
    power = 0,
    combo = 0,
    bestCombo = 0,
    feverUntil = 0,
    busyUntil = 0,
    perfects = 0,
    flips = 0,
    distance = 0;
  let last = -120;
  for (const action of actions) {
    if (
      !Number.isInteger(action.at) ||
      action.at < last + 90 ||
      action.at > 300000 ||
      action.at < busyUntil
    )
      throw new Error("Invalid action timing");
    const charge = action.charge ?? 0;
    if (action.type === "tap") {
      if (charge !== 0) throw new Error("Tap cannot contain charge");
      score += 1;
      power += tapPower(levels);
      distance += 0.35 * (1 + levels.wheel * 0.15);
    } else {
      if (
        !Number.isInteger(charge) ||
        charge < TAP_THRESHOLD_MS ||
        charge > MAX_CHARGE_MS ||
        action.at - charge < Math.max(last, busyUntil) - 2
      )
        throw new Error("Invalid charge");
      const l = launch(charge);
      const result = landingForCharge(charge);
      const landedAt = action.at + l.flightMs;
      combo = result === "MISS" ? 0 : combo + 1;
      score += landingPoints(result, combo, landedAt < feverUntil, levels);
      if (combo > 0 && combo % 5 === 0 && landedAt >= feverUntil)
        feverUntil = landedAt + FEVER_MS;
      power += Math.round(8 + l.q * 20);
      distance += 2 + l.q * 5;
      bestCombo = Math.max(bestCombo, combo);
      perfects += result === "PERFECT" ? 1 : 0;
      flips++;
      busyUntil = landedAt + recoveryMs(levels);
    }
    last = action.at;
  }
  return { score, power, distance, bestCombo, perfects, flips };
}
