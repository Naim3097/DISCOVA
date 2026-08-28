-- DISCOVA · Stage 0
-- The worker upserts one row here every 30 seconds; the dashboard reads it
-- to show whether the engine is alive.
create table if not exists worker_heartbeat (
  id int primary key,
  last_beat timestamptz not null,
  version text not null
);
