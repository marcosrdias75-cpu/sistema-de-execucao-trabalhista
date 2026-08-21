import type { QuestionnaireAnswers } from "@/lib/questionnaire-schema";
import { answerIsYes, positiveList } from "@/lib/questionnaire-schema";

export interface QuestionnaireReportAttachment {
  originalName: string;
  size: number;
  sha256: string;
}

function value(text: string | undefined | null) {
  return text?.trim() || "Não informado";
}

function money(text: string | undefined | null) {
  const cleaned = text?.trim();
  return cleaned ? `R$ ${cleaned.replace(/^R\$\s*/i, "")}` : "Não informado";
}

function section(title: string, lines: string[]) {
  return [`\n${title}`, "-".repeat(title.length), ...lines].join("\n");
}

function calculationLines(prefix: string, calc: QuestionnaireAnswers["baseCalculation"]) {
  return [
    `${prefix} ID PJe: ${value(calc.pjeId)}`,
    `${prefix} data de atualização: ${value(calc.updatedAt)}`,
    `${prefix} líquido reclamante: ${money(calc.netClaimantAmount)}`,
    `${prefix} bruto reclamante: ${money(calc.grossClaimantAmount)}`,
    `${prefix} honorários: ${money(calc.feesAmount)}`,
    `${prefix} total da execução: ${money(calc.totalExecutionAmount)}`,
    `${prefix} dedução de levantamento: ${money(calc.withdrawalDeductionAmount)}`,
  ];
}

export function renderQuestionnaireReport(input: {
  answers: QuestionnaireAnswers;
  attachments: QuestionnaireReportAttachment[];
  submittedAt: string;
  submittedBy: string;
}) {
  const { answers } = input;
  const lines = [
    "QUESTIONÁRIO INTEGRADO DE TRIAGEM - CASAS BAHIA",
    `Processo: ${value(answers.processNumber)}`,
    `Reclamante: ${value(answers.claimantName)}`,
    `Vara/TRT: ${value(answers.court)}`,
    `PJe: ${value(answers.pjeUrl)}`,
    `Preenchido por: ${input.submittedBy}`,
    `Data de envio: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(input.submittedAt))}`,
    section("BLOCO 1 - Dados Processuais e Cálculo-Base", [
      `Tipo da execução: ${value(answers.executionType)}`,
      `Trânsito em julgado do principal: ${value(answers.finalTransitDate)}`,
      `Cálculo base atual: ${value(answers.baseCalculationKind)}`,
      ...calculationLines("Cálculo base", answers.baseCalculation),
      `Após o cálculo-base houve nova expedição de alvará: ${value(answers.newWarrantAfterBase)}`,
      ...(
        answerIsYes(answers.newWarrantAfterBase)
          ? positiveList(answers.newWarrantsAfterBase).flatMap((item, index) => [
              `Novo alvará ${index + 1} ID: ${value(item.pjeId)}`,
              `Novo alvará ${index + 1} data: ${value(item.date)}`,
              `Novo alvará ${index + 1} líquido reclamante: ${money(item.netClaimantAmount)}`,
              `Novo alvará ${index + 1} honorários: ${money(item.feesAmount)}`,
            ])
          : []
      ),
    ]),
    section("BLOCO 2 - Cálculo Exigível", [
      `Cálculo já exigível: ${value(answers.enforceableCalculationKind)}`,
      ...calculationLines("Cálculo exigível", answers.enforceableCalculation),
    ]),
    section("BLOCO 3 - Histórico de Alvarás", [
      `Quantidade informada: ${positiveList(answers.releaseOrders).length}`,
      ...positiveList(answers.releaseOrders).flatMap((item, index) => [
        `Alvará ${index + 1} ID: ${value(item.pjeId)}`,
        `Alvará ${index + 1} data: ${value(item.issuedAt)}`,
        `Alvará ${index + 1} cota reclamante: ${money(item.claimantShareAmount)}`,
        `Alvará ${index + 1} cota honorários: ${money(item.feesShareAmount)}`,
        `Alvará ${index + 1} comprovação: ${value(item.proofStatus)}`,
      ]),
    ]),
    section("BLOCO 4 - Dinheiro e Garantias", [
      `Depósitos recursais: ${positiveList(answers.appealDeposits).length}`,
      ...positiveList(answers.appealDeposits).flatMap((item, index) => [
        `Depósito recursal ${index + 1} ID: ${value(item.pjeId)}`,
        `Depósito recursal ${index + 1} valor original: ${money(item.originalAmount)}`,
        `Depósito recursal ${index + 1} modalidade: ${value(item.guaranteeMode)}`,
        `Depósito recursal ${index + 1} situação: ${value(item.status)}`,
        `Depósito recursal ${index + 1} saldo disponível: ${money(item.availableBalanceAmount)}`,
      ]),
      `Depósitos judiciais/bloqueios/916: ${positiveList(answers.judicialDeposits).length}`,
      ...positiveList(answers.judicialDeposits).flatMap((item, index) => [
        `Depósito judicial ${index + 1} origem: ${value(item.origin)}`,
        `Depósito judicial ${index + 1} ID: ${value(item.pjeId)}`,
        `Depósito judicial ${index + 1} data: ${value(item.depositedAt)}`,
        `Depósito judicial ${index + 1} valor original: ${money(item.originalAmount)}`,
        `Depósito judicial ${index + 1} situação: ${value(item.status)}`,
      ]),
      `Seguros/Fianças: ${positiveList(answers.guarantees).length}`,
      ...positiveList(answers.guarantees).flatMap((item, index) => [
        `Garantia ${index + 1} tipo: ${value(item.guaranteeType)}`,
        `Garantia ${index + 1} ID: ${value(item.pjeId)}`,
        `Garantia ${index + 1} vencimento: ${value(item.expiresAt)}`,
        `Garantia ${index + 1} valor original: ${money(item.originalAmount)}`,
        `Garantia ${index + 1} substituída por dinheiro: ${value(item.substitutedByCash)}`,
        `Garantia ${index + 1} dinheiro levantado: ${value(item.substitutedMoneyWithdrawn)}`,
        `Garantia ${index + 1} valor exigível da seguradora: ${money(item.insurerEnforceableAmount)}`,
        `Garantia ${index + 1} sinistro: ${value(item.claimStatus)}`,
        `Garantia ${index + 1} petição do escritório: ${value(item.hasOfficePetitionForClaim)}`,
      ]),
    ]),
    section("BLOCO 5 - Petições e Estratégia", [
      `Petição para provocar sinistro: ${value(answers.claimPetitionStatus)}`,
      `Petição de liberação de valores: ${value(answers.releasePetitionStatus)}`,
      `Valor pleiteado líquido reclamante na liberação: ${money(answers.releasePetitionNetAmount)}`,
      `Valor pleiteado honorários na liberação: ${money(answers.releasePetitionFeesAmount)}`,
      `Petição de intimação para pagamento: ${value(answers.paymentPetitionStatus)}`,
      `Valor pleiteado líquido reclamante no pagamento: ${money(answers.paymentPetitionNetAmount)}`,
      `Valor pleiteado honorários no pagamento: ${money(answers.paymentPetitionFeesAmount)}`,
      `Ações estratégicas: ${positiveList(answers.strategicActions).join("; ") || "Não informado"}`,
      `Outra ação estratégica: ${value(answers.strategicActionOther)}`,
    ]),
    section("BLOCO 6 - Crédito Alvo", [
      `Valor líquido reclamante: ${money(answers.targetCreditNetAmount)}`,
      `Valor honorários sucumbenciais: ${money(answers.targetCreditFeesAmount)}`,
      `Observações internas: ${value(answers.internalNotes)}`,
    ]),
    section("Anexos", [
      ...input.attachments.map((file, index) => `Anexo ${index + 1}: ${file.originalName} (${file.size} bytes, sha256 ${file.sha256})`),
      ...(input.attachments.length === 0 ? ["Nenhum anexo informado."] : []),
    ]),
  ];

  return `${lines.join("\n")}\n`;
}
