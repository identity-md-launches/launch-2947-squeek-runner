import {
  addPoints,
  loadProgress,
  purchaseSkin,
  purchaseUpgrade,
  saveProgress,
  type Progress,
} from "../lib/progression";
import {
  FEVER_MS,
  MAX_CHARGE_MS,
  TAP_THRESHOLD_MS,
  launch,
  landingForCharge,
  landingPoints,
  recoveryMs,
  tapPower,
  EMPTY_LEVELS,
  type Action,
  type Landing,
  type Skin,
  type Upgrade,
} from "../shared/rules";
export type Phase = "idle" | "running" | "charging" | "airborne" | "landing";
export interface RunnerState {
  progress: Progress;
  phase: Phase;
  charge: number;
  rpm: number;
  combo: number;
  fever: number;
  paused: boolean;
  ranked: boolean;
  storageAvailable: boolean;
  result: Landing | null;
  resultPoints: number;
  message: string;
  sessionScore: number;
  sound: boolean;
  reducedMotion: boolean;
}
export type VisualEvent =
  | { type: "tap" }
  | { type: "launch"; charge: number }
  | { type: "land"; result: Landing }
  | { type: "skin"; skin: Skin }
  | { type: "pause"; paused: boolean }
  | { type: "reset" };
export class Runner {
  private state: RunnerState;
  private subscribers = new Set<() => void>();
  visuals = new Set<(event: VisualEvent) => void>();
  actions: Action[] = [];
  private now = 0;
  private pressedAt: number | null = null;
  private landAt = 0;
  private recoverAt = 0;
  private feverUntil = 0;
  private activeCharge = 0;
  private lastAction = -1000;
  private publishedAt = 0;
  private audio: AudioContext | null = null;
  private ranked = false;
  private levels() {
    return this.ranked ? EMPTY_LEVELS : this.state.progress.levels;
  }
  setRanked(ranked: boolean) {
    this.ranked = ranked;
    this.patch({ ranked });
  }
  getElapsed() {
    return Math.round(this.now);
  }
  constructor(initial?: Progress) {
    this.state = {
      progress: initial ?? loadProgress(),
      phase: "idle",
      charge: 0,
      rpm: 0,
      combo: 0,
      fever: 0,
      paused: false,
      ranked: false,
      storageAvailable: true,
      result: null,
      resultPoints: 0,
      message: "Ready when you are.",
      sessionScore: 0,
      sound: false,
      reducedMotion: false,
    };
  }
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  };
  private patch(p: Partial<RunnerState>) {
    this.state = { ...this.state, ...p };
    this.subscribers.forEach((fn) => fn());
  }
  private visual(e: VisualEvent) {
    this.visuals.forEach((fn) => fn(e));
  }
  private store(progress: Progress) {
    const saved = saveProgress(progress);
    this.patch({
      progress,
      storageAvailable: saved,
      ...(!saved
        ? {
            message:
              "Browser storage is unavailable. Keep this tab open to keep your progress.",
          }
        : {}),
    });
  }
  private points(amount: number) {
    this.store(addPoints(this.state.progress, amount));
    this.patch({ sessionScore: this.state.sessionScore + amount });
  }
  private beep(kind: "tap" | "launch" | "PERFECT" | "NICE" | "MISS") {
    if (!this.state.sound) return;
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      const freqs =
        kind === "PERFECT"
          ? [523, 659, 784, 1046]
          : kind === "NICE"
            ? [392, 523]
            : kind === "MISS"
              ? [165, 110]
              : kind === "launch"
                ? [220, 440]
                : [600];
      freqs.forEach((freq, i) => {
        const t = this.audio!.currentTime + i * 0.07,
          osc = this.audio!.createOscillator(),
          gain = this.audio!.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.025, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(this.audio!.destination);
        osc.start(t);
        osc.stop(t + 0.11);
      });
    } catch {
      this.patch({
        sound: false,
        message: "Audio is unavailable in this browser.",
      });
    }
  }
  press = () => {
    if (this.ranked && this.now >= 298000) {
      this.announce("Time to finish this ranked run. Select Finish & submit.");
      return;
    }
    if (
      this.state.paused ||
      this.pressedAt !== null ||
      ["airborne", "landing"].includes(this.state.phase) ||
      this.now - this.lastAction < 100
    )
      return;
    this.pressedAt = this.now;
    this.patch({
      phase: "running",
      rpm: Math.min(320, this.state.rpm + 24),
      result: null,
      message: "Hold to charge. Release in the bright zone.",
    });
  };
  release = () => {
    if (this.pressedAt === null || this.state.paused) return;
    const ms = Math.min(MAX_CHARGE_MS, Math.round(this.now - this.pressedAt));
    this.pressedAt = null;
    if (ms < TAP_THRESHOLD_MS) {
      this.lastAction = this.now;
      this.actions.push({ at: Math.round(this.now), type: "tap" });
      this.points(1);
      const p = this.state.progress;
      this.store({
        ...p,
        power: p.power + tapPower(this.levels()),
        distance: p.distance + 0.35 * (1 + this.levels().wheel * 0.15),
      });
      this.patch({
        phase: "running",
        charge: 0,
        message: "+1 Score. Keep those little paws moving.",
      });
      this.visual({ type: "tap" });
      this.beep("tap");
    } else this.doLaunch(ms);
  };
  tap = () => {
    this.press();
    this.release();
  };
  cancel = () => {
    this.pressedAt = null;
    if (["running", "charging"].includes(this.state.phase))
      this.patch({ phase: "running", charge: 0 });
  };
  private doLaunch(ms: number) {
    this.lastAction = this.now;
    this.activeCharge = ms;
    this.landAt = this.now + launch(ms).flightMs;
    this.actions.push({ at: Math.round(this.now), type: "launch", charge: ms });
    this.patch({
      phase: "airborne",
      charge: ms / MAX_CHARGE_MS,
      message: "Stick the landing…",
    });
    this.visual({ type: "launch", charge: ms });
    this.beep("launch");
  }
  tick(dt: number) {
    if (this.state.paused) return;
    this.now += dt;
    if (this.ranked && this.now >= 302000) {
      this.setPaused(true);
      return;
    }
    if (this.pressedAt !== null) {
      const held = this.now - this.pressedAt;
      this.state = {
        ...this.state,
        charge: Math.min(1, held / MAX_CHARGE_MS),
        phase: held >= TAP_THRESHOLD_MS ? "charging" : "running",
        rpm: Math.min(320, this.state.rpm + dt * 0.07),
      };
      if (held >= MAX_CHARGE_MS) {
        this.pressedAt = null;
        this.doLaunch(MAX_CHARGE_MS);
      }
    } else if (this.state.phase === "airborne" && this.now >= this.landAt)
      this.land();
    else if (this.state.phase === "landing" && this.now >= this.recoverAt)
      this.patch({ phase: "running", charge: 0 });
    else if (this.state.phase === "running" && this.state.rpm < 1)
      this.state = { ...this.state, phase: "idle" };
    if (this.pressedAt === null)
      this.state = {
        ...this.state,
        rpm: Math.max(0, this.state.rpm - dt * 0.008),
      };
    const fever = Math.max(0, this.feverUntil - this.now);
    if (this.now - this.publishedAt > 48) {
      this.publishedAt = this.now;
      this.patch({ fever });
    }
  }
  private land() {
    const result = landingForCharge(this.activeCharge),
      combo = result === "MISS" ? 0 : this.state.combo + 1;
    const fever = this.landAt < this.feverUntil;
    const points = landingPoints(result, combo, fever, this.levels());
    if (combo > 0 && combo % 5 === 0 && !fever)
      this.feverUntil = this.landAt + FEVER_MS;
    this.points(points);
    const p = this.state.progress,
      l = launch(this.activeCharge);
    this.store({
      ...p,
      power: p.power + Math.round(8 + l.q * 20),
      distance: p.distance + 2 + l.q * 5,
      flips: p.flips + 1,
      perfects: p.perfects + (result === "PERFECT" ? 1 : 0),
      bestCombo: Math.max(p.bestCombo, combo),
    });
    this.recoverAt = this.landAt + recoveryMs(this.levels());
    this.patch({
      phase: "landing",
      result,
      resultPoints: points,
      combo,
      fever: Math.max(0, this.feverUntil - this.now),
      message:
        result === "MISS"
          ? "Miss. Try releasing in the bright zone. Your points are safe."
          : result === "PERFECT"
            ? `Perfect landing! +${points} Score.`
            : `Nice landing! +${points} Score.`,
    });
    this.visual({ type: "land", result });
    this.beep(result);
  }
  setPaused(paused: boolean) {
    this.cancel();
    this.patch({ paused });
    this.visual({ type: "pause", paused });
  }
  setReducedMotion(reducedMotion: boolean) {
    this.patch({ reducedMotion });
  }
  toggleSound() {
    this.patch({ sound: !this.state.sound });
    if (this.state.sound) this.beep("tap");
  }
  buyUpgrade(id: Upgrade) {
    const p = purchaseUpgrade(this.state.progress, id);
    if (p) {
      this.store(p);
      this.patch({ message: "Upgrade installed. Back to the wheel!" });
      return true;
    }
    return false;
  }
  equipSkin(skin: Skin) {
    const p = purchaseSkin(this.state.progress, skin);
    if (p) {
      this.store(p);
      this.visual({ type: "skin", skin });
      this.patch({ message: "Hamster equipped." });
      return true;
    }
    return false;
  }
  announce(message: string) {
    this.patch({ message });
  }
  resetSession() {
    this.actions = [];
    this.now = 0;
    this.publishedAt = 0;
    this.activeCharge = 0;
    this.lastAction = -1000;
    this.landAt = 0;
    this.recoverAt = 0;
    this.pressedAt = null;
    this.feverUntil = 0;
    this.patch({
      phase: "idle",
      charge: 0,
      combo: 0,
      fever: 0,
      rpm: 0,
      sessionScore: 0,
      result: null,
      message: "New run. Make it a good one.",
    });
    this.visual({ type: "reset" });
  }
  destroy() {
    void this.audio?.close();
    this.subscribers.clear();
    this.visuals.clear();
  }
}
