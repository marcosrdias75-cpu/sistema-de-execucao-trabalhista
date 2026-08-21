import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listQuestionnaireSubmissions } from "@/lib/questionnaire-database";
import { pilotCases } from "@/lib/seed-data";
import { WorkspaceHeader } from "@/app/ui/WorkspaceHeader";
import { QuestionnaireForm } from "@/app/questionarios/QuestionnaireForm";

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

export default async function QuestionnairesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const created = typeof params.created === "string" ? params.created : null;
  const submissions = await listQuestionnaireSubmissions(25);
  const processOptions = pilotCases.map((item) => ({
    claimantName: item.reclamante ?? "",
    court: item.faseSituacaoProcesso ?? item.executionSheetPhase ?? "",
    processNumber: item.processNumber,
  }));

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <WorkspaceHeader name={user.name} current="/questionarios" />
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Questionário Casas Bahia</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Apuração de crédito por processo</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#566052]">
              Cada envio fica vinculado ao advogado, ao processo, aos anexos e à tentativa de sincronização com o Drive operacional.
            </p>
          </div>
          <p className="text-sm text-[#566052]">{submissions.length} envio(s) recentes</p>
        </div>

        {created ? (
          <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            Questionário registrado. Consulte o status do Drive no histórico abaixo.
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
          <div>
            <QuestionnaireForm processOptions={processOptions} />
          </div>

          <aside className="grid content-start gap-4">
            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Histórico</p>
                  <h2 className="mt-1 text-lg font-semibold">Últimos envios</h2>
                </div>
                <Link className="text-sm font-semibold text-emerald-800 underline underline-offset-4" href="/questionarios">Atualizar</Link>
              </div>
              <div className="mt-4 grid gap-3">
                {submissions.map((submission) => (
                  <a key={submission.id} href={`/questionarios/${submission.id}`} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 transition-colors hover:border-emerald-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{submission.processNumber}</p>
                        <p className="mt-1 truncate text-xs text-[#6a7466]">{submission.claimantName || "reclamante pendente"}</p>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${driveStatusClass(submission.driveStatus)}`}>
                        {driveStatusLabel(submission.driveStatus)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#6a7466]">
                      {submission.submittedByName} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(submission.submittedAt))}
                    </p>
                  </a>
                ))}
                {submissions.length === 0 ? <p className="rounded-md border border-dashed border-[#c7ccbf] p-6 text-center text-sm text-[#566052]">Nenhum questionário enviado ainda.</p> : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
