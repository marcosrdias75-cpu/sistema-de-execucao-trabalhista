import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDocument, listOcrRuns, queueOcr } from "@/lib/document-database";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const { documentId } = await context.params;
  const document = await getDocument(documentId);
  if (!document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  return NextResponse.json({ document, runs: await listOcrRuns(documentId) });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const { documentId } = await context.params;
  try {
    const run = await queueOcr({ documentId, requestedBy: user.name });
    return NextResponse.json(run, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enfileirar o OCR." }, { status: 400 });
  }
}
