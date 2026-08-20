import { postgresDatabase } from "@/lib/postgres";

export interface DbUser {
  email: string;
  name: string;
  role: string;
  password_hash: string;
  must_change_password: number;
  created_at: string;
  updated_at: string;
  password_changed_at: string | null;
  temporary_credential_created_at: string | null;
}

export interface PilotEdit {
  processNumber: string;
  reviewStatus: string;
  priority: string;
  responsible: string | null;
  workingExecutionClassification: string | null;
  creditConsolidated: number | null;
  amountReceived: number | null;
  availableCash: number | null;
  guaranteeStatus: string | null;
  nextAction: string | null;
  legalNotes: string | null;
  internalNotes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  auditTrail: Array<{ at: string; actor: string; changes: string[] }>;
}

export type AiAnalysisStatus =
  | "queued"
  | "sent_to_openclaw"
  | "completed"
  | "failed"
  | "approved"
  | "rejected";

export interface AiAnalysisRun {
  id: string;
  processNumber: string;
  status: AiAnalysisStatus;
  provider: string;
  promptVersion: string;
  modelRoute: string | null;
  requestedBy: string;
  requestedAt: string;
  updatedAt: string;
  sentAt: string | null;
  completedAt: string | null;
  analysisPrompt: string;
  resultText: string | null;
  resultPayload: Record<string, unknown> | null;
  failureMessage: string | null;
}

export interface OpenClawSettings {
  source: "database" | "environment" | "none";
  tokenConfigured: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  webhookUrl: string | null;
}

export interface OpenClawCredentials {
  token: string | null;
  webhookUrl: string | null;
}

const defaultEdit = {
  priority: "P2",
  reviewStatus: "pending_review",
};

function getDb() {
  return postgresDatabase;
}

export async function ensureDatabase() {
  const db = getDb();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      must_change_password INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      password_changed_at TEXT,
      temporary_credential_created_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pilot_edits (
      process_number TEXT PRIMARY KEY,
      review_status TEXT NOT NULL,
      priority TEXT NOT NULL,
      responsible TEXT,
      working_execution_classification TEXT,
      credit_consolidated REAL,
      amount_received REAL,
      available_cash REAL,
      guarantee_status TEXT,
      next_action TEXT,
      legal_notes TEXT,
      internal_notes TEXT,
      updated_at TEXT,
      updated_by TEXT,
      audit_trail TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_analysis_runs (
      id TEXT PRIMARY KEY,
      process_number TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      model_route TEXT,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sent_at TEXT,
      completed_at TEXT,
      analysis_prompt TEXT NOT NULL,
      result_text TEXT,
      result_payload TEXT,
      failure_message TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_analysis_runs_process_updated
      ON ai_analysis_runs(process_number, updated_at)`),
  ]);

}

export async function findUser(email: string) {
  await ensureDatabase();
  return getDb()
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
    .bind(email.trim())
    .first<DbUser>();
}

export async function updateUserPassword(email: string, passwordHash: string) {
  await ensureDatabase();
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `UPDATE users
       SET password_hash = ?, must_change_password = 0, updated_at = ?,
           password_changed_at = ?, temporary_credential_created_at = NULL
       WHERE lower(email) = lower(?)`,
    )
    .bind(passwordHash, now, now, email)
    .run();
}

function rowToEdit(row: Record<string, unknown> | null, processNumber: string): PilotEdit {
  if (!row) {
    return {
      ...defaultEdit,
      amountReceived: null,
      auditTrail: [],
      availableCash: null,
      creditConsolidated: null,
      guaranteeStatus: null,
      internalNotes: null,
      legalNotes: null,
      nextAction: null,
      processNumber,
      responsible: null,
      updatedAt: null,
      updatedBy: null,
      workingExecutionClassification: null,
    };
  }

  const rawAuditTrail = row.audit_trail;
  const auditTrail = Array.isArray(rawAuditTrail)
    ? (rawAuditTrail as PilotEdit["auditTrail"])
    : JSON.parse(String(rawAuditTrail ?? "[]")) as PilotEdit["auditTrail"];

  return {
    amountReceived: row.amount_received as number | null,
    auditTrail,
    availableCash: row.available_cash as number | null,
    creditConsolidated: row.credit_consolidated as number | null,
    guaranteeStatus: row.guarantee_status as string | null,
    internalNotes: row.internal_notes as string | null,
    legalNotes: row.legal_notes as string | null,
    nextAction: row.next_action as string | null,
    priority: String(row.priority ?? defaultEdit.priority),
    processNumber,
    responsible: row.responsible as string | null,
    reviewStatus: String(row.review_status ?? defaultEdit.reviewStatus),
    updatedAt: row.updated_at as string | null,
    updatedBy: row.updated_by as string | null,
    workingExecutionClassification: row.working_execution_classification as string | null,
  };
}

export async function listPilotEdits() {
  await ensureDatabase();
  const result = await getDb().prepare("SELECT * FROM pilot_edits").all<Record<string, unknown>>();
  return new Map(
    result.results.map((row) => [
      String(row.process_number),
      rowToEdit(row, String(row.process_number)),
    ]),
  );
}

export async function getPilotEdit(processNumber: string) {
  await ensureDatabase();
  const row = await getDb()
    .prepare("SELECT * FROM pilot_edits WHERE process_number = ?")
    .bind(processNumber)
    .first<Record<string, unknown>>();
  return rowToEdit(row, processNumber);
}

function readOpenClawEnv() {
  return {
    token: process.env.OPENCLAW_WEBHOOK_TOKEN?.trim() || process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || null,
    webhookUrl: process.env.OPENCLAW_WEBHOOK_URL?.trim() || process.env.OPENCLAW_GATEWAY_URL?.trim() || null,
  };
}

async function readAppSettingRows(keys: string[]) {
  await ensureDatabase();
  const placeholders = keys.map(() => "?").join(", ");
  const result = await getDb()
    .prepare(`SELECT * FROM app_settings WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all<Record<string, unknown>>();

  return new Map(result.results.map((row) => [String(row.key), row]));
}

export async function getOpenClawCredentials(): Promise<OpenClawCredentials> {
  const envSettings = readOpenClawEnv();
  const rows = await readAppSettingRows(["openclaw_webhook_token", "openclaw_webhook_url"]);
  const dbWebhookUrl = String(rows.get("openclaw_webhook_url")?.value ?? "").trim() || null;
  const dbToken = String(rows.get("openclaw_webhook_token")?.value ?? "").trim() || null;

  return {
    token: dbToken ?? envSettings.token,
    webhookUrl: dbWebhookUrl ?? envSettings.webhookUrl,
  };
}

export async function getOpenClawSettings(): Promise<OpenClawSettings> {
  const envSettings = readOpenClawEnv();
  const rows = await readAppSettingRows(["openclaw_webhook_token", "openclaw_webhook_url"]);
  const urlRow = rows.get("openclaw_webhook_url");
  const tokenRow = rows.get("openclaw_webhook_token");
  const dbWebhookUrl = String(urlRow?.value ?? "").trim() || null;
  const dbToken = String(tokenRow?.value ?? "").trim() || null;
  const webhookUrl = dbWebhookUrl ?? envSettings.webhookUrl;
  const tokenConfigured = Boolean(dbToken ?? envSettings.token);

  return {
    source: dbWebhookUrl || dbToken ? "database" : envSettings.webhookUrl || envSettings.token ? "environment" : "none",
    tokenConfigured,
    updatedAt: (urlRow?.updated_at as string | null) ?? (tokenRow?.updated_at as string | null) ?? null,
    updatedBy: (urlRow?.updated_by as string | null) ?? (tokenRow?.updated_by as string | null) ?? null,
    webhookUrl,
  };
}

export async function saveOpenClawSettings(input: {
  actor: string;
  webhookToken?: string | null;
  webhookUrl: string;
}) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const db = getDb();
  const statements = [
    db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
      )
      .bind("openclaw_webhook_url", input.webhookUrl.trim(), now, input.actor),
  ];
  const token = input.webhookToken?.trim();

  if (token) {
    statements.push(
      db
        .prepare(
          `INSERT INTO app_settings (key, value, updated_at, updated_by)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at,
             updated_by = excluded.updated_by`,
        )
        .bind("openclaw_webhook_token", token, now, input.actor),
    );
  }

  await db.batch(statements);
}

function rowToAiAnalysisRun(row: Record<string, unknown> | null): AiAnalysisRun | null {
  if (!row) {
    return null;
  }

  const rawPayload = row.result_payload;
  let resultPayload: Record<string, unknown> | null = null;

  if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
    resultPayload = rawPayload as Record<string, unknown>;
  } else if (typeof rawPayload === "string" && rawPayload.trim()) {
    try {
      const parsed = JSON.parse(rawPayload) as unknown;
      resultPayload =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
    } catch {
      resultPayload = null;
    }
  }

  return {
    analysisPrompt: String(row.analysis_prompt ?? ""),
    completedAt: row.completed_at as string | null,
    failureMessage: row.failure_message as string | null,
    id: String(row.id),
    modelRoute: row.model_route as string | null,
    processNumber: String(row.process_number),
    promptVersion: String(row.prompt_version),
    provider: String(row.provider),
    requestedAt: String(row.requested_at),
    requestedBy: String(row.requested_by),
    resultPayload,
    resultText: row.result_text as string | null,
    sentAt: row.sent_at as string | null,
    status: String(row.status) as AiAnalysisStatus,
    updatedAt: String(row.updated_at),
  };
}

export async function getLatestAiAnalysisRun(processNumber: string) {
  await ensureDatabase();
  const row = await getDb()
    .prepare(
      `SELECT * FROM ai_analysis_runs
       WHERE process_number = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(processNumber)
    .first<Record<string, unknown>>();

  return rowToAiAnalysisRun(row);
}

export async function getAiAnalysisRun(id: string) {
  await ensureDatabase();
  const row = await getDb()
    .prepare("SELECT * FROM ai_analysis_runs WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();

  return rowToAiAnalysisRun(row);
}

export async function createAiAnalysisRun(input: {
  analysisPrompt: string;
  modelRoute?: string | null;
  processNumber: string;
  requestedBy: string;
}) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const run: AiAnalysisRun = {
    analysisPrompt: input.analysisPrompt,
    completedAt: null,
    failureMessage: null,
    id: crypto.randomUUID(),
    modelRoute: input.modelRoute ?? "openclaw/chatgpt-subscription",
    processNumber: input.processNumber,
    promptVersion: "sigrj-openclaw-juridico-v2",
    provider: "openclaw",
    requestedAt: now,
    requestedBy: input.requestedBy,
    resultPayload: null,
    resultText: null,
    sentAt: null,
    status: "queued",
    updatedAt: now,
  };

  await getDb()
    .prepare(
      `INSERT INTO ai_analysis_runs (
        id, process_number, status, provider, prompt_version, model_route,
        requested_by, requested_at, updated_at, sent_at, completed_at,
        analysis_prompt, result_text, result_payload, failure_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      run.id,
      run.processNumber,
      run.status,
      run.provider,
      run.promptVersion,
      run.modelRoute,
      run.requestedBy,
      run.requestedAt,
      run.updatedAt,
      run.sentAt,
      run.completedAt,
      run.analysisPrompt,
      run.resultText,
      run.resultPayload,
      run.failureMessage,
    )
    .run();

  return run;
}

export async function markAiAnalysisRunSent(id: string) {
  await ensureDatabase();
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `UPDATE ai_analysis_runs
       SET status = ?, sent_at = ?, updated_at = ?, failure_message = NULL
       WHERE id = ?`,
    )
    .bind("sent_to_openclaw", now, now, id)
    .run();
}

export async function markAiAnalysisRunFailed(id: string, failureMessage: string) {
  await ensureDatabase();
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `UPDATE ai_analysis_runs
       SET status = ?, updated_at = ?, failure_message = ?
       WHERE id = ?`,
    )
    .bind("failed", now, failureMessage, id)
    .run();
}

export async function completeAiAnalysisRun(
  id: string,
  input: { resultPayload?: Record<string, unknown> | null; resultText: string },
) {
  await ensureDatabase();
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `UPDATE ai_analysis_runs
       SET status = ?, completed_at = ?, updated_at = ?, result_text = ?,
           result_payload = ?, failure_message = NULL
       WHERE id = ?`,
    )
    .bind(
      "completed",
      now,
      now,
      input.resultText,
      input.resultPayload ? JSON.stringify(input.resultPayload) : null,
      id,
    )
    .run();
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const numericText = text.replace(/[^\d,.-]/g, "");
  const normalized = numericText.includes(",")
    ? numericText.replaceAll(".", "").replace(",", ".")
    : numericText;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function savePilotEdit(
  processNumber: string,
  input: Record<string, unknown>,
  actor: string,
) {
  await ensureDatabase();
  const previous = await getPilotEdit(processNumber);
  const now = new Date().toISOString();
  const next: PilotEdit = {
    amountReceived: cleanNumber(input.amountReceived),
    auditTrail: previous.auditTrail,
    availableCash: cleanNumber(input.availableCash),
    creditConsolidated: cleanNumber(input.creditConsolidated),
    guaranteeStatus: cleanText(input.guaranteeStatus),
    internalNotes: cleanText(input.internalNotes),
    legalNotes: cleanText(input.legalNotes),
    nextAction: cleanText(input.nextAction),
    priority: cleanText(input.priority) ?? "P2",
    processNumber,
    responsible: cleanText(input.responsible),
    reviewStatus: cleanText(input.reviewStatus) ?? "pending_review",
    updatedAt: now,
    updatedBy: actor,
    workingExecutionClassification: cleanText(input.workingExecutionClassification),
  };
  const labels: Array<[keyof PilotEdit, string]> = [
    ["reviewStatus", "status"],
    ["priority", "prioridade"],
    ["responsible", "responsavel"],
    ["workingExecutionClassification", "classificacao"],
    ["creditConsolidated", "credito"],
    ["amountReceived", "recebido"],
    ["availableCash", "dinheiro disponivel"],
    ["guaranteeStatus", "garantia"],
    ["nextAction", "proxima acao"],
    ["legalNotes", "notas juridicas"],
    ["internalNotes", "observacoes"],
  ];
  const changes = labels
    .filter(([key]) => previous[key] !== next[key])
    .map(([, label]) => label);
  next.auditTrail =
    changes.length > 0
      ? [{ actor, at: now, changes }, ...previous.auditTrail].slice(0, 20)
      : previous.auditTrail;

  await getDb()
    .prepare(
      `INSERT INTO pilot_edits (
        process_number, review_status, priority, responsible,
        working_execution_classification, credit_consolidated, amount_received,
        available_cash, guarantee_status, next_action, legal_notes,
        internal_notes, updated_at, updated_by, audit_trail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(process_number) DO UPDATE SET
        review_status = excluded.review_status,
        priority = excluded.priority,
        responsible = excluded.responsible,
        working_execution_classification = excluded.working_execution_classification,
        credit_consolidated = excluded.credit_consolidated,
        amount_received = excluded.amount_received,
        available_cash = excluded.available_cash,
        guarantee_status = excluded.guarantee_status,
        next_action = excluded.next_action,
        legal_notes = excluded.legal_notes,
        internal_notes = excluded.internal_notes,
        updated_at = exclu