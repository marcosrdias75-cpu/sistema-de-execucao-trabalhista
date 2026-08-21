import { NextResponse } from "next/server";
import { completeOcrRun, failOcrRun, getOcrRun } from "@/lib/document-database";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

function workerToken() {
  return process.env.OCR_WORKER_TOKEN?.trim() ?? "";
}

function authorized(request: Request) {
  const configured = workerToken();
  return Boolean(configured) && request.headers.get("x-ocr-worker-token") === configured;
}

export async function GET(request: Request, context: RouteContext) {
  if (!authorized(request)) return NextResponse.json({ error: "Worker não autorizado." }, { status: 401 });
  const { runId } = await context.params;
  const run = await getOcrRun(runId);
  return run ? NextResponse.json(run) : NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });
}

export async function POST(request: Request, context: RouteContext) {
  if (!authorized(request)) return NextResponse.json({ error: "Worker não autorizado." }, { status: 401 });
  const { runId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as {
    status?: "completed" | "failed";
    extractedText?: string;
    confidence?: number | null;
    pages?: Array<{ pageNumber: number; text: string; hocr?: string | null; confidence?: number | null }>;
    errorMessage?: string;
  };
  try {
    if (payload.status === "failed") return NextResponse.json(await failOcrRun(runId, payload.errorMessage ?? "Falha não especificada."));
    if (!payload.extractedText) return NextResponse.json({ error: "extractedText é obrigatório na conclusão." }, { status: 400 });
    return NextResponse.json(await completeOcrRun({ runId, extractedText: payload.extractedText, confidence: payload.confidence, pages: payload.pages }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível registrar o resultado." }, { status: 400 });
  }
}
