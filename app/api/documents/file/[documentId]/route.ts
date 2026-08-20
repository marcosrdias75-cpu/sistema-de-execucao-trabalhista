import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDocumentFile } from "@/lib/documents";

interface RouteContext { params: Promise<{ documentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  if (!(await getSessionUser())) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const document = await getDocumentFile((await context.params).documentId);
  if (!document) return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 });
  return new NextResponse(new Uint8Array(document.bytes), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.original_name)}`,
      "content-type": document.mime_type,
      "x-content-type-options": "nosniff",
    },
  });
}
