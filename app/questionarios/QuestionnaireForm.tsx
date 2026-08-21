"use client";

import { useMemo, useState } from "react";
import {
  baseCalculationOptions,
  claimPetitionOptions,
  claimStatusOptions,
  defaultQuestionnaireAnswers,
  depositStatusOptions,
  enforceableCalculationOptions,
  executionTypeOptions,
  guaranteeModeOptions,
  guaranteeTypeOptions,
  judicialDepositOriginOptions,
  paymentPetitionOptions,
  releasePetitionOptions,
  strategicActionOptions,
  substitutionOptions,
  substitutedMoneyWithdrawalOptions,
  warrantProofOptions,
  answerIsYes,
  type AppealDepositAnswer,
  type CalculationSnapshot,
  type GuaranteeAnswer,
  type JudicialDepositAnswer,
  type NewWarrantAfterBase,
  type QuestionnaireAnswers,
  type ReleaseOrderAnswer,
} from "@/lib/questionnaire-schema";

interface ProcessOption {
  claimantName: string;
  court: string;
  processNumber: string;
}

function makeInitialAnswers(): QuestionnaireAnswers {
  return JSON.parse(JSON.stringify(defaultQuestionnaireAnswers)) as QuestionnaireAnswers;
}

function emptyNewWarrant(): NewWarrantAfterBase {
  return { date: "", feesAmount: "", netClaimantAmount: "", pjeId: "" };
}

function emptyReleaseOrder(): ReleaseOrderAnswer {
  return { claimantShareAmount: "", feesShareAmount: "", issuedAt: "", pjeId: "", proofStatus: "" };
}

function emptyAppealDeposit(): AppealDepositAnswer {
  return { availableBalanceAmount: "", guaranteeMode: "", originalAmount: "", pjeId: "", status: "" };
}

function emptyJudicialDeposit(): JudicialDepositAnswer {
  return { depositedAt: "", origin: "", originalAmount: "", pjeId: "", status: "" };
}

function emptyGuarantee(): GuaranteeAnswer {
  return {
    claimStatus: "",
    expiresAt: "",
    guaranteeType: "",
    hasOfficePetitionForClaim: "",
    insurerEnforceableAmount: "",
    originalAmount: "",
    pjeId: "",
    substitutedByCash: "Não",
    substitutedMoneyWithdrawn: "",
  };
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#293127]">
      {label}
      {children}
    </label>
  );
}

const inputClass = "h-10 rounded-md border border-[#c7ccbf] bg-white px-3 text-sm font-normal outline-none ring-emerald-700 focus:ring-2";
const textareaClass = "rounded-md border border-[#c7ccbf] bg-white p-3 text-sm font-normal outline-none ring-emerald-700 focus:ring-2";
const selectClass = inputClass;

function TextInput({
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return <input className={inputClass} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} />;
}

function MoneyInput({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  return <input className={inputClass} inputMode="decimal" onChange={(event) => onChange(event.target.value)} placeholder="0,00" value={value} />;
}

function SelectInput({
  onChange,
  options,
  required,
  value,
}: {
  onChange: (value: string) => void;
  options: readonly string[];
  required?: boolean;
  value: string;
}) {
  return (
    <select className={selectClass} onChange={(event) => onChange(event.target.value)} required={required} value={value}>
      <option value="">Selecione</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function YesNo({
  name,
  onChange,
  value,
}: {
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {["Não", "Sim"].map((option) => (
        <label key={option} className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${value === option ? "border-emerald-800 bg-emerald-900 text-white" : "border-[#c7ccbf] bg-white text-[#293127]"}`}>
          <input checked={value === option} className="sr-only" name={name} onChange={() => onChange(option)} type="radio" value={option} />
          {option}
        </label>
      ))}
    </div>
  );
}

function Section({ children, kicker, title }: { children: React.ReactNode; kicker: string; title: string }) {
  return (
    <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{kicker}</p>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function CalculationFields({
  onChange,
  value,
}: {
  onChange: (value: CalculationSnapshot) => void;
  value: CalculationSnapshot;
}) {
  function update(key: keyof CalculationSnapshot, nextValue: string) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="ID do cálculo no PJe"><TextInput onChange={(next) => update("pjeId", next)} value={value.pjeId} /></Field>
      <Field label="Data de atualização"><TextInput onChange={(next) => update("updatedAt", next)} type="date" value={value.updatedAt} /></Field>
      <Field label="Valor líquido reclamante"><MoneyInput onChange={(next) => update("netClaimantAmount", next)} value={value.netClaimantAmount} /></Field>
      <Field label="Valor bruto reclamante"><MoneyInput onChange={(next) => update("grossClaimantAmount", next)} value={value.grossClaimantAmount} /></Field>
      <Field label="Honorários sucumbenciais/periciais"><MoneyInput onChange={(next) => update("feesAmount", next)} value={value.feesAmount} /></Field>
      <Field label="Total da execução"><MoneyInput onChange={(next) => update("totalExecutionAmount", next)} value={value.totalExecutionAmount} /></Field>
      <Field label="Dedução de levantamento já computada"><MoneyInput onChange={(next) => update("withdrawalDeductionAmount", next)} value={value.withdrawalDeductionAmount ?? ""} /></Field>
    </div>
  );
}

export function QuestionnaireForm({ processOptions }: { processOptions: ProcessOption[] }) {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(() => makeInitialAnswers());
  const [fileCount, setFileCount] = useState(0);
  const selectedProcess = useMemo(
    () => processOptions.find((item) => item.processNumber === answers.processNumber),
    [answers.processNumber, processOptions],
  );

  function update<K extends keyof QuestionnaireAnswers>(key: K, value: QuestionnaireAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function chooseProcess(processNumber: string) {
    const option = processOptions.find((item) => item.processNumber === processNumber);
    setAnswers((current) => ({
      ...current,
      claimantName: option?.claimantName || current.claimantName,
      court: option?.court || current.court,
      processNumber,
    }));
  }

  function addArrayItem<K extends "newWarrantsAfterBase" | "releaseOrders" | "appealDeposits" | "judicialDeposits" | "guarantees">(
    key: K,
    item: QuestionnaireAnswers[K][number],
  ) {
    setAnswers((current) => ({ ...current, [key]: [...current[key], item] }));
  }

  function updateArrayItem<K extends "newWarrantsAfterBase" | "releaseOrders" | "appealDeposits" | "judicialDeposits" | "guarantees">(
    key: K,
    index: number,
    item: QuestionnaireAnswers[K][number],
  ) {
    setAnswers((current) => {
      const next = [...current[key]];
      next[index] = item;
      return { ...current, [key]: next };
    });
  }

  function removeArrayItem<K extends "newWarrantsAfterBase" | "releaseOrders" | "appealDeposits" | "judicialDeposits" | "guarantees">(key: K, index: number) {
    setAnswers((current) => ({ ...current, [key]: current[key].filter((_, itemIndex) => itemIndex !== index) }));
  }

  function toggleStrategicAction(option: string) {
    setAnswers((current) => {
      const hasOption = current.strategicActions.includes(option);
      return {
        ...current,
        strategicActions: hasOption
          ? current.strategicActions.filter((item) => item !== option)
          : [...current.strategicActions, option],
      };
    });
  }

  return (
    <form action="/api/questionarios" encType="multipart/form-data" method="post" className="grid gap-5">
      <input name="answers" type="hidden" value={JSON.stringify(answers)} />

      <Section kicker="Identificação" title="Processo e responsável">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Processo">
            <input className={inputClass} list="processos-questionario" onChange={(event) => chooseProcess(event.target.value)} placeholder="Ex.: 1000906-07.2022.5.02.0491" required value={answers.processNumber} />
            <datalist id="processos-questionario">
              {processOptions.map((item) => <option key={item.processNumber} value={item.processNumber}>{item.claimantName}</option>)}
            </datalist>
          </Field>
          <Field label="Reclamante"><TextInput onChange={(value) => update("claimantName", value)} value={answers.claimantName} /></Field>
          <Field label="Vara/TRT"><TextInput onChange={(value) => update("court", value)} value={answers.court} /></Field>
          <Field label="Link PJe"><TextInput onChange={(value) => update("pjeUrl", value)} placeholder="https://..." type="url" value={answers.pjeUrl} /></Field>
        </div>
        {selectedProcess ? <p className="text-xs text-[#6a7466]">Carteira: {selectedProcess.claimantName || "reclamante pendente"}</p> : null}
      </Section>

      <Section kicker="Bloco 1" title="Dados Processuais e Cálculo-Base">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="1. Tipo da execução"><SelectInput onChange={(value) => update("executionType", value)} options={executionTypeOptions} required value={answers.executionType} /></Field>
          <Field label="2. Trânsito em julgado do processo principal"><TextInput onChange={(value) => update("finalTransitDate", value)} type="date" value={answers.finalTransitDate} /></Field>
        </div>
        <Field label="3. Cálculo base atual"><SelectInput onChange={(value) => update("baseCalculationKind", value)} options={baseCalculationOptions} required value={answers.baseCalculationKind} /></Field>
        <CalculationFields onChange={(value) => update("baseCalculation", value)} value={answers.baseCalculation} />
        <Field label="5. Houve nova expedição de alvará após o cálculo-base?">
          <YesNo name="newWarrantAfterBase" onChange={(value) => update("newWarrantAfterBase", value)} value={answers.newWarrantAfterBase} />
        </Field>
        {answerIsYes(answers.newWarrantAfterBase) ? (
          <div className="grid gap-3">
            {answers.newWarrantsAfterBase.map((item, index) => (
              <div key={index} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">5.1/5.3 Novo alvará {index + 1}</h3>
                  <button className="rounded-md border border-[#c7ccbf] bg-white px-3 py-1 text-sm font-semibold" onClick={() => removeArrayItem("newWarrantsAfterBase", index)} type="button">Remover</button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Valor líquido reclamante"><MoneyInput onChange={(value) => updateArrayItem("newWarrantsAfterBase", index, { ...item, netClaimantAmount: value })} value={item.netClaimantAmount} /></Field>
                  <Field label="Honorários sucumbenciais"><MoneyInput onChange={(value) => updateArrayItem("newWarrantsAfterBase", index, { ...item, feesAmount: value })} value={item.feesAmount} /></Field>
                  <Field label="Data"><TextInput onChange={(value) => updateArrayItem("newWarrantsAfterBase", index, { ...item, date: value })} type="date" value={item.date} /></Field>
                  <Field label="ID"><TextInput onChange={(value) => updateArrayItem("newWarrantsAfterBase", index, { ...item, pjeId: value })} value={item.pjeId} /></Field>
                </div>
              </div>
            ))}
            <button className="h-10 rounded-md border border-emerald-800 bg-white px-4 text-sm font-semibold text-emerald-800" onClick={() => addArrayItem("newWarrantsAfterBase", emptyNewWarrant())} type="button">Adicionar alvará</button>
          </div>
        ) : null}
      </Section>

      <Section kicker="Bloco 2" title="Cálculo Exigível">
        <Field label="6. Cálculo já exigível neste momento"><SelectInput onChange={(value) => update("enforceableCalculationKind", value)} options={enforceableCalculationOptions} value={answers.enforceableCalculationKind} /></Field>
        <CalculationFields onChange={(value) => update("enforceableCalculation", value)} value={answers.enforceableCalculation} />
      </Section>

      <Section kicker="Bloco 3" title="Histórico de Alvarás Expedidos">
        <div className="grid gap-3">
          {answers.releaseOrders.map((item, index) => (
            <div key={index} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">7. Alvará {index + 1}</h3>
                <button className="rounded-md border border-[#c7ccbf] bg-white px-3 py-1 text-sm font-semibold" onClick={() => removeArrayItem("releaseOrders", index)} type="button">Remover</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="ID do Alvará no PJe"><TextInput onChange={(value) => updateArrayItem("releaseOrders", index, { ...item, pjeId: value })} value={item.pjeId} /></Field>
                <Field label="Data da expedição"><TextInput onChange={(value) => updateArrayItem("releaseOrders", index, { ...item, issuedAt: value })} type="date" value={item.issuedAt} /></Field>
                <Field label="Cota-parte reclamante"><MoneyInput onChange={(value) => updateArrayItem("releaseOrders", index, { ...item, claimantShareAmount: value })} value={item.claimantShareAmount} /></Field>
                <Field label="Cota-parte honorários"><MoneyInput onChange={(value) => updateArrayItem("releaseOrders", index, { ...item, feesShareAmount: value })} value={item.feesShareAmount} /></Field>
                <Field label="Comprovação do saque/levantamento"><SelectInput onChange={(value) => updateArrayItem("releaseOrders", index, { ...item, proofStatus: value })} options={warrantProofOptions} value={item.proofStatus} /></Field>
              </div>
            </div>
          ))}
          <button className="h-10 rounded-md border border-emerald-800 bg-white px-4 text-sm font-semibold text-emerald-800" onClick={() => addArrayItem("releaseOrders", emptyReleaseOrder())} type="button">Adicionar alvará expedido</button>
        </div>
      </Section>

      <Section kicker="Bloco 4" title="Dinheiro, Depósitos e Garantias">
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">8. Depósitos recursais</h3>
          {answers.appealDeposits.map((item, index) => (
            <div key={index} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Depósito recursal {index + 1}</h4>
                <button className="rounded-md border border-[#c7ccbf] bg-white px-3 py-1 text-sm font-semibold" onClick={() => removeArrayItem("appealDeposits", index)} type="button">Remover</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="ID do comprovante"><TextInput onChange={(value) => updateArrayItem("appealDeposits", index, { ...item, pjeId: value })} value={item.pjeId} /></Field>
                <Field label="Valor original"><MoneyInput onChange={(value) => updateArrayItem("appealDeposits", index, { ...item, originalAmount: value })} value={item.originalAmount} /></Field>
                <Field label="Modalidade da garantia"><SelectInput onChange={(value) => updateArrayItem("appealDeposits", index, { ...item, guaranteeMode: value })} options={guaranteeModeOptions} value={item.guaranteeMode} /></Field>
                <Field label="Situação atual"><SelectInput onChange={(value) => updateArrayItem("appealDeposits", index, { ...item, status: value })} options={depositStatusOptions} value={item.status} /></Field>
                <Field label="Saldo disponível"><MoneyInput onChange={(value) => updateArrayItem("appealDeposits", index, { ...item, availableBalanceAmount: value })} value={item.availableBalanceAmount} /></Field>
              </div>
            </div>
          ))}
          <button className="h-10 rounded-md border border-emerald-800 bg-white px-4 text-sm font-semibold text-emerald-800" onClick={() => addArrayItem("appealDeposits", emptyAppealDeposit())} type="button">Adicionar depósito recursal</button>
        </div>

        <div className="grid gap-3 border-t border-[#edf0e8] pt-4">
          <h3 className="text-sm font-semibold">9. Depósitos judiciais, bloqueios SisbaJud ou Art. 916</h3>
          {answers.judicialDeposits.map((item, index) => (
            <div key={index} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Depósito/bloqueio {index + 1}</h4>
                <button className="rounded-md border border-[#c7ccbf] bg-white px-3 py-1 text-sm font-semibold" onClick={() => removeArrayItem("judicialDeposits", index)} type="button">Remover</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Natureza/origem"><SelectInput onChange={(value) => updateArrayItem("judicialDeposits", index, { ...item, origin: value })} options={judicialDepositOriginOptions} value={item.origin} /></Field>
                <Field label="ID do comprovante/penhora"><TextInput onChange={(value) => updateArrayItem("judicialDeposits", index, { ...item, pjeId: value })} value={item.pjeId} /></Field>
                <Field label="Data do depósito/penhora"><TextInput onChange={(value) => updateArrayItem("judicialDeposits", index, { ...item, depositedAt: value })} type="date" value={item.depositedAt} /></Field>
                <Field label="Valor original"><MoneyInput onChange={(value) => updateArrayItem("judicialDeposits", index, { ...item, originalAmount: value })} value={item.originalAmount} /></Field>
                <Field label="Situação atual"><SelectInput onChange={(value) => updateArrayItem("judicialDeposits", index, { ...item, status: value })} options={depositStatusOptions} value={item.status} /></Field>
              </div>
            </div>
          ))}
          <button className="h-10 rounded-md border border-emerald-800 bg-white px-4 text-sm font-semibold text-emerald-800" onClick={() => addArrayItem("judicialDeposits", emptyJudicialDeposit())} type="button">Adicionar depósito judicial</button>
        </div>

        <div className="grid gap-3 border-t border-[#edf0e8] pt-4">
          <h3 className="text-sm font-semibold">10/11. Seguros Garantia e Cartas de Fiança</h3>
          {answers.guarantees.map((item, index) => (
            <div key={index} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Garantia {index + 1}</h4>
                <button className="rounded-md border border-[#c7ccbf] bg-white px-3 py-1 text-sm font-semibold" onClick={() => removeArrayItem("guarantees", index)} type="button">Remover</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Tipo da garantia"><SelectInput onChange={(value) => updateArrayItem("guarantees", index, { ...item, guaranteeType: value })} options={guaranteeTypeOptions} value={item.guaranteeType} /></Field>
                <Field label="ID da peça no PJe"><TextInput onChange={(value) => updateArrayItem("guarantees", index, { ...item, pjeId: value })} value={item.pjeId} /></Field>
                <Field label="Data de vencimento"><TextInput onChange={(value) => updateArrayItem("guarantees", index, { ...item, expiresAt: value })} type="date" value={item.expiresAt} /></Field>
                <Field label="Valor original segurado/garantido"><MoneyInput onChange={(value) => updateArrayItem("guarantees", index, { ...item, originalAmount: value })} value={item.originalAmount} /></Field>
                <Field label="12. Houve depósito em dinheiro para substituir?"><SelectInput onChange={(value) => updateArrayItem("guarantees", index, { ...item, substitutedByCash: value })} options={substitutionOptions} value={item.substitutedByCash} /></Field>
                {answerIsYes(item.substitutedByCash) ? (
                  <Field label="12.1. O dinheiro substituto foi levantado?"><SelectInput onChange={(value) => updateArrayItem("guarantees", index, { ...item, substitutedMoneyWithdrawn: value })} options={substitutedMoneyWithdrawalOptions} value={item.substitutedMoneyWithdrawn} /></Field>
                ) : null}
                {item.substitutedByCash.toLocaleLowerCase("pt-BR").includes("parcial") ? (
                  <Field label="13. Valor ainda exigível da seguradora"><MoneyInput onChange={(value) => updateArrayItem("guarantees", index, { ...item, insurerEnforceableAmount: value })} value={item.insurerEnforceableAmount} /></Field>
                ) : null}
                <Field label="14. Situação atual do sinistro"><SelectInput onChange={(value) => updateArrayItem("guarantees", index, { ...item, claimStatus: value })} options={claimStatusOptions} value={item.claimStatus} /></Field>
                {item.claimStatus.toLocaleLowerCase("pt-BR").startsWith("não ocorreu") ? (
                  <Field label="14.1. Já houve petição do escritório?"><YesNo name={`officePetition-${index}`} onChange={(value) => updateArrayItem("guarantees", index, { ...item, hasOfficePetitionForClaim: value })} value={item.hasOfficePetitionForClaim || "Não"} /></Field>
                ) : null}
              </div>
            </div>
          ))}
          <button className="h-10 rounded-md border border-emerald-800 bg-white px-4 text-sm font-semibold text-emerald-800" onClick={() => addArrayItem("guarantees", emptyGuarantee())} type="button">Adicionar garantia</button>
        </div>
      </Section>

      <Section kicker="Bloco 5" title="Petições e Ação Estratégica">
        <Field label="15. Petição para provocar sinistro"><SelectInput onChange={(value) => update("claimPetitionStatus", value)} options={claimPetitionOptions} value={answers.claimPetitionStatus} /></Field>
        <Field label="16. Petição requerendo liberação de valores"><SelectInput onChange={(value) => update("releasePetitionStatus", value)} options={releasePetitionOptions} value={answers.releasePetitionStatus} /></Field>
        {answerIsYes(answers.releasePetitionStatus) ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="16.1 Valor líquido reclamante"><MoneyInput onChange={(value) => update("releasePetitionNetAmount", value)} value={answers.releasePetitionNetAmount} /></Field>
            <Field label="16.1 Valor honorários sucumbenciais"><MoneyInput onChange={(value) => update("releasePetitionFeesAmount", value)} value={answers.releasePetitionFeesAmount} /></Field>
          </div>
        ) : null}
        <Field label="17. Petição requerendo intimação para pagamento"><SelectInput onChange={(value) => update("paymentPetitionStatus", value)} options={paymentPetitionOptions} value={answers.paymentPetitionStatus} /></Field>
        {answerIsYes(answers.paymentPetitionStatus) ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="17.1 Valor líquido reclamante"><MoneyInput onChange={(value) => update("paymentPetitionNetAmount", value)} value={answers.paymentPetitionNetAmount} /></Field>
            <Field label="17.1 Valor honorários sucumbenciais"><MoneyInput onChange={(value) => update("paymentPetitionFeesAmount", value)} value={answers.paymentPetitionFeesAmount} /></Field>
          </div>
        ) : null}
        <div>
          <p className="text-sm font-medium text-[#293127]">18. Ação estratégica a ser adotada</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {strategicActionOptions.map((option) => (
              <label key={option} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${answers.strategicActions.includes(option) ? "border-emerald-800 bg-emerald-50 text-emerald-950" : "border-[#d7dbd0] bg-white text-[#293127]"}`}>
                <input checked={answers.strategicActions.includes(option)} onChange={() => toggleStrategicAction(option)} type="checkbox" />
                {option}
              </label>
            ))}
          </div>
        </div>
        {answers.strategicActions.includes("Outra") ? (
          <Field label="Outra ação"><textarea className={textareaClass} onChange={(event) => update("strategicActionOther", event.target.value)} rows={3} value={answers.strategicActionOther} /></Field>
        ) : null}
      </Section>

      <Section kicker="Bloco 6" title="Crédito Alvo">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Valor líquido reclamante"><MoneyInput onChange={(value) => update("targetCreditNetAmount", value)} value={answers.targetCreditNetAmount} /></Field>
          <Field label="Valor honorários sucumbenciais"><MoneyInput onChange={(value) => update("targetCreditFeesAmount", value)} value={answers.targetCreditFeesAmount} /></Field>
        </div>
        <Field label="Observações internas"><textarea className={textareaClass} onChange={(event) => update("internalNotes", event.target.value)} rows={4} value={answers.internalNotes} /></Field>
      </Section>

      <Section kicker="Anexo" title="Arquivo do processo">
        <Field label="Arquivos do processo">
          <input className="rounded-md border border-[#c7ccbf] bg-white p-2 text-sm font-normal" multiple name="files" onChange={(event) => setFileCount(event.target.files?.length ?? 0)} required type="file" />
        </Field>
        <p className="text-xs text-[#6a7466]">{fileCount} arquivo(s) selecionado(s).</p>
      </Section>

      <div className="sticky bottom-0 z-10 border-t border-[#d7dbd0] bg-[#f6f7f2]/95 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[#566052]">O envio salva o questionário, os anexos e tenta sincronizar com o Drive.</p>
          <button className="h-11 rounded-md border border-emerald-800 bg-emerald-900 px-5 text-sm font-semibold text-white transition-transform active:scale-[0.98]" type="submit">Enviar questionário</button>
        </div>
      </div>
    </form>
  );
}
