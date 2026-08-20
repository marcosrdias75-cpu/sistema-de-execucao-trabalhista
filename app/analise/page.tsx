/* eslint-disable @next/next/no-html-link-for-pages */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listPilotEdits } from "@/lib/database";
import {
  analysisCriteria,
  buildCaseAnalyses,
  buildCriticalDeadlineQueue,
  buildSignalCounts,
  deadlineTiming,
} from "@/lib/analysis";
import { LogoutButton } from "@/app/ui/LogoutButton";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  blocked: "bloqueado",
  in_review: "em revisao",
  pending_review: "pendente",
  validated: "validado",
};

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

function formatDate(value: string | null) {
  if (!value) {
    return "sem data";
  }

  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function priorityClass(priority: string) {
  if (priority === "P1") {
    return "border-rose-300 bg-rose-50 text-rose-800";
  }

  if (priority === "P2") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}

function scoreBarClass(score: number) {
  if (score >= 78) {
    return "bg-rose-700";
  }

  if (score >= 58) {
    return "bg-amber-600";
  }

  return "bg-emerald-700";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AnalysisPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?next=/analise");
  }

  if (user.mustChangePassword) {
    redirect("/trocar-chave?next=/analise");
  }

  const edits = await listPilotEdits();
  const analyses = buildCaseAnalyses(edits);
  const criticalQueue = buildCriticalDeadlineQueue(analyses);
  const signalCounts = buildSignalCounts();
  const topAnalyses = analyses.slice(0, 10);
  const leaderAnalysis = topAnalyses[0] ?? null;
  const topSignals = signalCounts.slice(0, 8);
  const topCriticalDeadlines = criticalQueue.slice(0, 8);
  const totalValue = analyses.reduce((total, analysis) => total + (analysis.value ?? 0), 0);
  const p1Count = analyses.filter((analysis) => analysis.priority === "P1").length;
  const pendingReviewCount = analyses.filter(
    (analysis) => analysis.reviewStatus === "pending_review",
  ).length;
  const mediumOrHighConfidence = analyses.filter(
    (analysis) => analysis.confidence !== "Baixa",
  ).length;

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <header className="border-b border-[#d7dbd0] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-800">SIGRJ Restrito</p>
            <h1 className="text-2xl font-semibold">Analise executiva do piloto</h1>
            <p className="mt-1 text-sm text-[#566052]">Acesso de {user.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-white px-3 text-sm font-medium text-emerald-800"
            >
              Lista de processos
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

      <div className="mx-auto max-w-7xl space-y-6 px-5 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#566052]">Fila P1 sugerida</p>
            <p className="mt-2 text-3xl font-semibold">{p1Count}</p>
          </article>
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#566052]">Prazos criticos abertos</p>
            <p className="mt-2 text-3xl font-semibold">{criticalQueue.length}</p>
          </article>
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#566052]">Confianca media/alta</p>
            <p className="mt-2 text-3xl font-semibold">{mediumOrHighConfidence}</p>
          </article>
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#566052]">Potencial bruto analisado</p>
            <p className="mt-2 text-3xl font-semibold">{formatCurrency(totalValue)}</p>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Section title="Esteira de analise">
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ["1", "Fonte", "Planilha, PJe e edicoes internas."],
                ["2", "Sinais", "Execucao, calculo, alvara, SISBAJUD e deposito."],
                ["3", "Prioridade", "Pontuacao por valor, prazo, evidencia e risco."],
                ["4", "Revisao", "Advogado aprova, corrige ou bloqueia a recomendacao."],
              ].map(([step, title, description]) => (
                <article key={step} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                  <p className="text-xs font-semibold uppercase text-emerald-800">Etapa {step}</p>
                  <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#566052]">{description}</p>
                </article>
              ))}
            </div>
          </Section>

          <Section title="Status da revisao">
            <div className="grid gap-3">
              <div className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <p className="text-sm text-[#566052]">Pendentes de revisao humana</p>
                <p className="mt-2 text-2xl font-semibold">{pendingReviewCount}</p>
              </div>
              <div className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <p className="text-sm text-[#566052]">Processo lider da fila</p>
                {leaderAnalysis ? (
                  <>
                    <a
                      href={`/processos/${leaderAnalysis.slug}`}
                      className="mt-2 inline-flex text-sm font-semibold text-emerald-800"
                    >
                      {leaderAnalysis.processNumber}
                    </a>
                    <p className="mt-1 text-sm text-[#566052]">{leaderAnalysis.opportunity}</p>
                    <a
                      href={`/processos/${leaderAnalysis.slug}`}
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-emerald-900 px-3 text-sm font-semibold text-white"
                    >
                      Abrir processo lider
                    </a>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[#566052]">sem analise</p>
                )}
              </div>
            </div>
          </Section>
        </section>

        {leaderAnalysis ? (
          <Section title="Analise aplicada ao processo lider">
            <div className="grid gap-3 md:grid-cols-4">
              <article className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <p className="text-xs font-semibold uppercase text-emerald-800">1. Dados lidos</p>
                <p className="mt-2 text-sm leading-6 text-[#566052]">
                  {leaderAnalysis.deadlinesCount} prazo(s), {leaderAnalysis.pjeCount} PJe e{" "}
                  {formatCurrency(leaderAnalysis.value)} de potencial bruto.
                </p>
              </article>
              <article className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <p className="text-xs font-semibold uppercase text-emerald-800">2. Sinais encontrados</p>
                <p className="mt-2 text-sm leading-6 text-[#566052]">
                  {leaderAnalysis.evidence.slice(0, 4).join(", ")}
                </p>
              </article>
              <article className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <p className="text-xs font-semibold uppercase text-emerald-800">3. Prioridade calculada</p>
                <p className="mt-2 text-sm leading-6 text-[#566052]">
                  Score {leaderAnalysis.analysisScore}, fila {leaderAnalysis.priority}, confianca{" "}
                  {leaderAnalysis.confidence}.
                </p>
              </article>
              <article className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <p className="text-xs font-semibold uppercase text-emerald-800">4. Revisao humana</p>
                <p className="mt-2 text-sm leading-6 text-[#566052]">{leaderAnalysis.suggestedAction}</p>
              </article>
            </div>
          </Section>
        ) : null}

        <Section title="Criterios ativos">
          <div className="grid gap-3 md:grid-cols-4">
            {analysisCriteria.map((criterion) => (
              <article key={criterion.signal} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <p className="text-sm font-semibold">{criterion.label}</p>
                <p className="mt-2 text-xs uppercase text-[#6a7466]">peso {criterion.weight}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Fila de oportunidades">
          <div className="divide-y divide-[#edf0e8]">
            {topAnalyses.map((analysis) => (
              <article
                key={analysis.processNumber}
                className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[220px_1fr_150px_140px_150px]"
              >
                <div>
                  <a
                    href={`/processos/${analysis.slug}`}
                    className="text-sm font-semibold text-emerald-800"
                  >
                    {analysis.processNumber}
                  </a>
                  <p className="mt-1 text-xs text-[#6a7466]">{analysis.reclamante}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{analysis.opportunity}</p>
                  <p className="mt-1 text-sm leading-6 text-[#566052]">{analysis.suggestedAction}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {analysis.evidence.slice(0, 5).map((item) => (
                      <span key={item} className="rounded-sm bg-[#edf4f7] px-2 py-1 text-xs text-[#1f5363]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold">{formatCurrency(analysis.value)}</p>
                  <p className="mt-1 text-xs text-[#6a7466]">
                    {analysis.deadlinesCount} prazo(s) | {analysis.pjeCount} PJe
                  </p>
                  <p className="mt-1 text-xs text-[#6a7466]">confianca {analysis.confidence}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityClass(analysis.priority)}`}>
                      {analysis.priority}
                    </span>
                    <span className="text-sm font-semibold">{analysis.analysisScore}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#edf0e8]">
                    <div
                      className={`h-2 rounded-full ${scoreBarClass(analysis.analysisScore)}`}
                      style={{ width: `${analysis.analysisScore}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#6a7466]">
                    {statusLabels[analysis.reviewStatus] ?? analysis.reviewStatus}
                  </p>
                </div>
                <div className="lg:text-right">
                  <a
                    href={`/processos/${analysis.slug}`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-emerald-900 px-3 text-sm font-semibold text-white"
                  >
                    Abrir processo
                  </a>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Section title="Prazos criticos">
            {topCriticalDeadlines.length > 0 ? (
              <div className="divide-y divide-[#edf0e8]">
                {topCriticalDeadlines.map(({ analysis, deadline }) => (
                  <article key={`${analysis.processNumber}-${deadline.id}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <a
                          href={`/processos/${analysis.slug}`}
                          className="text-sm font-semibold text-emerald-800"
                        >
                          {analysis.processNumber}
                        </a>
                        <p className="mt-1 text-sm font-medium">{deadline.descricao ?? "Prazo sem descricao"}</p>
                        <p className="mt-1 text-sm text-[#566052]">{deadline.faseProcesso ?? "fase pendente"}</p>
                        <a
                          href={`/processos/${analysis.slug}`}
                          className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-emerald-800 bg-white px-3 text-xs font-semibold text-emerald-800"
                        >
                          Abrir processo
                        </a>
                      </div>
                      <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">
                        {deadlineTiming(deadline)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#6a7466]">
                      Data final {formatDate(deadline.dataFinal)} | {deadline.statusPrazo ?? "sem status"}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#566052]">Nenhum prazo critico aberto pelos criterios atuais.</p>
            )}
          </Section>

          <Section title="Matriz de sinais">
            <div className="grid gap-3">
              {topSignals.map((signal) => (
                <div key={signal.signal}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{signal.label}</p>
                    <p className="text-sm font-semibold">{signal.count}</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#edf0e8]">
                    <div
                      className="h-2 rounded-full bg-emerald-800"
                      style={{
                        width: `${Math.max(8, (signal.count / Math.max(topSignals[0]?.count ?? 1, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </section>
      </div>
    </main>
  );
}
