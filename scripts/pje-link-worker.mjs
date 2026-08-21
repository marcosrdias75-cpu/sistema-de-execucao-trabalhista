#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const workerUrl = process.env.SIGRJ_WORKER_URL?.replace(/\/$/, "");
const workerToken = process.env.PJE_CAPTURE_WORKER_TOKEN;
const snapshotDir = resolve(process.env.PJE_SNAPSHOT_DIR ?? "./pje-snapshots");
const once = process.env.PJE_CAPTURE_WORKER_ONCE !== "false";
const maxBytes = Number(process.env.PJE_MAX_RESPONSE_BYTES ?? "20000000");

if (!workerUrl || !workerToken) {
  console.error("Defina SIGRJ_WORKER_URL e PJE_CAPTURE_WORKER_TOKEN antes de executar o worker.");
  process.exit(2);
}

const headers = { "x-pje-capture-worker-token": workerToken, accept: "application/json" };

async function api(path, options = {}) {
  const response = await fetch(`${workerUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

function isOfficialHost(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLocaleLowerCase("pt-BR");
    return host === "pje.jus.br" || host.endsWith(".pje.jus.br") || host.endsWith(".jus.br");
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PJE_FETCH_TIMEOUT_MS ?? "30000"));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeAuthorizationWall(response, body) {
  const finalUrl = response.url.toLocaleLowerCase("pt-BR");
  const sample = body.slice(0, 200_000).toLocaleLowerCase("pt-BR");
  return finalUrl.includes("login") || finalUrl.includes("autentic") || /captcha|sess[aã]o expirada|acesso restrito|usu[aá]rio e senha/.test(sample);
}

async function processJob(job) {
  if (!job.sourceUrl || !job.linkTargetId || !job.caseId) {
    throw new Error("Job sem sourceUrl, linkTargetId ou caseId.");
  }

  await api("/api/internal/pje/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "start", runId: job.id, linkTargetId: job.linkTargetId }),
  });

  const response = await fetchWithTimeout(job.sourceUrl, { redirect: "follow", headers: { "user-agent": "SIGRJ-PJe-Capture/1.0" } });
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) throw new Error(`Resposta excede o limite de ${maxBytes} bytes.`);
  if (!isOfficialHost(response.url)) {
    await api("/api/internal/pje/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "finish", runId: job.id, linkTargetId: job.linkTargetId, status: "awaiting_authorization", errorMessage: "O link redirecionou para um domínio que não pertence ao Judiciário oficial; captura interrompida." }),
    });
    console.log(`Redirecionamento externo recusado: ${job.id}`);
    return;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error(`Resposta excede o limite de ${maxBytes} bytes.`);
  const body = new TextDecoder().decode(bytes);
  if (response.status === 401 || response.status === 403 || looksLikeAuthorizationWall(response, body)) {
    await api("/api/internal/pje/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "finish", runId: job.id, linkTargetId: job.linkTargetId, status: "awaiting_authorization", errorMessage: `A página exigiu autenticação ou apresentou bloqueio (HTTP ${response.status}). O worker não tenta contornar login, CAPTCHA ou MFA.` }),
    });
    console.log(`Autorização necessária: ${job.id} — ${job.sourceUrl}`);
    return;
  }
  if (!response.ok) throw new Error(`PJe retornou HTTP ${response.status}.`);

  const payloadHash = sha256(bytes);
  const snapshotKey = `${payloadHash}.html`;
  await mkdir(snapshotDir, { recursive: true });
  await writeFile(resolve(snapshotDir, snapshotKey), bytes);
  await api("/api/internal/pje/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "snapshot", runId: job.id, caseId: job.caseId, snapshotType: "pje_link_html", sourceUrl: job.sourceUrl, storageKey: snapshotKey, payloadHash }),
  });

  if (payloadHash === job.cursor) {
    await api("/api/internal/pje/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "finish", runId: job.id, linkTargetId: job.linkTargetId, status: "partial", cursor: payloadHash, payloadHash, itemsFound: 1, itemsImported: 0, errorMessage: null }),
    });
    console.log(`Sem alteração: ${job.id} — ${job.sourceUrl}`);
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isPdf = contentType.includes("application/pdf") || job.sourceUrl.toLocaleLowerCase("pt-BR").includes(".pdf");
  const text = isPdf ? "[PDF capturado; OCR pendente no worker de documentos]" : htmlToText(body);
  const document = await api("/api/internal/pje/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "document", runId: job.id, caseId: job.caseId, title: `PJe — ${job.processNumber ?? "processo"}`, documentType: isPdf ? "peca_pje" : "movimentacao", sourceUrl: job.sourceUrl, storageKey: snapshotKey, payloadHash, extractedText: text, readingStatus: isPdf ? "awaiting_storage" : "text_available", requestOcr: isPdf }),
  });

  await api("/api/internal/pje/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "finish", runId: job.id, linkTargetId: job.linkTargetId, status: "succeeded", cursor: payloadHash, payloadHash, itemsFound: 1, itemsImported: document?.document?.id ? 1 : 0, errorMessage: null }),
  });
  console.log(`Captura concluída: ${job.id} — ${job.sourceUrl}`);
}

async function run() {
  const jobs = await api("/api/internal/pje/capture?limit=10");
  for (const job of jobs) {
    try {
      await processJob(job);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await api("/api/internal/pje/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "finish", runId: job.id, linkTargetId: job.linkTargetId, status: "failed", errorMessage }),
      }).catch(() => {});
      console.error(`Captura falhou: ${job.id} — ${errorMessage}`);
    }
  }
  if (!once) setTimeout(run, Number(process.env.PJE_CAPTURE_POLL_MS ?? "60000"));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
