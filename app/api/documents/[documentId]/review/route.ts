import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { reviewDocument } from "@/lib/document-database";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const { documentId } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries((await request.formData()).entries());
  const status = String(input.status ?? "approved");
  if (!(["approved", "rejected", "corrected"] as string[]).includes(status)) {
    return NextResponse.json({ error: "Status de revisão inválido." }, { status: 400 });
  }
  const document = await reviewDocument({
    documentId,
    pageId: typeof input.pageId === "string" ? input.pageId : null,
    status: status as "approved" | "rejected" | "corrected",
    sourceExcerpt: typeof input.sourceExcerpt === "string" ? input.sourceExcerpt : null,
    correctedValue: typeof input.correctedValue === "string" ? input.correctedValue : null,
    notes: typeof input.notes === "string" ? input.notes : null,
    reviewedBy: user.name,
  });
  if (contentType.includes("application/json")) return NextResponse.json(document);
  return NextResponse.redirect(new URL(`/documentos/${documentId}?reviewed=1`, request.url), { status: 303 });
}
