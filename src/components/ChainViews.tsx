import { useState, type FormEvent } from "react";
import { useAccount } from "wagmi";
import {
  accountSchema,
  blockProgress,
  coreSchema,
  economySchema,
  formatInt,
  formatToken,
  squeekSchema,
  statusSchema,
  useOfficial,
} from "../lib/api";
import { Icon } from "./Icon";
export function ChainStrip() {
  const core = useOfficial("/core", coreSchema, 30000);
  const pct = core.data
    ? blockProgress(
        core.data.core.blockProgress,
        core.data.configuration.blockUnitsPerBlock,
      )
    : null;
  return (
    <div className="chain-strip">
      <div className="chain-strip-title">
        <Icon name="chain" size={20} />
        <div>
          <strong>Squeekchain</strong>
          <span className="small muted">Sepolia testnet</span>
        </div>
      </div>
      <div className="chain-progress">
        <div>
          <span className="small muted">Squeek block</span>
          <strong className="small">
            {core.data
              ? `#${formatInt(core.data.core.blockHeight)}`
              : core.isPending
                ? "Loading…"
                : "Unavailable"}
          </strong>
        </div>
        <div
          className="mini-track"
          role="progressbar"
          aria-label="Official block progress"
          aria-valuenow={pct ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>
      <span className="small muted chain-percent">
        {core.error
          ? "Reading unavailable"
          : pct === null
            ? "Awaiting API"
            : `${pct.toFixed(1)}% complete`}
      </span>
      <a className="text-link small" href="#chain">
        View chain <Icon name="arrow" size={16} />
      </a>
    </div>
  );
}
function Reading({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="reading">
      <p className="muted small">{label}</p>
      <strong>{value}</strong>
      {note && <span className="small muted">{note}</span>}
    </div>
  );
}
export function ChainDashboard() {
  const status = useOfficial("/status", statusSchema, 15000);
  const core = useOfficial("/core", coreSchema, 30000);
  const economy = useOfficial("/economy/state", economySchema, 60000);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      status.refetch(),
      core.refetch(),
      economy.refetch(),
    ]);
    setRefreshing(false);
  };
  const pct = core.data
    ? blockProgress(
        core.data.core.blockProgress,
        core.data.configuration.blockUnitsPerBlock,
      )
    : null;
  const s = status.data?.measurement;
  const online =
    s?.freshness === "online" && Date.now() - Date.parse(s.observedAt) < 120000;
  const unavailable = (pending: boolean) =>
    pending ? "Loading…" : "Unavailable";
  const error = status.error ?? core.error ?? economy.error;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Behind the wheel.</h1>
          <p className="muted">
            Official Squeekchain readings. Sepolia testnet.
          </p>
        </div>
        <button
          className="secondary"
          disabled={
            refreshing ||
            status.isFetching ||
            Boolean((error as { retryAfterMs?: number })?.retryAfterMs)
          }
          onClick={() => void refresh()}
        >
          <Icon name="refresh" size={16} />
          {refreshing ? "Refreshing…" : "Refresh data"}
        </button>
      </div>
      <div className="notice">
        <Icon name="chain" />
        <p>
          These readings come from the official API. Your arcade taps generate
          virtual game Power, not WHEELY9000 sensor measurements or SQK.
        </p>
      </div>
      {error && (
        <p className="error-note" role="status">
          {error.message} Previous readings, if shown, may be stale.
        </p>
      )}
      <div className="chain-grid">
        <section className="panel chain-main">
          <div className="section-title">
            <h2>Official work</h2>
            <span className="network-tag">Sepolia testnet</span>
          </div>
          <div className="block-display">
            <span className="muted">Current Squeek block</span>
            <strong className="pixel">
              {core.data
                ? `#${formatInt(core.data.core.blockHeight)}`
                : unavailable(core.isPending)}
            </strong>
          </div>
          <div className="progress-label">
            <span>Block progress</span>
            <strong>
              {pct === null ? "Unavailable" : `${pct.toFixed(2)}%`}
            </strong>
          </div>
          <progress
            max={100}
            value={pct ?? 0}
            aria-label="Squeek block completion"
          />
          <div className="reading-grid">
            <Reading
              label="Settled cumulative work"
              value={
                core.data
                  ? formatInt(core.data.core.cumulativeWork)
                  : unavailable(core.isPending)
              }
              note="Accepted work units"
            />
            <Reading
              label="Sensor cumulative work"
              value={
                s
                  ? formatInt(s.cumulativeWorkUnits)
                  : unavailable(status.isPending)
              }
              note="Hardware measurement"
            />
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>The real hamster</h2>
            <Icon name="hamster" />
          </div>
          <div className="official-hamster">
            <img
              src="./assets/portrait-miner.png"
              width="96"
              height="80"
              alt="Original miner hamster illustration"
            />
            <div>
              <span className="small muted">WHEELY9000</span>
              <strong className="pixel">
                {s
                  ? `${(s.rpmMilli / 1000).toFixed(1)} RPM`
                  : unavailable(status.isPending)}
              </strong>
            </div>
          </div>
          <dl className="definition-list">
            <div>
              <dt>Device status</dt>
              <dd>
                {s ? s.coreStatus.toLowerCase() : unavailable(status.isPending)}
              </dd>
            </div>
            <div>
              <dt>Freshness</dt>
              <dd>
                {s
                  ? online
                    ? "Online"
                    : "Stale / offline"
                  : unavailable(status.isPending)}
              </dd>
            </div>
            <div>
              <dt>Provenance</dt>
              <dd>{s ? s.provenance : unavailable(status.isPending)}</dd>
            </div>
            <div>
              <dt>Observed at</dt>
              <dd>
                {s
                  ? new Date(s.observedAt).toLocaleTimeString()
                  : unavailable(status.isPending)}
              </dd>
            </div>
          </dl>
          <p className="small muted">
            Idle is a valid hardware status. This reading does not follow your
            game speed.
          </p>
        </section>
        <section className="panel supply-panel">
          <div className="section-title">
            <h2>SQK supply & issuance</h2>
            <span className="small muted">Testnet token</span>
          </div>
          <div className="reading-grid three">
            <Reading
              label="Live SQK supply"
              value={
                economy.data
                  ? formatToken(
                      economy.data.supply.liveSupplyBaseUnits,
                      economy.data.asset.decimals,
                    )
                  : unavailable(economy.isPending)
              }
              note="SQK"
            />
            <Reading
              label="Cumulative mining issuance"
              value={
                economy.data
                  ? formatToken(
                      economy.data.supply.miningMintedBaseUnits,
                      economy.data.asset.decimals,
                    )
                  : unavailable(economy.isPending)
              }
              note="SQK"
            />
            <Reading
              label="Lifetime supply cap"
              value={
                economy.data
                  ? formatToken(
                      economy.data.supply.capBaseUnits,
                      economy.data.asset.decimals,
                    )
                  : unavailable(economy.isPending)
              }
              note="SQK"
            />
          </div>
        </section>
        <AccountPanel />
      </div>
      <p className="small muted data-source">
        Source:{" "}
        <a
          href="https://api.squeekchain.com/v1/status"
          target="_blank"
          rel="noreferrer"
        >
          Official read-only API <Icon name="external" size={14} />
        </a>{" "}
        · Device refreshes every 15s, core every 30s, economy every 60s. Paused
        in background tabs.
      </p>
    </>
  );
}
function AccountPanel() {
  const { address } = useAccount();
  const account = useOfficial(
    `/accounts/${address ?? ""}`,
    accountSchema,
    60000,
    Boolean(address),
  );
  const [input, setInput] = useState("");
  const [id, setId] = useState("");
  const [invalid, setInvalid] = useState("");
  const token = useOfficial(`/squeeks/${id}`, squeekSchema, 60000, Boolean(id));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{1,20}$/.test(input) || BigInt(input) < 1n) {
      setInvalid("Enter a positive Squeek token ID.");
      return;
    }
    setInvalid("");
    setId(BigInt(input).toString());
  };
  return (
    <section className="panel account-panel">
      <div className="section-title">
        <h2>Account & Squeeks</h2>
        <Icon name="wallet" />
      </div>
      {!address ? (
        <p className="muted">
          Connect a wallet in the header to read account information and Squeek
          NFT ownership. You can also look up any token ID below.
        </p>
      ) : account.isPending ? (
        <p className="muted">Reading your Sepolia account…</p>
      ) : account.error ? (
        <p className="error-note">{account.error.message}</p>
      ) : (
        account.data && (
          <>
            <p className="full-address small">{account.data.account}</p>
            <dl className="definition-list">
              <div>
                <dt>Wallet-owned Squeeks</dt>
                <dd>{formatInt(account.data.tokenCounts.wallet)}</dd>
              </div>
              <div>
                <dt>Staked Squeeks</dt>
                <dd>{formatInt(account.data.tokenCounts.staking)}</dd>
              </div>
              <div>
                <dt>Claimable SQK (testnet)</dt>
                <dd>{formatToken(account.data.rewards.claimableBaseUnits)}</dd>
              </div>
            </dl>
            <p className="small muted">
              NFT power: {formatInt(account.data.power.nftPower)} · SQK power:{" "}
              {formatInt(account.data.power.sqkPower)}
            </p>
            {account.data.tokens.length > 0 && (
              <div className="token-list">
                {account.data.tokens.map((t) => (
                  <button
                    className="token-chip"
                    key={t.tokenId}
                    onClick={() => {
                      setInput(t.tokenId);
                      setId(t.tokenId);
                    }}
                  >
                    Squeek #{t.tokenId} · L{t.level}
                  </button>
                ))}
                {account.data.nextCursor && (
                  <span className="small muted">
                    Showing the first {account.data.tokens.length} records.
                  </span>
                )}
              </div>
            )}
          </>
        )
      )}
      <form className="token-form" onSubmit={submit}>
        <label htmlFor="token-id">Look up a Squeek</label>
        <div>
          <input
            id="token-id"
            inputMode="numeric"
            placeholder="Token ID, e.g. 1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-invalid={Boolean(invalid)}
            aria-describedby="token-error"
          />
          <button className="secondary" disabled={token.isFetching}>
            Look up <Icon name="arrow" size={16} />
          </button>
        </div>
        <p id="token-error" className="error-note" role="status">
          {invalid}
        </p>
      </form>
      {id && (
        <div className="token-result" role="status">
          {token.isPending
            ? "Reading Squeek…"
            : token.error
              ? token.error.message
              : token.data && (
                  <>
                    <strong>
                      {token.data.metadata.name ??
                        `Squeek #${token.data.tokenId}`}
                    </strong>
                    <p className="small muted">
                      Level {token.data.level} · Base power{" "}
                      {formatInt(token.data.basePower)} ·{" "}
                      {token.data.custody.burned
                        ? "Burned"
                        : token.data.mergeState}
                    </p>
                    <span className="small muted">Owner (Sepolia)</span>
                    <p className="full-address small">
                      {token.data.custody.owner}
                    </p>
                  </>
                )}
        </div>
      )}
    </section>
  );
}
