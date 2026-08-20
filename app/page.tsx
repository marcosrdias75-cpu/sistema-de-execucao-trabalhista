import { requireUser } from "@/lib/auth";
import { listPilotEdits } from "@/lib/database";
import { buildCaseAnalyses, buildCriticalDeadlineQueue } from "@/lib/analysis";
import { pilotCases, pjeReferences, processDeadlines, toProcessSlug } from "@/lib/seed-data";
import { LogoutButton } from "@/app/ui/LogoutButton";

export const dynamic = "force-dynamic";

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) {
    return "pendente";
  }

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

const statusLabels: Record<string, string> = {
  blocked: "bloqueado",
  in_review: "em revisao",
  pending_review: "pendente",
  validated: "validado",
};

function priorityClass(priority: string) {
  if (priority === "P1") {
    return "border-rose-300 bg-rose-50 text-rose-800";
  }

  if (priority === "P2") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}

export default async function Home() {
  const user = await requireUser();
  const edits = await listPilotEdits();
  const analyses = buildCaseAnalyses(edits);
  const topAnalyses = analyses.slice(0, 3);
  const criticalQueue = buildCriticalDeadlineQueue(analyses);
  const totalValue = pilotCases.reduce(
    (total, pilotCase) => total + (pilotCase.maxBrutoReclamante ?? 0),
    0,
  );

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <header className="border-b border-[#d7dbd0] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-800">SIGRJ Restrito</p>
            <h1 className="text-2xl font-semibold">Processos reais do piloto</h1>
            <p className="mt-1 text-sm text-[#566052]">Acesso de {user.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/analise"
              className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-white px-3 text-sm font-medium text-emerald-800"
            >
              Abrir analise
            </a>
            <a
              href="/configuracoes/openclaw"
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#c7ccbf] bg-white px-3 text-sm font-medium text-[#293127]"
            >
              OpenClaw
            </a>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#566052]">Processos liberados</p>
            <p className="mt-2 text-3xl font-semibold">{pilotCases.length}</p>
          </article>
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#566052]">Prazos da planilha</p>
            <p className="mt-2 text-3xl font-semibold">{processDeadlines.length}</p>
          </article>
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#566052]">Referencias PJe</p>
            <p className="mt-2 text-3xl font-semibold">{pjeReferences.length}</p>
          </article>
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#566052]">Valor bruto sinalizado</p>
            <p className="mt-2 text-3xl font-semibold">{formatCurrency(totalValue)}</p>
          </article>
        </section>

        <section className="mt-6 rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-800">Motor de analise</p>
              <h2 className="mt-1 text-lg font-semibold">Fila inicial de oportunidades</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#566052]">
                A priorizacao cruza valor bruto, prazos da planilha, referencias PJe,
                sinais de execucao e status de revisao humana.
              </p>
            </div>
            <a
              href="/analise"
              className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white"
            >
              Ver analise executiva
            </a>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_180px]">
            {topAnalyses.map((analysis) => (
              <a
                key={analysis.processNumber}
                href={`/processos/${analysis.slug}`}
                className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 hover:border-emerald-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{analysis.processNumber}</p>
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityClass(analysis.priority)}`}>
                    {analysis.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#566052]">{analysis.opportunity}</p>
                <p className="mt-2 text-xs text-[#6a7466]">score {analysis.analysisScore}</p>
              </a>
            ))}
            <article className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
              <p className="text-sm text-[#566052]">Prazos criticos</p>
              <p className="mt-2 text-3xl font-semibold">{criticalQueue.length}</p>
              <p className="mt-2 text-xs text-[#6a7466]">abertos pelos criterios atuais</p>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-md border border-[#d7dbd0] bg-white shadow-sm">
          <div className="border-b border-[#edf0e8] px-4 py-3">
            <h2 className="text-base font-semibold">Lista de processos</h2>
            <p className="mt-1 text-sm text-[#566052]">
              Clique em um processo para revisar dados reais e editar a ficha.
            </p>
          </div>
          <div className="divide-y divide-[#edf0e8]">
            {pilotCases.map((pilotCase) => {
              const edit = edits.get(pilotCase.processNumber);
              const deadlinesCount = processDeadlines.filter(
                (deadline) => deadline.processo === pilotCase.processNumber,
              ).length;

              return (
                <a
                  key={pilotCase.processNumber}
                  href={`/processos/${toProcessSlug(pilotCase.processNumber)}`}
                  className="grid gap-3 px-4 py-4 hover:bg-[#fbfcf8] lg:grid-cols-[220px_1fr_160px_140px_150px] lg:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#171b18]">{pilotCase.processNumber}</p>
                    <p className="mt-1 text-xs text-[#6a7466]">rank {pilotCase.pilotRank}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#171b18]">{pilotCase.reclamante}</p>
                    <p className="mt-1 text-sm text-[#566052]">
                      {edit?.workingExecutionClassification ??
                        pilotCase.workingExecutionClassification ??
                        "sem classificacao"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatCurrency(pilotCase.maxBrutoReclamante)}</p>
                    <p className="mt-1 text-xs text-[#6a7466]">{deadlinesCount} prazo(s)</p>
                  </div>
                  <div>
                    <span className="rounded-md border border-cyan-300 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
                      {statusLabels[edit?.reviewStatus ?? "pending_review"]}
                    </span>
                  </div>
                  <div className="lg:text-right">
                    <span className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-emerald-900 px-3 text-sm font-semibold text-white">
                      Abrir processo
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
