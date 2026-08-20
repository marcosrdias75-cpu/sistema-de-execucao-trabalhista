import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { importPdf, listCaseDocuments } from "@/lib/documents";
import { getPilotCase, toProcessSlug } from "@/lib/seed-data";

interface RouteContext { params: Promise<{ processNumber: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const processNumber = decodeURIComponent((await context.params).processNumber);
  return NextResponse.json(await listCaseDocuments(processNumber));
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }
  const processNumber = decodeURIComponent((await context.params).processNumber);
  if (!getPilotCase(processNumber)) {
    return NextResponse.json({ error: "Processo nao encontrado." }, { status: 404 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um PDF." }, { status: 400 });
  }
  try {
    const result = await importPdf({
      processNumber,
      originalName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    const status = result.duplicate ? "duplicate" : "processed";
    return NextResponse.redirect(
      new URL(`/processos/${toProcessSlug(processNumber)}?document=${status}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no processamento.";
    return NextResponse.redirect(
      new URL(`/processos/${toProcessSlug(processNumber)}?document=failed&detail=${encodeURIComponent(message.slice(0,200))}`, request.url),
      { status: 303 },
    );
  }
}
