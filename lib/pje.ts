export type PjeEnvironment = "homologacao" | "producao";
export type PjeAuthMode = "mni" | "oauth2" | "certificado" | "navegador_controlado";

export interface PjeConnectorConfig {
  id: string;
  tribunalCode: string;
  name: string;
  environment: PjeEnvironment;
  baseUrl: string;
  apiVersion: string | null;
  authMode: PjeAuthMode;
  credentialRef: string | null;
  status: "draft" | "ready" | "disabled" | "error";
}

export interface PjeCapturePlan {
  processNumber: string;
  normalizedNumber: string;
  connectorId: string | null;
  environment: PjeEnvironment;
  mode: "metadata_only" | "events_and_documents";
  authorizationRequired: true;
  humanConfirmationRequired: true;
  nextStep: string;
}

export function normalizeCnj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 20) return null;
  return digits;
}

export function formatCnj(value: string) {
  const normalized = normalizeCnj(value);
  if (!normalized) return value;
  return `${normalized.slice(0, 7)}-${normalized.slice(7, 9)}.${normalized.slice(9, 13)}.${normalized.slice(13, 14)}.${normalized.slice(14, 16)}.${normalized.slice(16)}`;
}

export function tribunalFromCnj(value: string) {
  const normalized = normalizeCnj(value);
  return normalized ? `TRT${normalized.slice(13, 15)}` : null;
}

export function buildCapturePlan(input: {
  processNumber: string;
  connector?: PjeConnectorConfig | null;
  mode?: PjeCapturePlan["mode"];
}): PjeCapturePlan {
  const normalizedNumber = normalizeCnj(input.processNumber);
  if (!normalizedNumber) throw new Error("Número CNJ inválido. Informe 20 dígitos ou o formato completo.");
  const connector = input.connector ?? null;
  return {
    processNumber: formatCnj(normalizedNumber),
    normalizedNumber,
    connectorId: connector?.id ?? null,
    environment: connector?.environment ?? "homologacao",
    mode: input.mode ?? "metadata_only",
    authorizationRequired: true,
    humanConfirmationRequired: true,
    nextStep: connector ? "Validar credencial e executar consulta no ambiente autorizado." : "Cadastrar o conector oficial do tribunal antes de consultar o PJe.",
  };
}

export function createPjeConnectorDraft(input: {
  tribunalCode: string;
  name: string;
  environment: PjeEnvironment;
  baseUrl: string;
  authMode: PjeAuthMode;
}) {
  if (!input.baseUrl.startsWith("https://")) throw new Error("O endpoint do PJe deve usar HTTPS.");
  return {
    id: crypto.randomUUID(),
    tribunalCode: input.tribunalCode.trim().toUpperCase(),
    name: input.name.trim(),
    environment: input.environment,
    baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
    apiVersion: null,
    authMode: input.authMode,
    credentialRef: null,
    status: "draft" as const,
  };
}
