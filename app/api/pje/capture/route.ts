import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildCapturePlan } from "@/lib/pje";

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

export async function GET() {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  return NextResponse.json({ status: "not_configured", message: "Nenhum conector oficial PJe foi configurado. Esta rota não consulta produção." });
}

export async function POST(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries((await request.formData()).entries());
  try {
    const plan = buildCapturePlan({
      processNumber: String(input.processNumber ?? ""),
      mode: input.mode === "events_and_documents" ? "events_and_documents" : "metadata_only",
    });
    return NextResponse.json({ ...plan, createdBy: user.name, status: "plan_only" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar o plano." }, { status: 400 });
  }
}
