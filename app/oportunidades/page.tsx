import { requireUser } from "@/lib/auth";
import { listWorkspaceOpportunities } from "@/lib/workspace";
import { WorkspaceHeader } from "@/app/ui/WorkspaceHeader";

export const dynamic = "force-dynamic";

function formatCurrency(value: number | null) {
  if (value === null || value === 0) return "pendente";
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function priorityClass(priority: string) {
  if (priority === "P1") return "border-rose-200 bg-rose-50 text-rose-800";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function riskClass(risk: string) {
  if (risk === "alto") return "border-rose-200 bg-rose-50 text-rose-800";
  if (risk === "medio") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const opportunities = await listWorkspaceOpportunities();
  const totals = opportunities.reduce((acc, opportunity) => {
    acc.immediate += opportunity.immediateAmount;
    acc.estimated += opportunity.estimatedAmount ?? 0;
    acc.p1 += opportunity.priority === "P1" ? 1 : 0;
    return acc;
  }, { immediate: 0, estimated: 0, p1: 0 });

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <WorkspaceHeader name={user.name} current="/oportunidades" />
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Motor de oportunidades</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Fila de recuperação</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#566052]">As oportunidades são heurísticas explicáveis para organizar trabalho. O sistema não protocola atos jurídicos nem substitui a decisão da equipe.</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-right text-sm text-amber-900">
            <p className="font-semibold">Revisão humana obrigatória</p>
            <p className="mt-1 text-xs">{opportunities.length} oportunidades, {totals.p1} classificadas como P1</p>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><p className="text-sm text-[#566052]">Valor imediato indicado</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.immediate)}</p></article>
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><p className="text-sm text-[#566052]">Valor potencial em triagem</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.estimated)}</p></article>
          <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><p className="text-sm text-[#566052]">Aguardando decisão P1</p><p className="mt-2 text-2xl font-semibold">{totals.p1}</p></article>
        </section>

        <section className="mt-6 grid gap-4">
          {opportunities.map((opportunity) => (
            <article key={`${opportunity.caseNumber}-${opportunity.type}`} className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityClass(opportunity.priority)}`}>{opportunity.priority}</span>
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${riskClass(opportunity.rjRisk)}`}>risco RJ {opportunity.rjRisk}</span>
                    <span className="rounded-md border border-[#d7dbd0] bg-[#fbfcf8] px-2 py-1 text-xs font-semibold text-[#566052]">{opportunity.humanReviewRequired ? "revisão humana" : "automático"}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">{opportunity.title}</h2>
                  <p className="mt-1 text-sm font-medium text-emerald-900"><a href={`/processos/${opportunity.caseNumber.replace(/\D/g, "")}`} className="underline decoration-emerald-300 underline-offset-2">{opportunity.caseNumber}</a> · {opportunity.claimant ?? "reclamante pendente"}</p>
                  <p className="mt-3 max-w-4xl text-sm leading-6 text-[#566052]">{opportunity.summary}</p>
                </div>
                <div className="grid min-w-[220px] gap-2 rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-[#6a7466]">Imediato</span><strong>{formatCurrency(opportunity.immediateAmount)}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-[#6a7466]">Potencial</span><strong>{formatCurrency(opportunity.estimatedAmount)}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-[#6a7466]">Confiança</span><strong className="capitalize">{opportunity.confidence}</strong></div>
                  <div className="flex justify-between gap-4"><span className="text-[#6a7466]">Prazo</span><strong>{opportunity.dueDate ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${opportunity.dueDate}T12:00:00`)) : "sem data"}</strong></div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-[#edf0e8] pt-4 md:grid-cols-[1fr_auto] md:items-center">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[#6a7466]">Ação sugerida</p><p className="mt-1 text-sm leading-6 text-[#293127]">{opportunity.suggestedAction}</p></div>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Status: {opportunity.reviewStatus === "validated" ? "validado" : "pending_review"}</span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
