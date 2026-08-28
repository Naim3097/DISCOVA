// DISCOVA worker — Stage 0: heartbeat.
// With DATABASE_URL set it writes a heartbeat row every 30s;
// without it, it ticks to the console so local dev needs no database.
import pg from "pg";

const VERSION = "0.1.0-stage0";
const once = process.argv.includes("--once");
const url = process.env.DATABASE_URL;

async function beat(pool) {
  await pool.query(`
    create table if not exists worker_heartbeat (
      id int primary key,
      last_beat timestamptz not null,
      version text not null
    )`);
  await pool.query(
    `insert into worker_heartbeat (id, last_beat, version) values (1, now(), $1)
     on conflict (id) do update set last_beat = now(), version = $1`,
    [VERSION]
  );
  console.log(`[discova-worker] heartbeat written ${new Date().toISOString()}`);
}

async function main() {
  console.log(`[discova-worker] ${VERSION} starting`);
  if (!url) {
    const tick = () =>
      console.log(`[discova-worker] tick ${new Date().toISOString()} (local mode — no DATABASE_URL)`);
    tick();
    if (!once) setInterval(tick, 30_000);
    return;
  }
  const pool = new pg.Pool({
    connectionString: url,
    ssl: /supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });
  await beat(pool);
  if (once) { await pool.end(); return; }
  setInterval(() => beat(pool).catch((e) => console.error("[discova-worker] beat failed:", e.message)), 30_000);
}

process.on("SIGTERM", () => process.exit(0));
main().catch((e) => { console.error("[discova-worker] fatal:", e.message); process.exit(1); });
