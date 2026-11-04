BEGIN;
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 32),
  score bigint NOT NULL DEFAULT 0 CHECK (score >= 0),
  power numeric(24,4) NOT NULL DEFAULT 0,
  distance numeric(24,4) NOT NULL DEFAULT 0,
  best_combo integer NOT NULL DEFAULT 0,
  perfects integer NOT NULL DEFAULT 0,
  flips integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS runs_player ON runs(player_id);
CREATE TABLE IF NOT EXISTS scores (
  run_id uuid PRIMARY KEY REFERENCES runs(id),
  player_id uuid NOT NULL REFERENCES players(id),
  score bigint NOT NULL CHECK (score >= 0),
  distance numeric(24,4) NOT NULL,
  best_combo integer NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scores_period ON scores(finished_at, player_id);
COMMIT;
