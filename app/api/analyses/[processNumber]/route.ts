import { NextResponse } from "next/server";
import { buildCaseAnalyses } from "@/lib/analysis";
import { getSessionUser } from "@/lib/auth";
import {
  completeAiAnalysisRun,
  createAiAnalysisRun,
  getLatestAiAnalysisRun,
  getPilotEdit,
  markAiAnalysisRunFailed,
  markAiAnalysisRunSent,
} from "@/lib/database";
import { latestDocumentContext, persistStructuredAnalysis } from "@/lib/documents";
import {
  buildOpenClawPrompt,
  dispatchOpenClawRun,
  getProcessPublicPath,
  type OpenClawAnalysisPackage,
} from "@/lib/openclaw";
import { getPilotCase, getPjeReferences, getProcessDeadlines } from "@/lib/seed-data";

interface RouteContext {
  params: Promise<{ processNumber: string }>;
}

function redirectTo(request: Request, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url), { status: 303 });
}

async function requireReadyUser(request: Request, nextPath: string) {
  const user = await getSessionUser();

  if (!user) {
    return { response: redirectTo(request, `/login?next=${encodeURIComponent(nextPath)}`), user: null };
  }

  if (user.mustChangePassword) {
    return {
      response: redirectTo(request, `/trocar-chave?next=${encodeURIComponent(nextPath)}`),
      user: null,
    };
  }

  return { response: null, user };
}

export async function GET(request: Request, context: RouteContext) {
  const { processNumber } = await context.params;
  const pilotCase = getPilotCase(decodeURIComponent(processNumber));

  if (!pilotCase) {
    return NextResponse.json({ error: "Processo nao encontrado." }, { status: 404 });
  }

  const auth = await requireReadyUser(request, getProcessPublicPath(pilotCase.processNumber));

  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json(await getLatestAiAnalysisRun(pilotCase.processNumber));
}

export async function POST(request: Request, context: RouteContext) {
  const { processNumber } = await context.params;
  const decodedProcessNumber = decodeURIComponent(processNumber);
  const pilotCase = getPilotCase(decodedProcessNumber);

  if (!pilotCase) {
    return NextResponse.json({ error: "Processo nao encontrado." }, { status: 404 });
  }

  const processPath = getProcessPublicPath(pilotCase.processNumber);
  const auth = await requireReadyUser(request, processPath);

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const [edit, deadlines, pjeReferences, documents] = await Promise.all([
    getPilotEdit(pilotCase.processNumber),
    Promise.resolve(getProcessDeadlines(pilotCase.processNumber)),
    Promise.resolve(getPjeReferences(pilotCase.processNumber)),
    latestDocumentContext(pilotCase.processNumber),
  ]);
  const analysis = buildCaseAnalyses(new Map([[pilotCase.processNumber, edit]])).find(
    (item) => item.processNumber === pilotCase.processNumber,
  );

  if (!analysis) {
    return NextResponse.json({ error: "Analise base nao encontrada." }, { status: 404 });
  }

  const analysisPackage: OpenClawAnalysisPackage = {
    analysis,
    deadlines,
    documents,
    edit,
    pjeReferences,
    pilotCase,
  };
  const prompt = buildOpenClawPrompt(analysisPackage);
  const run = await createAiAnalysisRun({
    analysisPrompt: prompt,
    processNumber: pilotCase.processNumber,
    requestedBy: auth.user.name,
  });
  const origin = new URL(request.url).origin;
  const dispatchResult = await dispatchOpenClawRun({
    analysisPackage,
    callbackUrl: `${origin}/api/openclaw/runs/${run.id}`,
    processUrl: `${origin}${processPath}`,
    prompt,
    runId: run.id,
  }).catch((error: unknown) => ({
    completed: false,
    dispatched: false,
    failureMessage: error instanceof Error ? error.message : "Falha inesperada ao acionar OpenClaw.",
    resultPayload: null,
    resultText: undefined,
    status: "failed" as const,
  }));

  if (dispatchResult.dispatched) {
    if (dispatchResult.completed && dispatchResult.resultText) {
      await completeAiAnalysisRun(run.id, {
        resultPayload: dispatchResult.resultPayload ?? null,
        resultText: dispatchResult.resultText,
      });
      await persistStructuredAnalysis({
        aiRunId: run.id,
        payload: dispatchResult.resultPayload ?? null,
        processNumber: pilotCase.processNumber,
      });
      return redirectTo(request, `${processPath}?analysis=completed`);
    }

    await markAiAnalysisRunSent(run.id);
    return redirectTo(request, `${processPath}?analysis=sent`);
  }

  if (dispatchResult.status === "failed" && dispatchResult.failureMessage) {
    await markAiAnalysisRunFailed(run.id, dispatchResult.failureMessage);
    return redirec