import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createPjeCaptureRun } from "@/lib/pje-database";
import { getPjeLinkTarget, updatePjeLinkTargetCapture } from "@/lib/pje-links";

interface RouteContext {
  params: Promise<{ linkId: string }>;
}

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const { linkId } = await context.params;
  const target = await getPjeLinkTarget(linkId);
  if (!target) return NextResponse.json({ error: "Link PJe não encontrado." }, { status: 404 });
  if (["queued", "capturing"].includes(target.status)) return NextResponse.json({ error: "Este link já possui uma captura em andamento." }, { status: 409 });
  const run = await createPjeCaptureRun({ caseId: target.caseId, requestedBy: user.name, cursor: target.lastPayloadHash });
  if (!run) return NextResponse.json({ error: "Não foi possível criar a execução." }, { status: 500 });
  const updatedTarget = await updatePjeLinkTargetCapture({ id: target.id, status: "queued", captureRunId: run.id });
  const wantsRedirect = (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsRedirect) return NextResponse.redirect(new URL(`/processos/${encodeURIComponent(target.processNumber)}?pjeQueued=1`, request.url), { status: 303 });
  return NextResponse.json({ target: updatedTarget, run }, { status: 202 });
}
