import type { PilotEdit } from "@/lib/database";
import {
  getPjeReferences,
  getProcessDeadlines,
  pilotCases,
  processDeadlines,
  toProcessSlug,
  type ProcessDeadline,
} from "@/lib/seed-data";

const dayMs = 24 * 60 * 60 * 1000;

const signalWeights: Record<string, number> = {
  appeal: 6,
  calculation: 14,
  deposit: 18,
  execution_definitive: 16,
  execution_provisional: 8,
  guarantee: 10,
  homologation: 14,
  incontroversial: 18,
  rj: 10,
  sisbajud: 14,
  warrant: 18,
};

export const signalLabels: Record<string, string> = {
  appeal: "recurso / agravo",
  attachment: "penhora",
  calculation: "calculo",
  deposit: "deposito",
  execution_definitive: "execucao definitiva",
  execution_provisional: "execucao provisoria",
  guarantee: "garantia",
  homologation: "homologacao",
  incontroversial: "credito incontroverso",
  rj: "recuperacao judicial",
  sisbajud: "SISBAJUD",
  warrant: "alvara / liberacao",
};

export const analysisCriteria = [
  { label: "Execucao definitiva", signal: "execution_definitive", weight: signalWeights.execution_definitive },
  { label: "Credito incontroverso", signal: "incontroversial", weight: signalWeights.incontroversial },
  { label: "Alvara ou liberacao", signal: "warrant", weight: signalWeights.warrant },
  { label: "Deposito identificado", signal: "deposit", weight: signalWeights.deposit },
  { label: "Calculo ou homologacao", signal: "calculation", weight: signalWeights.calculation },
  { label: "SISBAJUD ou garantia", signal: "sisbajud", weight: signalWeights.sisbajud },
  { label: "Prazo critico aberto", signal: "deadline", weight: 12 },
  { label: "Referencia PJe verificada", signal: "pje", weight: 8 },
];

export interface CaseAnalysis {
  analysisScore: number;
  classification: string | null;
  confidence: "Alta" | "Media" | "Baixa";
  criticalDeadlines: ProcessDeadline[];
  deadlinesCount: number;
  evidence: string[];
  pjeCount: number;
  priority: "P1" | "P2" | "P3";
  processNumber: string;
  reclamante: string | null;
  reviewStatus: string;
  signals: string[];
  slug: string;
  suggestedAction: string;
  value: number | null;
  opportunity: string;
}

export interface CriticalDeadline {
  analysis: CaseAnalysis;
  deadline: ProcessDeadline;
  daysUntil: number | null;
  timing: string;
}

function parseDateOnly(value: string | null) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function todayUtc() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function daysUntil(value: string | null) {
  const parsed = parseDateOnly(value);

  if (parsed === null) {
    return null;
  }

  return Math.round((parsed - todayUtc()) / dayMs);
}

export function deadlineTiming(deadline: ProcessDeadline) {
  const diff = daysUntil(deadline.dataFinal);

  if (diff === null) {
    return "sem data";
  }

  if (diff < 0) {
    return `${Math.abs(diff)} dia(s) vencido`;
  }

  if (diff === 0) {
    return "vence hoje";
  }

  return `vence em ${diff} dia(s)`;
}

function isCompleted(deadline: ProcessDeadline) {
  return (deadline.statusPrazo ?? "").toLocaleLowerCase("pt-BR").includes("conclu");
}

function isCritical(deadline: ProcessDeadline) {
  const diff = daysUntil(deadline.dataFinal);

  if (diff === null) {
    return false;
  }

  return diff <= 10 && !isCompleted(deadline);
}

function uniqueSignals(signals: string[]) {
  return Array.from(new Set(signals.filter(Boolean))).sort();
}

function valueScore(value: number | null) {
  if (value === null) {
    return 0;
  }

  if (value >= 150000) {
    return 16;
  }

  if (value >= 100000) {
    return 12;
  }

  if (value >= 50000) {
    return 8;
  }

  return 4;
}

function opportunityFor(signals: Set<string>, classification: string | null) {
  const classText = (classification ?? "").toLocaleLowerCase("pt-BR");

  if (
    classText.includes("definitiva") &&
    (signals.has("warrant") || signals.has("incontroversial") || signals.has("deposit"))
  ) {
    return "Liberacao de valores com prova de credito";
  }

  if (signals.has("calculation") && signals.has("homologation")) {
    return "Consolidacao de calculo e homologacao";
  }

  if (signals.has("sisbajud") || signals.has("guarantee") || signals.has("deposit")) {
    return "Conversao de garantia em caixa";
  }

  if (signals.has("appeal")) {
    return "Atuacao em recurso com protecao do incontroverso";
  }

  return "Triagem documental para oportunidade executiva";
}

function actionFor(signals: Set<string>, criticalDeadlines: ProcessDeadline[], pjeCount: number) {
  if (pjeCount === 0) {
    return "Validar pagina do PJe e vincular documento-base antes da recomendacao.";
  }

  if (criticalDeadlines.length > 0) {
    return "Revisar prazo critico e registrar decisao humana na ficha.";
  }

  if (signals.has("warrant") || signals.has("incontroversial")) {
    return "Conferir deposito, alvara e valor incontroverso para pedido de liberacao.";
  }

  if (signals.has("calculation") || signals.has("homologation")) {
    return "Confrontar calculo, homologacao e impugnacoes pendentes.";
  }

  return "Completar leitura do processo e manter em fila de acompanhamento.";
}

function confidenceFor(pjeCount: number, deadlinesCount: number, reviewStatus: string) {
  if (reviewStatus === "validated" && pjeCount > 0) {
    return "Alta";
  }

  if (pjeCount > 0 && deadlinesCount > 0) {
    return "Media";
  }

  return "Baixa";
}

export function buildCaseAnalyses(edits: Map<string, PilotEdit>) {
  return pilotCases
    .map((pilotCase): CaseAnalysis => {
      const edit = edits.get(pilotCase.processNumber);
      const deadlines = getProcessDeadlines(pilotCase.processNumber);
      const pjeRefs = getPjeReferences(pilotCase.processNumber);
      const signals = uniqueSignals([
        ...pilotCase.coverageTags,
        ...deadlines.flatMap((deadline) => deadline.signals),
      ]);
      const signalSet = new Set(signals);
      const criticalDeadlines = deadlines.filter(isCritical);
      const reviewStatus = edit?.reviewStatus ?? "pending_review";
      const classification =
        edit?.workingExecutionClassification ?? pilotCase.workingExecutionClassification;
      const rawScore =
        18 +
        valueScore(pilotCase.maxBrutoReclamante) +
        signals.reduce((total, signal) => total + (signalWeights[signal] ?? 2), 0) +
        Math.min(criticalDeadlines.length * 12, 24) +
        Math.min(pjeRefs.length * 8, 16) +
        (reviewStatus === "pending_review" ? 8 : 0) +
        (reviewStatus === "blocked" ? -10 : 0) +
        (reviewStatus === "validated" ? -8 : 0);
      const analysisScore = Math.max(0, Math.min(100, Math.round(rawScore)));
      const priority = analysisScore >= 78 ? "P1" : analysisScore >= 58 ? "P2" : "P3";
      const evidence = [
        ...signals.slice(0, 4).map((signal) => signalLabels[signal] ?? signal),
        `${deadlines.length} prazo(s) da planilha`,
        `${pjeRefs.length} referencia(s) PJe`,
      ];

      return {
        analysisScore,
        classification,
        confidence: confidenceFor(pjeRefs.length, deadlines.length, reviewStatus),
        criticalDeadlines,
        deadlinesCount: deadlines.length,
        evidence,
        pjeCount: pjeRefs.length,
        priority,
        processNumber: pilotCase.processNumber,
        reclamante: pilotCase.reclamante,
        reviewStatus,
        signals,
        slug: toProcessSlug(pilotCase.processNumber),
        suggestedAction: actionFor(signalSet, criticalDeadlines, pjeRefs.length),
        value: pilotCase.maxBrutoReclamante,
        opportunity: opportunityFor(signalSet, classification),
      };
    })
    .sort((a, b) => b.analysisScore - a.analysisScore);
}

export function buildCriticalDeadlineQueue(analyses: CaseAnalysis[]) {
  return analyses
    .flatMap((analysis) =>
      analysis.criticalDeadlines.map((deadline): CriticalDeadline => {
        const diff = daysUntil(deadline.dataFinal);

        return {
          analysis,
          deadline,
          daysUntil: diff,
          timing: deadlineTiming(deadline),
        };
      }),
    )
    .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));
}

export function buildSignalCounts() {
  const counts = new Map<string, number>();

  for (const deadline of processDeadlines) {
    for (const signal of deadline.signals) {
      counts.set(signal, (counts.get(signal) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([signal, count]) => ({ count, label: signalLabels[signal] ?? signal, signal }))
    .sort((a, b) => b.count - a.count);
}
