create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (name)
);

insert into organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'MRD Advocacia')
on conflict do nothing;

create table if not exists users (
  email text primary key,
  organization_id uuid not null default '00000000-0000-4000-8000-000000000001' references organizations(id),
  name text not null,
  role text not null check (role in ('leader','administrador','advogado','analista','financeiro','operador','auditor')),
  password_hash text not null,
  must_change_password integer not null default 1 check (must_change_password in (0,1)),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  password_changed_at timestamptz,
  temporary_credential_created_at timestamptz
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on audit_logs (entity_type, entity_id, created_at desc);

create table if not exists pilot_edits (
  process_number text primary key,
  review_status text not null,
  priority text not null,
  responsible text,
  working_execution_classification text,
  credit_consolidated numeric(18,2),
  amount_received numeric(18,2),
  available_cash numeric(18,2),
  guarantee_status text,
  next_action text,
  legal_notes text,
  internal_notes text,
  updated_at timestamptz,
  updated_by text,
  audit_trail jsonb not null default '[]'::jsonb
);

create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null,
  updated_by text not null
);

create table if not exists ai_analysis_runs (
  id text primary key,
  process_number text not null,
  status text not null,
  provider text not null,
  prompt_version text not null,
  model_route text,
  requested_by text not null,
  requested_at timestamptz not null,
  updated_at timestamptz not null,
  sent_at timestamptz,
  completed_at timestamptz,
  analysis_prompt text not null,
  result_text text,
  result_payload jsonb,
  failure_message text
);
create index if not exists idx_ai_analysis_runs_process_updated
  on ai_analysis_runs (process_number, updated_at desc);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  legal_name text not null,
  trade_name text,
  tax_id text,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_companies_org_name on companies (organization_id, lower(legal_name));

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  company_id uuid references companies(id),
  process_number text not null,
  claimant_name text,
  court text,
  state text,
  city text,
  court_division text,
  procedural_class text,
  current_instance text,
  source text not null default 'pilot',
  analysis_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, process_number)
);
create index if not exists idx_cases_company on cases (company_id, analysis_status);
create index if not exists idx_cases_number on cases (process_number);

create table if not exists case_relationships (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null references cases(id) on delete cascade,
  target_case_id uuid not null references cases(id) on delete cascade,
  relationship_type text not null,
  confidence numeric(5,4),
  evidence_id uuid,
  human_review_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (source_case_id, target_case_id, relationship_type)
);

create table if not exists case_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  external_document_id text,
  original_name text not null,
  mime_type text not null,
  sha256 text not null,
  storage_path text not null,
  file_size bigint not null check (file_size >= 0),
  page_count integer,
  document_date date,
  filed_at timestamptz,
  source text not null default 'upload',
  processing_status text not null default 'pending',
  classification_status text not null default 'pending',
  extraction_status text not null default 'pending',
  extracted_markdown text,
  extraction_method text,
  extraction_error text,
  imported_at timestamptz not null default now(),
  unique (case_id, sha256)
);
create index if not exists idx_documents_case on case_documents (case_id, imported_at desc);
create index if not exists idx_documents_processing on case_documents (processing_status) where processing_status <> 'completed';

create table if not exists document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references case_documents(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  content text not null,
  content_sha256 text not null,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

create table if not exists evidence_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  document_id uuid references case_documents(id) on delete restrict,
  page_number integer,
  evidence_type text not null,
  excerpt text,
  locator jsonb,
  source_kind text not null default 'document',
  created_at timestamptz not null default now()
);
create index if not exists idx_evidence_case on evidence_items (case_id, created_at desc);

create table if not exists procedural_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  event_type text not null,
  event_date date,
  effective_date date,
  description text not null,
  source_document_id uuid references case_documents(id) on delete restrict,
  source_page integer,
  confidence numeric(5,4),
  is_fact boolean not null default true,
  human_review_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_events_case_date on procedural_events (case_id, event_date desc nulls last);

create table if not exists case_analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  ai_run_id text references ai_analysis_runs(id) on delete set null,
  process_phase text not null default 'indeterminado',
  execution_status text not null default 'nao_identificada',
  appeal_status text not null default 'nao_identificado',
  knowledge_finality text not null default 'nao_identificado',
  execution_finality text not null default 'nao_identificado',
  calculation_status text not null default 'nao_identificado',
  fgts_credit_status text not null default 'nao_identificado',
  confidence text not null default 'nao_informada',
  events_used integer not null default 0,
  evidence_count integer not null default 0,
  result_payload jsonb not null default '{}'::jsonb,
  human_review_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_analysis_case on case_analysis_snapshots (case_id, created_at desc);
create unique index if not exists idx_analysis_ai_run on case_analysis_snapshots (ai_run_id) where ai_run_id is not null;

create table if not exists calculation_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  calculation_type text not null,
  prepared_by text,
  document_id uuid references case_documents(id) on delete restrict,
  presentation_date date,
  reference_date date,
  gross_amount numeric(18,2),
  principal_amount numeric(18,2),
  interest_amount numeric(18,2),
  monetary_adjustment_amount numeric(18,2),
  fees_amount numeric(18,2),
  taxes_amount numeric(18,2),
  social_security_amount numeric(18,2),
  other_amount numeric(18,2),
  total_amount numeric(18,2),
  homologated boolean not null default false,
  homologation_date date,
  challenged boolean not null default false,
  stabilized boolean not null default false,
  superseded_by_id uuid references calculation_versions(id),
  confidence numeric(5,4),
  human_review_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_calculations_case on calculation_versions (case_id, reference_date desc nulls last);

create table if not exists credits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  base_calculation_id uuid references calculation_versions(id),
  gross_credit numeric(18,2) not null default 0,
  received_amount numeric(18,2) not null default 0,
  remaining_credit numeric(18,2) not null default 0,
  questioned_amount numeric(18,2) not null default 0,
  undisputed_amount numeric(18,2) not null default 0,
  stabilized_amount numeric(18,2) not null default 0,
  reference_date date,
  legal_status text not null default 'indeterminado',
  confidence numeric(5,4),
  last_recalculated_at timestamptz not null default now(),
  unique (case_id)
);

create table if not exists guarantees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  guarantee_type text not null,
  financial_nature text not null default 'garantia',
  amount numeric(18,2) not null check (amount >= 0),
  currency char(3) not null default 'BRL',
  creation_date date,
  deposit_date date,
  reference_date date,
  institution text,
  external_reference text,
  document_id uuid references case_documents(id) on delete restrict,
  status text not null default 'localizada',
  availability_status text not null default 'indeterminada',
  expiration_date date,
  released_amount numeric(18,2) not null default 0,
  remaining_amount numeric(18,2),
  notes text,
  confidence numeric(5,4),
  human_review_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_guarantees_case_type on guarantees (case_id, guarantee_type);
create index if not exists idx_guarantees_expiration on guarantees (expiration_date) where expiration_date is not null;

create table if not exists insurance_policies (
  id uuid primary key default gen_random_uuid(),
  guarantee_id uuid not null unique references guarantees(id) on delete cascade,
  insurer text,
  policy_number text,
  insured_amount numeric(18,2),
  start_date date,
  expiration_date date,
  endorsement_number text,
  replaced_policy_id uuid references insurance_policies(id),
  renewal_status text not null default 'indeterminado',
  notice_deadline date,
  claim_status text not null default 'nao_analisado',
  claim_date date,
  source_document_id uuid references case_documents(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists idx_policies_expiration on insurance_policies (expiration_date);

create table if not exists release_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  order_date date,
  issuance_date date,
  availability_date date,
  withdrawal_date date,
  received_date date,
  amount numeric(18,2),
  beneficiary text,
  source_document_id uuid references case_documents(id) on delete restrict,
  proof_document_id uuid references case_documents(id) on delete restrict,
  status text not null default 'determinado',
  reconciliation_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_release_orders_case on release_orders (case_id, order_date desc nulls last);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  payment_type text not null,
  financial_nature text not null default 'pagamento',
  amount numeric(18,2) not null check (amount >= 0),
  payment_date date,
  received_date date,
  payer text,
  beneficiary text,
  guarantee_id uuid references guarantees(id) on delete restrict,
  release_order_id uuid references release_orders(id) on delete restrict,
  document_id uuid references case_documents(id) on delete restrict,
  reconciliation_status text not null default 'pending',
  confidence numeric(5,4),
  human_review_status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint received_requires_proof check (received_date is null or document_id is not null)
);
create index if not exists idx_payments_case on payments (case_id, payment_date desc nulls last);

create table if not exists company_legal_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  company_id uuid not null references companies(id) on delete cascade,
  event_type text not null,
  event_date date not null,
  effective_date date,
  source text,
  source_document_id uuid references case_documents(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists legal_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  stable_key text not null,
  name text not null,
  category text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, stable_key)
);

create table if not exists legal_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references legal_rules(id) on delete cascade,
  version integer not null,
  status text not null default 'draft' check (status in ('draft','review','approved','deprecated')),
  description text not null,
  conditions jsonb not null,
  consequence jsonb not null,
  risk_level text not null,
  source_references jsonb not null default '[]'::jsonb,
  author_email text,
  reviewer_email text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (rule_id, version),
  constraint approved_rule_requires_reviewer check (status <> 'approved' or (reviewer_email is not null and approved_at is not null))
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  opportunity_type text not null,
  title text not null,
  description text not null,
  priority text not null,
  estimated_value numeric(18,2),
  rule_version_id uuid references legal_rule_versions(id) on delete restrict,
  confidence numeric(5,4),
  status text not null default 'pending_review',
  detected_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  disposition text,
  reason text
);
create index if not exists idx_opportunities_queue on opportunities (status, priority, detected_at desc);

create table if not exists opportunity_evidence (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  evidence_id uuid not null references evidence_items(id) on delete restrict,
  explanation text,
  primary key (opportunity_id, evidence_id)
);

create table if not exists golden_corpus_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  version text not null,
  input_payload jsonb not null,
  expected_payload jsonb not null,
  source_document_id uuid references case_documents(id) on delete restrict,
  approved_by text,
  approved_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name, version)
);

comment on table case_analysis_snapshots is
  'Conclusoes separadas dos fatos; toda conclusao deve manter eventos, evidencias, confianca e revisao humana.';
comment on table payments is
  'Pagamento e recebimento comprovado. Garantia, deposito e alvara expedido nao sao abatidos automaticamente.';
comment on table legal_rule_versions is
  'Somente versoes approved podem gerar oportunidades automaticas de producao.';
