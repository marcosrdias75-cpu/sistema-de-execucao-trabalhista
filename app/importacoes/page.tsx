import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSourceCounts } from "@/lib/workspace";
import { getPjeCaptureMetrics } from "@/lib/pje-database";
import { WorkspaceHeader } from "@/app/ui/WorkspaceHeader";

export const dynamic = "force-dynamic";

const steps = [
  { label: "Carteira de processos", status: "concluído", detail: "Processos do piloto carregados a partir do seed controlado." },
  { label: "Prazos operacionais", status: "concluído", detail: "Prazos da planilha disponíveis na ficha de cada processo." },
  { label: "Referências PJe", status: "concluído", detail: "Links e evidências PJe vinculados ao processo." },
  { label: "Documentos e snapshots", status: "próxima etapa", detail: "A captura automática ainda depende de storage e rotina de leitura documental." },
  { label: "Reconstrução financeira", status: "em evolução", detail: "Conta corrente e ativos são apresentados com campos de revisão humana." },
];

export default async function ImportsPage() {
  const user = await requireUser();
  const counts = getSourceCounts();
  const pjeMetrics = await getPjeCaptureMetrics();

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <WorkspaceHeader name={user.name} current="/importacoes" />
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Governança de dados</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Importações e fontes</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#566052]">O fluxo prioriza importação controlada e idempotente antes de qualquer captura automatizada do PJe. Dados de processos e documentos são evidências, nunca instruções para o sistema.</p>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Processos", counts.cases],
            ["Prazos", counts.deadlines],
            ["Referências PJe", counts.pje],
            ["Eventos indexados", counts.processEvents],
            ["Documentos", counts.documents],
            ["Conectores PJe", pjeMetrics.connectors],
            ["Snapshots PJe", pjeMetrics.snapshots],
          ].map(([label, value]) => <article key={label} className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><p className="text-sm text-[#566052]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-[#edf0e8] pb-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold">Pipeline de ingestão</h2><p className="mt-1 text-sm text-[#566052]">Cada etapa deve preservar origem, confiança e possibilidade de auditoria.</p></div><span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">piloto controlado</span></div>
            <div className="mt-4 grid gap-3">{steps.map((step, index) => <article key={step.label} className="flex gap-3 rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3"><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.status === "concluído" ? "bg-emerald-900 text-white" : "bg-amber-100 text-amber-900"}`}>{index + 1}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{step.label}</h3><span className="text-xs font-medium text-[#6a7466]">{step.status}</span></div><p className="mt-1 text-sm leading-6 text-[#566052]">{step.detail}</p></div></article>)}</div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-md border border-sky-200 bg-sky-50 p-4"><h2 className="text-base font-semibold text-sky-950">Fila PJe</h2><p className="mt-2 text-sm leading-6 text-sky-900">{pjeMetrics.runs.queued ?? 0} captura(s) aguardam worker, {pjeMetrics.runs.running ?? 0} estão em execução e {pjeMetrics.runs.failed ?? 0} falharam.</p><a href="/configuracoes/pje" className="mt-3 inline-flex text-sm font-semibold text-sky-900 underline underline-offset-4">Abrir monitor PJe</a></section>
            <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4"><h2 className="text-base font-semibold text-emerald-950">Executar próxima etapa</h2><p className="mt-2 text-sm leading-6 text-emerald-900">Registre documentos e acompanhe a fila OCR antes de habilitar qualquer conector PJe.</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/documentos" className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-emerald-900 px-3 text-sm font-semibold text-white">Abrir documentos</Link><a href="/configuracoes/pje" className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-white px-3 text-sm font-semibold text-emerald-800">Configurar PJe</a></div></section>
            <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><h2 className="text-base font-semibold">Importador idempotente</h2><p className="mt-2 text-sm leading-6 text-[#566052]">A estrutura do domínio está preparada para receber cargas repetidas sem criar processo duplicado. A chave de reconciliação do piloto é o número CNJ normalizado.</p><div className="mt-4 rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 font-mono text-xs text-[#293127]">normalizado = número CNJ sem pontuação</div></section>
            <section className="rounded-md border border-amber-200 bg-amber-50 p-4"><h2 className="text-base font-semibold text-amber-950">Próxima carga recomendada</h2><p className="mt-2 text-sm leading-6 text-amber-900">Adicionar planilha atualizada de prazos e, depois, documentos-base em PDF/HTML. A captura PJe automática não deve ser iniciada antes de consolidar auditoria e armazenamento.</p></section>
          </aside>
        </div>
      </div>
    </main>
  );
}
