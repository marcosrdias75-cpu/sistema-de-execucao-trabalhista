import { createHash, randomUUID } from "node:crypto";
import { ensureCase } from "@/lib/documents";
import { getPool } from "@/lib/postgres";
import { getPilotCase, toProcessSlug } from "@/lib/seed-data";

export type DocumentReadingStatus =
  | "queued"
  | "awaiting_storage"
  | "text_available"
  | "ocr_queued"
  | "ocr_running"
  | "review_pending"
  | "reviewed"
  | "failed";

export interface DocumentRecord {
  id: string;
  caseId: string;
  processNumber: string | null;
  documentType: string | null;
  title: string;
  pjeDocumentId: string | null;
  sourceUrl: string | null;
  fileHash: string | null;
  storageKey: string | null;
  extractedText: string | null;
  documentDate: string | null;
  readingStatus: DocumentReadingStatus;
  createdAt: string;
}

export interface OcrRunRecord {
  id: string;
  documentId: string;
  status: string;
  engine: string | null;
  engineVersion: string | null;
  language: string | null;
  parameters: Record<string, unknown> | null;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  confidence: number | null;
  errorMessage: string | null;
}

function hashFallback(...values: Array<string | null | undefined>) {
  return createHash("sha256").update(values.filter(Boolean).join("\n")).digest("hex");
}

function readingStatus(row: Record<string, unknown>): DocumentReadingStatus {
  const processing = String(row.processing_status ?? "");
  const extraction = String(row.extraction_status ?? "");

  if (processing === "failed" || extraction === "failed") return "failed";
  if (processing === "ocr_queued") return "ocr_queued";
  if (processing === "ocr_running") return "ocr_running";
  if (processing === "reviewed") return "reviewed";
  if (extraction === "completed" || row.extracted_markdown) return "text_available";
  if (processing === "pending" || processing === "processing") return "awaiting_storage";
  return "queued";
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function resolveProcessNumber(input: { caseId?: string; processNumber?: string }) {
  if (input.processNumber) return input.processNumber;

  const legacyPilotCase = getPilotCase(input.caseId?.replace(/^case_/, "") ?? "");
  if (legacyPilotCase) return legacyPilotCase.processNumber;

  if (!input.caseId) return null;

  const result = await getPool().query<{ process_number: string }>(
    "select process_number from cases where id = $1 limit 1",
    [input.caseId],
  );
  return result.rows[0]?.process_number ?? null;
}

function rowToDocument(row: Record<string, unknown>): DocumentRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    processNumber: row.process_number ? String(row.process_number) : null,
    documentType: row.source ? String(row.source) : null,
    title: String(row.original_name ?? "Documento sem titulo"),
    pjeDocumentId: row.external_document_id ? String(row.external_document_id) : null,
    sourceUrl: row.external_document_id ? String(row.external_document_id) : null,
    fileHash: row.sha256 ? String(row.sha256) : null,
    storageKey: row.storage_path ? String(row.storage_path) : null,
    extractedText: row.extracted_markdown ? String(row.extracted_markdown) : null,
    documentDate: row.document_date ? String(row.document_date) : null,
    readingStatus: readingStatus(row),
    createdAt: String(row.imported_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function rowToOcrRun(row: Record<string, unknown>): OcrRunRecord {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    status: String(row.status),
    engine: row.engine ? String(row.engine) : null,
    engineVersion: row.engine_version ? String(row.engine_version) : null,
    language: row.language ? String(row.language) : null,
    parameters: parseJson(row.parameters),
    requestedBy: String(row.requested_by),
    requestedAt: String(row.requested_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    errorMessage: row.error_message ? String(row.error_message) : null,
  };
}

export async function listDocuments(processNumber?: string) {
  const params: unknown[] = [];
  let where = "";

  if (processNumber) {
    params.push(processNumber);
    where = "where c.process_number = $1";
  }

  const result = await getPool().query(
    `select d.*, c.process_number
       from case_documents d
       left join cases c on c.id = d.case_id
       ${where}
      order by d.imported_at desc`,
    params,
  );

  return result.rows.map(rowToDocument);
}

export async function getDocument(id: string) {
  const result = await getPool().query(
    `select d.*, c.process_number
       from case_documents d
       left join cases c on c.id = d.case_id
      where d.id = $1
      limit 1`,
    [id],
  );

  return result.rows[0] ? rowToDocument(result.rows[0]) : null;
}

export async function createDocument(input: {
  caseId?: string;
  processNumber?: string;
  title: string;
  documentType?: string | null;
  pjeDocumentId?: string | null;
  sourceUrl?: string | null;
  fileHash?: string | null;
  storageKey?: string | null;
  extractedText?: string | null;
  documentDate?: string | null;
  readingStatus?: DocumentReadingStatus;
}) {
  const processNumber = await resolveProcessNumber(input);

  if (!processNumber) {
    throw new Error("Processo nao informado para o documento.");
  }

  const caseId = await ensureCase(processNumber);
  const id = randomUUID();
  const sha256 = input.fileHash ?? hashFallback(input.title, input.sourceUrl, input.extractedText, id);
  const storagePath =
    input.storageKey ??
    input.sourceUrl ??
    `manual://${toProcessSlug(processNumber)}/${id}`;
  const hasText = Boolean(input.extractedText?.trim());
  const processingStatus =
    input.readingStatus === "failed"
      ? "failed"
      : hasText
        ? "completed"
        : "pending";
  const extractionStatus =
    input.readingStatus === "failed"
      ? "failed"
      : hasText
        ? "completed"
        : "pending";

  const duplicate = await getPool().query<{ id: string }>(
    "select id from case_documents where case_id = $1 and sha256 = $2 limit 1",
    [caseId, sha256],
  );

  if (duplicate.rows[0]) return getDocument(duplicate.rows[0].id);

  await getPool().query(
    `insert into case_documents (
       id, organization_id, case_id, external_document_id, original_name, mime_type,
       sha256, storage_path, file_size, document_date, source, processing_status,
       extraction_status, extracted_markdown, extraction_method, extraction_error
     ) values (
       $1, '00000000-0000-4000-8000-000000000001', $2, $3, $4, $5,
       $6, $7, $8, $9, $10, $11, $12, $13, $14, null
     )`,
    [
      id,
      caseId,
      input.pjeDocumentId ?? input.sourceUrl ?? null,
      input.title.trim() || "Documento importado manualmente",
      "text/plain",
      sha256,
      storagePath,
      input.extractedText ? Buffer.byteLength(input.extractedText, "utf8") : 0,
      input.documentDate || null,
      input.documentType ?? "manual",
      processingStatus,
      extractionStatus,
      input.extractedText ?? null,
      hasText ? "manual" : null,
    ],
  );

  return getDocument(id);
}

export async function queueOcr(input: { documentId: string; requestedBy: string }) {
  const document = await getDocument(input.documentId);
  if (!document) throw new Error("Documento nao encontrado.");

  const existing = await getPool().query(
    `select * from ocr_runs
      where document_id = $1 and status in ('queued', 'running', 'completed')
      order by requested_at desc
      limit 1`,
    [input.documentId],
  );

  if (existing.rows[0]) return rowToOcrRun(existing.rows[0]);

  const id = randomUUID();
  const now = new Date().toISOString();

  await getPool().query(
    `insert into ocr_runs (
       id, document_id, status, engine, engine_version, language, parameters,
       requested_by, requested_at, started_at, completed_at, confidence, error_message
     ) values ($1,$2,'queued','tesseract/ocrmypdf',null,'por',$3,$4,$5,null,null,null,null)`,
    [id, input.documentId, JSON.stringify({ output: ["text", "hocr", "pdf"] }), input.requestedBy, now],
  );
  await getPool().query(
    "update case_documents set processing_status = 'ocr_queued' where id = $1",
    [input.documentId],
  );

  return getOcrRun(id);
}

export async function listQueuedOcrRuns(limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const result = await getPool().query(
    `select r.*, d.original_name as title, d.storage_path, d.sha256 as file_hash,
            d.source as document_type, d.external_document_id as source_url,
            d.extracted_markdown as extracted_text
       from ocr_runs r
       join case_documents d on d.id = r.document_id
      where r.status = 'queued'
      order by r.requested_at asc
      limit $1`,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    ...rowToOcrRun(row),
    title: String(row.title ?? "Documento"),
    storageKey: row.storage_path ? String(row.storage_path) : null,
    fileHash: row.file_hash ? String(row.file_hash) : null,
    documentType: row.document_type ? String(row.document_type) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    extractedText: row.extracted_text ? String(row.extracted_text) : null,
  }));
}

export async function markOcrRunStarted(runId: string) {
  const now = new Date().toISOString();
  await getPool().query(
    "update ocr_runs set status = 'running', started_at = $1 where id = $2 and status = 'queued'",
    [now, runId],
  );
  await getPool().query(
    `update case_documents set processing_status = 'ocr_running'
      where id = (select document_id from ocr_runs where id = $1)`,
    [runId],
  );
  return getOcrRun(runId);
}

export async function getOcrRun(id: string) {
  const result = await getPool().query("select * from ocr_runs where id = $1", [id]);
  return result.rows[0] ? rowToOcrRun(result.rows[0]) : null;
}

export async function listOcrRuns(documentId: string) {
  const result = await getPool().query(
    "select * from ocr_runs where document_id = $1 order by requested_at desc",
    [documentId],
  );
  return result.rows.map(rowToOcrRun);
}

export async function completeOcrRun(input: {
  runId: string;
  extractedText: string;
  confidence?: number | null;
  pages?: Array<{ pageNumber: number; text: string; hocr?: string | null; confidence?: number | null }>;
}) {
  const run = await getOcrRun(input.runId);
  if (!run) throw new Error("Execucao OCR nao encontrada.");
  const now = new Date().toISOString();
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query(
      "update ocr_runs set status = 'completed', completed_at = $1, confidence = $2, error_message = null where id = $3",
      [now, input.confidence ?? null, input.runId],
    );
    await client.query(
      `update case_documents set
         extracted_markdown = $1,
         processing_status = 'completed',
         extraction_status = 'completed',
         extraction_method = 'ocr-worker',
         extraction_error = null
       where id = $2`,
      [input.extractedText, run.documentId],
    );

    for (const page of input.pages ?? []) {
      const contentSha = createHash("sha256").update(page.text).digest("hex");
      await client.query(
        `insert into document_pages (document_id, page_number, content, content_sha256)
         values ($1, $2, $3, $4)
         on conflict (document_id, page_number) do update set
           content = excluded.content,
           content_sha256 = excluded.content_sha256`,
        [run.documentId, page.pageNumber, page.text, contentSha],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getOcrRun(input.runId);
}

export async function failOcrRun(runId: string, errorMessage: string) {
  const run = await getOcrRun(runId);
  if (!run) throw new Error("Execucao OCR nao encontrada.");
  const now = new Date().toISOString();
  await getPool().query(
    "update ocr_runs set status = 'failed', completed_at = $1, error_message = $2 where id = $3",
    [now, errorMessage, runId],
  );
  await getPool().query(
    "update case_documents set processing_status = 'failed', extraction_status = 'failed', extraction_error = $1 where id = $2",
    [errorMessage, run.documentId],
  );
  return getOcrRun(runId);
}

export async function reviewDocument(input: {
  documentId: string;
  pageId?: string | null;
  status: "approved" | "rejected" | "corrected";
  sourceExcerpt?: string | null;
  correctedValue?: string | null;
  notes?: string | null;
  reviewedBy: string;
}) {
  const now = new Date().toISOString();
  await getPool().query(
    `insert into human_reviews (
       id, document_id, page_id, review_type, status, source_excerpt,
       corrected_value, notes, reviewed_by, reviewed_at
     ) values ($1,$2,$3,'document_text',$4,$5,$6,$7,$8,$9)`,
    [
      randomUUID(),
      input.documentId,
      input.pageId ?? null,
      input.status,
      input.sourceExcerpt ?? null,
      input.correctedValue ?? null,
      input.notes ?? null,
      input.reviewedBy,
      now,
    ],
  );
  await getPool().query(
    "update case_documents set processing_status = 'reviewed' where id = $1",
    [input.documentId],
  );
  return getDocument(input.documentId);
}

export async function listReviews(documentId: string) {
  const result = await getPool().query(
    "select * from human_reviews where document_id = $1 order by reviewed_at desc",
    [documentId],
  );
  return result.rows;
}
