import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { validateSubmission } from "./validation";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
interface Options {
  origin: string;
  production?: boolean;
  crossSite?: boolean;
  rateMax?: number;
}
export function createApp(pool: Pool, options: Options) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const origin = req.get("origin");
    if (origin && origin !== options.origin) {
      res.status(403).json({ error: "This origin is not allowed." });
      return;
    }
    if (origin === options.origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    if (req.method === "POST" && origin !== options.origin) {
      res.status(403).json({ error: "A matching browser Origin is required." });
      return;
    }
    next();
  });
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: options.rateMax ?? 90,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Wait a minute and try again." },
    }),
  );
  app.use(express.json({ limit: "180kb", strict: true }));
  const session = async (req: Request) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("squeek_session="))
      ?.slice(15);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const found = await pool.query(
      "SELECT p.id, p.name FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = $1 AND s.expires_at > now()",
      [hash(token)],
    );
    return found.rows[0] as { id: string; name: string } | undefined;
  };
  app.get("/api/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  });
  app.post("/api/session", async (req, res) => {
    const existing = await session(req);
    if (existing) {
      res.json({ name: existing.name });
      return;
    }
    const client = await pool.connect();
    const id = randomUUID(),
      token = randomBytes(32).toString("hex"),
      name = `Runner ${id.slice(0, 4).toUpperCase()}`;
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO players(id,name) VALUES($1,$2)", [
        id,
        name,
      ]);
      await client.query(
        "INSERT INTO sessions(token_hash,player_id,expires_at) VALUES($1,$2,now()+interval '30 days')",
        [hash(token), id],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    res.cookie("squeek_session", token, {
      httpOnly: true,
      secure: options.production || options.crossSite,
      sameSite: options.crossSite ? "none" : "lax",
      maxAge: 30 * 86400000,
      path: "/api",
    });
    res.status(201).json({ name });
  });
  app.post(
    "/api/runs",
    rateLimit({
      windowMs: 60000,
      limit: 6,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Please wait before starting another ranked run." },
    }),
    async (req, res) => {
      const player = await session(req);
      if (!player) {
        res.status(401).json({ error: "Start a player session first." });
        return;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [
          player.id,
        ]);
        await client.query(
          "UPDATE runs SET used=true WHERE player_id=$1 AND used=false",
          [player.id],
        );
        const id = randomUUID();
        await client.query("INSERT INTO runs(id,player_id) VALUES($1,$2)", [
          id,
          player.id,
        ]);
        await client.query("COMMIT");
        res.status(201).json({ runId: id, name: player.name });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  );
  app.post("/api/runs/:id/finish", async (req, res) => {
    const player = await session(req);
    if (!player) {
      res.status(401).json({ error: "Your session expired. Start a new run." });
      return;
    }
    if (!z.uuid().safeParse(req.params.id).success) {
      res.status(400).json({ error: "Invalid run ID." });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [
        player.id,
      ]);
      const found = await client.query(
        "SELECT * FROM runs WHERE id=$1 AND player_id=$2 FOR UPDATE",
        [req.params.id, player.id],
      );
      const run = found.rows[0];
      if (!run || run.used) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "This run was already submitted or replaced. Start a new run.",
        });
        return;
      }
      const elapsed = Date.now() - new Date(run.started_at).getTime();
      if (Date.now() > new Date(run.expires_at).getTime()) {
        await client.query("ROLLBACK");
        res
          .status(410)
          .json({ error: "This run expired. Start another ranked run." });
        return;
      }
      let result;
      try {
        result = validateSubmission(req.body, elapsed);
      } catch {
        await client.query("ROLLBACK");
        res.status(422).json({
          error:
            "Run validation failed. Finish all landings and submit only actions from this run.",
        });
        return;
      }
      await client.query("UPDATE runs SET used=true WHERE id=$1", [run.id]);
      await client.query(
        "INSERT INTO scores(run_id,player_id,score,distance,best_combo) VALUES($1,$2,$3,$4,$5)",
        [run.id, player.id, result.score, result.distance, result.bestCombo],
      );
      await client.query(
        "UPDATE players SET score=score+$2,power=power+$3,distance=distance+$4,best_combo=GREATEST(best_combo,$5),perfects=perfects+$6,flips=flips+$7 WHERE id=$1",
        [
          player.id,
          result.score,
          result.power,
          result.distance,
          result.bestCombo,
          result.perfects,
          result.flips,
        ],
      );
      await client.query("COMMIT");
      res.json({ score: result.score, bestCombo: result.bestCombo });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });
  app.get("/api/profile", async (req, res) => {
    const player = await session(req);
    if (!player) {
      res.status(401).json({ error: "Start a player session first." });
      return;
    }
    const r = await pool.query(
      'SELECT name,score,power,distance,best_combo AS "bestCombo",perfects,flips FROM players WHERE id=$1',
      [player.id],
    );
    res.json(r.rows[0]);
  });
  app.get("/api/leaderboard", async (req, res) => {
    const metric = z
      .enum(["daily", "weekly", "distance", "combo"])
      .safeParse(req.query.metric ?? "daily");
    if (!metric.success) {
      res.status(400).json({ error: "Choose a supported leaderboard metric." });
      return;
    }
    // SQL fragments come only from this fixed allowlist, never the query string.
    const period =
      metric.data === "daily"
        ? "date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'"
        : "(date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') - interval '6 days'";
    const q =
      metric.data === "daily" || metric.data === "weekly"
        ? `SELECT p.name,SUM(s.score) AS score,p.distance,p.best_combo AS "bestCombo" FROM scores s JOIN players p ON p.id=s.player_id WHERE s.finished_at >= ${period} GROUP BY p.id,p.name,p.distance,p.best_combo ORDER BY score DESC,p.name ASC LIMIT 50`
        : `SELECT name,score,distance,best_combo AS "bestCombo" FROM players WHERE ${metric.data === "distance" ? "distance>0" : "flips>0"} ORDER BY ${metric.data === "distance" ? "distance" : "best_combo"} DESC,name ASC LIMIT 50`;
    res.json((await pool.query(q)).rows);
  });
  app.use((_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status = (error as Error & { status?: number }).status;
    if (status === 400 || status === 413) {
      res.status(status).json({
        error:
          status === 413
            ? "Run submission is too large."
            : "Send a valid JSON request.",
      });
      return;
    }
    console.error("Score request failed:", error.name);
    res.status(503).json({
      error: "Score service is unavailable. Your local progress is safe.",
    });
  });
  return app;
}
