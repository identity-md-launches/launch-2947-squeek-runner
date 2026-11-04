import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OfficialError,
  blockProgress,
  coreSchema,
  economySchema,
  formatToken,
  officialRead,
  statusSchema,
} from "../src/lib/api";
const core = {
  schemaVersion: 1,
  status: "available",
  chain: { target: "sepolia", chainId: "11155111" },
  configuration: { blockUnitsPerBlock: "1000000000" },
  core: {
    blockHeight: "8332",
    blockProgress: "296609556",
    cumulativeWork: "91726",
    paused: false,
  },
};
async function withFetch(response: Response | Error, fn: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    if (response instanceof Error) throw response;
    return response;
  };
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}
test("official schema accepts documented core strings and rejects missing or invented readings", () => {
  assert.equal(coreSchema.safeParse(core).success, true);
  assert.equal(
    coreSchema.safeParse({ ...core, core: { ...core.core, blockHeight: 8332 } })
      .success,
    false,
  );
  assert.equal(
    coreSchema.safeParse({ ...core, status: "unavailable" }).success,
    false,
  );
  assert.equal(
    statusSchema.safeParse({ schemaVersion: 1, measurement: { rpmMilli: 500 } })
      .success,
    false,
  );
  assert.equal(
    economySchema.safeParse({
      schemaVersion: 1,
      supply: { liveSupplyBaseUnits: "0" },
    }).success,
    false,
  );
});
test("official API rejects a changed deployment instead of displaying it as Sepolia", async () => {
  await withFetch(
    new Response(
      JSON.stringify({ ...core, chain: { target: "mainnet", chainId: "1" } }),
    ),
    async () => {
      await assert.rejects(
        officialRead("/core", coreSchema),
        /expects Sepolia/,
      );
    },
  );
});
test("official API preserves rate-limit retry guidance and handles malformed responses", async () => {
  await withFetch(
    new Response("{}", { status: 429, headers: { "Retry-After": "120" } }),
    async () => {
      await assert.rejects(
        officialRead("/core", coreSchema),
        (e: unknown) => e instanceof OfficialError && e.retryAfterMs === 120000,
      );
    },
  );
  await withFetch(new Response("not json"), async () => {
    await assert.rejects(officialRead("/core", coreSchema), /unreadable data/);
  });
  await withFetch(new Response("{}"), async () => {
    await assert.rejects(
      officialRead("/core", coreSchema),
      /unsupported format/,
    );
  });
  await withFetch(new Error("network failure"), async () => {
    await assert.rejects(
      officialRead("/core", coreSchema),
      /game is still ready to play/,
    );
  });
});
test("official token and block formatting does not lose integer precision", () => {
  assert.equal(formatToken("2100000000000000000000000000"), "2,100,000,000.00");
  assert.equal(formatToken("33157606255453613574932373"), "33,157,606.25");
  assert.equal(blockProgress("296609556", "1000000000"), 29.66);
  assert.equal(blockProgress("1", "0"), null);
});
