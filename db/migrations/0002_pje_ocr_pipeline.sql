create table if not exists pje_connectors (
  id uuid primary key default gen_random_uuid(),
  tribunal_code text not null,
  name text not null,
  environment text not null,
  base_url text not null,
  api_version text,
  auth_mode text not null default 'navegador_controlado',
  credential_ref text,
  status text not null default 'draft',
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tribunal_code, environment)
);

create table if not exists pje_capture_runs (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid references pje_connectors(id) on delete set null,
  case_id uuid references cases(id) on delete set null,
  status text not null default 'queued',
  cursor text,
  requested_by text not null,
  started_at timestamptz,
  completed_at timestamptz,
  items_found integer,
  items_imported integer,
  error_message text
);
create index if not exists idx_pje_capture_runs_status on pje_capture_runs(status);

create table if not exists pje_link_targets (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  process_number text not null,
  source_url text not null,
  tribunal_code text,
  link_kind text not null default 'unknown',
  status text not null default 'registered',
  last_payload_hash text,
  last_capture_run_id uuid references pje_capture_runs(id) on delete set null,
  last_captured_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_url)
);
create index if not exists idx_pje_link_targets_case on pje_link_targets(case_id);
create index if not exists idx_pje_link_targets_status on pje_link_targets(status);

create table if not exists pje_snapshots (
  id uuid primary key default gen_random_uuid(),
  capture_run_id uuid references pje_capture_runs(id) on delete set null,
  case_id uuid not null references cases(id) on delete cascade,
  snapshot_type text not null,
  source_url text,
  storage_key text,
  payload_hash text not null,
  captured_at timestamptz not null default now(),
  unique (case_id, payload_hash)
);
create index if not exists idx_pje_snapshots_case on pje_snapshots(case_id, captured_at desc);

create table if not exists ocr_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references case_documents(id) on delete cascade,
  status text not null default 'queued',
  engine text,
  engine_version text,
  language text,
  parameters jsonb,
  requested_by text not null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  confidence numeric(5,4),
  error_message text
);
create index if not exists idx_ocr_runs_document_requested on ocr_runs(document_id, requested_at desc);
create index if not exists idx_ocr_runs_status on ocr_runs(status);

create table if not exists human_reviews (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references case_documents(id) on delete cascade,
  page_id uuid references document_pages(id) on delete set null,
  review_type text not null,
  status text not null,
  source_excerpt text,
  corrected_value text,
  notes text,
  reviewed_by text not null,
  reviewed_at timestamptz not null default now()
);
create index if not exists idx_human_reviews_document_status on human_reviews(document_id, status);
