import type { ReactNode } from "react";
import type { PilotEdit } from "@/lib/database";

const inputClass =
  "h-10 rounded-md border border-[#c7ccbf] bg-white px-3 text-sm outline-none focus:border-emerald-800";
const textAreaClass =
  "min-h-24 rounded-md border border-[#c7ccbf] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-emerald-800";

function fieldValue(value: string | number | null | undefined) {
  return value?.toString() ?? "";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase text-[#6a7466]">{label}</span>
      {children}
    </label>
  );
}

export function EditForm({
  processNumber,
  initialEdit,
}: {
  processNumber: string;
  initialEdit: PilotEdit;
}) {
  return (
    <form action={`/api/edits/${encodeURIComponent(processNumber)}`} method="post" className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Status">
          <select className={inputClass} name="reviewStatus" defaultValue={initialEdit.reviewStatus}>
            <option value="pending_review">Pendente</option>
            <option value="in_review">Em revisao</option>
            <option value="validated">Validado</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </Field>
        <Field label="Prioridade">
          <select className={inputClass} name="priority" defaultValue={initialEdit.priority}>
            <option value="P1">P1 - urgente</option>
            <option value="P2">P2 - importante</option>
            <option value="P3">P3 - acompanhar</option>
          </select>
        </Field>
        <Field label="Responsavel">
          <input
            className={inputClass}
            name="responsible"
            defaultValue={fieldValue(initialEdit.responsible)}
            placeholder="Nome"
          />
        </Field>
      </div>

      <Field label="Classificacao corrigida">
        <input
          className={inputClass}
          name="workingExecutionClassification"
          defaultValue={fieldValue(initialEdit.workingExecutionClassification)}
          placeholder="Classificacao revisada"
        />
      </Field>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Credito consolidado">
          <input
            className={inputClass}
            inputMode="decimal"
            name="creditConsolidated"
            defaultValue={fieldValue(initialEdit.creditConsolidated)}
            placeholder="0"
          />
        </Field>
        <Field label="Recebido / abatido">
          <input
            className={inputClass}
            inputMode="decimal"
            name="amountReceived"
            defaultValue={fieldValue(initialEdit.amountReceived)}
            placeholder="0"
          />
        </Field>
        <Field label="Dinheiro disponivel">
          <input
            className={inputClass}
            inputMode="decimal"
            name="availableCash"
            defaultValue={fieldValue(initialEdit.availableCash)}
            placeholder="0"
          />
        </Field>
      </div>

      <Field label="Garantia util">
        <input
          className={inputClass}
          name="guaranteeStatus"
          defaultValue={fieldValue(initialEdit.guaranteeStatus)}
          placeholder="Ex.: apolice vigente, caucao vencida"
        />
      </Field>

      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="Proxima acao">
          <textarea className={textAreaClass} name="nextAction" defaultValue={fieldValue(initialEdit.nextAction)} />
        </Field>
        <Field label="Notas juridicas">
          <textarea className={textAreaClass} name="legalNotes" defaultValue={fieldValue(initialEdit.legalNotes)} />
        </Field>
        <Field label="Observacoes internas">
          <textarea className={textAreaClass} name="internalNotes" defaultValue={fieldValue(initialEdit.internalNotes)} />
        </Field>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#edf0e8] pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-[#566052]">As edicoes ficam salvas no banco online.</p>
        <button
          type="submit"
          className="h-10 rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white"
        >
          Salvar edicao
        </button>
      </div>
    </form>
  );
}
