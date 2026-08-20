import { NextResponse } from "next/server";
import { completeAiAnalysisRun, getAiAnalysisRun, getOpenClawCredentials } from "@/lib/database";
import { persistStructuredAnalysis } from "@/lib/documents";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim())
    : [];
}

function formatList(title: string, items: string[]) {
  if (items.length === 0) {
    return "";
  }

  return `${title}\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function resultTextFromPayload(payload: Record<string, unknown>) {
  const sections = [
    cleanText(payload.resumoExecutivo),
    cleanText(payload.oportunidade),
    cleanText(payload.riscoJuridico) ? `Risco juridico: ${cleanText(payload.riscoJuridico)}` : null,
    cleanText(payload.riscoOperacional)
      ? `Risco operacional: ${cleanText(payload.riscoOperacional)}`
      : null,
    cleanText(payload.confianca) ? `Confianca: ${cleanText(payload.confianca)}` : null,
    formatList("Proximos passos", cleanList(payload.proximosPassos)),
    formatList("Pontos de conferencia humana", cleanList(payload.pontosConferenciaHumana)),
    formatList("Fundamentos extraidos", cleanList(payload.fundamentosExtraidos)),
  ].filter(Boolean);

  return sections.join("\n\n");
}

export async function POST(request: Request, context: RouteContext) {
  const token = (await getOpenClawCredentials()).token;

  if (!token) {
    return NextResponse.json({ error: "Token do OpenClaw nao configurado." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Token invalido." }, { status: 401 });
  }

  const { runId } = await context.params;
  const run = await getAiAnalysisRun(runId);

  if (!run) {
    return NextResponse.json({ error: "Analise nao encontrada." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const resultPayload =
    body && typeof body === "object" && !Array.isArray(body) ? body : { resultado: String(body) };
  const resultText =
    cleanText(body.resultText) ??
    cleanText(body.resultado) ??
    cleanText(body.analysis) ??
    resultTextFromPayload(resultPayload);

  if (!resultText) {
    return NextResponse.json({ error: "Resultado vazio." }, { status: 400 });
  }

  await completeAiAnalysisRun(run.id, {
    resultPayload,
    resultText,
  });
  await persistStructuredAnalysis({
    aiRunId: run.id,
    payload: resultPayload,
    processNumbe