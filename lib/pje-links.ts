import { postgresDatabase } from "@/lib/postgres";
import { ensureCase } from "@/lib/documents";
import { normalizeCnj, formatCnj, tribunalFromCnj } from "@/lib/pje";

export type PjeLinkKind = "process_detail" | "external_case_panel" | "public_consulta" | "unknown";

export interface PjeLinkTargetRecord {
  id: string;
  caseId: string;
  processNumber: string;
  sourceUrl: string;
  tribunalCode: string | null;
  linkKind: PjeLinkKind;
  status: string;
  lastPayloadHash: string | null;
  lastCaptureRunId: string | null;
  lastCapturedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

function db() {
  return postgresDatabase;
}

function rowToTarget(row: Record<string, unknown>): PjeLinkTargetRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    processNumber: String(row.process_number),
    sourceUrl: String(row.source_url),
    tribunalCode: row.tribunal_code ? String(row.tribunal_code) : null,
    linkKind: String(row.link_kind) as PjeLinkKind,
    status: String(row.status),
    lastPayloadHash: row.last_payload_hash ? String(row.last_payload_hash) : null,
    lastCaptureRunId: row.last_capture_run_id ? String(row.last_capture_run_id) : null,
    lastCapturedAt: row.last_captured_at ? String(row.last_captured_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function classifyPjeLink(rawUrl: string): { url: string; kind: PjeLinkKind; tribunalCode: string | null } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Informe uma URL válida do processo PJe.");
  }
  if (parsed.protocol !== "https:") throw new Error("O link do PJe deve usar HTTPS.");
  if (parsed.username || parsed.password) throw new Error("A URL não pode conter usuário ou senha embutidos.");
  if (parsed.port && parsed.port !== "443") throw new Error("O link do PJe deve usar a porta HTTPS padrão.");
  const host = parsed.hostname.toLocaleLowerCase("pt-BR");
  const allowed = host === "pje.jus.br" || host.endsWith(".pje.jus.br") || host.endsWith(".jus.br");
  if (!allowed) throw new Error("Por segurança, o link deve pertencer a um domínio oficial do Judiciário (.jus.br).");
  const path = parsed.pathname.toLocaleLowerCase("pt-BR");
  const kind = path.includes("/pjekz/processo/") && path.endsWith("/detalhe")
    ? "process_detail"
    : path.includes("/pjekz/painel/usuario-externo/")
      ? "external_case_panel"
      : host === "comunica.pje.jus.br" || path.includes("/consulta")
        ? "public_consulta"
        : "unknown";
  const tribunalMatch = host.match(/pje\.trt(\d+)\.jus\.br/);
  return { url: parsed.toString(), kind, tribunalCode: tribunalMatch ? `TRT${tribunalMatch[1]}` : null };
}

export function validatePjeLinkInput(input: { processNumber: string; sourceUrl: string }) {
  const normalized = normalizeCnj(input.processNumber);
  if (!normalized) throw new Error("Número CNJ inválido.");
  const classified = classifyPjeLink(input.sourceUrl);
  return { processNumber: formatCnj(normalized), normalizedNumber: normalized, ...classified, tribunalCode: classified.tribunalCode ?? tribunalFromCnj(normalized) };
}

export async function getPjeLinkTarget(id: string) {
  const result = await db().prepare("SELECT * FROM pje_link_targets WHERE id = ? LIMIT 1").bind(id).first<Record<string, unknown>>();
  return result ? rowToTarget(result) : null;
}

export async function listPjeLinkTargets(processNumber?: string) {
  const query = processNumber
    ? "SELECT * FROM pje_link_targets WHERE process_number = ? ORDER BY updated_at DESC"
    : "SELECT * FROM pje_link_targets ORDER BY updated_at DESC";
  const statement = db().prepare(query);
  const result = processNumber ? await statement.bind(processNumber).all<Record<string, unknown>>() : await statement.all<Record<string, unknown>>();
  return result.results.map(rowToTarget);
}

export async function upsertPjeLinkTarget(input: { caseId: string; processNumber: string; sourceUrl: string; tribunalCode: string | null; linkKind: PjeLinkKind }) {
  const caseId = await ensureCase(input.processNumber);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db().prepare(`INSERT INTO pje_link_targets (
    id, case_id, process_number, source_url, tribunal_code, link_kind, status,
    last_payload_hash, last_capture_run_id, last_captured_at, last_error, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(source_url) DO UPDATE SET
    case_id = excluded.case_id, process_number = excluded.process_number, tribunal_code = excluded.tribunal_code,
    link_kind = excluded.link_kind, status = CASE WHEN pje_link_targets.status = 'captured' THEN pje_link_targets.status ELSE excluded.status END,
    updated_at = excluded.updated_at`).bind(id, caseId, input.processNumber, input.sourceUrl, input.tribunalCode, input.linkKind, "registered", null, null, null, null, now, now).run();
  const result = await db().prepare("SELECT * FROM pje_link_targets WHERE source_url = ? LIMIT 1").bind(input.sourceUrl).first<Record<string, unknown>>();
  return result ? rowToTarget(result) : null;
}

export async function updatePjeLinkTargetCapture(input: { id: string; status: "queued" | "capturing" | "captured" | "unchanged" | "awaiting_authorization" | "failed"; payloadHash?: string | null; captureRunId?: string | null; error?: string | null }) {
  const now = new Date().toISOString();
  await db().prepare(`UPDATE pje_link_targets SET status = ?, last_payload_hash = COALESCE(?, last_payload_hash), last_capture_run_id = COALESCE(?, last_capture_run_id), last_captured_at = CASE WHEN ? IN ('captured', 'unchanged') THEN ? ELSE last_captured_at END, last_error = ?, updated_at = ? WHERE id = ?`).bind(input.status, input.payloadHash ?? null, input.captureRunId ?? null, input.status, now, input.error ?? null, now, input.id).run();
  const result = await db().prepare("SELECT * FROM pje_link_targets WHERE id = ? LIMIT 1").bind(input.id).first<Record<string, unknown>>();
  return result ? rowToTarget(result) : null;
}
