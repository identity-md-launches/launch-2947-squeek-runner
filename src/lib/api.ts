import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
const uint = z.string().regex(/^\d+$/).max(80);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const chain = z.object({ target: z.string(), chainId: uint });
export const statusSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  measurement: z.object({
    freshness: z.string(),
    observedAt: z.string().datetime(),
    provenance: z.string(),
    coreStatus: z.string(),
    rpmMilli: z.number().finite().nonnegative(),
    cumulativeWorkUnits: uint,
  }),
});
export const coreSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.literal("available"),
  chain,
  configuration: z.object({ blockUnitsPerBlock: uint }),
  core: z.object({
    blockHeight: uint,
    blockProgress: uint,
    cumulativeWork: uint,
    paused: z.boolean(),
  }),
});
export const economySchema = z.object({
  schemaVersion: z.literal(2),
  status: z.literal("available"),
  generatedAt: z.string().datetime(),
  chain,
  asset: z.object({
    symbol: z.literal("SQK"),
    decimals: z.number().int().min(0).max(36),
  }),
  supply: z.object({
    liveSupplyBaseUnits: uint,
    capBaseUnits: uint,
    miningMintedBaseUnits: uint,
  }),
  schedule: z.object({ issuedBaseUnits: uint, closedThroughBlock: uint }),
});
export const accountSchema = z.object({
  schemaVersion: z.literal(2),
  status: z.literal("available"),
  chain,
  account: address,
  power: z.object({ nftPower: uint, sqkPower: uint }),
  rewards: z.object({ claimableBaseUnits: uint }),
  tokens: z.array(
    z.object({
      tokenId: uint,
      custody: z.string(),
      level: z.number().int().min(1).max(100),
    }),
  ),
  tokenCounts: z.object({ wallet: uint, staking: uint }),
  nextCursor: z.string().nullable(),
});
export const squeekSchema = z.object({
  schemaVersion: z.literal(2),
  status: z.literal("available"),
  chain,
  tokenId: uint,
  custody: z.object({
    owner: address,
    depositor: address.nullable(),
    burned: z.boolean(),
  }),
  level: z.number().int().min(1),
  basePower: uint,
  mergeState: z.string(),
  metadata: z.object({ status: z.string(), name: z.string().optional() }),
});
export class OfficialError extends Error {
  constructor(
    message: string,
    public retryAfterMs = 0,
  ) {
    super(message);
  }
}
const API = "https://api.squeekchain.com/v1";
export async function officialRead<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
        : AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new OfficialError(
      "Chain data is unavailable. Your game is still ready to play.",
    );
  }
  if (res.status === 429) {
    const header = res.headers.get("Retry-After");
    const seconds = header ? Number(header) : 60;
    const delay = Number.isFinite(seconds)
      ? seconds * 1000
      : Math.max(0, Date.parse(header!) - Date.now());
    throw new OfficialError(
      "The official API is busy. Refresh will resume automatically.",
      Math.max(15000, Math.min(900000, delay || 60000)),
    );
  }
  if (!res.ok)
    throw new OfficialError(
      res.status === 404
        ? "No record was found. Check the address or token ID."
        : "Chain data is unavailable. Try again shortly.",
    );
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new OfficialError("The official API returned unreadable data.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    throw new OfficialError(
      "This reading is unavailable or has an unsupported format.",
    );
  const data = parsed.data;
  if (
    data &&
    typeof data === "object" &&
    "chain" in data &&
    (data as { chain: { chainId: string } }).chain.chainId !== "11155111"
  )
    throw new OfficialError(
      "The API deployment changed. This app expects Sepolia testnet.",
    );
  return data;
}
export function useOfficial<T>(
  path: string,
  schema: z.ZodType<T>,
  interval: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ["official", path],
    queryFn: ({ signal }) => officialRead(path, schema, signal),
    enabled,
    staleTime: interval / 2,
    refetchInterval: (q) =>
      q.state.error instanceof OfficialError && q.state.error.retryAfterMs
        ? q.state.error.retryAfterMs
        : interval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
export const formatInt = (v: string | number | undefined) =>
  v === undefined
    ? "Unavailable"
    : typeof v === "string"
      ? BigInt(v).toLocaleString("en-US")
      : v.toLocaleString("en-US", { maximumFractionDigits: 0 });
export function formatToken(v: string, decimals = 18) {
  const n = BigInt(v),
    d = 10n ** BigInt(decimals);
  const whole = n / d;
  const fraction = (((n % d) * 100n) / d).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${fraction}`;
}
export function blockProgress(progress: string, units: string) {
  const p = BigInt(progress),
    u = BigInt(units);
  return u > 0n
    ? Math.max(0, Math.min(100, Number((p * 10000n) / u) / 100))
    : null;
}
