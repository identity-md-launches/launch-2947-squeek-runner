import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import frames from "../src/game/frames.json";

test("all five original sheets have distinct frames for every required animation", async () => {
  for (const skin of ["classic", "miner", "golden", "cyber", "squeektoshi"]) {
    const png = await readFile(
      new URL(`../public/assets/hamster-${skin}.png`, import.meta.url),
    );
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    const width = png.readUInt32BE(16),
      height = png.readUInt32BE(20),
      parts: Buffer[] = [];
    let offset = 8;
    while (offset < png.length) {
      const size = png.readUInt32BE(offset),
        type = png.subarray(offset + 4, offset + 8).toString();
      if (type === "IDAT")
        parts.push(png.subarray(offset + 8, offset + 8 + size));
      offset += 12 + size;
    }
    assert.equal(width, 576);
    assert.equal(height, 160);
    const pixels = inflateSync(Buffer.concat(parts)),
      stride = width * 4 + 1;
    const hashFrame = (frame: number) => {
      const hash = createHash("sha256");
      for (let y = 0; y < 40; y++) {
        const row = Math.floor(frame / 12) * 40 + y,
          x = (frame % 12) * 48;
        assert.equal(pixels[row * stride], 0);
        hash.update(
          pixels.subarray(
            row * stride + 1 + x * 4,
            row * stride + 1 + (x + 48) * 4,
          ),
        );
      }
      return hash.digest("hex");
    };
    for (const [name, { start, end }] of Object.entries(frames)) {
      const hashes = new Set(
        Array.from({ length: end - start + 1 }, (_, i) => hashFrame(start + i)),
      );
      assert.ok(
        hashes.size >= 2,
        `${skin} ${name} must actually change pixels between frames`,
      );
    }
  }
});
