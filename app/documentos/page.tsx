import { requireUser } from "@/lib/auth";
import { listDocuments } from "@/lib/document-database";
import { pilotCases } from "@/lib/seed-data";
import { WorkspaceHeader } from "@/app/ui/WorkspaceHeader";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_storage: "aguardando armazenamento",
    failed: "falhou",
    ocr_queued: "OCR na fila",
    ocr_running: "OCR em execução",
    queued: "na fila",
    review_pending: "aguardando revisão",
    reviewed: "revisado",
    text_available: "texto disponível",
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "reviewed" || status === "text_available") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const processNumber = typeof params.processNumber === "string" ? params.processNumber : "";
  const documents = await listDocuments(processNumber || undefined);

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <WorkspaceHeader name={user.name} current="/importacoes" />
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Documentos e evidências</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Ingestão manual e OCR</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#566052]">Importe um documento para o processo correto. O sistema guarda metadados, hash, origem e estado de leitura; o arquivo binário deve ser ligado a um storage autorizado antes do uso em produção.</p></div>
          <a href="/importacoes" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">Voltar ao pipeline</a>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[400px_1fr]">
          <form action="/api/documents" method="post" encType="multipart/form-data" className="grid content-start gap-4 rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <div><h2 className="text-lg font-semibold">Adicionar documento</h2><p className="mt-1 text-sm leading-6 text-[#566052]">PDFs entram como job OCR. HTML/TXT podem fornecer texto imediatamente.</p></div>
            <label className="grid gap-2 text-sm font-medium">Processo<select name="processNumber" required defaultValue={processNumber} className="h-10 rounded-md border border-[#c7ccbf] bg-white px-3 font-normal"><option value="">Selecione</option>{pilotCases.map((item) => <option key={item.processNumber} value={item.processNumber}>{item.processNumber} · {item.reclamante ?? "reclamante pendente"}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium">Título<input name="title" required placeholder="Ex.: cálculo homologado" className="h-10 rounded-md border border-[#c7ccbf] px-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-medium">Tipo<select name="documentType" defaultValue="decisao" className="h-10 rounded-md border border-[#c7ccbf] bg-white px-3 font-normal"><option value="decisao">Decisão</option><option value="calculo">Cálculo</option><option value="alvara">Alvará</option><option value="garantia">Garantia/seguro/fiança</option><option value="movimentacao">Movimentação</option><option value="outro">Outro</option></select></label>
            <label className="grid gap-2 text-sm font-medium">Data do documento<input name="documentDate" type="date" className="h-10 rounded-md border border-[#c7ccbf] px-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-medium">URL de origem<input name="sourceUrl" type="url" placeholder="https://..." className="h-10 rounded-md border border-[#c7ccbf] px-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-medium">Arquivo PDF/HTML/TXT<input name="file" type="file" accept=".pdf,.html,.htm,.txt,application/pdf,text/html,text/plain" className="rounded-md border border-[#c7ccbf] bg-white p-2 text-sm font-normal" /></label>
            <label className="grid gap-2 text-sm font-medium">Texto já extraído<textarea name="extractedText" rows={5} placeholder="Opcional: cole aqui o texto quando o arquivo ainda não estiver no storage." className="rounded-md border border-[#c7ccbf] p-3 text-sm font-normal" /></label>
            <button type="submit" className="h-10 rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white">Registrar documento</button>
          </form>

          <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 border-b border-[#edf0e8] pb-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold">Documentos registrados</h2><p className="mt-1 text-sm text-[#566052]">{documents.length} documento(s) para o filtro atual.</p></div><form method="get" className="flex gap-2"><select name="processNumber" defaultValue={processNumber} className="h-9 rounded-md border border-[#c7ccbf] bg-white px-2 text-sm"><option value="">Toda a carteira</option>{pilotCases.map((item) => <option key={item.processNumber} value={item.processNumber}>{item.processNumber}</option>)}</select><button type="submit" className="h-9 rounded-md border border-[#c7ccbf] bg-white px-3 text-sm font-semibold">Filtrar</button></form></div>
            <div className="mt-4 grid gap-3">{documents.map((document) => <article key={document.id} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#6a7466]">{document.documentType ?? "documento"} · {document.processNumber ?? "processo pendente"}</p><h3 className="mt-1 text-sm font-semibold">{document.title}</h3><p className="mt-1 text-xs text-[#6a7466]">hash {document.fileHash ? `${document.fileHash.slice(0, 16)}…` : "pendente"} · {new Intl.DateTimeFormat("pt-BR").format(new Date(document.createdAt))}</p></div><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(document.readingStatus)}`}>{statusLabel(document.readingStatus)}</span></div>{document.extractedText ? <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#566052]">{document.extractedText}</p> : <p className="mt-3 text-sm text-[#6a7466]">Sem texto extraído. O worker deverá processar o arquivo a partir do storage.</p>}<div className="mt-3 flex flex-wrap gap-2 border-t border-[#edf0e8] pt-3"><a href={`/documentos/${document.id}`} className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-white px-3 text-sm font-semibold text-emerald-800">Abrir revisão</a><form action={`/api/documents/${document.id}/ocr`} method="post"><button type="submit" className="h-9 rounded-md border border-amber-700 bg-amber-700 px-3 text-sm font-semibold text-white">Enfileirar OCR</button></form></div></article>)}{documents.length === 0 ? <div className="rounded-md border border-dashed border-[#c7ccbf] p-10 text-center text-sm text-[#566052]">Nenhum documento registrado ainda.</div> : null}</div>
          </section>
        </section>
      </div>
    </main>
  );
}
