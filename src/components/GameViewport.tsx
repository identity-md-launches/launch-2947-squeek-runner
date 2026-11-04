import { useEffect, useRef, useState } from "react";
import { Runner, type RunnerState } from "../game/Runner";
import { Icon } from "./Icon";
export function GameViewport({
  runner,
  state,
  active,
}: {
  runner: Runner;
  state: RunnerState;
  active: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let game: import("phaser").Game | undefined,
      disposed = false;
    let observer: ResizeObserver | undefined;
    void Promise.all([import("phaser"), import("../game/MiningScene")])
      .then(([{ default: Phaser }, { MiningScene }]) => {
        if (disposed || !host.current) return;
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: host.current,
          transparent: true,
          pixelArt: true,
          roundPixels: true,
          antialias: false,
          scale: {
            mode: Phaser.Scale.NONE,
            width: host.current.clientWidth || 960,
            height: host.current.clientHeight || 520,
          },
          physics: {
            default: "arcade",
            arcade: { gravity: { x: 0, y: 0 }, fps: 120, fixedStep: true },
          },
          scene: new MiningScene(
            runner,
            () => {
              if (!disposed) setReady(true);
            },
            () => {
              if (!disposed) setFailed(true);
            },
          ),
          audio: { noAudio: true },
          banner: false,
        });
        // Hidden screens report a zero-sized parent. Retain the last valid
        // framebuffer and resize only when the game has a visible viewport.
        observer = new ResizeObserver(([entry]) => {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0)
            game?.scale.resize(Math.round(width), Math.round(height));
        });
        observer.observe(host.current);
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      observer?.disconnect();
      game?.destroy(true);
    };
  }, [runner]);
  useEffect(() => {
    if (!active) return;
    const gameplayTarget = (e: KeyboardEvent) =>
      !document.querySelector("dialog[open]") &&
      e.target instanceof HTMLElement &&
      !e.target.closest("input,textarea,select,a,button:not(.sprint-button)");
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || !gameplayTarget(e)) return;
      e.preventDefault();
      runner.press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && gameplayTarget(e)) {
        e.preventDefault();
        runner.release();
      }
    };
    const release = () => runner.release();
    const blur = () => runner.setPaused(true);
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("pointerup", release);
    addEventListener("blur", blur);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("pointerup", release);
      removeEventListener("blur", blur);
    };
  }, [active, runner]);
  return (
    <div
      className={`game-stage ${state.fever > 0 ? "fever-stage" : ""}`}
      data-phase={state.phase}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={host} className="phaser-host" />
      <div className="stage-top">
        <span className="play-label">
          <i className="status-dot" />
          {state.fever > 0
            ? `Fever ×2 · ${(state.fever / 1000).toFixed(1)}s`
            : state.ranked
              ? "Ranked run"
              : "Free play"}
        </span>
        <div className="stage-tools" hidden={state.paused}>
          <button
            className="icon-button"
            onClick={() => runner.toggleSound()}
            aria-label={state.sound ? "Mute sound" : "Enable sound"}
            aria-pressed={state.sound}
          >
            <Icon name={state.sound ? "sound" : "muted"} size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => runner.setPaused(!state.paused)}
            aria-label={state.paused ? "Resume game" : "Pause game"}
          >
            <Icon name={state.paused ? "play" : "pause"} size={18} />
          </button>
        </div>
      </div>
      {!ready && !failed && (
        <div className="game-cover">
          <img
            src="./assets/portrait-classic.png"
            width="96"
            height="80"
            alt=""
          />
          <p>Waking up the hamster…</p>
        </div>
      )}
      {failed && (
        <div className="game-cover">
          <p>The game couldn’t load.</p>
          <button className="secondary" onClick={() => location.reload()}>
            Reload game
          </button>
        </div>
      )}
      {state.paused && ready && (
        <div className="game-cover paused-cover">
          <Icon name="pause" size={28} />
          <h2>Taking a breather.</h2>
          <button className="primary" onClick={() => runner.setPaused(false)}>
            <Icon name="play" />
            Resume game
          </button>
        </div>
      )}
      {state.phase === "idle" && !state.paused && ready && (
        <div className="stage-hint">
          Tap the wheel to wake those paws <Icon name="arrow" size={14} />
        </div>
      )}
    </div>
  );
}
