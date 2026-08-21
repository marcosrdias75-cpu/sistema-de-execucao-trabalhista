import { requireUser } from "@/lib/auth";
import { WorkspaceHeader } from "@/app/ui/WorkspaceHeader";
import { buildWorkspace, getSourceCounts, listWorkspaceOpportunities } from "@/lib/workspace";
import { toProcessSlug } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function priorityClass(priority: string) {
  if (priority === "P1") return "border-rose-200 bg-rose-50 text-rose-800";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function Home() {
  const user = await requireUser();
  const [snapshot, opportunities] = await Promise.all([buildWorkspace(), listWorkspaceOpportunities()]);
  const sources = getSourceCounts();
  const topOpportunities = opportunities.slice(0, 4);
  const criticalDeadlines = snapshot.criticalDeadlines.slice(0, 5);

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <WorkspaceHeader name={user.name} current="/" />
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Painel executivo</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Onde está o dinheiro recuperável?</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#566052]">Visão consolidada da carteira para priorizar execução, conferência financeira e próximos passos jurídicos, sempre com validação humana.</p></div>
          <a href="/analise" className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white">Abrir análise executiva</a>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Processos na carteira", snapshot.metrics.totalProcesses.toString(), "carteira Casas Bahia"],
            ["Crédito bruto sinalizado", formatCurrency(snapshot.metrics.grossSignaled), "origem: piloto"],
            ["Dinheiro disponível", formatCurrency(snapshot.metrics.availableCash), "edições confirmadas"],
            ["Valor potencialmente liberável", formatCurrency(snapshot.metrics.potentiallyReleasable), "estimativa de triagem"],
          ].map(([label, value, hint]) => <article key={label} className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><p className="text-sm text-[#566052]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-[#6a7466]">{hint}</p></article>)}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Fila de trabalho</p><h2 className="mt-1 text-lg font-semibold">Oportunidades que pedem decisão</h2></div><a href="/oportunidades" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">Ver todas</a></div><div className="mt-4 grid gap-3">{topOpportunities.map((opportunity) => <a key={`${opportunity.caseNumber}-${opportunity.type}`} href={`/processos/${toProcessSlug(opportunity.caseNumber)}`} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 transition-colors hover:border-emerald-700"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityClass(opportunity.priority)}`}>{opportunity.priority}</span><p className="truncate text-sm font-semibold">{opportunity.title}</p></div><p className="shrink-0 text-sm font-semibold">{formatCurrency(opportunity.immediateAmount)}</p></div><p className="mt-2 text-xs text-[#566052]">{opportunity.caseNumber} · {opportunity.claimant ?? "reclamante pendente"}</p><p className="mt-2 text-sm leading-5 text-[#566052]">{opportunity.suggestedAction}</p></a>)}</div></section>

            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Prazos críticos</p><h2 className="mt-1 text-lg font-semibold">O que não pode ficar sem conferência</h2></div><span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{snapshot.criticalDeadlines.length} abertos</span></div><div className="mt-4 divide-y divide-[#edf0e8]">{criticalDeadlines.map((item) => <a key={item.deadline.id} href={`/processos/${toProcessSlug(item.analysis.processNumber)}`} className="flex flex-col gap-2 py-3 first:pt-0 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold">{item.deadline.descricao ?? "Prazo sem descrição"}</p><p className="mt-1 text-xs text-[#566052]">{item.analysis.processNumber} · {item.deadline.responsavel ?? "responsável pendente"}</p></div><span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">{item.timing}</span></a>)}</div></section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><h2 className="text-lg font-semibold">Funil financeiro</h2><div className="mt-4 grid gap-3">{[["Crédito bruto", snapshot.metrics.grossSignaled], ["Crédito consolidado", snapshot.metrics.consolidatedCredit], ["Recebido/abatido", snapshot.metrics.receivedAmount], ["Pendente de confirmação", snapshot.metrics.pendingConfirmation]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-[#edf0e8] pb-3 last:border-0 last:pb-0"><span className="text-sm text-[#566052]">{label}</span><strong className="text-sm">{formatCurrency(Number(value))}</strong></div>)}</div></section>
            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><h2 className="text-lg font-semibold">Cobertura operacional</h2><div className="mt-4 grid gap-3">{[["Execução definitiva", snapshot.metrics.definitiveProcesses], ["Execução provisória", snapshot.metrics.provisionalProcesses], ["Com garantia/bloqueio", snapshot.metrics.processesWithGuarantee], ["Com depósito", snapshot.metrics.processesWithDeposit], ["Alvará a conferir", snapshot.metrics.pendingWarrants]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4"><span className="text-sm text-[#566052]">{label}</span><span className="rounded-full bg-[#edf4f7] px-2.5 py-1 text-xs font-semibold text-[#1f5363]">{value}</span></div>)}</div></section>
            <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Qualidade da fonte</p><p className="mt-2 text-sm leading-6 text-emerald-950">{sources.cases} processos, {sources.deadlines} prazos e {sources.pje} referências PJe estão disponíveis no piloto. Documentos e eventos processuais estruturados são a próxima camada de ingestão.</p><a href="/importacoes" className="mt-3 inline-flex text-sm font-semibold text-emerald-900 underline underline-offset-4">Ver pipeline de importação</a></section>
          </aside>
        </section>
      </div>
    </main>
  );
}
