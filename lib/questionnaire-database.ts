import { postgresDatabase } from "@/lib/postgres";
import type { QuestionnaireAnswers } from "@/lib/questionnaire-schema";

export interface QuestionnaireAttachment {
  driveFileId?: string | null;
  driveUrl?: string | null;
  mimeType: string;
  originalName: string;
  sha256: string;
  size: number;
  storageKey: string;
}

export interface QuestionnaireDriveFile {
  id: string;
  mimeType: string | null;
  name: string;
  size: number | null;
  webViewLink: string | null;
}

export interface QuestionnaireSubmission {
  answers: QuestionnaireAnswers;
  attachments: QuestionnaireAttachment[];
  claimantName: string | null;
  court: string | null;
  driveError: string | null;
  driveFiles: QuestionnaireDriveFile[];
  driveFolderId: string | null;
  driveFolderUrl: string | null;
  driveStatus: string;
  id: string;
  pjeUrl: string | null;
  processNumber: string;
  reportStorageKey: string | null;
  submittedAt: string;
  submittedBy: string;
  submittedByName: string;
  updatedAt: string;
}

function getDb() {
  return postgresDatabase;
}

export async function ensureQuestionnaireDatabase() {
  const db = getDb();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS questionnaire_submissions (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
      process_number TEXT NOT NULL,
      claimant_name TEXT,
      court TEXT,
      pje_url TEXT,
      answers JSONB NOT NULL,
      attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      report_storage_key TEXT,
      drive_status TEXT NOT NULL DEFAULT 'pending',
      drive_folder_id TEXT,
      drive_folder_url TEXT,
      drive_files JSONB NOT NULL DEFAULT '[]'::jsonb,
      drive_error TEXT,
      submitted_by TEXT NOT NULL,
      submitted_by_name TEXT NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_questionnaire_submissions_process
      ON questionnaire_submissions(process_number, submitted_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_questionnaire_submissions_drive_status
      ON questionnaire_submissions(drive_status, submitted_at DESC)`),
  ]);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function rowToSubmission(row: Record<string, unknown>): QuestionnaireSubmission {
  return {
    answers: parseJson<QuestionnaireAnswers>(row.answers, {} as QuestionnaireAnswers),
    attachments: parseJson<QuestionnaireAttachment[]>(row.attachments, []),
    claimantName: row.claimant_name as string | null,
    court: row.court as string | null,
    driveError: row.drive_error as string | null,
    driveFiles: parseJson<QuestionnaireDriveFile[]>(row.drive_files, []),
    driveFolderId: row.drive_folder_id as string | null,
    driveFolderUrl: row.drive_folder_url as string | null,
    driveStatus: String(row.drive_status),
    id: String(row.id),
    pjeUrl: row.pje_url as string | null,
    processNumber: String(row.process_number),
    reportStorageKey: row.report_storage_key as string | null,
    submittedAt: String(row.submitted_at),
    submittedBy: String(row.submitted_by),
    submittedByName: String(row.submitted_by_name),
    updatedAt: String(row.updated_at),
  };
}

export async function createQuestionnaireSubmission(input: {
  answers: QuestionnaireAnswers;
  attachments: QuestionnaireAttachment[];
  id: string;
  reportStorageKey: string;
  submittedAt: string;
  submittedBy: string;
  submittedByName: string;
}) {
  await ensureQuestionnaireDatabase();
  await getDb()
    .prepare(
      `INSERT INTO questionnaire_submissions (
        id, process_number, claimant_name, court, pje_url, answers,
        attachments, report_storage_key, drive_status, submitted_by,
        submitted_by_name, submitted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.answers.processNumber,
      input.answers.claimantName || null,
      input.answers.court || null,
      input.answers.pjeUrl || null,
      JSON.stringify(input.answers),
      JSON.stringify(input.attachments),
      input.reportStorageKey,
      "pending",
      input.submittedBy,
      input.submittedByName,
      input.submittedAt,
      input.submittedAt,
    )
    .run();

  return getQuestionnaireSubmission(input.id);
}

export async function updateQuestionnaireDriveStatus(input: {
  driveError?: string | null;
  driveFiles?: QuestionnaireDriveFile[];
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  id: string;
  status: "uploaded" | "pending_credentials" | "failed";
}) {
  await ensureQuestionnaireDatabase();
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `UPDATE questionnaire_submissions
       SET drive_status = ?, drive_folder_id = ?, drive_folder_url = ?,
           drive_files = ?::jsonb, drive_error = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.status,
      input.driveFolderId ?? null,
      input.driveFolderUrl ?? null,
      JSON.stringify(input.driveFiles ?? []),
      input.driveError ?? null,
      now,
      input.id,
    )
    .run();
}

export async function listQuestionnaireSubmissions(limit = 50) {
  await ensureQuestionnaireDatabase();
  const result = await getDb()
    .prepare(
      `SELECT * FROM questionnaire_submissions
       ORDER BY submitted_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<Record<string, unknown>>();
  return result.results.map(rowToSubmission);
}

export async function getQuestionnaireSubmission(id: string) {
  await ensureQuestionnaireDatabase();
  const row = await getDb()
    .prepare("SELECT * FROM questionnaire_submissions WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();

  return row ? rowToSubmission(row) : null;
}
