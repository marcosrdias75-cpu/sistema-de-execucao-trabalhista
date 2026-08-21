export type ExecutionPhase =
  | "conhecimento"
  | "liquidacao"
  | "execucao_provisoria"
  | "execucao_definitiva"
  | "cumprimento_levantamento"
  | "arquivado_extinto"
  | "pendente_verificacao";

export type Confidence = "alta" | "media" | "baixa";
export type RJRisk = "baixo" | "medio" | "alto";
export type OpportunityPriority = "P1" | "P2" | "P3";

export interface CreditBalanceInput {
  consolidated: number | null;
  received: number | null;
  adjustments?: number;
  availableCash?: number | null;
}

export interface CreditBalance {
  consolidated: number | null;
  received: number;
  adjustments: number;
  estimatedBalance: number | null;
  availableCash: number;
  potentiallyReleasable: number;
  status: "pendente" | "parcial" | "saldo_estavel";
}

export function classifyExecutionPhase(input: {
  classification?: string | null;
  phase?: string | null;
  signals?: string[];
}): ExecutionPhase {
  const value = `${input.classification ?? ""} ${input.phase ?? ""}`.toLocaleLowerCase("pt-BR");
  const signals = new Set(input.signals ?? []);

  if (value.includes("arquiv") || value.includes("extint")) return "arquivado_extinto";
  if (value.includes("levant") || value.includes("alvar")) return "cumprimento_levantamento";
  if (value.includes("provis")) return "execucao_provisoria";
  if (value.includes("definit")) return "execucao_definitiva";
  if (value.includes("liquid")) return "liquidacao";
  if (signals.has("execution_definitive")) return "execucao_definitiva";
  if (signals.has("execution_provisional")) return "execucao_provisoria";
  if (signals.has("calculation")) return "liquidacao";
  return "pendente_verificacao";
}

export function calculateCreditBalance(input: CreditBalanceInput): CreditBalance {
  const consolidated = input.consolidated;
  const received = Math.max(0, input.received ?? 0);
  const adjustments = input.adjustments ?? 0;
  const availableCash = Math.max(0, input.availableCash ?? 0);

  if (consolidated === null || consolidated === undefined) {
    return {
      consolidated: null,
      received,
      adjustments,
      estimatedBalance: null,
      availableCash,
      potentiallyReleasable: availableCash,
      status: "pendente",
    };
  }

  const estimatedBalance = Math.max(0, consolidated + adjustments - received);
  return {
    consolidated,
    received,
    adjustments,
    estimatedBalance,
    availableCash,
    potentiallyReleasable: Math.min(estimatedBalance, availableCash),
    status: received > 0 ? "parcial" : "saldo_estavel",
  };
}

export function classifyRJRisk(input: {
  hasRJSignal: boolean;
  assetAfterRJ?: boolean;
  hasCashAsset: boolean;
  hasGuarantee: boolean;
  executionPhase: ExecutionPhase;
}): RJRisk {
  if (input.hasRJSignal && input.assetAfterRJ && !input.hasCashAsset) return "alto";
  if (input.hasRJSignal && (input.hasGuarantee || input.executionPhase === "execucao_definitiva")) {
    return "medio";
  }
  return "baixo";
}

export function classifyGuaranteeUsefulness(input: {
  type: string;
  status?: string | null;
  amount?: number | null;
}): "levantamento" | "acionamento" | "conferencia" | "sem_uso_definido" {
  const type = input.type.toLocaleLowerCase("pt-BR");
  const status = (input.status ?? "").toLocaleLowerCase("pt-BR");
  const amount = input.amount ?? 0;

  if (amount <= 0) return "sem_uso_definido";
  if (type.includes("deposit") || type.includes("bloqueio")) {
    return status.includes("levant") || status.includes("pago") ? "conferencia" : "levantamento";
  }
  if (type.includes("seguro") || type.includes("fianca")) return "acionamento";
  return "conferencia";
}

export function suggestOpportunity(input: {
  executionPhase: ExecutionPhase;
  signals: string[];
  hasCriticalDeadline: boolean;
  pjeCount: number;
  availableCash: number;
  estimatedValue: number | null;
  rjRisk: RJRisk;
}): {
  type: string;
  title: string;
  summary: string;
  suggestedAction: string;
  priority: OpportunityPriority;
  estimatedAmount: number | null;
  immediateAmount: number;
  confidence: Confidence;
  humanReviewRequired: true;
} {
  const signals = new Set(input.signals);
  const immediateAmount = input.availableCash;
  const estimatedAmount = input.estimatedValue;
  const confidence: Confidence = input.pjeCount > 0 && input.executionPhase !== "pendente_verificacao" ? "media" : "baixa";
  let type = "triagem_documental";
  let title = "Triagem documental para oportunidade executiva";
  let suggestedAction = "Completar leitura do processo e registrar a decisão humana na ficha.";

  if (signals.has("warrant") && signals.has("deposit")) {
    type = "levantamento_deposito";
    title = "Conferir depósito e possibilidade de levantamento";
    suggestedAction = "Conferir depósito, alvará, valor incontroverso e eventual recebimento antes de requerer levantamento.";
  } else if (signals.has("warrant")) {
    type = "confirmacao_alvara";
    title = "Confirmar alvará e recebimento";
    suggestedAction = "Distinguir alvará expedido de pagamento efetivo e registrar o comprovante de recebimento.";
  } else if (signals.has("guarantee") || signals.has("sisbajud")) {
    type = "conversao_garantia";
    title = "Avaliar conversão de garantia em caixa";
    suggestedAction = "Conferir natureza jurídica do ativo, vínculo com o crédito e medida de liberação possível.";
  } else if (signals.has("calculation") || signals.has("homologation")) {
    type = "adequacao_calculo";
    title = "Consolidar cálculo e estabilidade do crédito";
    suggestedAction = "Confrontar cálculo, homologação, impugnações e decisões que alterem os critérios.";
  }

  const priority: OpportunityPriority =
    input.hasCriticalDeadline || (input.rjRisk === "alto" && immediateAmount > 0)
      ? "P1"
      : immediateAmount > 0 || input.executionPhase === "execucao_definitiva"
        ? "P2"
        : "P3";

  return {
    type,
    title,
    summary: `${title}. O valor indicado é uma estimativa de triagem e depende de conferência documental e decisão humana.`,
    suggestedAction,
    priority,
    estimatedAmount,
    immediateAmount,
    confidence,
    humanReviewRequired: true,
  };
}

export function normalizeProcessNumber(value: string) {
  return value.replace(/\D/g, "");
}
