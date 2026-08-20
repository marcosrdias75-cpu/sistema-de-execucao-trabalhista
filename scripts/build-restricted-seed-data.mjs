import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const importRoot = resolve(projectRoot, "..", "sigrj", "data", "imports", "casas-bahia");
const seedPath = resolve(projectRoot, "lib", "seed-data.ts");

const currentSeed = readFileSync(seedPath, "utf8");
const initialUserMatch = currentSeed.match(
  /export const initialUser = (?<json>\{[\s\S]*?\n\});/,
);

if (!initialUserMatch?.groups?.json) {
  throw new Error("Nao foi possivel reaproveitar o usuario inicial.");
}

const initialUser = JSON.parse(initialUserMatch.groups.json);
const { pilotCases } = JSON.parse(
  readFileSync(resolve(importRoot, "pilot-cases.json"), "utf8"),
);
const pjeReferences = JSON.parse(
  readFileSync(resolve(importRoot, "pje-references.json"), "utf8"),
);
const allDeadlines = JSON.parse(readFileSync(resolve(importRoot, "deadlines.json"), "utf8"));
const pilotProcessNumbers = new Set(pilotCases.map((pilotCase) => pilotCase.processNumber));

function nullableText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const processDeadlines = allDeadlines
  .filter((deadline) => pilotProcessNumbers.has(deadline.processo))
  .map((deadline) => ({
    id: deadline.id,
    sourceSheet: deadline.sourceSheet ?? "Prazos",
    sourceRowNumber: nullableNumber(deadline.sourceRowNumber),
    processo: deadline.processo,
    dataInicial: deadline.dataInicial ?? null,
    dataFinal: deadline.dataFinal ?? null,
    dataFatal: deadline.dataFatal ?? null,
    reclamante: nullableText(deadline.reclamante),
    empresa: nullableText(deadline.empresa),
    tipoAcao: nullableText(deadline.tipoAcao),
    statusProcesso: nullableText(deadline.statusProcesso),
    faseProcesso: nullableText(deadline.faseProcesso),
    tipoPrazo: nullableText(deadline.tipoPrazo),
    statusPrazo: nullableText(deadline.statusPrazo),
    responsavel: nullableText(deadline.responsavel),
    descricao: nullableText(deadline.descricao),
    observacao: nullableText(deadline.observacao),
    forum: nullableText(deadline.forum),
    vara: nullableText(deadline.vara),
    brutoReclamante: nullableNumber(deadline.brutoReclamante),
    verificado: deadline.verificado ?? null,
    criadoPor: nullableText(deadline.criadoPor),
    signals: Array.isArray(deadline.signals) ? deadline.signals : [],
  }))
  .sort((a, b) => {
    const byProcess = a.processo.localeCompare(b.processo);
    if (byProcess !== 0) {
      return byProcess;
    }

    return String(b.dataFinal ?? "").localeCompare(String(a.dataFinal ?? ""));
  });

const content = `export interface PilotDeadline {
  id: string;
  dataFinal: string | null;
  statusProcesso: string | null;
  faseProcesso: string | null;
  tipoPrazo: string | null;
  brutoReclamante: number | null;
  signals: string[];
  descricao: string | null;
  observacao: string | null;
}

export interface PilotCase {
  pilotRank: number;
  processNumber: string;
  reclamante: string | null;
  empresa: string | null;
  faseSituacaoProcesso: string | null;
  executionSheetPhase: string | null;
  deadlineExecutionStatuses: string[];
  workingExecutionClassification: string | null;
  executionListed: boolean;
  sourceConfidence: string;
  reviewFlags: string[];
  score: number;
  coverageTags: string[];
  whySelected: string[];
  nextAuditActions: string[];
  deadlinesCount: number;
  maxBrutoReclamante: number | null;
  representativeDeadlines: PilotDeadline[];
}

export interface PjeReference {
  id: string;
  processNumber: string;
  pjeUrl: string;
  title: string;
  evidenceKind: string;
  reviewStatus: string;
  court: string;
  eventNumber: string | null;
  documentId: string | null;
  observedAt: string;
  excerpt: string | null;
  notes: string | null;
}

export interface ProcessDeadline extends PilotDeadline {
  sourceSheet: string;
  sourceRowNumber: number | null;
  processo: string;
  dataInicial: string | null;
  dataFatal: string | null;
  reclamante: string | null;
  empresa: string | null;
  tipoAcao: string | null;
  statusPrazo: string | null;
  responsavel: string | null;
  forum: string | null;
  vara: string | null;
  verificado: string | null;
  criadoPor: string | null;
}

export const initialUser = ${JSON.stringify(initialUser, null, 2)};

export const pilotCases: PilotCase[] = ${JSON.stringify(pilotCases, null, 2)};

export const pjeReferences: PjeReference[] = ${JSON.stringify(pjeReferences, null, 2)};

export const processDeadlines: ProcessDeadline[] = ${JSON.stringify(processDeadlines, null, 2)};

export function toProcessSlug(processNumber: string) {
  return processNumber.replace(/\\D/g, "");
}

export function getPilotCase(processNumberOrSlug: string) {
  return (
    pilotCases.find(
      (pilotCase) =>
        pilotCase.processNumber === processNumberOrSlug ||
        toProcessSlug(pilotCase.processNumber) === processNumberOrSlug,
    ) ?? null
  );
}

export function getPjeReferences(processNumberOrSlug: string) {
  const pilotCase = getPilotCase(processNumberOrSlug);
  const processNumber = pilotCase?.processNumber ?? processNumberOrSlug;
  return pjeReferences.filter((reference) => reference.processNumber === processNumber);
}

export function getProcessDeadlines(processNumberOrSlug: string) {
  const pilotCase = getPilotCase(processNumberOrSlug);
  const processNumber = pilotCase?.processNumber ?? processNumberOrSlug;
  return processDeadlines.filter((deadline) => deadline.processo === processNumber);
}
`;

writeFileSync(seedPath, content);
