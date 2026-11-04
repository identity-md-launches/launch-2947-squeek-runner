import { z } from "zod";
import type { Action } from "../shared/rules";
export const scoreApiBase = (import.meta.env.VITE_SCORE_API_URL ?? "").replace(
  /\/$/,
  "",
);
export const hasScoreService = Boolean(scoreApiBase);
const rowSchema = z.object({
  name: z.string(),
  score: z.coerce.number().finite().nonnegative(),
  distance: z.coerce.number().finite().nonnegative(),
  bestCombo: z.coerce.number().int().nonnegative(),
});
export type BoardRow = z.infer<typeof rowSchema>;
export type BoardMetric = "daily" | "weekly" | "distance" | "combo";
async function request(path: string, body?: unknown) {
  const response = await fetch(scoreApiBase + path, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Score service is unavailable. Your local progress is safe.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Score service is unavailable. Try again later.",
    );
  return data;
}
export async function startRanked() {
  await request("/session", {});
  return z
    .object({ runId: z.uuid(), name: z.string() })
    .parse(await request("/runs", {}));
}
export async function submitRanked(
  runId: string,
  actions: Action[],
  duration: number,
) {
  return z
    .object({ score: z.number(), bestCombo: z.number() })
    .parse(await request(`/runs/${runId}/finish`, { actions, duration }));
}
export async function getLeaderboard(metric: BoardMetric): Promise<BoardRow[]> {
  return z
    .array(rowSchema)
    .parse(await request(`/leaderboard?metric=${metric}`));
}
