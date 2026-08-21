import { NextResponse } from "next/server";
import { listQueuedOcrRuns, markOcrRunStarted } from "@/lib/document-database";

function authorized(request: Request) {
  const configured = process.env.OCR_WORKER_TOKEN?.trim() ?? "";
  return Boolean(configured) && request.headers.get("x-ocr-worker-token") === configured;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Worker não autorizado." }, { status: 401 });
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "10");
  return NextResponse.json(await listQueuedOcrRuns(limit));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Worker não autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { runId?: string };
  if (!body.runId) return NextResponse.json({ error: "runId é obrigatório." }, { status: 400 });
  const run = await markOcrRunStarted(body.runId);
  return run ? NextResponse.json(run) : NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });
}
