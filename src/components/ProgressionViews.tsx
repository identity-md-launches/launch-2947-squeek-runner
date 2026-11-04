import { useEffect, useState } from "react";
import { Runner, type RunnerState } from "../game/Runner";
import { SKINS, UPGRADES, upgradeCost } from "../shared/rules";
import {
  getLeaderboard,
  hasScoreService,
  type BoardMetric,
  type BoardRow,
} from "../lib/score-api";
import { today, upgradePowerRequired } from "../lib/progression";
import { Icon } from "./Icon";
const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });
export function Upgrades({
  runner,
  state,
}: {
  runner: Runner;
  state: RunnerState;
}) {
  const [note, setNote] = useState("");
  const p = state.progress;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A little more horsepower.</h1>
          <p className="muted">Bigger runs start with a better wheel.</p>
        </div>
        <div className="balance">
          <Icon name="spark" />
          <span>
            {fmt(p.score)} <span className="muted">Score to spend</span>
          </span>
        </div>
      </div>
      <div className="shop-layout">
        <div className="upgrade-list">
          {UPGRADES.map((u, i) => {
            const level = p.levels[u.id],
              cost = upgradeCost(u.id, p.levels),
              requiredPower = upgradePowerRequired(level);
            return (
              <section className="upgrade-row" key={u.id}>
                <div className="upgrade-icon">
                  <Icon name={u.icon} size={28} />
                </div>
                <div className="upgrade-copy">
                  <div className="upgrade-name">
                    <h2>{u.name}</h2>
                    <span className="small muted">Level {level} / 5</span>
                  </div>
                  <p className="muted small">{u.detail}</p>
                  {level < 5 && (
                    <p className="muted small" id={`power-${u.id}`}>
                      {fmt(requiredPower)} Power required · You have{" "}
                      {fmt(Math.floor(p.power))}
                    </p>
                  )}
                  <div
                    className="level-slots"
                    role="img"
                    aria-label={`Level ${level} of 5`}
                  >
                    {Array.from({ length: 5 }, (_, j) => (
                      <i className={j < level ? "filled" : ""} key={j} />
                    ))}
                  </div>
                </div>
                <button
                  className="secondary upgrade-buy"
                  disabled={
                    level === 5 || p.score < cost || p.power < requiredPower
                  }
                  aria-describedby={level < 5 ? `power-${u.id}` : undefined}
                  onClick={() => {
                    if (runner.buyUpgrade(u.id))
                      setNote(`${u.name} upgraded to level ${level + 1}.`);
                  }}
                >
                  {level === 5 ? (
                    <>
                      <Icon name="check" size={16} />
                      Max level
                    </>
                  ) : (
                    <>
                      <Icon name="bolt" size={16} />
                      Upgrade · {fmt(cost)} Score
                    </>
                  )}
                </button>
                <span className="upgrade-number" aria-hidden="true">
                  0{i + 1}
                </span>
              </section>
            );
          })}
        </div>
        <aside className="upgrade-aside">
          <img
            src="./assets/portrait-miner.png"
            width="144"
            height="120"
            alt="Original hamster wearing a miner’s hard hat"
          />
          <h2>Built for the long run.</h2>
          <p className="muted">
            Upgrades are permanent in this browser. Score spent in the shop
            still counts toward your lifetime record.
          </p>
          <p className="muted">
            Earn virtual Power to unlock upgrade levels: 25, 100, 250, 500 and
            1,000 Power for levels 1–5. Power is never spent; pay with Score.
          </p>
          <div className="tip">
            <Icon name="help" size={20} />
            <p className="small">
              Start with Sprint boost for bigger landing rewards. You can earn
              every upgrade just by playing.
            </p>
          </div>
          <a className="text-link" href="#play">
            Back to the wheel <Icon name="arrow" size={16} />
          </a>
        </aside>
      </div>
      <p className="inline-feedback" role="status">
        {note}
      </p>
      <p className="small muted">
        Virtual Power unlocks upgrade tiers. Score pays for upgrades. No wallet,
        SQK or transaction required.
      </p>
    </>
  );
}
export function Collection({
  runner,
  state,
}: {
  runner: Runner;
  state: RunnerState;
}) {
  const [note, setNote] = useState("");
  const p = state.progress;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Meet the night shift.</h1>
          <p className="muted">
            Five little personalities. One very important wheel.
          </p>
        </div>
        <span className="muted">{p.skins.length} / 5 collected</span>
      </div>
      <div className="collection-grid">
        {SKINS.map((s, i) => {
          const owned = p.skins.includes(s.id),
            equipped = p.skin === s.id;
          return (
            <section
              className={`collection-item ${equipped ? "equipped" : ""}`}
              key={s.id}
            >
              <div className={`hamster-art skin-${s.id}`}>
                <span className="small specimen">No. 00{i + 1}</span>
                <img
                  src={`./assets/portrait-${s.id}.png`}
                  width="192"
                  height="160"
                  alt={s.name}
                />
                {equipped && (
                  <span className="equipped-tag">
                    <Icon name="check" size={14} />
                    Equipped
                  </span>
                )}
              </div>
              <div className="collection-copy">
                <h2>{s.name}</h2>
                <p className="muted small">{s.description}</p>
                <button
                  className={owned ? "secondary" : "primary"}
                  disabled={equipped || (!owned && p.score < s.cost)}
                  onClick={() => {
                    if (runner.equipSkin(s.id)) setNote(`${s.name} equipped.`);
                  }}
                >
                  {equipped ? (
                    "Currently running"
                  ) : owned ? (
                    "Equip hamster"
                  ) : (
                    <>
                      <Icon name="lock" size={16} />
                      Unlock · {fmt(s.cost)} Score
                    </>
                  )}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <p className="inline-feedback" role="status">
        {note}
      </p>
      <div className="notice">
        <Icon name="hamster" />
        <p>
          These are original arcade cosmetics, saved in this browser. They are
          separate from official Squeek NFTs and give no gameplay advantage.
        </p>
      </div>
    </>
  );
}
const metrics: { id: BoardMetric; label: string }[] = [
  { id: "daily", label: "Daily Score" },
  { id: "weekly", label: "Weekly Score" },
  { id: "distance", label: "Total distance" },
  { id: "combo", label: "Best combo" },
];
export function Leaderboard({ state }: { state: RunnerState }) {
  const [metric, setMetric] = useState<BoardMetric>("daily");
  const [global, setGlobal] = useState(false);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!global) return;
    let live = true;
    setPending(true);
    setError("");
    getLeaderboard(metric)
      .then((r) => {
        if (live) setRows(r);
      })
      .catch(() => {
        if (live)
          setError(
            "Shared rankings are unavailable. Try again or view your local records.",
          );
      })
      .finally(() => {
        if (live) setPending(false);
      });
    return () => {
      live = false;
    };
  }, [global, metric, attempt]);
  const p = state.progress;
  const week = Object.entries(p.daily)
    .filter(([d]) => Date.parse(d) >= Date.parse(today()) - 6 * 86400000)
    .reduce((sum, [, n]) => sum + n, 0);
  const localScore =
    metric === "daily"
      ? (p.daily[today()] ?? 0)
      : metric === "weekly"
        ? week
        : metric === "distance"
          ? p.distance
          : p.bestCombo;
  const local: BoardRow = {
    name: "You · this browser",
    score: localScore,
    distance: p.distance,
    bestCombo: p.bestCombo,
  };
  const displayed = global ? rows : [local];
  const value = (row: BoardRow) =>
    metric === "distance"
      ? `${row.distance.toFixed(1)} m`
      : metric === "combo"
        ? `${row.bestCombo}×`
        : fmt(row.score);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Little paws. Lasting records.</h1>
          <p className="muted">Every good run deserves a place on the board.</p>
        </div>
        <Icon name="trophy" size={28} />
      </div>
      <div className="board-source">
        <div className="segmented">
          <button
            className={!global ? "selected" : ""}
            aria-pressed={!global}
            onClick={() => setGlobal(false)}
          >
            Local records
          </button>
          <button
            className={global ? "selected" : ""}
            aria-pressed={global}
            onClick={() => setGlobal(true)}
          >
            Shared rankings
          </button>
        </div>
        <span className="small muted">
          {global ? "Server-validated runs" : "Saved on this device"}
        </span>
      </div>
      <div className="metric-tabs" role="group" aria-label="Leaderboard metric">
        {metrics.map((m) => (
          <button
            key={m.id}
            aria-pressed={metric === m.id}
            className={metric === m.id ? "active" : ""}
            onClick={() => setMetric(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {global && !hasScoreService ? (
        <div className="board-empty">
          <Icon name="trophy" size={40} />
          <h2>The shared board is offline.</h2>
          <p className="muted">
            This edition saves records in your browser. Shared rankings will
            appear when the score service is connected.
          </p>
          <button className="secondary" onClick={() => setGlobal(false)}>
            View local records <Icon name="arrow" size={16} />
          </button>
        </div>
      ) : pending ? (
        <div className="board-empty" role="status">
          Reading validated runs…
        </div>
      ) : error ? (
        <div className="board-empty">
          <p role="status">{error}</p>
          <button
            className="secondary"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="board-empty">
          <Icon name="trophy" size={40} />
          <h2>First place is wide open.</h2>
          <p className="muted">
            Complete a ranked run to put your paws on the board.
          </p>
          <a className="secondary" href="#play">
            Play a run <Icon name="arrow" size={16} />
          </a>
        </div>
      ) : (
        <div className="board-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Runner</th>
                <th scope="col">
                  {metrics.find((m) => m.id === metric)?.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, i) => (
                <tr key={i}>
                  <td>
                    <span className="rank">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <div className="runner-cell">
                      <img
                        src={`./assets/portrait-${global ? "classic" : p.skin}.png`}
                        alt=""
                        width="48"
                        height="40"
                      />
                      <strong>{row.name}</strong>
                      {!global && <span className="small you-tag">You</span>}
                    </div>
                  </td>
                  <td className="pixel">{value(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="record-summary">
        <div>
          <span className="small muted">Lifetime Score</span>
          <strong>{fmt(p.totalScore)}</strong>
        </div>
        <div>
          <span className="small muted">Perfect landings</span>
          <strong>{fmt(p.perfects)}</strong>
        </div>
        <div>
          <span className="small muted">Total distance</span>
          <strong>{p.distance.toFixed(1)} m</strong>
        </div>
        <div>
          <span className="small muted">Best combo</span>
          <strong>{p.bestCombo}×</strong>
        </div>
      </div>
      <p className="small muted">
        Daily and weekly records use UTC. Local records are unverified and
        aren’t submitted to shared rankings.
      </p>
    </>
  );
}
