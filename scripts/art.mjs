// Original pixel art. No downloaded artwork or runtime image services.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
mkdirSync("public/assets", { recursive: true });
const crc = (b) => {
  let c = 0xffffffff;
  for (const v of b) {
    c ^= v;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, b) => {
  const t = Buffer.from(type),
    n = Buffer.alloc(4),
    c = Buffer.alloc(4);
  n.writeUInt32BE(b.length);
  c.writeUInt32BE(crc(Buffer.concat([t, b])));
  return Buffer.concat([n, t, b, c]);
};
function canvas(w, h) {
  const data = Buffer.alloc(w * h * 4);
  const px = (x, y, c) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    data[i] = parseInt(c.slice(1, 3), 16);
    data[i + 1] = parseInt(c.slice(3, 5), 16);
    data[i + 2] = parseInt(c.slice(5, 7), 16);
    data[i + 3] = 255;
  };
  const rect = (x, y, rw, rh, c) => {
    for (let j = 0; j < rh; j++)
      for (let i = 0; i < rw; i++) px(x + i, y + j, c);
  };
  const ellipse = (x, y, rx, ry, c) => {
    for (let j = -ry; j <= ry; j++)
      for (let i = -rx; i <= rx; i++)
        if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) px(x + i, y + j, c);
  };
  const line = (x1, y1, x2, y2, c, t = 1) => {
    const d = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= d; i++)
      rect(x1 + ((x2 - x1) * i) / d, y1 + ((y2 - y1) * i) / d, t, t, c);
  };
  const save = (p) => {
    const head = Buffer.alloc(13);
    head.writeUInt32BE(w);
    head.writeUInt32BE(h, 4);
    head[8] = 8;
    head[9] = 6;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++)
      data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    writeFileSync(
      p,
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", head),
        chunk("IDAT", deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
      ]),
    );
  };
  return { w, h, data, px, rect, ellipse, line, save };
}
const skins = {
  classic: ["#c89052", "#f1cd91", "#fff0cb", "#e9a0a1"],
  miner: ["#b78955", "#dfba85", "#fff0cb", "#e9a0a1"],
  golden: ["#b87b24", "#eebd45", "#fff0a2", "#eb9f6a"],
  cyber: ["#408e82", "#7cc9b2", "#d9f8cf", "#e193be"],
  squeektoshi: ["#706485", "#aaa0c4", "#e8ddf7", "#e7a4b7"],
};
const anims = [
  ["idle", 4],
  ["run", 6],
  ["fast", 6],
  ["charge", 4],
  ["jump", 2],
  ["rotate", 4],
  ["land", 3],
  ["perfect", 4],
  ["fail", 4],
  ["fever", 6],
];
const frames = {};
let frame = 0;
for (const [name, n] of anims) {
  frames[name] = { start: frame, end: frame + n - 1 };
  frame += n;
}
let classicPortrait;
for (const [skin, [dark, fur, cream, pink]] of Object.entries(skins)) {
  const c = canvas(12 * 48, Math.ceil(frame / 12) * 40);
  for (let i = 0; i < frame; i++) {
    const ox = (i % 12) * 48,
      oy = Math.floor(i / 12) * 40;
    const name = Object.keys(frames).find(
        (k) => i >= frames[k].start && i <= frames[k].end,
      ),
      f = i - frames[name].start;
    const run = ["run", "fast", "fever"].includes(name),
      crouch = name === "charge" || (name === "land" && f === 0),
      air = ["jump", "rotate"].includes(name),
      happy = ["perfect", "fever"].includes(name);
    const bob = run ? f % 2 : name === "idle" && f === 3 ? 1 : 0,
      by = crouch
        ? 3
        : air
          ? f % 2
          : name === "perfect"
            ? f % 3 === 1
              ? -2
              : 0
            : name === "fail"
              ? f % 2
              : bob;
    const r = (x, y, w, h, col) => c.rect(ox + x, oy + y + by, w, h, col);
    const e = (x, y, rx, ry, col) =>
      c.ellipse(ox + x, oy + y + by, rx, ry, col);
    // Small stepped silhouettes with a dark warm outline.
    e(10, 25, 4, 3, "#342e27");
    e(10, 24, 3, 2, pink);
    e(24, 23, 15, crouch ? 10 : 12, "#292b23");
    e(24, 22, 14, crouch ? 9 : 11, dark);
    e(25, 20, 13, crouch ? 8 : 10, fur);
    e(19, 16, 8, 4, cream);
    e(32, 13, 7, 8, "#292b23");
    e(31, 12, 6, 7, dark);
    e(32, 12, 4, 5, pink);
    r(30, 9, 3, 3, "#f4c5b4");
    e(20, 11, 5, 6, "#292b23");
    e(20, 11, 4, 5, fur);
    e(20, 10, 2, 3, pink);
    e(33, 24, 9, 9, "#292b23");
    e(33, 23, 8, 8, fur);
    e(35, 27, 7, 5, cream);
    e(26, 28, 7, 5, cream);
    r(23, 25, 4, 2, "#fff4d4");
    if (name === "fail") {
      r(33, 18, 2, 2, "#242a23");
      r(36, 21, 2, 2, "#242a23");
      r(36, 18, 2, 2, "#242a23");
      r(33, 21, 2, 2, "#242a23");
    } else if (happy || (name === "idle" && f === 2)) {
      r(33, 18, 5, 2, "#202720");
      r(32, 20, 2, 2, "#202720");
      r(37, 20, 2, 2, "#202720");
    } else {
      r(33, 17, 5, 6, "#202720");
      r(34, 17, 2, 2, "#ffffff");
      r(34, 22, 3, 1, "#573d2b");
    }
    r(40, 23, 3, 2, pink);
    r(39, 25, 2, 1, "#684b37");
    r(39, 27, 2, 1, "#684b37");
    r(30, 25, 4, 2, pink);
    r(42, 27, 3, 1, "#c39c6d");
    r(41, 29, 4, 1, "#c39c6d");
    if (air) {
      r(16 - (f % 2), 29, 4, 4, pink);
      r(34, 30 - (f % 2), 5, 3, pink);
    } else {
      const leg = run ? [-2, 0, 2, 1, -1, 0][f % 6] : 0;
      r(15 + leg, 32, 7, 3, "#332d25");
      r(16 + leg, 32, 5, 2, pink);
      r(29 - leg, 32, 8, 3, "#332d25");
      r(30 - leg, 32, 6, 2, pink);
    }
    if (name === "perfect") {
      r(18, 23 - (f % 2), 4, 3, pink);
      r(38, 28, 3, 2, "#684b37");
    }
    if (name === "fail" && f % 2) {
      r(33, 25, 2, 3, "#8ad1d3");
    }
    if (name === "charge") {
      r(12, 21, 2, 5, cream);
      r(10 - (f % 2), 19, 2, 2, "#d5ff75");
    }
    if (skin === "miner") {
      r(25, 7, 14, 4, "#b88522");
      r(27, 4, 10, 4, "#eec14b");
      r(23, 11, 18, 3, "#eec14b");
      r(33, 7, 4, 4, "#ffffcd");
    }
    if (skin === "cyber") {
      r(31, 17, 9, 5, "#173d37");
      r(32, 18, 7, 2, "#8cffd3");
      r(11, 20, 3, 8, "#80ffbf");
    }
    if (skin === "squeektoshi") {
      r(13, 25, 9, 2, "#201d31");
      r(14, 27, 8, 4, "#433b55");
      r(17, 14, 3, 3, "#c6ff84");
    }
  }
  c.save(`public/assets/hamster-${skin}.png`);
  // Static preview frame, also derived from the original sprite sheet.
  const p = canvas(48, 40);
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 48; x++) {
      const i = (y * c.w + x) * 4,
        j = (y * 48 + x) * 4;
      c.data.copy(p.data, j, i, i + 4);
    }
  p.save(`public/assets/portrait-${skin}.png`);
  if (skin === "classic") classicPortrait = p;
}
writeFileSync("src/game/frames.json", JSON.stringify(frames, null, 2) + "\n");
// Share card uses the same original hamster, a block-letter wordmark and wheel.
const s = canvas(1200, 630);
s.rect(0, 0, 1200, 630, "#0b100e");
s.rect(40, 40, 1120, 550, "#111c15");
for (let a = 0; a < 360; a += 1) {
  const r = (a * Math.PI) / 180;
  for (let k = 0; k < 12; k++)
    s.rect(
      830 + Math.cos(r) * (185 + k),
      310 + Math.sin(r) * (185 + k),
      4,
      4,
      "#80e969",
    );
}
for (let y = 0; y < 40; y++)
  for (let x = 0; x < 48; x++) {
    const i = (y * 48 + x) * 4;
    if (classicPortrait.data[i + 3])
      s.rect(
        710 + x * 5,
        275 + y * 5,
        5,
        5,
        "#" + classicPortrait.data.subarray(i, i + 3).toString("hex"),
      );
  }
const glyphs = {
  S: ["11111", "10000", "10000", "11111", "00001", "00001", "11111"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
};
function text(t, x, y, scale, color) {
  for (const l of t) {
    const g = glyphs[l];
    if (g)
      for (let j = 0; j < 7; j++)
        for (let i = 0; i < 5; i++)
          if (g[j][i] === "1")
            s.rect(x + i * scale, y + j * scale, scale, scale, color);
    x += 6 * scale;
  }
}
text("SQUEEK", 100, 190, 12, "#a2f477");
text("RUNNER", 100, 300, 12, "#eff2e5");
s.rect(100, 430, 270, 10, "#5b8e4a");
s.save("public/share.png");
writeFileSync(
  "public/favicon.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="5" fill="#0b100e"/><path fill="#a2f477" d="M6 6h6v6h8V6h6v10h2v10H4V16h2z"/><path fill="#17291b" d="M9 17h4v4H9zm10 0h4v4h-4zm-5 7h4v3h-4z"/></svg>',
);
console.log(
  `Generated ${frame} frames × ${Object.keys(skins).length} original hamster skins, portraits, favicon and share card.`,
);
