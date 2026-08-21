import { NextResponse } from "next/server";
import { listQueuedPjeCaptureRuns, markPjeCaptureRunStarted, savePjeSnapshot, updatePjeCaptureRun } from "@/lib/pje-database";
import { createDocument, queueOcr } from "@/lib/document-database";
import { updatePjeLinkTargetCapture } from "@/lib/pje-links";

function authorized(request: Request) {
  const configured = process.env.PJE_CAPTURE_WORKER_TOKEN?.trim() ?? "";
  return Boolean(configured) && request.headers.get("x-pje-capture-worker-token") === configured;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Worker PJe não autorizado." }, { status: 401 });
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "10");
  return NextResponse.json(await listQueuedPjeCaptureRuns(limit));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Worker PJe não autorizado." }, { status: 401 });
  const input = (await request.json().catch(() => ({}))) as {
    action?: "start" | "document" | "snapshot" | "finish";
    runId?: string;
    caseId?: string;
    snapshotType?: string;
    title?: string;
    documentType?: string;
    extractedText?: string;
    requestOcr?: boolean;
    readingStatus?: "awaiting_storage" | "text_available";
    sourceUrl?: string | null;
    storageKey?: string | null;
    payloadHash?: string;
    linkTargetId?: string;
    status?: "succeeded" | "partial" | "failed" | "awaiting_authorization";
    cursor?: string | null;
    itemsFound?: number | null;
    itemsImported?: number | null;
    errorMessage?: string | null;
  };
  if (!input.action || !input.runId) return NextResponse.json({ error: "action e runId são obrigatórios." }, { status: 400 });
  try {
    if (input.action === "start") {
      const run = await markPjeCaptureRunStarted(input.runId);
      if (input.linkTargetId) await updatePjeLinkTargetCapture({ id: input.linkTargetId, status: "capturing", captureRunId: input.runId });
      return NextResponse.json(run);
    }
    if (input.action === "document") {
      if (!input.caseId || !input.title || !input.extractedText || !input.payloadHash) return NextResponse.json({ error: "caseId, title, extractedText e payloadHash são obrigatórios." }, { status: 400 });
      const document = await createDocument({ caseId: input.caseId, title: input.title, documentType: input.documentType ?? "movimentacao", sourceUrl: input.sourceUrl ?? null, fileHash: input.payloadHash, storageKey: input.storageKey ?? null, extractedText: input.extractedText, readingStatus: input.readingStatus ?? "text_available" });
      const ocrRun = input.requestOcr && document ? await queueOcr({ documentId: document.id, requestedBy: "pje-link-worker" }) : null;
      return NextResponse.json({ document, ocrRun }, { status: 201 });
    }
    if (input.action === "snapshot") {
      if (!input.caseId || !input.snapshotType || !input.payloadHash) return NextResponse.json({ error: "caseId, snapshotType e payloadHash são obrigatórios." }, { status: 400 });
      const id = await savePjeSnapshot({ captureRunId: input.runId, caseId: input.caseId, snapshotType: input.snapshotType, sourceUrl: input.sourceUrl, storageKey: input.storageKey, payloadHash: input.payloadHash });
      return NextResponse.json({ id });
    }
    const run = await updatePjeCaptureRun({ id: input.runId, status: input.status ?? "failed", cursor: input.cursor, itemsFound: input.itemsFound, itemsImported: input.itemsImported, errorMessage: input.errorMessage });
    if (input.linkTargetId) {
      const targetStatus = input.status === "succeeded" ? "captured" : input.status === "partial" ? "unchanged" : input.status === "awaiting_authorization" ? "awaiting_authorization" : "failed";
      await updatePjeLinkTargetCapture({ id: input.linkTargetId, status: targetStatus, payloadHash: input.payloadHash ?? null, captureRunId: input.runId, error: input.errorMessage ?? null });
    }
    return NextResponse.json(run);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na operação do worker PJe." }, { status: 400 });
  }
}
