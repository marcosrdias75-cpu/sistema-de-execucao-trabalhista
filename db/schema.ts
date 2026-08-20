import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: integer("must_change_password").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  passwordChangedAt: text("password_changed_at"),
  temporaryCredentialCreatedAt: text("temporary_credential_created_at"),
});

export const pilotEdits = sqliteTable("pilot_edits", {
  processNumber: text("process_number").primaryKey(),
  reviewStatus: text("review_status").notNull(),
  priority: text("priority").notNull(),
  responsible: text("responsible"),
  workingExecutionClassification: text("working_execution_classification"),
  creditConsolidated: real("credit_consolidated"),
  amountReceived: real("amount_received"),
  availableCash: real("available_cash"),
  guaranteeStatus: text("guarantee_status"),
  nextAction: text("next_action"),
  legalNotes: text("legal_notes"),
  internalNotes: text("internal_notes"),
  updatedAt: text("updated_at"),
  updatedBy: text("updated_by"),
  auditTrail: text("audit_trail").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const aiAnalysisRuns = sqliteTable(
  "ai_analysis_runs",
  {
    id: text("id").primaryKey(),
    processNumber: text("process_number").notNull(),
    status: text("status").notNull(),
    provider: text("provider").notNull(),
    promptVersion: text("prompt_version").notNull(),
    modelRoute: text("model_route"),
    requestedBy: text("requested_by").notNull(),
    requestedAt: text("requested_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    sentAt: text("sent_at"),
    completedAt: text("completed_at"),
    analysisPrompt: text("analysis_prompt").notNull(),
    resultText: text("result_text"),
    resultPayload: text("result_payload"),
    failureMessage: text("failure_message"),
  },
  (table) => [
    index("idx_ai_analysis_runs_process_updated").on(table.processNumber, table.updatedAt),
  ],
);
