import { requireUser } from "@/lib/auth";
import { buildWorkspace } from "@/lib/workspace";
import { WorkspaceHeader } from "@/app/ui/WorkspaceHeader";
import { toProcessSlug } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

function formatCurrency(value: number | null) {
  if (value === null || value === undefined || value === 0) return "pendente";
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function phaseLabel(value: string) {
  const labels: Record<string, string> = {
    arquivado_extinto: "Arquivado/extinto",
    conhecimento: "Conhecimento",
    liquidacao: "Liquidação",
    execucao_definitiva: "Execução definitiva",
    execucao_provisoria: "Execução provisória",
    cumprimento_levantamento: "Cumprimento/levantamento",
    pendente_verificacao: "Pendente de verificação",
  };
  return labels[value] ?? value;
}

function priorityClass(priority: string) {
  if (priority === "P1") return "border-rose-200 bg-rose-50 text-rose-800";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function riskClass(risk: string) {
  if (risk === "alto") return "text-rose-700";
  if (risk === "medio") return "text-amber-700";
  return "text-emerald-700";
}

export default async function ProcessesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q.trim().toLocaleLowerCase("pt-BR") : "";
  const phase = typeof params.phase === "string" ? params.phase : "";
  const priority = typeof params.priority === "string" ? params.priority : "";
  const snapshot = await buildWorkspace();
  const cases = snapshot.cases.filter((item) => {
    const matchesQuery = !query || [item.pilotCase.processNumber, item.pilotCase.reclamante, item.pilotCase.empresa]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("pt-BR").includes(query));
    const matchesPhase = !phase || item.phase === phase;
    const matchesPriority = !priority || item.opportunity.priority === priority;
    return matchesQuery && matchesPhase && matchesPriority;
  });

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <WorkspaceHeader name={user.name} current="/processos" />
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Carteira de processos</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Triagem operacional</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#566052]">
              Pesquise a carteira do piloto e identifique onde existe crédito, garantia, prazo ou oportunidade que exige revisão humana.
            </p>
          </div>
          <p className="text-sm text-[#566052]">{cases.length} de {snapshot.cases.length} processos exibidos</p>
        </div>

        <form method="get" className="mt-6 grid gap-3 rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm md:grid-cols-[1fr_210px_150px_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium">
            Buscar processo, reclamante ou empresa
            <input name="q" defaultValue={query} placeholder="Ex.: 1000906 ou nome" className="h-10 rounded-md border border-[#c7ccbf] bg-white px-3 font-normal outline-none ring-emerald-700 focus:ring-2" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Fase
            <select name="phase" defaultValue={phase} className="h-10 rounded-md border border-[#c7ccbf] bg-white px-3 font-normal outline-none ring-emerald-700 focus:ring-2">
              <option value="">Todas as fases</option>
              <option value="execucao_definitiva">Execução definitiva</option>
              <option value="execucao_provisoria">Execução provisória</option>
              <option value="liquidacao">Liquidação</option>
              <option value="cumprimento_levantamento">Cumprimento/levantamento</option>
              <option value="pendente_verificacao">Pendente de verificação</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Prioridade
            <select name="priority" defaultValue={priority} className="h-10 rounded-md border border-[#c7ccbf] bg-white px-3 font-normal outline-none ring-emerald-700 focus:ring-2">
              <option value="">Todas</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </label>
          <button type="submit" className="h-10 rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white transition-transform active:scale-[0.98]">Filtrar</button>
        </form>

        <section className="mt-6 overflow-hidden rounded-md border border-[#d7dbd0] bg-white shadow-sm">
          <div className="grid gap-3 border-b border-[#edf0e8] bg-[#fbfcf8] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6a7466] lg:grid-cols-[220px_1fr_170px_130px_130px_100px]">
            <span>Processo</span><span>Parte / fase</span><span>Valor / saldo</span><span>Oportunidade</span><span>Risco RJ</span><span>Revisão</span>
          </div>
          <div className="divide-y divide-[#edf0e8]">
            {cases.map((item) => (
              <a key={item.pilotCase.processNumber} href={`/processos/${toProcessSlug(item.pilotCase.processNumber)}`} className="grid gap-3 px-4 py-4 transition-colors hover:bg-[#fbfcf8] lg:grid-cols-[220px_1fr_170px_130px_130px_100px] lg:items-center">
                <div>
                  <p className="text-sm font-semibold">{item.pilotCase.processNumber}</p>
                  <p className="mt-1 text-xs text-[#6a7466]">score {item.analysis.analysisScore}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{item.pilotCase.reclamante ?? "Reclamante pendente"}</p>
                  <p className="mt-1 text-sm text-[#566052]">{phaseLabel(item.phase)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{formatCurrency(item.grossSignaled)}</p>
                  <p className="mt-1 text-xs text-[#6a7466]">saldo {formatCurrency(item.balance.estimatedBalance)}</p>
                </div>
                <div>
                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${priorityClass(item.opportunity.priority)}`}>{item.opportunity.priority}</span>
                  <p className="mt-1 text-xs text-[#566052]">{item.opportunity.type.replaceAll("_", " ")}</p>
                </div>
                <div>
                  <p className={`text-sm font-semibold capitalize ${riskClass(item.rjRisk)}`}>{item.rjRisk}</p>
                  <p className="mt-1 text-xs text-[#6a7466]">{item.hasGuarantee ? "com garantia" : "sem garantia"}</p>
                </div>
                <div>
                  <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">{item.edit.reviewStatus === "validated" ? "validado" : "revisar"}</span>
                </div>
              </a>
            ))}
            {cases.length === 0 ? <p className="px-4 py-10 text-center text-sm text-[#566052]">Nenhum processo corresponde aos filtros atuais.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
