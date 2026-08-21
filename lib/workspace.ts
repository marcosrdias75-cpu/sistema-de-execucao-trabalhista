import { buildCaseAnalyses, buildCriticalDeadlineQueue, type CaseAnalysis } from "@/lib/analysis";
import { listPilotEdits, type PilotEdit } from "@/lib/database";
import { getPjeReferences, getProcessDeadlines, pilotCases, type PilotCase } from "@/lib/seed-data";
import {
  calculateCreditBalance,
  classifyExecutionPhase,
  classifyRJRisk,
  suggestOpportunity,
  type CreditBalance,
  type ExecutionPhase,
  type OpportunityPriority,
  type RJRisk,
} from "@/domain/execution";

export interface WorkspaceCase {
  pilotCase: PilotCase;
  edit: PilotEdit;
  analysis: CaseAnalysis;
  phase: ExecutionPhase;
  balance: CreditBalance;
  grossSignaled: number | null;
  rjRisk: RJRisk;
  hasGuarantee: boolean;
  hasDeposit: boolean;
  hasPendingWarrant: boolean;
  opportunity: ReturnType<typeof suggestOpportunity>;
}

export interface WorkspaceMetrics {
  totalProcesses: number;
  definitiveProcesses: number;
  provisionalProcesses: number;
  processesWithGuarantee: number;
  processesWithDeposit: number;
  pendingWarrants: number;
  p1Opportunities: number;
  grossSignaled: number;
  consolidatedCredit: number;
  receivedAmount: number;
  availableCash: number;
  potentiallyReleasable: number;
  pendingConfirmation: number;
}

export interface WorkspaceSnapshot {
  cases: WorkspaceCase[];
  metrics: WorkspaceMetrics;
  criticalDeadlines: ReturnType<typeof buildCriticalDeadlineQueue>;
}

function hasSignal(analysis: CaseAnalysis, names: string[]) {
  return names.some((name) => analysis.signals.includes(name));
}

function buildWorkspaceCase(pilotCase: PilotCase, edit: PilotEdit, analysis: CaseAnalysis): WorkspaceCase {
  const phase = classifyExecutionPhase({
    classification: analysis.classification,
    phase: pilotCase.faseSituacaoProcesso,
    signals: analysis.signals,
  });
  const consolidated = edit.creditConsolidated;
  const received = edit.amountReceived;
  const availableCash = edit.availableCash;
  const balance = calculateCreditBalance({ consolidated, received, availableCash });
  const hasGuarantee = hasSignal(analysis, ["guarantee", "sisbajud"]);
  const hasDeposit = hasSignal(analysis, ["deposit"]);
  const hasPendingWarrant = hasSignal(analysis, ["warrant"]) && (received ?? 0) <= 0;
  const hasRJSignal = hasSignal(analysis, ["rj"]);
  const rjRisk = classifyRJRisk({
    hasRJSignal,
    assetAfterRJ: false,
    hasCashAsset: (availableCash ?? 0) > 0,
    hasGuarantee,
    executionPhase: phase,
  });
  const opportunity = suggestOpportunity({
    executionPhase: phase,
    signals: analysis.signals,
    hasCriticalDeadline: analysis.criticalDeadlines.length > 0,
    pjeCount: analysis.pjeCount,
    availableCash: balance.availableCash,
    estimatedValue: pilotCase.maxBrutoReclamante,
    rjRisk,
  });

  return {
    pilotCase,
    edit,
    analysis,
    phase,
    balance,
    grossSignaled: pilotCase.maxBrutoReclamante,
    rjRisk,
    hasGuarantee,
    hasDeposit,
    hasPendingWarrant,
    opportunity,
  };
}

export async function buildWorkspace(): Promise<WorkspaceSnapshot> {
  const edits = await listPilotEdits();
  const analyses = buildCaseAnalyses(edits);
  const byProcess = new Map(analyses.map((analysis) => [analysis.processNumber, analysis]));
  const workspaceCases = pilotCases.map((pilotCase) => {
    const analysis = byProcess.get(pilotCase.processNumber);
    if (!analysis) throw new Error(`Análise ausente para ${pilotCase.processNumber}`);
    return buildWorkspaceCase(pilotCase, edits.get(pilotCase.processNumber) ?? {
      amountReceived: null,
      auditTrail: [],
      availableCash: null,
      creditConsolidated: null,
      guaranteeStatus: null,
      internalNotes: null,
      legalNotes: null,
      nextAction: null,
      priority: "P2",
      processNumber: pilotCase.processNumber,
      responsible: null,
      reviewStatus: "pending_review",
      updatedAt: null,
      updatedBy: null,
      workingExecutionClassification: null,
    }, analysis);
  });
  const metrics = workspaceCases.reduce<WorkspaceMetrics>((acc, item) => {
    acc.totalProcesses += 1;
    acc.definitiveProcesses += item.phase === "execucao_definitiva" ? 1 : 0;
    acc.provisionalProcesses += item.phase === "execucao_provisoria" ? 1 : 0;
    acc.processesWithGuarantee += item.hasGuarantee ? 1 : 0;
    acc.processesWithDeposit += item.hasDeposit ? 1 : 0;
    acc.pendingWarrants += item.hasPendingWarrant ? 1 : 0;
    acc.p1Opportunities += item.opportunity.priority === "P1" ? 1 : 0;
    acc.grossSignaled += item.grossSignaled ?? 0;
    acc.consolidatedCredit += item.balance.consolidated ?? 0;
    acc.receivedAmount += item.balance.received;
    acc.availableCash += item.balance.availableCash;
    acc.potentiallyReleasable += item.balance.potentiallyReleasable;
    acc.pendingConfirmation += item.balance.estimatedBalance === null ? (item.grossSignaled ?? 0) : 0;
    return acc;
  }, {
    totalProcesses: 0,
    definitiveProcesses: 0,
    provisionalProcesses: 0,
    processesWithGuarantee: 0,
    processesWithDeposit: 0,
    pendingWarrants: 0,
    p1Opportunities: 0,
    grossSignaled: 0,
    consolidatedCredit: 0,
    receivedAmount: 0,
    availableCash: 0,
    potentiallyReleasable: 0,
    pendingConfirmation: 0,
  });

  return {
    cases: workspaceCases.sort((a, b) => b.analysis.analysisScore - a.analysis.analysisScore),
    metrics,
    criticalDeadlines: buildCriticalDeadlineQueue(analyses),
  };
}

export async function getWorkspaceCase(processNumberOrSlug: string) {
  const snapshot = await buildWorkspace();
  const normalized = processNumberOrSlug.replace(/\D/g, "");
  return snapshot.cases.find((item) => item.pilotCase.processNumber.replace(/\D/g, "") === normalized) ?? null;
}

export async function listWorkspaceOpportunities() {
  const snapshot = await buildWorkspace();
  return snapshot.cases
    .map((item) => ({
      ...item.opportunity,
      analysisScore: item.analysis.analysisScore,
      caseNumber: item.pilotCase.processNumber,
      claimant: item.pilotCase.reclamante,
      phase: item.phase,
      rjRisk: item.rjRisk,
      reviewStatus: item.edit.reviewStatus,
      responsible: item.edit.responsible,
      dueDate: item.analysis.criticalDeadlines[0]?.dataFinal ?? null,
    }))
    .sort((a, b) => {
      const rank: Record<OpportunityPriority, number> = { P1: 0, P2: 1, P3: 2 };
      return rank[a.priority] - rank[b.priority] || b.analysisScore - a.analysisScore;
    });
}

export function getSourceCounts() {
  return {
    cases: pilotCases.length,
    deadlines: pilotCases.reduce((total, item) => total + item.deadlinesCount, 0),
    pje: pilotCases.reduce((total, item) => total + getPjeReferences(item.processNumber).length, 0),
    documents: 0,
    processEvents: pilotCases.reduce((total, item) => total + getProcessDeadlines(item.processNumber).length, 0),
  };
}
