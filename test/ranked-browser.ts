import assert from "node:assert/strict";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { chromium } from "playwright";
import { createApp } from "../server/app";
const db = new PGlite();
await db.exec(
  await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
);
const pool = {
  query: (...args: Parameters<PGlite["query"]>) => db.query(...args),
  connect: async () => ({
    query: (...args: Parameters<PGlite["query"]>) => db.query(...args),
    release: () => {},
  }),
} as unknown as Pool;
const options = { origin: "" };
const app = createApp(pool, options);
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const root = resolve("test/scratch/ranked-dist");
const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/api")) {
    app(req, res);
    return;
  }
  try {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (!path.startsWith("/preview/")) throw 0;
    let file = resolve(
      root,
      "." + decodeURIComponent(path.slice("/preview".length)),
    );
    if (!file.startsWith(root + "/")) {
      if (file === root) file = resolve(root, "index.html");
      else throw 0;
    }
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
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
options.origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const proxyServer = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
const browser = await chromium.launch({
  ...(process.env.SQUEEK_CHROMIUM
    ? { executablePath: process.env.SQUEEK_CHROMIUM }
    : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  ...(proxyServer
    ? {
        proxy: {
          server: proxyServer,
          bypass: "127.0.0.1,localhost",
        },
      }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: "reduce",
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(options.origin + "/preview/");
  await page.locator("canvas").waitFor();
  await page.locator(".game-cover").waitFor({ state: "hidden" });
  await page.locator(".sprint-button").click();
  await page.waitForTimeout(900);
  await page
    .getByRole("button", { name: "Start ranked run", exact: true })
    .click();
  await page.getByRole("heading", { name: /Ranked run · Runner/ }).waitFor();
  assert.equal(
    (await page.getByTestId("score").textContent())?.trim(),
    "00000",
  );
  await page.locator(".sprint-button").click();
  await page.waitForTimeout(150);
  const b = (await page.locator(".sprint-button").boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForFunction(
    () =>
      Number(
        document
          .querySelector('[aria-label="Sprint charge"]')
          ?.getAttribute("aria-valuenow"),
      ) >= 71,
  );
  await page.mouse.up();
  await page.waitForFunction(() =>
    /Perfect landing|Nice landing/.test(
      document.querySelector(".game-feedback p")?.textContent ?? "",
    ),
  );
  await page.waitForFunction(
    () =>
      !(document.querySelector(".sprint-button") as HTMLButtonElement).disabled,
  );
  const expected = Number(
    (await page.getByTestId("score").textContent())!.replace(/,/g, ""),
  );
  assert.ok(expected >= 40);
  await page
    .getByRole("button", { name: "Finish & submit", exact: true })
    .click();
  await page
    .getByText(`Run verified: ${expected} Score. Check shared rankings.`)
    .waitFor();
  const result = await db.query<{
    score: number;
    flips: number;
    perfects: number;
  }>("SELECT score,flips,perfects FROM players");
  assert.equal(Number(result.rows[0].score), expected);
  assert.equal(result.rows[0].flips, 1);
  assert.equal((await db.query("SELECT * FROM scores")).rows.length, 1);
  await page.locator('.desktop-nav a[href="#leaderboard"]').click();
  await page
    .getByRole("button", { name: "Shared rankings", exact: true })
    .click();
  await page.locator(".board-table").filter({ hasText: "Runner " }).waitFor();
  assert.equal(await page.locator(".board-table tbody tr").count(), 1);
  assert.deepEqual(errors, []);
  await mkdir("test/scratch/browser-check", { recursive: true });
  await writeFile(
    "test/scratch/browser-check/ranked-results.json",
    JSON.stringify(
      {
        passed: true,
        engine: "chromium",
        database: "PGlite embedded PostgreSQL",
        validatedScore: expected,
        savedRuns: 1,
        sharedRankingRows: 1,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ranked UI: starts with a secure session, validates ${expected} points, persists PostgreSQL progression and displays one shared ranking.`,
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await db.close();
}
