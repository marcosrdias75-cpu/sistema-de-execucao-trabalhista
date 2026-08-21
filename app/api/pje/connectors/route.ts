import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createPjeConnector, listPjeConnectors } from "@/lib/pje-database";
import { createPjeConnectorDraft } from "@/lib/pje";

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

function field(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "string" ? input[key].trim() : "";
}

export async function GET() {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  return NextResponse.json(await listPjeConnectors());
}

export async function POST(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries((await request.formData()).entries());
  try {
    const draft = createPjeConnectorDraft({
      tribunalCode: field(input, "tribunalCode"),
      name: field(input, "name"),
      environment: field(input, "environment") === "producao" ? "producao" : "homologacao",
      baseUrl: field(input, "baseUrl"),
      authMode: (field(input, "authMode") || "mni") as "mni" | "oauth2" | "certificado" | "navegador_controlado",
    });
    const connector = await createPjeConnector({ ...draft, credentialRef: field(input, "credentialRef") || null });
    return NextResponse.json({ connector, createdBy: user.name }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar o conector." }, { status: 400 });
  }
}
