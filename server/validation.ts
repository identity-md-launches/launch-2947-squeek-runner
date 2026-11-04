import { z } from "zod";
import { EMPTY_LEVELS, launch, recoveryMs, replay } from "../src/shared/rules";
const actionSchema = z.discriminatedUnion("type", [
  z
    .object({ at: z.number().int().min(0).max(300000), type: z.literal("tap") })
    .strict(),
  z
    .object({
      at: z.number().int().min(0).max(300000),
      type: z.literal("launch"),
      charge: z.number().int().min(220).max(1800),
    })
    .strict(),
]);
export const submissionSchema = z
  .object({
    actions: z.array(actionSchema).min(1).max(3000),
    duration: z.number().int().min(1).max(302000),
  })
  .strict();
export function validateSubmission(body: unknown, elapsedWallMs: number) {
  const data = submissionSchema.parse(body);
  if (data.duration > elapsedWallMs + 300 || elapsedWallMs > 600000)
    throw new Error("Run duration does not match the server clock.");
  const result = replay(data.actions, EMPTY_LEVELS);
  const last = data.actions.at(-1)!;
  const completedAt =
    last.at +
    (last.type === "launch"
      ? launch(last.charge).flightMs + recoveryMs(EMPTY_LEVELS)
      : 0);
  if (data.duration + 2 < completedAt)
    throw new Error("Finish the landing before submitting.");
  return result;
}
