import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { createApp } from "../server/app";

test("score service: sessions, SQL migration, replay, duplicates, progression, rankings and origin guard", async () => {
  const db = new PGlite();
  await db.exec(
    await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
  );
  // PGlite runs PostgreSQL in-process. This adapter exercises the service's real SQL.
  const pool = {
    query: (...args: Parameters<PGlite["query"]>) => db.query(...args),
    connect: async () => ({
      query: (...args: Parameters<PGlite["query"]>) => db.query(...args),
      release: () => {},
    }),
  } as unknown as Pool;
  const server = createApp(pool, { origin: "http://localhost:5173" }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise<void>((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  let cookie = "";
  const post = (
    path: string,
    body: unknown,
    origin = "http://localhost:5173",
  ) =>
    fetch(url + path, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(url + "/health")).status, 200);
    assert.equal(
      (await post("/session", {}, "https://untrusted.example")).status,
      403,
    );
    assert.equal((await post("/runs", {})).status, 401);
    const session = await post("/session", {});
    assert.equal(session.status, 201);
    cookie = session.headers.get("set-cookie")!.split(";")[0];
    assert.match(cookie, /^squeek_session=[a-f0-9]{64}$/);
    assert.match(session.headers.get("set-cookie")!, /HttpOnly/);
    const again = await post("/session", {});
    assert.equal(again.status, 200);
    const runResponse = await post("/runs", {});
    assert.equal(runResponse.status, 201);
    const run = (await runResponse.json()) as { runId: string };
    await db.query(
      "UPDATE runs SET started_at = now() - interval '4 seconds' WHERE id=$1",
      [run.runId],
    );
    const actions = [{ at: 1300, type: "launch", charge: 1296 }];
    assert.equal(
      (
        await post(`/runs/${run.runId}/finish`, {
          actions,
          duration: 2800,
          score: 99999,
        })
      ).status,
      422,
    );
    assert.equal(
      (await post(`/runs/${run.runId}/finish`, { actions, duration: 1400 }))
        .status,
      422,
    );
    const result = await post(`/runs/${run.runId}/finish`, {
      actions,
      duration: 2800,
    });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { score: 110, bestCombo: 1 });
    assert.equal(
      (await post(`/runs/${run.runId}/finish`, { actions, duration: 2800 }))
        .status,
      409,
    );
    const profile = (await (
      await fetch(url + "/profile", { headers: { Cookie: cookie } })
    ).json()) as {
      score: string;
      perfects: number;
      flips: number;
      bestCombo: number;
    };
    assert.equal(Number(profile.score), 110);
    assert.equal(profile.perfects, 1);
    assert.equal(profile.bestCombo, 1);
    assert.equal(profile.flips, 1);
    for (const metric of ["daily", "weekly", "distance", "combo"]) {
      const response = await fetch(url + `/leaderboard?metric=${metric}`);
      assert.equal(response.status, 200);
      const rows = (await response.json()) as {
        score: string;
        bestCombo: number;
      }[];
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].score), 110);
      assert.equal(rows[0].bestCombo, 1);
    }
    assert.equal(
      (await fetch(url + "/leaderboard?metric=DROP%20TABLE")).status,
      400,
    );
    const run2 = (await (await post("/runs", {})).json()) as { runId: string };
    const run3 = (await (await post("/runs", {})).json()) as { runId: string };
    assert.equal(
      (await post(`/runs/${run2.runId}/finish`, { actions, duration: 2800 }))
        .status,
      409,
    );
    await db.query(
      "UPDATE runs SET expires_at=now()-interval '1 second' WHERE id=$1",
      [run3.runId],
    );
    assert.equal(
      (await post(`/runs/${run3.runId}/finish`, { actions, duration: 2800 }))
        .status,
      410,
    );
    assert.equal((await post("/runs/not-a-uuid/finish", {})).status, 400);
  } finally {
    await new Promise<void>((r, e) =>
      server.close((err) => (err ? e(err) : r())),
    );
    await db.close();
  }
});

test("score service enforces a request rate limit", async () => {
  const pool = { query: async () => ({ rows: [{}] }) } as unknown as Pool;
  const server = createApp(pool, {
    origin: "http://localhost:5173",
    rateMax: 2,
  }).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/health`;
  try {
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 200);
    const limited = await fetch(url);
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get("Retry-After"));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
