import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDocument, listOcrRuns, listReviews } from "@/lib/document-database";
import { WorkspaceHeader } from "@/app/ui/WorkspaceHeader";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "completed" || status === "reviewed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ documentId: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { documentId } = await params;
  const document = await getDocument(documentId);
  if (!document) notFound();
  const [runs, reviews] = await Promise.all([listOcrRuns(documentId), listReviews(documentId)]);
  const query = (await searchParams) ?? {};

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <WorkspaceHeader name={user.name} current="/importacoes" />
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
        <a href={`/documentos?processNumber=${encodeURIComponent(document.processNumber ?? "")}`} className="text-sm font-semibold text-emerald-800 underline underline-offset-4">Voltar aos documentos</a>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Revisão de evidência</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{document.title}</h1><p className="mt-2 text-sm text-[#566052]">{document.processNumber ?? "processo pendente"} · {document.documentType ?? "documento"}</p></div><span className={`rounded-md border px-3 py-2 text-xs font-semibold ${statusClass(document.readingStatus)}`}>{document.readingStatus}</span></div>
        {query.reviewed === "1" ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Revisão registrada e auditada.</p> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="space-y-6">
            <article className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><h2 className="text-lg font-semibold">Texto extraído</h2><p className="mt-1 text-sm text-[#566052]">O texto abaixo é evidência de leitura e não constitui decisão jurídica.</p><pre className="mt-4 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-4 text-sm leading-6 text-[#293127]">{document.extractedText ?? "Texto ainda não disponível. Enfileire o OCR após configurar o storage/worker."}</pre></article>
            <form action={`/api/documents/${document.id}/review`} method="post" className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><h2 className="text-lg font-semibold">Decisão humana</h2><p className="mt-1 text-sm leading-6 text-[#566052]">Registre se a evidência foi conferida, rejeitada ou corrigida. A decisão fica separada do texto original.</p><div className="mt-4 grid gap-4"><label className="grid gap-2 text-sm font-medium">Status<select name="status" defaultValue="approved" className="h-10 rounded-md border border-[#c7ccbf] bg-white px-3 font-normal"><option value="approved">Aprovado</option><option value="corrected">Corrigido</option><option value="rejected">Rejeitado</option></select></label><label className="grid gap-2 text-sm font-medium">Trecho conferido<textarea name="sourceExcerpt" rows={4} className="rounded-md border border-[#c7ccbf] p-3 text-sm font-normal" placeholder="Cole o trecho ou indique a página conferida." /></label><label className="grid gap-2 text-sm font-medium">Valor corrigido, se aplicável<textarea name="correctedValue" rows={3} className="rounded-md border border-[#c7ccbf] p-3 text-sm font-normal" /></label><label className="grid gap-2 text-sm font-medium">Notas<textarea name="notes" rows={3} className="rounded-md border border-[#c7ccbf] p-3 text-sm font-normal" /></label><button type="submit" className="h-10 rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white">Registrar revisão</button></div></form>
          </section>
          <aside className="space-y-4"><section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><h2 className="text-base font-semibold">Metadados</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs uppercase tracking-wide text-[#6a7466]">Hash</dt><dd className="mt-1 break-all font-mono text-xs">{document.fileHash ?? "pendente"}</dd></div><div><dt className="text-xs uppercase tracking-wide text-[#6a7466]">Origem</dt><dd className="mt-1 break-all">{document.sourceUrl ?? document.storageKey ?? "não informada"}</dd></div><div><dt className="text-xs uppercase tracking-wide text-[#6a7466]">Criado em</dt><dd className="mt-1">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(document.createdAt))}</dd></div></dl></section><section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><h2 className="text-base font-semibold">Execuções OCR</h2><div className="mt-3 grid gap-2">{runs.map((run) => <div key={run.id} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className={`rounded-md border px-2 py-1 font-semibold ${statusClass(run.status)}`}>{run.status}</span><span className="text-[#6a7466]">{run.language ?? "por"}</span></div><p className="mt-2 text-[#566052]">{run.engine ?? "worker pendente"} · {run.requestedBy}</p>{run.errorMessage ? <p className="mt-2 text-rose-700">{run.errorMessage}</p> : null}</div>)}{runs.length === 0 ? <p className="text-sm text-[#566052]">Nenhuma execução registrada.</p> : null}</div></section><section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><h2 className="text-base font-semibold">Histórico humano</h2><div className="mt-3 grid gap-2">{reviews.map((review) => <div key={String(review.id)} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 text-xs"><p className="font-semibold">{String(review.status)} · {String(review.reviewed_by)}</p><p className="mt-1 text-[#566052]">{String(review.notes ?? "sem notas")}</p></div>)}{reviews.length === 0 ? <p className="text-sm text-[#566052]">Nenhuma revisão registrada.</p> : null}</div></section></aside>
        </div>
      </div>
    </main>
  );
}
