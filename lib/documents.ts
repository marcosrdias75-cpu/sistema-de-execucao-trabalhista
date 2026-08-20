import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { getPool } from "@/lib/postgres";
import { getPilotCase, toProcessSlug } from "@/lib/seed-data";

const execFileAsync = promisify(execFile);
const organizationId = "00000000-0000-4000-8000-000000000001";

export interface CaseDocument {
  id: string;
  processNumber: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  processingStatus: string;
  extractionStatus: string;
  extractionMethod: string | null;
  extractionError: string | null;
  extractedMarkdown: string | null;
  importedAt: string;
}

function storageRoot() {
  return resolve(process.env.STORAGE_ROOT?.trim() || "/data/documents");
}

export async function ensureCase(processNumber: string) {
  const pilotCase = getPilotCase(processNumber);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    let companyId: string | null = null;
    if (pilotCase?.empresa) {
      const company = await client.query<{ id: string }>(
        `select id from companies where organization_id = $1 and lower(legal_name) = lower($2) limit 1`,
        [organizationId, pilotCase.empresa],
      );
      companyId = company.rows[0]?.id ?? null;
      if (!companyId) {
        companyId = randomUUID();
        await client.query(
          `insert into companies (id, organization_id, legal_name, trade_name, aliases)
           values ($1, $2, $3, $3, $4)`,
          [companyId, organizationId, pilotCase.empresa, ["Casas Bahia", "Via Varejo", "Via", "Ponto Frio"]],
        );
      }
    }

    const inserted = await client.query<{ id: string }>(
      `insert into cases (
         organization_id, company_id, process_number, claimant_name, procedural_class, source
       ) values ($1, $2, $3, $4, $5, 'pilot')
       on conflict (organization_id, process_number) do update set
         company_id = coalesce(cases.company_id, excluded.company_id),
         claimant_name = coalesce(cases.claimant_name, excluded.claimant_name),
         updated_at = now()
       returning id`,
      [
        organizationId,
        companyId,
        processNumber,
        pilotCase?.reclamante ?? null,
        pilotCase?.faseSituacaoProcesso ?? null,
      ],
    );
    await client.query("commit");
    return inserted.rows[0].id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function mapDocument(row: Record<string, unknown>): CaseDocument {
  return {
    id: String(row.id),
    processNumber: String(row.process_number),
    originalName: String(row.original_name),
    mimeType: String(row.mime_type),
    fileSize: Number(row.file_size),
    sha256: String(row.sha256),
    processingStatus: String(row.processing_status),
    extractionStatus: String(row.extraction_status),
    extractionMethod: row.extraction_method as string | null,
    extractionError: row.extraction_error as string | null,
    extractedMarkdown: row.extracted_markdown as string | null,
    importedAt: String(row.imported_at),
  };
}

export async function listCaseDocuments(processNumber: string, includeContent = false) {
  const result = await getPool().query(
    `select d.*, c.process_number
       from case_documents d
       join cases c on c.id = d.case_id
      where c.organization_id = $1 and c.process_number = $2
      order by d.imported_at desc`,
    [organizationId, processNumber],
  );
  return result.rows.map((row) => {
    const document = mapDocument(row);
    return includeContent ? document : { ...document, extractedMarkdown: null };
  });
}

async function convertWithMarkItDown(path: string) {
  const binary = process.env.MARKITDOWN_BIN?.trim() || "markitdown";
  const { stdout } = await execFileAsync(binary, [path], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: Number(process.env.MARKITDOWN_TIMEOUT_MS ?? 600_000),
  });
  if (!stdout.trim()) throw new Error("MarkItDown nao extraiu texto do documento.");
  return stdout;
}

export async function importPdf(input: {
  processNumber: string;
  originalName: string;
  bytes: Uint8Array;
}) {
  const maxBytes = Number(process.env.MAX_PDF_SIZE_BYTES ?? 100 * 1024 * 1024);
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > maxBytes) {
    throw new Error("PDF vazio ou acima do limite permitido.");
  }
  if (Buffer.from(input.bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    throw new Error("O arquivo enviado nao possui assinatura PDF valida.");
  }

  const caseId = await ensureCase(input.processNumber);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const duplicate = await getPool().query<{ id: string }>(
    "select id from case_documents where case_id = $1 and sha256 = $2",
    [caseId, sha256],
  );
  if (duplicate.rows[0]) return { duplicate: true, id: duplicate.rows[0].id };

  const id = randomUUID();
  const safeExtension = extname(input.originalName).toLowerCase() === ".pdf" ? ".pdf" : ".pdf";
  const path = join(storageRoot(), toProcessSlug(input.processNumber), `${id}${safeExtension}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, input.bytes, { flag: "wx", mode: 0o600 });

  await getPool().query(
    `insert into case_documents (
       id, organization_id, case_id, original_name, mime_type, sha256, storage_path,
       file_size, processing_status, extraction_status
     ) values ($1,$2,$3,$4,'application/pdf',$5,$6,$7,'processing','processing')`,
    [id, organizationId, caseId, input.originalName.slice(0, 255), sha256, path, input.bytes.byteLength],
  );

  try {
    const markdown = await convertWithMarkItDown(path);
    await getPool().query(
      `update case_documents set
         processing_status = 'completed', extraction_status = 'completed',
         extracted_markdown = $2, extraction_method = $3, extraction_error = null
       where id = $1`,
      [id, markdown, process.env.MARKITDOWN_VERSION?.trim() || "microsoft-markitdown"],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no MarkItDown.";
    await getPool().query(
      `update case_documents set processing_status = 'failed', extraction_status = 'failed', extraction_error = $2
       where id = $1`,
      [id, message.slice(0, 2000)],
    );
    throw error;
  }

  return { duplicate: false, id };
}

export async function getDocumentFile(id: string) {
  const result = await getPool().query<{
    storage_path: string;
    original_name: string;
    mime_type: string;
  }>(
    `select storage_path, original_name, mime_type from case_documents
      where id = $1 and organization_id = $2`,
    [id, organizationId],
  );
  const document = result.rows[0];
  if (!document) return null;
  const normalized = resolve(document.storage_path);
  if (!normalized.startsWith(`${storageRoot()}${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("Caminho de documento invalido.");
  }
  return { ...document, bytes: await readFile(normalized) };
}

export async function latestDocumentContext(processNumber: string) {
  const documents = await listCaseDocuments(processNumber, true);
  return documents
    .filter((document) => document.extractionStatus === "completed" && document.extractedMarkdown)
    .slice(0, 5)
    .map((document) => ({
      documentId: document.id,
      name: document.originalName,
      markdown: document.extractedMarkdown!.slice(0, 60_000),
      sha256: document.sha256,
    }));
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function listValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function persistStructuredAnalysis(input: {
  aiRunId: string;
  processNumber: string;
  payload: Record<string, unknown> | null;
}) {
  if (!input.payload) return;
  const caseId = await ensureCase(input.processNumber);
  const phase = objectValue(input.payload.faseProcessual);
  const execution = objectValue(input.payload.execucao);
  const appeals = objectValue(input.payload.recursos);
  const knowledge = objectValue(input.payload.transitoConhecimento);
  const executionFinality = objectValue(input.payload.transitoExecucao);
  const calculation = objectValue(input.payload.calculo);
  const fgts = objectValue(input.payload.creditoFgts);
  const evidenceCount = [phase, execution, appeals, knowledge, executionFinality, calculation, fgts]
    .reduce((sum, item) => sum + listValue(item.evidencias).length, 0);
  const events = listValue(input.payload.eventosEstruturados);
  const confidence = textValue(
    execution.confianca ?? phase.confianca ?? input.payload.confianca,
    "nao_informada",
  );
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query(
      `insert into case_analysis_snapshots (
         organization_id, case_id, ai_run_id, process_phase, execution_status,
         appeal_status, knowledge_finality, execution_finality, calculation_status,
         fgts_credit_status, confidence, events_used, evidence_count, result_payload
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (ai_run_id) where ai_run_id is not null do update set
         process_phase = excluded.process_phase,
         execution_status = excluded.execution_status,
         appeal_status = excluded.appeal_status,
         knowledge_finality = excluded.knowledge_finality,
         execution_finality = excluded.execution_finality,
         calculation_status = excluded.calculation_status,
         fgts_credit_status = excluded.fgts_credit_status,
         confidence = excluded.confidence,
         events_used = excluded.events_used,
         evidence_count = excluded.evidence_count,
         result_payload = excluded.result_payload`,
      [
        organizationId, caseId, input.aiRunId,
        textValue(phase.status, "indeterminado"),
        textValue(execution.status, "nao_identificada"),
        textValue(appeals.status, "nao_identificado"),
        textValue(knowledge.status, "nao_identificado"),
        textValue(executionFinality.status, "nao_identificado"),
        textValue(calculation.status, "nao_identificado"),
        textValue(fgts.status, "nao_identificado"),
        confidence, events.length, evidenceCount, JSON.stringify(input.payload),
      ],
    );

    for (const rawEvent of events.slice(0, 500)) {
      const event = objectValue(rawEvent);
      const description = textValue(event.efeito ?? event.descricao, "Evento extraido para revisao");
      await client.query(
        `insert into procedural_events (
           organization_id, case_id, event_type, event_date, description,
           source_page, confidence, is_fact, human_review_status
         ) values ($1,$2,$3,$4,$5,$6,$7,false,'pending')`,
        [
          organizationId, caseId, textValue(event.tipo, "outro"),
          typeof event.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.data) ? event.data : null,
          description,
          typeof event.pagina === "number" && Number.isInteger(event.pagina) ? event.pagina : null,
          event.confianca === "alta" ? 0.9 : event.confianca === "media" ? 0.65 : 0.35,
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
