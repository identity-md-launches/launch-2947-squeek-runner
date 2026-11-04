import pg from "pg";
import { createApp } from "./app";
if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL to a PostgreSQL database, then run npm run db:migrate.",
  );
  process.exit(1);
}
const production = process.env.NODE_ENV === "production";
const origin = process.env.SCORE_ORIGIN ?? "http://localhost:5173";
if (production && !process.env.SCORE_ORIGIN) {
  console.error(
    "Set SCORE_ORIGIN to the exact frontend origin for production.",
  );
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
await pool.query("SELECT 1");
const app = createApp(pool, {
  origin,
  production,
  crossSite: process.env.SCORE_CROSS_SITE === "1",
});
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, () =>
  console.log(`Squeek score service listening on port ${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  });
