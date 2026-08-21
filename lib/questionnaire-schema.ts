export const driveParentFolderId = "1a51UgnURa7AwG99u9JbwxIAngSgxoHGz";

export const executionTypeOptions = [
  "Definitiva",
  "Provisória",
  "Definitiva em relação à reclamada",
] as const;

export const baseCalculationOptions = [
  "Cálculo Homologado",
  "Cálculo adequado após a homologação e trânsito em julgado da fase de execução",
  "Cálculo adequado após a homologação mas ainda pendente de recurso na fase de execução",
  "Ainda sem cálculo homologado",
  "Cálculo pericial sem cálculo homologado",
  "Cálculo da Reclamada",
  "Sentença líquida",
] as const;

export const enforceableCalculationOptions = [
  "Cálculo Homologado",
  "Cálculo da Reclamada apresentado na liquidação inicial",
  "Cálculo da Reclamada nos Embargos à Execução",
  "Cálculo da Reclamada no Agravo de Petição",
  "Sentença líquida",
  "Ainda não há",
] as const;

export const warrantProofOptions = [
  "Comprovado nos autos",
  "Aguardando comprovação ou compensação bancária",
  "Sem comprovação nos autos",
] as const;

export const guaranteeModeOptions = [
  "Dinheiro",
  "Seguro Garantia",
  "Carta de Fiança Bancária",
] as const;

export const depositStatusOptions = [
  "Intacto",
  "Parcialmente levantado",
  "Totalmente levantado",
] as const;

export const judicialDepositOriginOptions = [
  "Pagamento com petição requerendo liberação",
  "Pagamento com prazo de embargos/impugnação transcorrido in albis",
  "Parcelamento Art. 916 do CPC",
  "Pagamento - Valor Incontroverso Determinado",
  "Depósito em Substituição a Seguro Garantia/Fiança",
  "Depósito Garantia do Juízo com trânsito em julgado da fase de execução",
  "Depósito Garantia do Juízo com pendência de recurso na fase de execução",
] as const;

export const guaranteeTypeOptions = [
  "Seguro Garantia Judicial",
  "Carta de Fiança Bancária",
] as const;

export const substitutionOptions = [
  "Não",
  "Sim, substituição Parcial",
  "Sim, substituição Total",
] as const;

export const substitutedMoneyWithdrawalOptions = [
  "Sim, saque realizado",
  "Não, dinheiro permanece retido",
] as const;

export const claimStatusOptions = [
  "Já ocorreu",
  "Não ocorreu: falta intimar a executada para pagar",
  "Não ocorreu: prazo de pagamento em curso ou recurso pendente",
] as const;

export const claimPetitionOptions = [
  "Sim, pendente de análise pelo juiz",
  "Sim, mas indeferida pelo juiz",
  "Sim, prazo deferido para pagamento pela reclamada em curso",
  "Não, com expectativa de requerer em menos de 30 dias",
  "Não, recurso pendente na fase de execução",
] as const;

export const releasePetitionOptions = [
  "Sim, pendente de análise pelo juiz",
  "Sim, mas indeferida pelo juiz",
  "Sim, deferido pelo juiz, mas a Secretaria não cumpriu",
  "Não, com expectativa de requerer em menos de 30 dias",
  "Não, não há depósito passível de requerimento de liberação",
] as const;

export const paymentPetitionOptions = [
  "Sim, pendente de análise pelo juiz",
  "Sim, mas indeferida pelo juiz",
  "Sim, prazo deferido para pagamento pela reclamada em curso",
  "Sim, deferido pelo juiz, mas a Secretaria não cumpriu",
  "Não, com expectativa de requerer em menos de 30 dias",
  "Não, ainda não há crédito passível de requerimento de liberação",
] as const;

export const strategicActionOptions = [
  "Forçar sinistro - intimação da ré",
  "Cobrar seguradora ou fiador",
  "Requerer liberação de valores depositados",
  "Declaratória de conversão em pagamento e alvará",
  "Cobrar expedição de alvará já deferido",
  "Reiterar pedido já feito com fundamento no risco da RJ",
  "Pedido de reconsideração por fato superveniente",
  "Atualização para habilitação na RJ",
  "Outra",
  "Nenhuma no momento",
] as const;

export interface CalculationSnapshot {
  pjeId: string;
  updatedAt: string;
  netClaimantAmount: string;
  grossClaimantAmount: string;
  feesAmount: string;
  totalExecutionAmount: string;
  withdrawalDeductionAmount?: string;
}

export interface NewWarrantAfterBase {
  pjeId: string;
  date: string;
  netClaimantAmount: string;
  feesAmount: string;
}

export interface ReleaseOrderAnswer {
  pjeId: string;
  issuedAt: string;
  claimantShareAmount: string;
  feesShareAmount: string;
  proofStatus: string;
}

export interface AppealDepositAnswer {
  pjeId: string;
  originalAmount: string;
  guaranteeMode: string;
  status: string;
  availableBalanceAmount: string;
}

export interface JudicialDepositAnswer {
  origin: string;
  pjeId: string;
  depositedAt: string;
  originalAmount: string;
  status: string;
}

export interface GuaranteeAnswer {
  guaranteeType: string;
  pjeId: string;
  expiresAt: string;
  originalAmount: string;
  substitutedByCash: string;
  substitutedMoneyWithdrawn: string;
  insurerEnforceableAmount: string;
  claimStatus: string;
  hasOfficePetitionForClaim: string;
}

export interface QuestionnaireAnswers {
  processNumber: string;
  claimantName: string;
  court: string;
  pjeUrl: string;
  executionType: string;
  finalTransitDate: string;
  baseCalculationKind: string;
  baseCalculation: CalculationSnapshot;
  newWarrantAfterBase: string;
  newWarrantsAfterBase: NewWarrantAfterBase[];
  enforceableCalculationKind: string;
  enforceableCalculation: CalculationSnapshot;
  releaseOrders: ReleaseOrderAnswer[];
  appealDeposits: AppealDepositAnswer[];
  judicialDeposits: JudicialDepositAnswer[];
  guarantees: GuaranteeAnswer[];
  claimPetitionStatus: string;
  releasePetitionStatus: string;
  releasePetitionNetAmount: string;
  releasePetitionFeesAmount: string;
  paymentPetitionStatus: string;
  paymentPetitionNetAmount: string;
  paymentPetitionFeesAmount: string;
  strategicActions: string[];
  strategicActionOther: string;
  targetCreditNetAmount: string;
  targetCreditFeesAmount: string;
  internalNotes: string;
}

export const emptyCalculationSnapshot: CalculationSnapshot = {
  feesAmount: "",
  grossClaimantAmount: "",
  netClaimantAmount: "",
  pjeId: "",
  totalExecutionAmount: "",
  updatedAt: "",
  withdrawalDeductionAmount: "",
};

export const defaultQuestionnaireAnswers: QuestionnaireAnswers = {
  appealDeposits: [],
  baseCalculation: { ...emptyCalculationSnapshot },
  baseCalculationKind: "",
  claimPetitionStatus: "",
  claimantName: "",
  court: "",
  enforceableCalculation: { ...emptyCalculationSnapshot },
  enforceableCalculationKind: "",
  executionType: "",
  finalTransitDate: "",
  guarantees: [],
  internalNotes: "",
  judicialDeposits: [],
  newWarrantAfterBase: "Não",
  newWarrantsAfterBase: [],
  paymentPetitionFeesAmount: "",
  paymentPetitionNetAmount: "",
  paymentPetitionStatus: "",
  pjeUrl: "",
  processNumber: "",
  releaseOrders: [],
  releasePetitionFeesAmount: "",
  releasePetitionNetAmount: "",
  releasePetitionStatus: "",
  strategicActionOther: "",
  strategicActions: [],
  targetCreditFeesAmount: "",
  targetCreditNetAmount: "",
};

export function positiveList<T>(items: T[] | undefined | null) {
  return Array.isArray(items) ? items : [];
}

export function answerIsYes(value: string | undefined | null) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR").startsWith("sim");
}
