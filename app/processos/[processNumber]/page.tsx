/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLatestAiAnalysisRun, getPilotEdit, type AiAnalysisRun } from "@/lib/database";
import { getPilotCase, getPjeReferences, getProcessDeadlines } from "@/lib/seed-data";
import { LogoutButton } from "@/app/ui/LogoutButton";
import { EditForm } from "./EditForm";

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

function formatDate(value: string | null) {
  if (!value) {
    return "sem data";
  }

  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "pendente";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

const openClawStatusLabels: Record<string, string> = {
  approved: "aprovada",
  completed: "analise recebida",
  failed: "falha no envio",
  queued: "aguardando OpenClaw",
  rejected: "rejeitada",
  sent_to_openclaw: "enviada ao OpenClaw",
};

function isGenericOpenClawFailure(resultText: string) {
  const normalized = resultText.trim().toLowerCase();
  return (
    normalized.includes("agent couldn't generate a response") ||
    normalized.includes("please try again") ||
    normalized.includes("could not generate a response") ||
    normalized.includes("failed to generate")
  );
}

function openClawStatusClass(status: string) {
  if (status === "completed" || status === "approved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (status === "failed" || status === "rejected") {
    return "border-rose-300 bg-rose-50 text-rose-800";
  }

  return "border-amber-300 bg-amber-50 text-amber-800";
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

function OpenClawPanel({
  analysisMessage,
  processNumber,
  run,
}: {
  analysisMessage?: string | string[];
  processNumber: string;
  run: AiAnalysisRun | null;
}) {
  const normalizedMessage = Array.isArray(analysisMessage) ? analysisMessage[0] : analysisMessage;
  const genericFailure = run?.resultText ? isGenericOpenClawFailure(run.resultText) : false;
  const feedback =
    normalizedMessage === "sent"
      ? "Tarefa enviada ao OpenClaw. O resultado entrara automaticamente aqui quando o agente concluir."
      : normalizedMessage === "completed"
        ? "Analise concluida pelo OpenClaw e registrada neste processo."
      : normalizedMessage === "queued"
        ? "Tarefa criada. Ela ficara aguardando o gateway OpenClaw configurado."
        : normalizedMessage === "failed"
          ? "A tarefa foi criada, mas o envio ao OpenClaw falhou. Confira o status abaixo."
          : null;
  const buttonLabel = run ? "Rodar nova analise" : "Analisar com OpenClaw";

  return (
    <Section title="Analise OpenClaw">
      <div className="grid gap-4">
        {feedback ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {feedback}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">Solicitar analise assistida</p>
            <p className="mt-1 text-sm leading-6 text-[#566052]">
              O SIGRJ monta o pacote do processo e entrega ao OpenClaw para execucao em segundo plano.
            </p>
          </div>
          <form action={`/api/analyses/${encodeURIComponent(processNumber)}`} method="post">
            <button
              type="submit"
              className="h-10 rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white"
            >
              {buttonLabel}
            </button>
          </form>
        </div>

        {run ? (
          <article className="rounded-md border border-[#e3e6dd] bg-white p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#6a7466]">Ultima solicitacao</p>
                <p className="mt-1 text-sm text-[#566052]">
                  {formatDateTime(run.requestedAt)} por {run.requestedBy}
                </p>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${openClawStatusClass(run.status)}`}>
                {openClawStatusLabels[run.status] ?? run.status}
              </span>
            </div>

            {run.failureMessage ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {run.failureMessage}
              </p>
            ) : null}

            {run.resultText && genericFailure ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                OpenClaw autenticou, mas o agente nao conseguiu gerar a analise. Rode nova analise apos confirmar
                que o provedor/modelo do OpenClaw esta funcional.
              </p>
            ) : run.resultText ? (
              <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-900">Resultado recebido</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#293127]">{run.resultText}</p>
              </div>
            ) : (
              <details className="mt-4 rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                <summary className="cursor-pointer text-sm font-semibold text-emerald-800">
                  Ver pacote preparado para o OpenClaw
                </summary>
                <textarea
                  className="mt-3 min-h-72 w-full rounded-md border border-[#c7ccbf] bg-white p-3 font-mono text-xs leading-5 text-[#293127]"
                  readOnly
                  value={run.analysisPrompt}
                />
              </details>
            )}
          </article>
        ) : (
          <p className="text-sm text-[#566052]">
            Nenhuma analise OpenClaw foi solicitada para este processo ainda.
          </p>
        )}
      </div>
    </Section>
  );
}

export default async function ProcessPage(props: PageProps<"/processos/[processNumber]">) {
  await requireUser();
  const { processNumber } = await props.params;
  const searchParams = await props.searchParams;
  const savedByFallback = searchParams?.saved === "1";
  const processKey = decodeURIComponent(processNumber);
  const pilotCase = getPilotCase(processKey);

  if (!pilotCase) {
    notFound();
  }

  const [edit, pjeRefs, deadlines, latestOpenClawRun] = await Promise.all([
    getPilotEdit(pilotCase.processNumber),
    Promise.resolve(getPjeReferences(pilotCase.processNumber)),
    Promise.resolve(getProcessDeadlines(pilotCase.processNumber)),
    getLatestAiAnalysisRun(pilotCase.processNumber),
  ]);
  const balance =
    edit.creditConsolidated !== null && edit.amountReceived !== null
      ? edit.creditConsolidated - edit.amountReceived
      : null;

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <header className="border-b border-[#d7dbd0] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <a href="/" className="text-sm font-medium text-emerald-800">
              Voltar para processos
            </a>
            <h1 className="mt-2 text-2xl font-semibold">{pilotCase.processNumber}</h1>
            <p className="mt-1 text-sm text-[#566052]">{pilotCase.reclamante}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/analise"
              className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-white px-3 text-sm font-medium text-emerald-800"
            >
              Analise
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

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <Section title="Ficha executiva">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-[#6a7466]">Classificacao</dt>
                <dd className="mt-1 font-medium">
                  {edit.workingExecutionClassification ??
                    pilotCase.workingExecutionClassification ??
                    "pendente"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-[#6a7466]">Fase cadastrada</dt>
                <dd className="mt-1 font-medium">{pilotCase.faseSituacaoProcesso ?? "pendente"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-[#6a7466]">Valor bruto sinalizado</dt>
                <dd className="mt-1 font-medium">{formatCurrency(pilotCase.maxBrutoReclamante)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-[#6a7466]">Saldo editado</dt>
                <dd className="mt-1 font-medium">{formatCurrency(balance)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-[#6a7466]">PJe</dt>
                <dd className="mt-1 font-medium">{pjeRefs.length} referencia(s)</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-[#6a7466]">Prazos da planilha</dt>
                <dd className="mt-1 font-medium">{deadlines.length} prazo(s)</dd>
              </div>
            </dl>
          </Section>

          <Section title="Sinais">
            <div className="flex flex-wrap gap-2">
              {pilotCase.coverageTags.map((tag) => (
                <span key={tag} className="rounded-sm bg-[#edf4f7] px-2 py-1 text-xs font-medium text-[#1f5363]">
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        </aside>

        <div className="space-y-6">
          <Section title="Editar ficha">
            {savedByFallback ? (
              <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                Edicao salva.
              </p>
            ) : null}
            <EditForm processNumber={pilotCase.processNumber} initialEdit={edit} />
          </Section>

          <OpenClawPanel
            analysisMessage={searchParams?.analysis}
            processNumber={pilotCase.processNumber}
            run={latestOpenClawRun}
          />

          <Section title="Prazos do processo">
            {deadlines.length > 0 ? (
              <div className="grid gap-3">
                {deadlines.map((deadline) => (
                  <article key={deadline.id} className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#6a7466]">
                          {formatDate(deadline.dataFinal)} | {deadline.faseProcesso ?? "fase pendente"}
                        </p>
                        <h3 className="mt-2 text-sm font-semibold">
                          {deadline.descricao ?? "Prazo sem descricao"}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <span className="rounded-sm bg-[#edf4f7] px-2 py-1 text-xs font-medium text-[#1f5363]">
                          {deadline.statusProcesso ?? "sem status"}
                        </span>
                        <span className="rounded-sm bg-[#f4f1e8] px-2 py-1 text-xs font-medium text-[#64542f]">
                          {deadline.statusPrazo ?? "sem andamento"}
                        </span>
                      </div>
                    </div>

                    <dl className="mt-3 grid gap-2 text-sm text-[#566052] md:grid-cols-3">
                      <div>
                        <dt className="text-xs font-semibold uppercase text-[#6a7466]">Tipo</dt>
                        <dd className="mt-1">{deadline.tipoPrazo ?? "pendente"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-[#6a7466]">Responsavel</dt>
                        <dd className="mt-1">{deadline.responsavel ?? "pendente"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-[#6a7466]">Valor bruto</dt>
                        <dd className="mt-1">{formatCurrency(deadline.brutoReclamante)}</dd>
                      </div>
                    </dl>

                    {deadline.observacao ? (
                      <p className="mt-3 text-sm leading-6 text-[#566052]">{deadline.observacao}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#edf0e8] pt-3 text-xs text-[#6a7466]">
                      <span>
                        Origem: {deadline.sourceSheet}, linha {deadline.sourceRowNumber ?? "pendente"}
                      </span>
                      {deadline.forum ? <span>{deadline.forum}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#566052]">Nenhum prazo localizado na planilha para este processo.</p>
            )}
          </Section>

          <Section title="Referencias PJe">
            {pjeRefs.length > 0 ? (
              <div className="divide-y divide-[#edf0e8]">
                {pjeRefs.map((reference) => (
                  <article key={reference.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#6a7466]">
                          {reference.court} | {reference.evidenceKind}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold">{reference.title}</h3>
                        <p className="mt-1 text-sm text-[#566052]">
                          Consultado em {formatDate(reference.observedAt)}
                        </p>
                      </div>
                      <a
                        href={reference.pjeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-white px-3 text-sm font-medium text-emerald-800"
                      >
                        Abrir PJe
                      </a>
                    </div>
                    {reference.notes ? (
                      <p className="mt-2 text-sm leading-6 text-[#566052]">{reference.notes}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#566052]">Nenhuma referencia PJe vinculada.</p>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}
