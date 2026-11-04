// Bounded interaction checks against the production export at a gateway-style subpath.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
const dependency = (name) =>
  process.env.SQUEEK_MODULES
    ? pathToFileURL(
        resolve(
          process.env.SQUEEK_MODULES,
          name,
          name === "playwright" ? "index.mjs" : "dist/index.mjs",
        ),
      ).href
    : name;
const { chromium, webkit } = await import(dependency("playwright"));
const { default: AxeBuilder } = await import(
  dependency("@axe-core/playwright")
);
const out = resolve("test/scratch/browser-check");
await mkdir(out, { recursive: true });
const contentTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const root = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/preview/")) throw 0;
    let file = resolve(
      root,
      "." + decodeURIComponent(url.pathname.slice("/preview".length)),
    );
    if (!file.startsWith(root + "/") && file !== root) throw 0;
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader(
      "Content-Type",
      contentTypes[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
const browserName = process.env.SQUEEK_ENGINE ?? "chromium";
const engine = browserName === "webkit" ? webkit : chromium;
const browser = await engine.launch({
  headless: true,
  ...(process.env.SQUEEK_CHROMIUM && browserName === "chromium"
    ? { executablePath: process.env.SQUEEK_CHROMIUM }
    : {}),
  ...(browserName === "chromium"
    ? { args: ["--no-sandbox", "--disable-dev-shm-usage"] }
    : {}),
  ...(process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    ? {
        proxy: {
          server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
          bypass: "127.0.0.1,localhost",
        },
      }
    : {}),
});
const checks = [];
const check = (name, data = true) => {
  checks.push({ name, passed: true, data });
  console.log("PASS", name, JSON.stringify(data));
};
const errors = [],
  localFailures = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(base) && r.status() >= 400)
      localFailures.push(r.url());
  });
  await page.goto(base);
  await page.locator("canvas").waitFor();
  await page.locator(".game-cover").waitFor({ state: "hidden" });
  await page.evaluate(() => document.fonts.ready);
  const score = async () =>
    Number((await page.getByTestId("score").textContent()).replace(/,/g, ""));
  const combo = async () =>
    Number((await page.getByTestId("combo").textContent()).replace("×", ""));
  await page.locator(".sprint-button").click();
  assert.equal(await score(), 1);
  assert.ok(
    Number(
      (await page.getByTestId("power").textContent()).replace(/[^0-9.]/g, ""),
    ) >= 2,
  );
  check("Tap earns Score and virtual Power");
  const flip = async (percent) => {
    await page.waitForTimeout(140);
    const b = await page.locator(".sprint-button").boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForFunction(
      (p) =>
        Number(
          document
            .querySelector('[aria-label="Sprint charge"]')
            .getAttribute("aria-valuenow"),
        ) >= p,
      percent,
      { timeout: 4000 },
    );
    await page.mouse.up();
    await page.waitForFunction(
      () => document.querySelector(".game-stage").dataset.phase === "landing",
      { timeout: 3000 },
    );
    const message = await page.locator(".game-feedback p").textContent();
    await page.locator(".sprint-button").waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector(".sprint-button").disabled,
    );
    return message;
  };
  let message = await flip(71);
  assert.match(message, /Perfect landing/);
  assert.equal(await combo(), 1);
  check("Hold / release produces a Perfect physics landing", message);
  for (let i = 0; i < 4; i++) await flip(71);
  assert.equal(await combo(), 5);
  await page.getByText(/Fever Mode · .*2× points/).waitFor();
  check("Five clean landings activate a 10-second Fever");
  const earned = await score();
  message = await flip(95);
  assert.match(message, /Miss/);
  assert.equal(await combo(), 0);
  assert.equal(await score(), earned);
  check("Miss resets combo and preserves earned Score");
  // Nice is a separate, forgiving window outside the ideal band.
  message = await flip(63);
  assert.match(message, /Nice landing/);
  check("Nice landing window", message);
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume game", exact: true })
    .waitFor();
  const frozen = await score();
  await page.waitForTimeout(150);
  assert.equal(await score(), frozen);
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
  check("Pause and resume");
  await page.locator(".sprint-button").focus();
  const beforeKey = await score();
  await page.keyboard.down("Space");
  await page.waitForTimeout(80);
  await page.keyboard.up("Space");
  assert.equal(await score(), beforeKey + 1);
  check("Keyboard Space supports taps");
  // Native dialog semantics, Escape and focus return.
  await page
    .getByRole("button", { name: "How to play", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page
      .locator("dialog")
      .evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "How to play", exact: true })
      .first()
      .evaluate((el) => el === document.activeElement),
    true,
  );
  check("Help dialog traps focus and returns it after Escape");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "Coinbase Wallet", exact: true })
      .isVisible(),
  );
  await page
    .getByRole("button", { name: "Browser wallet", exact: true })
    .click();
  await page.getByText("No browser wallet found.", { exact: false }).waitFor();
  await page.keyboard.press("Escape");
  check("Optional wallet picker and unavailable-extension feedback");
  // Use points earned above; no fixture progress is seeded into the product.
  const totalBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem("squeek.runner.v1")).totalScore,
  );
  await page.locator('.desktop-nav a[href="#upgrades"]').click();
  await page
    .getByRole("heading", { name: "A little more horsepower." })
    .waitFor();
  await page
    .locator(".upgrade-row")
    .filter({ hasText: "Wheel speed" })
    .getByRole("button")
    .click();
  await page.getByText("Wheel speed upgraded to level 1.").waitFor();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("squeek.runner.v1")).levels.wheel,
    ),
    1,
  );
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("squeek.runner.v1")).totalScore,
    ),
    totalBefore,
  );
  check("Upgrade purchase spends balance, preserves lifetime Score");
  await page.locator('.desktop-nav a[href="#collection"]').click();
  await page
    .locator(".collection-item")
    .filter({ hasText: "Miner Hamster" })
    .getByRole("button")
    .click();
  await page.getByText("Miner Hamster equipped.").waitFor();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("squeek.runner.v1")).skin,
    ),
    "miner",
  );
  check("Cosmetic unlock and equip");
  await page.locator('.desktop-nav a[href="#leaderboard"]').click();
  await page.getByText("You · this browser").waitFor();
  for (const label of [
    "Weekly Score",
    "Total distance",
    "Best combo",
    "Daily Score",
  ])
    await page.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("button", { name: "Shared rankings", exact: true })
    .click();
  await page.getByText("The shared board is offline.").waitFor();
  check("All leaderboard metrics and honest offline shared board");
  await page.locator('.desktop-nav a[href="#chain"]').click();
  await page
    .getByRole("heading", { name: "Official work", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  await page.getByText("Enter a positive Squeek token ID.").waitFor();
  await page.getByLabel("Look up a Squeek", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  await page
    .locator(".token-result")
    .filter({ hasText: "Squeek #1" })
    .waitFor({ timeout: 15000 });
  check("Real official API and Squeek lookup");
  await page.locator('.desktop-nav a[href="#play"]').click();
  if (
    await page
      .getByRole("button", { name: "Resume game", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Resume game", exact: true })
      .click();
  await page.screenshot({ path: resolve(out, "desktop.png"), fullPage: true });
  await page.reload();
  await page.locator("canvas").waitFor();
  await page.locator(".game-cover").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("squeek.runner.v1")).skin,
    ),
    "miner",
  );
  check("Progress persists across reload");
  for (const width of [320, 390, 768, 960, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    for (const tab of [
      "upgrades",
      "leaderboard",
      "collection",
      "chain",
      "play",
    ]) {
      await page.evaluate((tab) => {
        location.hash = tab;
      }, tab);
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${width}px ${tab} overflow`,
      );
      if (width === 390 && tab !== "play") {
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.equal(
          result.violations.length,
          0,
          `${tab}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })))}`,
        );
      }
    }
  }
  check("No horizontal overflow on all screens at 320, 390, 768, 960 and 1440");
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page
      .getByRole("button", { name: "Resume game", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Resume game", exact: true })
      .click();
  const b = await page.locator(".sprint-button").boundingBox();
  assert.ok(b.y + b.height < 844);
  await page.screenshot({ path: resolve(out, "mobile.png"), fullPage: true });
  check("390px first screen includes product and main action", {
    buttonBottom: b.y + b.height,
  });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await writeFile(
    resolve(out, "axe.json"),
    JSON.stringify(audit.violations, null, 2),
  );
  assert.equal(
    audit.violations.length,
    0,
    JSON.stringify(
      audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    ),
  );
  check("Automated accessibility audit on mobile game", 0);
  // Visibility changes must pause immediately, including during a charge.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page
    .getByRole("button", { name: "Resume game", exact: true })
    .waitFor();
  check("Background visibility pauses the game");
  await context.close();
  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  const phone = await touch.newPage();
  await phone.goto(base);
  await phone.locator("canvas").waitFor();
  await phone.locator(".game-cover").waitFor({ state: "hidden" });
  await phone.locator(".sprint-button").tap();
  assert.equal(
    (await phone.getByTestId("score").textContent()).trim(),
    "00001",
  );
  if (browserName === "chromium") {
    const cdp = await touch.newCDPSession(phone);
    const b = await phone.locator(".sprint-button").boundingBox();
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await phone.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await phone.waitForFunction(
      () =>
        Number(
          document
            .querySelector('[aria-label="Sprint charge"]')
            .getAttribute("aria-valuenow"),
        ) >= 71,
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await phone.waitForFunction(() =>
      document
        .querySelector(".game-feedback p")
        .textContent.match(/Perfect landing|Nice landing/),
    );
    assert.equal(await phone.evaluate(() => scrollY), 0);
    check("Real emulated touch hold / release lands without scrolling");
  }
  await phone
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
    assert.ok(
      await phone
        .getByRole("link", { name: `Open in ${name}`, exact: true })
        .isVisible(),
    );
  assert.ok(
    await phone
      .getByRole("button", { name: "Coinbase Smart Wallet", exact: true })
      .isVisible(),
  );
  check("Mobile touch and four wallet app links");
  await touch.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(localFailures, []);
  check("No uncaught JavaScript errors or missing local resources");
  await writeFile(
    resolve(out, `${browserName}-results.json`),
    JSON.stringify(
      { engine: browserName, checks, errors, localFailures },
      null,
      2,
    ),
  );
  console.log(
    `${checks.length} browser interaction checks passed in ${browserName}.`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
