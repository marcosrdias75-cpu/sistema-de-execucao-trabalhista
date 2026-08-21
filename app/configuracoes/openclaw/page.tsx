/* eslint-disable @next/next/no-html-link-for-pages */
import { requireUser } from "@/lib/auth";
import { getOpenClawSettings } from "@/lib/database";
import { testOpenClawGateway } from "@/lib/openclaw";
import { LogoutButton } from "@/app/ui/LogoutButton";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) {
    return "nunca";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function statusClass(configured: boolean) {
  return configured
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : "border-amber-300 bg-amber-50 text-amber-800";
}

function diagnosticClass(ok: boolean) {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-rose-200 bg-rose-50 text-rose-900";
}

interface OpenClawSettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OpenClawSettingsPage(props: OpenClawSettingsPageProps) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const settings = await getOpenClawSettings();
  const saved = searchParams?.saved === "1";
  const error = Array.isArray(searchParams?.error) ? searchParams.error[0] : searchParams?.error;
  const shouldTest = searchParams?.test === "1";
  const diagnostics = shouldTest ? await testOpenClawGateway() : null;
  const tokenStatus = settings.tokenConfigured ? "token cadastrado" : "token pendente";
  const webhookStatus = settings.webhookUrl ? "gateway cadastrado" : "gateway pendente";

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#171b18]">
      <header className="border-b border-[#d7dbd0] bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <a href="/" className="text-sm font-medium text-emerald-800">
              Voltar para processos
            </a>
            <h1 className="mt-2 text-2xl font-semibold">Configurar OpenClaw</h1>
            <p className="mt-1 text-sm text-[#566052]">Acesso de {user.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/analise"
              className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-800 bg-white px-3 text-sm font-medium text-emerald-800"
            >
              Analise
            </a>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 sm:px-8">
        <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold">Gateway OpenClaw</h2>
              <p className="mt-1 text-sm text-[#566052]">
                Fonte ativa: {settings.source === "none" ? "nao configurada" : settings.source}.
              </p>
              <p className="mt-1 text-sm text-[#566052]">
                Atualizado em {formatDateTime(settings.updatedAt)} por {settings.updatedBy ?? "sistema"}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(Boolean(settings.webhookUrl))}`}>
                {webhookStatus}
              </span>
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(settings.tokenConfigured)}`}>
                {tokenStatus}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Dados de conexao</h2>
          {saved ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              Configuracao salva.
            </p>
          ) : null}
          {error === "url" ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
              Informe uma URL http, https, ws ou wss valida.
            </p>
          ) : null}
          {error === "auth" ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
              Informe o token do Gateway OpenClaw.
            </p>
          ) : null}

          <form action="/api/openclaw/config" method="post" className="mt-4 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase text-[#6a7466]">URL do Gateway OpenClaw</span>
              <input
                className="h-10 rounded-md border border-[#c7ccbf] bg-white px-3 text-sm outline-none focus:border-emerald-800"
                name="webhookUrl"
                placeholder="wss://... ou https://..."
                required
                type="url"
                defaultValue={settings.webhookUrl ?? ""}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase text-[#6a7466]">Token do Gateway OpenClaw</span>
              <input
                className="h-10 rounded-md border border-[#c7ccbf] bg-white px-3 font-mono text-sm outline-none focus:border-emerald-800"
                name="webhookToken"
                placeholder={settings.tokenConfigured ? "cole novo token para substituir" : "cole o token do Gateway"}
                required={!settings.tokenConfigured}
                type="password"
              />
            </label>

            <div className="grid gap-2 rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 text-sm text-[#566052]">
              <p>
                Use o token atual do Gateway OpenClaw. Quando a URL for wss://, o SIGRJ tentara usar o
                endpoint HTTP do Gateway para executar a analise.
              </p>
              <p className="font-mono text-xs text-[#293127]">wss://... -&gt; /v1/chat/completions</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[#edf0e8] pt-4">
              <button
                type="submit"
                className="h-10 rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white"
              >
                Salvar configuracao
              </button>
              <a
                href="/configuracoes/openclaw?test=1"
                className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-800 bg-white px-4 text-sm font-semibold text-emerald-800"
              >
                Testar conexao
              </a>
              <a
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#c7ccbf] bg-white px-4 text-sm font-medium text-[#293127]"
              >
                Cancelar
              </a>
            </div>
          </form>
        </section>

        {diagnostics ? (
          <section className="rounded-md border border-[#d7dbd0] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-base font-semibold">Teste de conexao</h2>
                <p className="mt-1 text-sm text-[#566052]">{diagnostics.detail}</p>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${diagnosticClass(diagnostics.ok)}`}>
                {diagnostics.ok ? "conexao aceita" : "falha no teste"}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {diagnostics.steps.length ? (
                diagnostics.steps.map((step) => (
                  <article key={step.name} className={`rounded-md border p-3 ${diagnosticClass(step.ok)}`}>
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm font-semibold">{step.name}</p>
                      <p className="text-xs font-semibold">HTTP {step.status ?? "sem resposta"}</p>
                    </div>
                    <p className="mt-2 text-sm">{step.detail}</p>
                    {step.target ? <p className="mt-2 break-all font-mono text-xs">{step.target}</p> : null}
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Configure URL e token antes de testar.
                </p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
