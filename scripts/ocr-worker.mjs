#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

const execFileAsync = promisify(execFile);
const workerUrl = process.env.SIGRJ_WORKER_URL?.replace(/\/$/, "");
const workerToken = process.env.OCR_WORKER_TOKEN;
const sourceDir = resolve(process.env.OCR_SOURCE_DIR ?? ".");
const once = process.env.OCR_WORKER_ONCE !== "false";

if (!workerUrl || !workerToken) {
  console.error("Defina SIGRJ_WORKER_URL e OCR_WORKER_TOKEN antes de executar o worker.");
  process.exit(2);
}

const headers = { "x-ocr-worker-token": workerToken, accept: "application/json" };

async function api(path, options = {}) {
  const response = await fetch(`${workerUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function loadInput(job) {
  if (job.extractedText) return { text: job.extractedText, pages: [{ pageNumber: 1, text: job.extractedText, confidence: 1 }] };
  if (!job.storageKey) throw new Error("Documento não possui storage_key nem texto disponível.");
  const localPath = resolve(sourceDir, job.storageKey);
  if (!existsSync(localPath)) throw new Error(`Arquivo não encontrado no OCR_SOURCE_DIR: ${localPath}`);
  const extension = basename(localPath).toLocaleLowerCase("pt-BR");
  if (!extension.endsWith(".pdf")) {
    const text = await readFile(localPath, "utf8");
    return { text, pages: [{ pageNumber: 1, text, confidence: 1 }] };
  }

  try {
    const result = await execFileAsync("pdftotext", ["-layout", localPath, "-"]);
    const text = result.stdout.trim();
    if (text) return { text, pages: [{ pageNumber: 1, text, confidence: 0.98 }] };
  } catch {
    // A tentativa de extração textual falhou; abaixo tentamos OCR real.
  }

  const searchablePdf = `${localPath}.searchable.pdf`;
  try {
    await execFileAsync("ocrmypdf", ["--skip-text", "--deskew", "-l", "por", localPath, searchablePdf]);
    const result = await execFileAsync("pdftotext", ["-layout", searchablePdf, "-"]);
    const text = result.stdout.trim();
    await rm(searchablePdf, { force: true });
    if (text) return { text, pages: [{ pageNumber: 1, text, confidence: null }] };
  } catch {
    await rm(searchablePdf, { force: true }).catch(() => {});
  }

  const tempDir = await mkdtemp(resolve(sourceDir, ".ocr-pages-"));
  try {
    await execFileAsync("pdftoppm", ["-png", "-r", "200", localPath, `${tempDir}/page`]);
    const pages = [];
    for (const file of (await readdir(tempDir)).filter((name) => name.endsWith(".png")).sort()) {
      const imagePath = resolve(tempDir, file);
      const outputBase = imagePath.slice(0, -4);
      await execFileAsync("tesseract", [imagePath, outputBase, "-l", "por", "--psm", "3"]);
      const text = (await readFile(`${outputBase}.txt`, "utf8")).trim();
      if (text) pages.push({ pageNumber: pages.length + 1, text, confidence: null });
    }
    const text = pages.map((page) => page.text).join("\n\n").trim();
    if (!text) throw new Error("Tesseract não retornou texto.");
    return { text, pages };
  } catch (error) {
    throw new Error(`OCR PDF indisponível ou sem resultado. Instale Tesseract/OCRmyPDF no worker. ${error instanceof Error ? error.message : ""}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function processJob(job) {
  await api("/api/internal/ocr/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId: job.id }),
  });
  try {
    const result = await loadInput(job);
    await api(`/api/internal/ocr/runs/${encodeURIComponent(job.id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "completed", extractedText: result.text, confidence: result.pages[0]?.confidence ?? null, pages: result.pages }),
    });
    console.log(`OCR concluído: ${job.id} — ${job.title}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await api(`/api/internal/ocr/runs/${encodeURIComponent(job.id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "failed", errorMessage }),
    });
    console.error(`OCR falhou: ${job.id} — ${errorMessage}`);
  }
}

async function run() {
  await mkdir(sourceDir, { recursive: true });
  const jobs = await api("/api/internal/ocr/runs?limit=10");
  for (const job of jobs) await processJob(job);
  if (!once) setTimeout(run, Number(process.env.OCR_POLL_MS ?? "60000"));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
