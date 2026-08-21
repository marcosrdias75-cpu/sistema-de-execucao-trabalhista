import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPilotCase, toProcessSlug } from "@/lib/seed-data";
import { listPjeLinkTargets, upsertPjeLinkTarget, validatePjeLinkInput } from "@/lib/pje-links";

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

export async function GET(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const processNumber = new URL(request.url).searchParams.get("processNumber") ?? undefined;
  return NextResponse.json(await listPjeLinkTargets(processNumber || undefined));
}

export async function POST(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries((await request.formData()).entries());
  try {
    const validated = validatePjeLinkInput({ processNumber: String(input.processNumber ?? ""), sourceUrl: String(input.sourceUrl ?? "") });
    const pilotCase = getPilotCase(validated.processNumber);
    if (!pilotCase) return NextResponse.json({ error: "Processo não encontrado na carteira atual." }, { status: 404 });
    const target = await upsertPjeLinkTarget({ caseId: `case_${toProcessSlug(pilotCase.processNumber)}`, processNumber: pilotCase.processNumber, sourceUrl: validated.url, tribunalCode: validated.tribunalCode, linkKind: validated.kind });
    if ((request.headers.get("accept") ?? "").includes("text/html")) return NextResponse.redirect(new URL("/configuracoes/pje?linkRegistered=1", request.url), { status: 303 });
    return NextResponse.json({ target, createdBy: user.name }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível registrar o link." }, { status: 400 });
  }
}
