import Phaser from "phaser";
import { Runner, type VisualEvent } from "./Runner";
import { GRAVITY, launch, type Skin } from "../shared/rules";
import frames from "./frames.json";
const CX = 480,
  CY = 246,
  HOME = 350;
export class MiningScene extends Phaser.Scene {
  private runner: Runner;
  private hamster!: Phaser.Physics.Arcade.Sprite;
  private wheel!: Phaser.GameObjects.Graphics;
  private wheelRotation = 0;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private gauge!: Phaser.GameObjects.Graphics;
  private bulbs!: Phaser.GameObjects.Graphics;
  private result!: Phaser.GameObjects.Text;
  private skin: Skin = "classic";
  private launchCharge = 0;
  private flightElapsed = 0;
  private offVisual?: () => void;
  private assetFailed = false;
  constructor(
    runner: Runner,
    private ready?: () => void,
    private failed?: () => void,
  ) {
    super("Mining");
    this.runner = runner;
  }
  preload() {
    this.load.once("loaderror", () => {
      this.assetFailed = true;
      this.failed?.();
    });
    for (const skin of ["classic", "miner", "golden", "cyber", "squeektoshi"])
      this.load.spritesheet(
        skin,
        `${import.meta.env.BASE_URL}assets/hamster-${skin}.png`,
        { frameWidth: 48, frameHeight: 40 },
      );
  }
  create() {
    if (this.assetFailed) return;
    this.cameras.main.setBackgroundColor("#101b15");
    this.background();
    this.wheel = this.add.graphics().setDepth(3);
    this.drawWheel();
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x394b38);
    g.fillRect(451, 389, 58, 44);
    g.fillStyle(0x18281d);
    g.fillRect(458, 389, 44, 34);
    g.fillStyle(0x718262);
    g.fillRect(407, 429, 146, 10);
    g.fillStyle(0xa6db67);
    g.fillRect(416, 429, 128, 3);
    g.fillStyle(0x617454);
    g.fillRect(300, 417, 360, 7);
    g.fillStyle(0x263b2a);
    g.fillRect(306, 424, 348, 20);
    for (let x = 312; x < 650; x += 24) {
      g.fillStyle(0x87974e);
      g.fillRect(x, 435, 12, 5);
    }
    g.fillStyle(0x132019);
    g.fillRect(343, 445, 274, 8);
    this.skin = this.runner.getSnapshot().progress.skin;
    for (const skin of ["classic", "miner", "golden", "cyber", "squeektoshi"])
      for (const [name, range] of Object.entries(frames))
        this.anims.create({
          key: `${skin}-${name}`,
          frames: this.anims.generateFrameNumbers(skin, {
            start: range.start,
            end: range.end,
          }),
          frameRate:
            name === "idle" ? 4 : name === "fast" || name === "fever" ? 18 : 10,
          repeat: ["land", "perfect", "fail"].includes(name) ? 0 : -1,
        });
    this.hamster = this.physics.add
      .sprite(CX, HOME, this.skin)
      .setScale(2.8)
      .setDepth(6);
    this.hamster.body!.enable = false;
    this.hamster.play(`${this.skin}-idle`);
    const p = this.make.graphics({ x: 0, y: 0 });
    p.fillStyle(0xc2ff7c);
    p.fillRect(0, 0, 4, 4);
    p.generateTexture("spark", 4, 4);
    p.destroy();
    this.sparks = this.add
      .particles(0, 0, "spark", {
        speed: { min: 30, max: 180 },
        angle: { min: 190, max: 350 },
        lifespan: 650,
        gravityY: 150,
        scale: { start: 1.6, end: 0 },
        emitting: false,
      })
      .setDepth(8);
    this.gauge = this.add.graphics().setDepth(7);
    this.bulbs = this.add.graphics().setDepth(3);
    this.result = this.add
      .text(CX, 105, "", {
        fontFamily: "Silkscreen",
        fontSize: "28px",
        color: "#c0fa8c",
        align: "center",
        stroke: "#102017",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(9);
    this.input.on("pointerdown", () => this.runner.press());
    this.input.on("pointerup", () => this.runner.release());
    this.input.on("pointerupoutside", () => this.runner.release());
    const fn = (event: VisualEvent) => this.onVisual(event);
    this.runner.visuals.add(fn);
    this.offVisual = () => this.runner.visuals.delete(fn);
    this.scale.on("resize", () => this.resize());
    this.resize();
    this.events.once("shutdown", () => this.offVisual?.());
    this.game.canvas.setAttribute("aria-hidden", "true");
    this.ready?.();
  }
  private resize() {
    const { width, height } = this.scale;
    if (!width || !height) return;
    const zoom = Math.max(width / 960, height / 460);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(CX, 258);
  }
  private background() {
    const g = this.add.graphics();
    // Deep brickwork, crossbeams and an excavated lower wall.
    g.fillStyle(0x111c16);
    g.fillRect(-500, -200, 2000, 1000);
    for (let y = 0; y < 448; y += 40) {
      for (let x = -80; x < 1040; x += 80) {
        const shift = (y / 40) % 2 ? 40 : 0;
        g.fillStyle((x + y) % 3 ? 0x17241b : 0x18271d);
        g.fillRect(x + shift + 2, y + 2, 76, 36);
        g.fillStyle(0x1d2d20);
        g.fillRect(x + shift + 3, y + 3, 72, 2);
      }
    }
    // Cable run along the ceiling.
    g.fillStyle(0x283b2b);
    g.fillRect(0, 20, 960, 14);
    g.fillStyle(0x364c32);
    g.fillRect(0, 20, 960, 3);
    g.fillStyle(0x0c1711);
    g.fillRect(200, 20, 10, 67);
    g.fillRect(752, 20, 10, 67);
    for (const x of [130, 790]) {
      g.fillStyle(0x35442f);
      g.fillRect(x, 44, 46, 11);
      g.fillStyle(0x5e7d42);
      g.fillRect(x + 4, 55, 38, 8);
      g.fillStyle(0xcede8a);
      g.fillRect(x + 9, 63, 28, 5);
      g.fillStyle(0xc8ee75, 0.025);
      g.fillTriangle(x + 8, 70, x - 76, 328, x + 122, 328);
    }
    // Vertical pipes, small junction boxes and an inspection window.
    for (const x of [58, 884]) {
      g.fillStyle(0x314230);
      g.fillRect(x, 25, 18, 415);
      g.fillStyle(0x46553a);
      g.fillRect(x + 2, 25, 4, 415);
      for (let y = 60; y < 440; y += 90) {
        g.fillStyle(0x536147);
        g.fillRect(x - 3, y, 24, 9);
        g.fillStyle(0x1b2c21);
        g.fillRect(x - 3, y + 7, 24, 3);
      }
    }
    g.fillStyle(0x334631);
    g.fillRect(112, 154, 118, 102);
    g.fillStyle(0x0b1711);
    g.fillRect(118, 160, 106, 90);
    g.fillStyle(0x26442c);
    g.fillRect(126, 172, 90, 53);
    g.fillStyle(0x81a956);
    g.fillRect(132, 210, 9, 8);
    g.fillRect(145, 198, 9, 20);
    g.fillRect(158, 202, 9, 16);
    g.fillRect(171, 184, 9, 34);
    g.fillRect(184, 192, 9, 26);
    g.fillRect(197, 176, 9, 42);
    g.fillStyle(0x859772);
    g.fillRect(128, 236, 48, 3);
    g.fillStyle(0x9ce66c);
    g.fillRect(204, 234, 7, 7);
    g.fillStyle(0x314330);
    g.fillRect(724, 171, 108, 120);
    g.fillStyle(0x101b14);
    g.fillRect(730, 177, 96, 108);
    for (let y = 187; y < 254; y += 13) {
      g.fillStyle(0x263b29);
      g.fillRect(740, y, 76, 5);
    }
    g.fillStyle(0x8dc96a);
    g.fillRect(740, 266, 6, 6);
    g.fillStyle(0x45563b);
    g.fillRect(752, 267, 57, 3);
    // Cables winding into the wheel generator.
    g.lineStyle(7, 0x0c1711);
    g.strokePoints(
      [
        { x: 229, y: 246 },
        { x: 258, y: 246 },
        { x: 258, y: 418 },
        { x: 342, y: 418 },
      ],
      false,
    );
    g.lineStyle(2, 0x536346);
    g.strokePoints(
      [
        { x: 229, y: 246 },
        { x: 258, y: 246 },
        { x: 258, y: 418 },
        { x: 342, y: 418 },
      ],
      false,
    );
    g.fillStyle(0x0b150f);
    g.fillRect(-500, 453, 2000, 200);
    g.fillStyle(0x3e5733);
    g.fillRect(-500, 451, 2000, 5);
    g.fillStyle(0x8eb960);
    g.fillRect(-500, 451, 2000, 2);
    for (let y = 470; y < 600; y += 24) {
      g.fillStyle(0x19281b);
      g.fillRect(-200, y, 1400, 2);
    }
    for (let x = 0; x < 960; x += 75) {
      g.fillStyle(0x1c2d1f);
      g.fillRect(x, 457, 2, 150);
    }
    // Mining crates and scattered green ore.
    for (const [x, y, w, h] of [
      [110, 375, 76, 72],
      [180, 408, 52, 39],
      [755, 389, 71, 59],
    ]) {
      g.fillStyle(0x253323);
      g.fillRect(x, y, w, h);
      g.lineStyle(4, 0x526044);
      g.strokeRect(x + 3, y + 3, w - 6, h - 6);
      g.lineBetween(x + 7, y + 7, x + w - 7, y + h - 7);
      g.lineBetween(x + w - 7, y + 7, x + 7, y + h - 7);
      g.fillStyle(0x79835a);
      g.fillRect(x + 5, y + 5, 4, 4);
    }
    for (const [x, y] of [
      [270, 445],
      [690, 442],
      [708, 449],
      [94, 451],
      [850, 447],
    ]) {
      g.fillStyle(0x416d37);
      g.fillRect(x, y - 6, 16, 6);
      g.fillRect(x + 4, y - 11, 9, 5);
      g.fillStyle(0x90c966);
      g.fillRect(x + 5, y - 10, 4, 6);
    }
    const style = {
      fontFamily: "Silkscreen",
      fontSize: "12px",
      color: "#8aa079",
    };
    this.add.text(33, 100, "SECTOR 07", style);
    this.add.text(786, 332, "POWER\nSTATION", style).setLineSpacing(5);
    this.add
      .text(CX, 47, "THE NIGHT SHIFT", {
        ...style,
        color: "#8fa580",
        fontSize: "14px",
      })
      .setOrigin(0.5);
  }
  private drawWheel() {
    const g = this.wheel;
    g.clear();
    // Stepped ring silhouette, sampled on a 4px grid for a true pixel edge.
    for (let y = -168; y <= 168; y += 4)
      for (let x = -168; x <= 168; x += 4) {
        const r = Math.sqrt(x * x + y * y);
        let color = 0;
        if (r >= 155 && r < 168) color = 0x283f29;
        else if (r >= 148 && r < 155) color = 0x82985a;
        else if (r >= 140 && r < 148) color = 0x354d30;
        else if (r >= 136 && r < 140) color = 0xa5d977;
        if (color) {
          g.fillStyle(color);
          g.fillRect(CX + x, CY + y, 4, 4);
        }
      }
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16 + this.wheelRotation;
      const x = CX + Math.cos(a) * 145,
        y = CY + Math.sin(a) * 145;
      g.fillStyle(i % 4 === 0 ? 0xc1e78a : 0x5a7543);
      g.fillRect(Math.round(x / 4) * 4 - 3, Math.round(y / 4) * 4 - 3, 6, 6);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + this.wheelRotation;
      g.lineStyle(5, 0x354e31, 0.8);
      g.lineBetween(
        CX + Math.cos(a) * 23,
        CY + Math.sin(a) * 23,
        CX + Math.cos(a) * 135,
        CY + Math.sin(a) * 135,
      );
      g.lineStyle(2, 0x526a3e);
      g.lineBetween(
        CX + Math.cos(a) * 30,
        CY + Math.sin(a) * 30,
        CX + Math.cos(a) * 130,
        CY + Math.sin(a) * 130,
      );
    }
    g.fillStyle(0x243925);
    g.fillCircle(CX, CY, 23);
    g.lineStyle(4, 0x779351);
    g.strokeCircle(CX, CY, 22);
    g.fillStyle(0x91be65);
    g.fillRect(CX - 7, CY - 7, 14, 14);
    g.fillStyle(0x405b35);
    g.fillRect(CX - 3, CY - 3, 6, 6);
  }
  private onVisual(event: VisualEvent) {
    if (event.type === "reset") {
      this.hamster.body!.enable = false;
      this.hamster.setVelocity(0, 0).setPosition(CX, HOME).setAngle(0);
      this.result.setText("");
      this.flightElapsed = 0;
      return;
    }
    if (event.type === "skin") {
      this.skin = event.skin;
      this.hamster.setTexture(this.skin);
      return;
    }
    if (event.type === "pause") {
      if (event.paused) this.physics.pause();
      else this.physics.resume();
      return;
    }
    const reduced = this.runner.getSnapshot().reducedMotion;
    if (event.type === "tap") {
      if (!reduced) this.sparks.explode(4, CX - 40, HOME + 35);
    }
    if (event.type === "launch") {
      const l = launch(event.charge);
      this.launchCharge = event.charge;
      this.flightElapsed = 0;
      this.hamster.body!.enable = true;
      this.hamster.setVelocity(0, -l.velocity).setGravityY(GRAVITY);
      this.hamster.play(`${this.skin}-jump`, true);
      this.result.setText("");
      if (!reduced) this.sparks.explode(15, CX, HOME + 35);
    }
    if (event.type === "land") {
      this.hamster.setVelocity(0, 0);
      this.hamster.body!.enable = false;
      this.hamster
        .setPosition(CX, HOME)
        .setAngle(event.result === "MISS" ? 65 : 0);
      this.hamster.play(
        `${this.skin}-${event.result === "MISS" ? "fail" : event.result === "PERFECT" ? "perfect" : "land"}`,
        true,
      );
      this.result
        .setText(event.result === "MISS" ? "TRY AGAIN" : `${event.result}!`)
        .setColor(event.result === "MISS" ? "#f0b181" : "#c0fa8c");
      if (!reduced) {
        this.sparks.explode(
          event.result === "PERFECT" ? 42 : 12,
          CX,
          HOME + 35,
        );
        if (event.result === "PERFECT") this.cameras.main.shake(100, 0.002);
      }
    }
  }
  update(_time: number, delta: number) {
    if (!this.hamster) return;
    this.runner.tick(Math.min(delta, 40));
    const s = this.runner.getSnapshot();
    const effectiveRpm =
      s.rpm * (1 + (s.ranked ? 0 : s.progress.levels.wheel) * 0.15);
    if (s.paused) {
      this.hamster.anims.pause();
      return;
    }
    this.hamster.anims.resume();
    if (s.phase === "airborne") {
      this.flightElapsed += Math.min(delta, 40);
      const l = launch(this.launchCharge);
      const t = Math.min(1, this.flightElapsed / l.flightMs);
      this.hamster.setAngle(l.rotation * t);
      if (t > 0.18) this.hamster.play(`${this.skin}-rotate`, true);
    } else if (s.phase !== "landing") {
      this.hamster.setAngle(0).setPosition(CX, HOME);
      const anim =
        s.phase === "charging"
          ? "charge"
          : s.fever > 0
            ? "fever"
            : effectiveRpm > 150
              ? "fast"
              : s.rpm > 1
                ? "run"
                : "idle";
      this.hamster.play(`${this.skin}-${anim}`, true);
      this.hamster.anims.timeScale =
        s.reducedMotion && anim === "idle"
          ? 0
          : Math.max(0.6, Math.min(2, effectiveRpm / 90));
      if (s.result && s.phase === "running" && s.charge === 0)
        this.result.setText(
          `${s.result === "MISS" ? "TRY AGAIN" : s.result + "!"}`,
        );
      else if (!s.result) this.result.setText("");
    }
    if (!s.reducedMotion && s.rpm > 0) {
      this.wheelRotation += (delta * effectiveRpm) / 120000;
      this.drawWheel();
    }
    this.gauge.clear();
    this.bulbs.clear();
    for (let i = 0; i < 5; i++) {
      this.bulbs.fillStyle(
        i < s.combo % 5 || s.fever > 0 ? 0xb5f078 : 0x34452b,
      );
      this.bulbs.fillRect(432 + i * 21, 70, 12, 5);
    }
    if (s.phase === "charging") {
      this.gauge.fillStyle(0x0c1711);
      this.gauge.fillRect(CX - 65, HOME + 57, 130, 10);
      this.gauge.fillStyle(0x718b48);
      this.gauge.fillRect(CX - 63, HOME + 59, 126 * s.charge, 6);
      this.gauge.fillStyle(0xc6ff7d);
      this.gauge.fillRect(CX - 63 + 126 * 0.7, HOME + 57, 7, 10);
      if (!s.reducedMotion && Math.random() < 0.25)
        this.sparks.explode(1, CX - 38, HOME + 20);
    }
    if (s.fever > 0 && !s.reducedMotion && Math.random() < 0.18)
      this.sparks.explode(2, 310 + Math.random() * 340, 390);
  }
}
