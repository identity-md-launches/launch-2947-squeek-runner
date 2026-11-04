import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Runner } from "./game/Runner";
import { SKINS } from "./shared/rules";
import { GameViewport } from "./components/GameViewport";
import { ConnectWallet } from "./components/ConnectWallet";
import { Icon } from "./components/Icon";
import { Modal } from "./components/Modal";
import { ChainDashboard, ChainStrip } from "./components/ChainViews";
import {
  Collection,
  Leaderboard,
  Upgrades,
} from "./components/ProgressionViews";
import { hasScoreService, startRanked, submitRanked } from "./lib/score-api";
const tabs = [
  { id: "play", label: "Play", icon: "game" },
  { id: "upgrades", label: "Upgrades", icon: "bolt" },
  { id: "leaderboard", label: "Leaderboard", icon: "trophy" },
  { id: "collection", label: "Hamsters", icon: "hamster" },
  { id: "chain", label: "Chain", icon: "chain" },
];
const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const currentTab = () => {
  const id = location.hash.slice(1);
  return tabs.some((t) => t.id === id) ? id : "play";
};
export default function App() {
  const runner = useMemo(() => new Runner(), []);
  const state = useSyncExternalStore(runner.subscribe, runner.getSnapshot);
  const [tab, setTab] = useState(currentTab);
  const [help, setHelp] = useState(false);
  const [ranked, setRanked] = useState<{ runId: string; name: string } | null>(
    null,
  );
  const [rankPending, setRankPending] = useState(false);
  const [rankNote, setRankNote] = useState("");
  useEffect(() => {
    if (currentTab() !== "play") runner.setPaused(true);
    const hash = () => {
      const next = currentTab();
      setTab(next);
      if (next !== "play") runner.setPaused(true);
      window.scrollTo({ top: 0 });
    };
    addEventListener("hashchange", hash);
    const visibility = () => {
      if (document.hidden) runner.setPaused(true);
    };
    document.addEventListener("visibilitychange", visibility);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => runner.setReducedMotion(media.matches);
    change();
    media.addEventListener("change", change);
    return () => {
      removeEventListener("hashchange", hash);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", change);
      runner.destroy();
    };
  }, [runner]);
  const openHelp = () => {
    runner.setPaused(true);
    setHelp(true);
  };
  const p = state.progress;
  const skin = SKINS.find((s) => s.id === p.skin)!;
  const chargeText =
    state.phase === "charging"
      ? state.charge >= 0.7 && state.charge <= 0.74
        ? "Release now!"
        : state.charge > 0.85
          ? "Too much charge!"
          : "Charging…"
      : state.phase === "airborne"
        ? "Squeek incoming!"
        : state.phase === "landing"
          ? "Finding our feet…"
          : "Hold to sprint";
  const start = async () => {
    setRankPending(true);
    setRankNote("");
    try {
      const run = await startRanked();
      runner.resetSession();
      runner.setRanked(true);
      runner.setPaused(false);
      setRanked(run);
    } catch (e) {
      setRankNote((e as Error).message);
    } finally {
      setRankPending(false);
    }
  };
  const finish = async () => {
    if (!ranked) return;
    runner.setPaused(true);
    setRankPending(true);
    setRankNote("");
    try {
      const result = await submitRanked(
        ranked.runId,
        runner.actions,
        runner.getElapsed(),
      );
      setRankNote(
        `Run verified: ${fmt(result.score)} Score. Check shared rankings.`,
      );
      setRanked(null);
      runner.setRanked(false);
    } catch (e) {
      setRankNote((e as Error).message);
    } finally {
      setRankPending(false);
    }
  };
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to game
      </a>
      <header className="site-header">
        <a href="#play" className="wordmark" aria-label="Squeek Runner home">
          <img src="./favicon.svg" width="36" height="36" alt="" />
          <span>
            Squeek<span className="wordmark-sub">Runner</span>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {tabs.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <Icon name={t.icon} size={17} />
              {t.label}
            </a>
          ))}
        </nav>
        <div className="header-tools">
          <button
            className="icon-button help-button"
            onClick={openHelp}
            aria-label="How to play"
          >
            <Icon name="help" />
          </button>
          <ConnectWallet onOpen={() => runner.setPaused(true)} />
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <Icon name={t.icon} size={18} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <main id="main" className="main-shell">
        {!state.storageAvailable && (
          <p className="error-note" role="status">
            Progress could not be saved. Enable browser storage to keep future
            progress, and keep this tab open for now.
          </p>
        )}
        <section hidden={tab !== "play"} aria-label="Arcade game">
          <div className="page-heading game-heading">
            <div>
              <h1>
                Small paws. <span>Big power.</span>
              </h1>
              <p className="muted">
                A pixel-art hamster arcade. Make every landing count.
              </p>
            </div>
            <div className="personal-best">
              <Icon name="trophy" size={18} />
              <span className="small muted">Personal best combo</span>
              <strong className="pixel">{p.bestCombo}×</strong>
            </div>
          </div>
          <div className="play-layout">
            <div className="arcade-column">
              <div className="arcade-cabinet">
                <div className="hud">
                  <div>
                    <span className="hud-label">
                      <Icon name="spark" size={14} />
                      {state.ranked ? "Run Score" : "Score"}
                    </span>
                    <strong className="pixel" data-testid="score">
                      {fmt(
                        state.ranked ? state.sessionScore : p.score,
                      ).padStart(5, "0")}
                    </strong>
                  </div>
                  <div>
                    <span className="hud-label">
                      <Icon name="bolt" size={14} />
                      Virtual Power
                    </span>
                    <strong className="pixel power-value" data-testid="power">
                      {fmt(p.power)}
                      <small> pwr</small>
                    </strong>
                  </div>
                  <div>
                    <span className="hud-label">
                      <Icon name="wheel" size={14} />
                      Wheel speed
                    </span>
                    <strong className="pixel" data-testid="rpm">
                      {fmt(
                        state.rpm *
                          (1 + (state.ranked ? 0 : p.levels.wheel) * 0.15),
                      )}
                      <small> rpm</small>
                    </strong>
                  </div>
                </div>
                <GameViewport
                  runner={runner}
                  state={state}
                  active={tab === "play"}
                />
                <div className="sprint-controls">
                  <div className="charge-label">
                    <span>Sprint charge</span>
                    <span className="small muted">
                      {state.phase === "charging"
                        ? `${Math.round(state.charge * 100)}%`
                        : "Aim for the bright zone"}
                    </span>
                  </div>
                  <div
                    className="charge-meter"
                    role="progressbar"
                    aria-label="Sprint charge"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(state.charge * 100)}
                  >
                    <div
                      className="charge-fill"
                      style={{ width: `${state.charge * 100}%` }}
                    />
                    <div className="nice-zone" />
                    <div className="perfect-zone" />
                    <i
                      style={{ left: `${Math.min(99.5, state.charge * 100)}%` }}
                    />
                  </div>
                  <button
                    className={`primary sprint-button ${state.phase === "charging" ? "is-charging" : ""}`}
                    disabled={
                      state.paused ||
                      state.phase === "airborne" ||
                      state.phase === "landing"
                    }
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      runner.press();
                    }}
                    onPointerUp={() => runner.release()}
                    onPointerCancel={() => runner.cancel()}
                    onLostPointerCapture={() => runner.cancel()}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={(e) => {
                      if (e.detail === 0) runner.tap();
                    }}
                  >
                    <Icon name="bolt" />
                    <span>{chargeText}</span>
                    <kbd>Space</kbd>
                  </button>
                  <div className="control-footer">
                    <span className="small muted">
                      <span className="desktop-only">Click</span>
                      <span className="touch-only">Tap</span> to run · Hold to
                      charge · Release to flip
                    </span>
                    <button className="text-button small" onClick={openHelp}>
                      How to play <Icon name="help" size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <ChainStrip />
            </div>
            <aside className="game-sidebar">
              <section className="runner-panel">
                <div className="section-title">
                  <h2>Your tiny powerhouse</h2>
                  <span className="small muted">No. 001</span>
                </div>
                <div className={`current-hamster skin-${p.skin}`}>
                  <span className="pixel-corner top-left" />
                  <span className="pixel-corner bottom-right" />
                  <img
                    src={`./assets/portrait-${p.skin}.png`}
                    width="144"
                    height="120"
                    alt={skin.name}
                  />
                  <span className="hamster-shadow" />
                </div>
                <div className="hamster-name">
                  <h3>{skin.name}</h3>
                  <a className="text-link small" href="#collection">
                    Change <Icon name="arrow" size={14} />
                  </a>
                </div>
                <div className="hamster-state">
                  <i className="status-dot" />
                  {state.paused
                    ? "On a break"
                    : state.fever > 0
                      ? "Feeling unstoppable"
                      : state.phase === "idle"
                        ? "Ready to roll"
                        : state.phase === "airborne"
                          ? "Airborne!"
                          : "Putting in the work"}
                </div>
              </section>
              <section className="combo-panel">
                <div className="combo-heading">
                  <span>
                    <Icon name="flame" size={18} />
                    Combo
                  </span>
                  <strong className="pixel" data-testid="combo">
                    {state.combo}×
                  </strong>
                </div>
                <div
                  className="combo-slots"
                  role="img"
                  aria-label={`${state.combo % 5} of 5 landings toward Fever`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={
                        i < state.combo % 5 || state.fever > 0 ? "filled" : ""
                      }
                    >
                      <Icon name={i === 4 ? "flame" : "spark"} size={18} />
                    </span>
                  ))}
                </div>
                <p className="small muted">
                  {state.fever > 0
                    ? `Fever Mode · ${(state.fever / 1000).toFixed(1)}s left · 2× points`
                    : `${5 - (state.combo % 5)} clean landings to Fever Mode`}
                </p>
              </section>
              <section className="quick-guide">
                <h2>Find your rhythm.</h2>
                <ol>
                  <li>
                    <span>01</span>
                    <div>
                      <strong>Get moving</strong>
                      <p>Tap to run and build Power.</p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>Feel the charge</strong>
                      <p>Hold until the bright zone.</p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>Stick the landing</strong>
                      <p>Release. Flip. Land on your paws.</p>
                    </div>
                  </li>
                </ol>
              </section>
              <div className="game-feedback">
                <Icon
                  name={
                    state.result === "PERFECT"
                      ? "spark"
                      : state.result === "MISS"
                        ? "heart"
                        : "hamster"
                  }
                  size={18}
                />
                <p className="small" role="status">
                  {state.message}
                </p>
              </div>
            </aside>
          </div>
          <div className="session-strip">
            <div>
              <Icon name="wheel" />
              <span className="muted small">Distance covered</span>
              <strong>{p.distance.toFixed(1)} m</strong>
            </div>
            <div>
              <Icon name="spark" />
              <span className="muted small">Perfect landings</span>
              <strong>{fmt(p.perfects)}</strong>
            </div>
            <div>
              <Icon name="trophy" />
              <span className="muted small">Lifetime Score</span>
              <strong>{fmt(p.totalScore)}</strong>
            </div>
            <a href="#upgrades" className="text-link small">
              Give your wheel an upgrade <Icon name="arrow" size={16} />
            </a>
          </div>
          {hasScoreService && (
            <section className="ranked-controls">
              <h2>
                {ranked
                  ? `Ranked run · ${ranked.name}`
                  : "Ready for the shared board?"}
              </h2>
              <p className="small muted">
                Ranked runs use standard equipment and server-validated actions.
                Maximum 5 minutes of active play.
              </p>
              {ranked ? (
                <button
                  className="secondary"
                  disabled={
                    rankPending ||
                    state.phase === "airborne" ||
                    state.phase === "landing"
                  }
                  onClick={() => void finish()}
                >
                  {rankPending ? "Verifying…" : "Finish & submit"}
                </button>
              ) : (
                <button
                  className="secondary"
                  disabled={rankPending}
                  onClick={() => void start()}
                >
                  {rankPending ? "Starting…" : "Start ranked run"}
                </button>
              )}
              {ranked && (
                <button
                  className="text-button"
                  disabled={rankPending}
                  onClick={() => {
                    setRanked(null);
                    runner.setRanked(false);
                    runner.resetSession();
                    setRankNote(
                      "Ranked run ended. Your local points are safe.",
                    );
                  }}
                >
                  End ranked run
                </button>
              )}
              <p role="status">{rankNote}</p>
            </section>
          )}
        </section>
        {tab === "upgrades" && <Upgrades runner={runner} state={state} />}{" "}
        {tab === "leaderboard" && <Leaderboard state={state} />}{" "}
        {tab === "collection" && <Collection runner={runner} state={state} />}{" "}
        {tab === "chain" && <ChainDashboard />}
      </main>
      <footer className="site-footer">
        <span>
          <span className="footer-mark">Squeek Runner</span> · A little wheel, a
          lot of heart.
        </span>
        <span>
          Virtual Power. Real fun.{" "}
          <span className="footer-note">No SQK rewards.</span>
        </span>
        <a href="https://squeekchain.com/" target="_blank" rel="noreferrer">
          Explore Squeekchain <Icon name="external" size={14} />
        </a>
      </footer>
      {help && (
        <Modal title="A perfect little flip." close={() => setHelp(false)}>
          <div className="help-hamster">
            <img
              src="./assets/portrait-classic.png"
              width="96"
              height="80"
              alt=""
            />
          </div>
          <ol className="help-steps">
            <li>
              <strong>Tap to run.</strong> Quick taps on the wheel or sprint
              button earn 1 Score and virtual Power.
            </li>
            <li>
              <strong>Hold to charge.</strong> Hold the wheel, sprint button or
              Space. Release around 72% charge, in the bright band.
            </li>
            <li>
              <strong>Land on your paws.</strong> A clean angle and controlled
              impact earn Nice or Perfect. Overcharging can cause a miss.
            </li>
            <li>
              <strong>Keep the combo.</strong> Five clean landings start 10
              seconds of Fever with double landing points.
            </li>
          </ol>
          <p className="muted small">
            A miss resets the combo, never your earned Score. Progress saves in
            this browser. The game pauses when you leave the tab.
          </p>
          <button
            className="primary full"
            onClick={() => {
              setHelp(false);
              runner.setPaused(false);
            }}
          >
            Back to the wheel <Icon name="arrow" size={16} />
          </button>
        </Modal>
      )}
    </>
  );
}
