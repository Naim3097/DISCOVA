-- DISCOVA · Stage 1 — core data model (BUILD-PROMPT §4)

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  tier text not null check (tier in ('audit','investigation','intelligence')),
  framework_version text not null,
  status text not null default 'queued'
    check (status in ('queued','crawling','checking','verifying','scoring','writing','done','failed','partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  scores jsonb,
  competitor_urls text[] not null default '{}'
);

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  url text not null,
  template_cluster text,
  status_code int,
  raw_snapshot_path text,
  rendered_snapshot_path text,
  fetched_at timestamptz not null default now()
);

create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  check_id text not null,
  category text not null,
  severity text not null check (severity in ('critical','high','medium','low')),
  title text not null,
  evidence text,
  evidence_label text not null
    check (evidence_label in ('verified','likely','requires_external_data','not_testable')),
  verification text
    check (verification in ('raw_html','rendered_dom','runtime_js','image_review','none')),
  confidence numeric not null default 1.0,
  reach text check (reach in ('high','medium','low')),
  artifacts text[] not null default '{}',
  internal_detail text,
  client_summary text,
  effort text check (effort in ('quick_win','low','medium','high')),
  score_impact numeric not null default 0,
  status text not null default 'open' check (status in ('open','fixed','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists findings_run_idx on findings(run_id);
create index if not exists pages_run_idx on pages(run_id);

-- Internal tool: lock the public API out entirely.
-- RLS on with no policies = anon key sees nothing; the app and worker
-- use the service role, which bypasses RLS.
alter table runs enable row level security;
alter table pages enable row level security;
alter table findings enable row level security;
alter table worker_heartbeat enable row level security;
