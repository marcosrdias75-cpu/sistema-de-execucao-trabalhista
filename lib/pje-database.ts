import { postgresDatabase } from "@/lib/postgres";
import type { PjeAuthMode, PjeEnvironment } from "@/lib/pje";

export interface PjeConnectorRecord {
  id: string;
  tribunalCode: string;
  name: string;
  environment: PjeEnvironment;
  baseUrl: string;
  apiVersion: string | null;
  authMode: PjeAuthMode;
  credentialRef: string | null;
  status: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PjeCaptureRunRecord {
  id: string;
  connectorId: string | null;
  caseId: string | null;
  processNumber: string | null;
  status: string;
  cursor: string | null;
  requestedBy: string;
  startedAt: string | null;
  completedAt: string | null;
  itemsFound: number | null;
  itemsImported: number | null;
  errorMessage: string | null;
}

function getDb() {
  return postgresDatabase;
}

function rowToConnector(row: Record<string, unknown>): PjeConnectorRecord {
  return {
    id: String(row.id),
    tribunalCode: String(row.tribunal_code),
    name: String(row.name),
    environment: String(row.environment) as PjeEnvironment,
    baseUrl: String(row.base_url),
    apiVersion: row.api_version ? String(row.api_version) : null,
    authMode: String(row.auth_mode ?? "mni") as PjeAuthMode,
    credentialRef: row.credential_ref ? String(row.credential_ref) : null,
    status: String(row.status),
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToCaptureRun(row: Record<string, unknown>): PjeCaptureRunRecord {
  return {
    id: String(row.id),
    connectorId: row.connector_id ? String(row.connector_id) : null,
    caseId: row.case_id ? String(row.case_id) : null,
    processNumber: row.process_number ? String(row.process_number) : null,
    status: String(row.status),
    cursor: row.cursor ? String(row.cursor) : null,
    requestedBy: String(row.requested_by),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    itemsFound: row.items_found === null || row.items_found === undefined ? null : Number(row.items_found),
    itemsImported: row.items_imported === null || row.items_imported === undefined ? null : Number(row.items_imported),
    errorMessage: row.error_message ? String(row.error_message) : null,
  };
}

export async function listPjeConnectors() {
  const result = await getDb().prepare("SELECT * FROM pje_connectors ORDER BY tribunal_code, environment").all<Record<string, unknown>>();
  return result.results.map(rowToConnector);
}

export async function getPjeConnector(id: string) {
  const row = await getDb().prepare("SELECT * FROM pje_connectors WHERE id = ? LIMIT 1").bind(id).first<Record<string, unknown>>();
  return row ? rowToConnector(row) : null;
}

export async function createPjeConnector(input: {
  id: string;
  tribunalCode: string;
  name: string;
  environment: PjeEnvironment;
  baseUrl: string;
  apiVersion?: string | null;
  authMode: PjeAuthMode;
  credentialRef?: string | null;
  status?: string;
}) {
  const now = new Date().toISOString();
  await getDb()
    .prepare(`INSERT INTO pje_connectors (
      id, tribunal_code, name, environment, base_url, api_version, auth_mode,
      credential_ref, status, last_success_at, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tribunal_code, environment) DO UPDATE SET
      name = excluded.name, base_url = excluded.base_url, api_version = excluded.api_version,
      auth_mode = excluded.auth_mode, credential_ref = excluded.credential_ref,
      status = excluded.status, updated_at = excluded.updated_at`)
    .bind(input.id, input.tribunalCode, input.name, input.environment, input.baseUrl, input.apiVersion ?? null, input.authMode, input.credentialRef ?? null, input.status ?? "draft", null, null, now, now)
    .run();
  const connectors = await listPjeConnectors();
  return connectors.find((connector) => connector.tribunalCode === input.tribunalCode && connector.environment === input.environment) ?? null;
}

export async function listQueuedPjeCaptureRuns(limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const result = await getDb()
    .prepare(`SELECT pje_capture_runs.*, cases.process_number, pje_connectors.tribunal_code, pje_connectors.base_url, pje_connectors.environment, pje_connectors.auth_mode, pje_link_targets.id AS link_target_id, pje_link_targets.source_url, pje_link_targets.link_kind
      FROM pje_capture_runs
      LEFT JOIN cases ON cases.id = pje_capture_runs.case_id
      LEFT JOIN pje_connectors ON pje_connectors.id = pje_capture_runs.connector_id
      LEFT JOIN pje_link_targets ON pje_link_targets.last_capture_run_id = pje_capture_runs.id
      WHERE pje_capture_runs.status = ? AND pje_link_targets.id IS NOT NULL ORDER BY pje_capture_runs.id ASC LIMIT ${safeLimit}`)
    .bind("queued")
    .all<Record<string, unknown>>();
  return result.results.map((row) => ({
    ...rowToCaptureRun(row),
    tribunalCode: row.tribunal_code ? String(row.tribunal_code) : null,
    baseUrl: row.base_url ? String(row.base_url) : null,
    environment: row.environment ? String(row.environment) : null,
    authMode: row.auth_mode ? String(row.auth_mode) : null,
    linkTargetId: row.link_target_id ? String(row.link_target_id) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    linkKind: row.link_kind ? String(row.link_kind) : null,
  }));
}

export async function listPjeCaptureRuns(limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await getDb()
    .prepare(`SELECT pje_capture_runs.*, cases.process_number
      FROM pje_capture_runs LEFT JOIN cases ON cases.id = pje_capture_runs.case_id
      ORDER BY pje_capture_runs.started_at DESC NULLS LAST, pje_capture_runs.id DESC LIMIT ${safeLimit}`)
    .all<Record<string, unknown>>();
  return result.results.map(rowToCaptureRun);
}

export async function createPjeCaptureRun(input: {
  connectorId?: string | null;
  caseId?: string | null;
  requestedBy: string;
  cursor?: string | null;
}) {
  const id = crypto.randomUUID();
  await getDb()
    .prepare(`INSERT INTO pje_capture_runs (
      id, connector_id, case_id, status, cursor, requested_by,
      started_at, completed_at, items_found, items_imported, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.connectorId ?? null, input.caseId ?? null, "queued", input.cursor ?? null, input.requestedBy, null, null, null, null, null)
    .run();
  const runs = await listPjeCaptureRuns();
  return runs.find((run) => run.id === id) ?? null;
}

export async function markPjeCaptureRunStarted(id: string) {
  const now = new Date().toISOString();
  await getDb().prepare("UPDATE pje_capture_runs SET status = ?, started_at = ? WHERE id = ? AND status = ?").bind("running", now, id, "queued").run();
  const runs = await listPjeCaptureRuns();
  return runs.find((run) => run.id === id) ?? null;
}

export async function updatePjeCaptureRun(input: {
  id: string;
  status: "running" | "succeeded" | "partial" | "failed" | "awaiting_authorization";
  cursor?: string | null;
  itemsFound?: number | null;
  itemsImported?: number | null;
  errorMessage?: string | null;
}) {
  const now = new Date().toISOString();
  const completedAt = ["succeeded", "partial", "failed", "awaiting_authorization"].includes(input.status) ? now : null;
  await getDb()
    .prepare(`UPDATE pje_capture_runs SET status = ?, cursor = ?, started_at = COALESCE(started_at, ?), completed_at = ?, items_found = ?, items_imported = ?, error_message = ? WHERE id = ?`)
    .bind(input.status, input.cursor ?? null, now, completedAt, input.itemsFound ?? null, input.itemsImported ?? null, input.errorMessage ?? null, input.id)
    .run();
  const runs = await listPjeCaptureRuns();
  return runs.find((run) => run.id === input.id) ?? null;
}

export async function savePjeSnapshot(input: {
  captureRunId?: string | null;
  caseId: string;
  snapshotType: string;
  sourceUrl?: string | null;
  storageKey?: string | null;
  payloadHash: string;
}) {
  const existing = await getDb().prepare("SELECT id FROM pje_snapshots WHERE case_id = ? AND payload_hash = ? LIMIT 1").bind(input.caseId, input.payloadHash).first<{ id: string }>();
  if (existing?.id) return existing.id;
  const id = crypto.randomUUID();
  await getDb()
    .prepare(`INSERT INTO pje_snapshots (
      id, capture_run_id, case_id, snapshot_type, source_url, storage_key, payload_hash, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.captureRunId ?? null, input.caseId, input.snapshotType, input.sourceUrl ?? null, input.storageKey ?? null, input.payloadHash, new Date().toISOString())
    .run();
  return id;
}

export async function getPjeCaptureMetrics() {
  const [connectors, runs, snapshots] = await Promise.all([
    getDb().prepare("SELECT COUNT(*) AS count FROM pje_connectors").first<{ count: number }>(),
    getDb().prepare("SELECT status, COUNT(*) AS count FROM pje_capture_runs GROUP BY status").all<{ status: string; count: number }>(),
    getDb().prepare("SELECT COUNT(*) AS count FROM pje_snapshots").first<{ count: number }>(),
  ]);
  return {
    connectors: Number(connectors?.count ?? 0),
    snapshots: Number(snapshots?.count ?? 0),
    runs: Object.fromEntries(runs.results.map((row) => [row.status, Number(row.count)])),
  };
}
