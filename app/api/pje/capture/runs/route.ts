import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createPjeCaptureRun, getPjeCaptureMetrics, listPjeCaptureRuns, updatePjeCaptureRun } from "@/lib/pje-database";

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

function inputFrom(request: Request) {
  return request.headers.get("content-type")?.includes("application/json")
    ? request.json()
    : request.formData().then((form) => Object.fromEntries(form.entries()));
}

export async function GET() {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  return NextResponse.json({ metrics: await getPjeCaptureMetrics(), runs: await listPjeCaptureRuns() });
}

export async function POST(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const input = (await inputFrom(request)) as Record<string, unknown>;
  const run = await createPjeCaptureRun({
    connectorId: typeof input.connectorId === "string" && input.connectorId ? input.connectorId : null,
    caseId: typeof input.caseId === "string" && input.caseId ? input.caseId : null,
    cursor: typeof input.cursor === "string" && input.cursor ? input.cursor : null,
    requestedBy: user.name,
  });
  return NextResponse.json({ run, status: "queued" }, { status: 202 });
}

export async function PATCH(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.status !== "string") return NextResponse.json({ error: "id e status são obrigatórios." }, { status: 400 });
  const allowed = ["running", "succeeded", "partial", "failed", "awaiting_authorization"];
  if (!allowed.includes(input.status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  const run = await updatePjeCaptureRun({
    id: input.id,
    status: input.status as "running" | "succeeded" | "partial" | "failed" | "awaiting_authorization",
    cursor: typeof input.cursor === "string" ? input.cursor : null,
    itemsFound: typeof input.itemsFound === "number" ? input.itemsFound : null,
    itemsImported: typeof input.itemsImported === "number" ? input.itemsImported : null,
    errorMessage: typeof input.errorMessage === "string" ? input.errorMessage : null,
  });
  return run ? NextResponse.json(run) : NextResponse.json({ error: "Execução não encontrada." }, { status: 404 });
}
