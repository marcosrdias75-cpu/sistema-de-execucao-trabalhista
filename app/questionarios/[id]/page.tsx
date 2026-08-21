import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getQuestionnaireSubmission } from "@/lib/questionnaire-database";
import { WorkspaceHeader } from "@/app/ui/WorkspaceHeader";
import { answerIsYes } from "@/lib/questionnaire-schema";

export const dynamic = "force-dynamic";

function driveStatusLabel(status: string) {
  const labels: Record<string, string> = {
    failed: "Falha no Drive",
    pending: "Pendente",
    pending_credentials: "Credencial pendente",
    uploaded: "Enviado ao Drive",
  };
  return labels[status] ?? status;
}

function driveStatusClass(status: string) {
  if (status === "uploaded") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function value(text: string | undefined | null) {
  return text?.trim() || "Não informado";
}

function money(text: string | undefined | null) {
  return text?.trim() ? `R$ ${text.replace(/^R\$\s*/i, "")}` : "Não informado";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[#edf0e8] py-2 last:border-0 md:grid-cols-[280px_1fr]">
      <dt className="text-sm font-medium text-[#566052]">{label}</dt>
      <dd className="text-sm text-[#171b18]">{value}</dd>
    </div>
  );
}

export default async function QuestionnaireSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const submission = await getQuestionnaireSubmission(id);
  if (!submission) notFound();
  const answers = submission.answers;

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <WorkspaceHeader name={user.name} current="/questionarios" />
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Questionário enviado</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{submission.processNumber}</h1>
            <p className="mt-2 text-sm text-[#566052]">
              {submission.submittedByName} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(submission.submittedAt))}
            </p>
          </div>
          <Link href="/questionarios" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">Voltar ao formulário</Link>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4">
            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Resumo do preenchimento</h2>
              <dl className="mt-3">
                <Row label="Reclamante" value={value(answers.claimantName)} />
                <Row label="Vara/TRT" value={value(answers.court)} />
                <Row label="PJe" value={answers.pjeUrl ? <a className="text-emerald-800 underline underline-offset-4" href={answers.pjeUrl}>{answers.pjeUrl}</a> : "Não informado"} />
                <Row label="Tipo da execução" value={value(answers.executionType)} />
                <Row label="Trânsito em julgado" value={value(answers.finalTransitDate)} />
                <Row label="Cálculo base" value={value(answers.baseCalculationKind)} />
                <Row label="ID do cálculo base" value={value(answers.baseCalculation.pjeId)} />
                <Row label="Valor líquido reclamante" value={money(answers.baseCalculation.netClaimantAmount)} />
                <Row label="Valor bruto reclamante" value={money(answers.baseCalculation.grossClaimantAmount)} />
                <Row label="Honorários no cálculo base" value={money(answers.baseCalculation.feesAmount)} />
                <Row label="Total da execução" value={money(answers.baseCalculation.totalExecutionAmount)} />
                <Row label="Nova expedição de alvará após cálculo-base" value={value(answers.newWarrantAfterBase)} />
                {answerIsYes(answers.newWarrantAfterBase) ? <Row label="Novos alvarás após cálculo-base" value={answers.newWarrantsAfterBase.length} /> : null}
                <Row label="Cálculo exigível" value={value(answers.enforceableCalculationKind)} />
                <Row label="Alvarás expedidos" value={answers.releaseOrders.length} />
                <Row label="Depósitos recursais" value={answers.appealDeposits.length} />
                <Row label="Depósitos judiciais/bloqueios" value={answers.judicialDeposits.length} />
                <Row label="Seguros/fianças" value={answers.guarantees.length} />
                <Row label="Petição para provocar sinistro" value={value(answers.claimPetitionStatus)} />
                <Row label="Petição de liberação" value={value(answers.releasePetitionStatus)} />
                <Row label="Petição de pagamento" value={value(answers.paymentPetitionStatus)} />
                <Row label="Ação estratégica" value={answers.strategicActions.join("; ") || "Não informado"} />
                <Row label="Crédito alvo líquido" value={money(answers.targetCreditNetAmount)} />
                <Row label="Crédito alvo honorários" value={money(answers.targetCreditFeesAmount)} />
              </dl>
            </section>
          </div>

          <aside className="grid content-start gap-4">
            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6a7466]">Drive</p>
                  <h2 className="mt-1 text-lg font-semibold">Sincronização</h2>
                </div>
                <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${driveStatusClass(submission.driveStatus)}`}>
                  {driveStatusLabel(submission.driveStatus)}
                </span>
              </div>
              {submission.driveFolderUrl ? (
                <a className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white" href={submission.driveFolderUrl}>
                  Abrir pasta no Drive
                </a>
              ) : null}
              {submission.driveError ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{submission.driveError}</p> : null}
              {submission.driveStatus !== "uploaded" ? (
                <form action={`/api/questionarios/${submission.id}/drive`} method="post" className="mt-4">
                  <button className="h-10 rounded-md border border-emerald-800 bg-white px-4 text-sm font-semibold text-emerald-800" type="submit">Tentar enviar novamente</button>
                </form>
              ) : null}
            </section>

            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Anexos</h2>
              <div className="mt-3 grid gap-2">
                {submission.attachments.map((attachment) => (
                  <div key={attachment.sha256} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                    <p className="text-sm font-semibold">{attachment.originalName}</p>
                    <p className="mt-1 text-xs text-[#6a7466]">{attachment.size} bytes · {attachment.sha256.slice(0, 16)}...</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
