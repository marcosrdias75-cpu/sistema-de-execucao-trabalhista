create table if not exists questionnaire_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-4000-8000-000000000001' references organizations(id),
  process_number text not null,
  claimant_name text,
  court text,
  pje_url text,
  answers jsonb not null,
  attachments jsonb not null default '[]'::jsonb,
  report_storage_key text,
  drive_status text not null default 'pending'
    check (drive_status in ('pending', 'uploaded', 'pending_credentials', 'failed')),
  drive_folder_id text,
  drive_folder_url text,
  drive_files jsonb not null default '[]'::jsonb,
  drive_error text,
  submitted_by text not null,
  submitted_by_name text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_questionnaire_submissions_process
  on questionnaire_submissions(process_number, submitted_at desc);

create index if not exists idx_questionnaire_submissions_drive_status
  on questionnaire_submissions(drive_status, submitted_at desc);
