import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.SQUEEK_MODULES
    ? pathToFileURL(resolve(process.env.SQUEEK_MODULES, "playwright/index.mjs"))
        .href
    : "playwright"
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const root = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    let file = resolve(
      root,
      "." +
        new URL(req.url, "http://localhost").pathname.replace(/^\/preview/, ""),
    );
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
const browser = await chromium.launch({
  ...(process.env.SQUEEK_CHROMIUM
    ? { executablePath: process.env.SQUEEK_CHROMIUM }
    : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const checks = [];
const pass = (name) => {
  checks.push({ name, passed: true });
  console.log("PASS", name);
};
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.clock.install();
  let mode = "loading",
    requests = 0,
    release;
  const blocked = new Promise((r) => (release = r));
  await page.route("https://api.squeekchain.com/**", async (route) => {
    requests++;
    if (mode === "loading") await blocked;
    if (mode === "rate")
      return route.fulfill({
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "120",
          "Access-Control-Allow-Origin": "*",
        },
        body: "{}",
      });
    return route.fulfill({
      status: mode === "schema" ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ schemaVersion: 0, status: "unavailable" }),
    });
  });
  await page.goto(base + "#chain");
  await page.getByText("Loading…", { exact: true }).first().waitFor();
  mode = "offline";
  release();
  await page
    .getByText("Chain data is unavailable. Try again shortly.", {
      exact: false,
    })
    .waitFor();
  assert.match(
    await page.locator(".block-display").textContent(),
    /Unavailable/,
  );
  pass("Official data loading and unavailable states show no invented values");
  mode = "schema";
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await page
    .getByText("This reading is unavailable or has an unsupported format.", {
      exact: false,
    })
    .waitFor();
  pass("Unsupported official schema is recoverable and visibly unavailable");
  mode = "rate";
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await page.getByText("The official API is busy.", { exact: false }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Refresh data", exact: true })
      .isDisabled(),
    true,
  );
  const before = requests;
  await page.clock.fastForward(31000);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(requests, before);
  await page.clock.fastForward(90000);
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(requests > before);
  pass(
    "HTTP 429 respects Retry-After instead of normal polling; verified with a virtual clock",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenCount = requests;
  await page.clock.fastForward(121000);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(requests, hiddenCount);
  pass("Official polling stops when the document is hidden");
  await context.close();
  const storage = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await storage.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  const blockedPage = await storage.newPage();
  await blockedPage.route("https://api.squeekchain.com/**", (r) => r.abort());
  await blockedPage.goto(base);
  await blockedPage.locator(".game-cover").waitFor({ state: "hidden" });
  await blockedPage.locator(".sprint-button").click();
  await blockedPage
    .getByText("Progress could not be saved.", { exact: false })
    .waitFor();
  assert.equal(
    (await blockedPage.getByTestId("score").textContent()).trim(),
    "00001",
  );
  pass(
    "Unavailable browser storage preserves the active game and shows a persistent notice",
  );
  await storage.close();
  const wallet = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await wallet.addInitScript(() => {
    // A test EIP-1193 provider, never included in the product. No keys or signing.
    const address = "0x8342a3f35fdd8d2696005b2d101374f9eb10daf7";
    let authorized = false,
      chain = "0x" + (1).toString(16);
    const listeners = new Map();
    window.__walletCalls = [];
    const provider = {
      isMetaMask: true,
      on: (name, fn) => {
        const a = listeners.get(name) ?? [];
        a.push(fn);
        listeners.set(name, a);
      },
      removeListener: (name, fn) =>
        listeners.set(
          name,
          (listeners.get(name) ?? []).filter((x) => x !== fn),
        ),
      request: async ({ method, params }) => {
        window.__walletCalls.push(method);
        if (method === "eth_chainId") return chain;
        if (method === "eth_accounts") return authorized ? [address] : [];
        if (method === "eth_requestAccounts") {
          authorized = true;
          return [address];
        }
        if (method === "wallet_requestPermissions")
          return [{ parentCapability: "eth_accounts" }];
        if (method === "wallet_switchEthereumChain") {
          chain = params[0].chainId;
          for (const fn of listeners.get("chainChanged") ?? []) fn(chain);
          return null;
        }
        throw Object.assign(new Error("Unsupported test-provider method"), {
          code: 4200,
        });
      },
    };
    window.ethereum = provider;
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid: "b1ea9044-102a-4716-8ab7-302c180bbc19",
              name: "MetaMask (test provider)",
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
              rdns: "io.metamask",
            },
            provider,
          },
        }),
      );
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  });
  const wp = await wallet.newPage();
  await wp.route("https://api.squeekchain.com/**", (r) => r.abort());
  await wp.goto(base);
  await wp.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await wp
    .getByRole("button", { name: "MetaMask (test provider)", exact: true })
    .click();
  await wp
    .getByRole("button", { name: "Switch to Sepolia", exact: true })
    .waitFor();
  await wp
    .getByRole("button", { name: "Switch to Sepolia", exact: true })
    .click();
  await wp.waitForFunction(() =>
    document.querySelector(".wallet-button").textContent.includes("0x8342"),
  );
  await wp.locator(".wallet-button").click();
  await wp
    .getByRole("button", { name: "Disconnect wallet", exact: true })
    .click();
  await wp
    .getByRole("button", { name: "Connect wallet", exact: true })
    .waitFor();
  const calls = await wp.evaluate(() => window.__walletCalls);
  assert.ok(calls.includes("wallet_switchEthereumChain"));
  assert.equal(
    calls.some((m) => /sign|sendTransaction|sendRawTransaction/.test(m)),
    false,
  );
  pass(
    "Mock EIP-6963 discovery, address display, wrong-chain switching and disconnect; no signing or transfers",
  );
  await wallet.close();
  const landscape = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const lp = await landscape.newPage();
  await lp.route("https://api.squeekchain.com/**", (r) => r.abort());
  await lp.goto(base);
  await lp.locator(".game-cover").waitFor({ state: "hidden" });
  await lp.setViewportSize({ width: 844, height: 390 });
  await lp.waitForFunction(
    () => document.querySelector(".game-stage").clientHeight === 270,
  );
  assert.equal(
    await lp.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await lp.locator(".sprint-button").tap();
  assert.equal((await lp.getByTestId("score").textContent()).trim(), "00001");
  await lp.waitForTimeout(150);
  await lp.locator(".sprint-button").focus();
  await lp.keyboard.down("Space");
  await lp.waitForFunction(
    () =>
      Number(
        document
          .querySelector('[aria-label="Sprint charge"]')
          .getAttribute("aria-valuenow"),
      ) >= 71,
  );
  await lp.keyboard.up("Space");
  await lp.waitForFunction(() =>
    /Perfect landing|Nice landing/.test(
      document.querySelector(".game-feedback p").textContent,
    ),
  );
  pass(
    "Portrait-to-landscape resize retains a playable scene, tap and charged landing at 844×390 without horizontal overflow",
  );
  await landscape.close();
  await mkdir("test/scratch/browser-check", { recursive: true });
  await writeFile(
    "test/scratch/browser-check/states-results.json",
    JSON.stringify({ checks }, null, 2),
  );
  console.log(`${checks.length} state and wallet checks passed.`);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
