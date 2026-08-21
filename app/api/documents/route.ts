import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createDocument, listDocuments } from "@/lib/document-database";
import { getPilotCase, toProcessSlug } from "@/lib/seed-data";
import { storeDocumentBytes } from "@/lib/document-storage";

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  const processNumber = new URL(request.url).searchParams.get("processNumber") ?? undefined;
  return NextResponse.json(await listDocuments(processNumber || undefined));
}

export async function POST(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });

  const form = await request.formData();
  const processNumber = field(form, "processNumber");
  const pilotCase = getPilotCase(processNumber);
  if (!pilotCase) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  const uploaded = form.get("file");
  const sourceText = field(form, "extractedText");
  const sourceUrl = field(form, "sourceUrl") || null;
  const documentType = field(form, "documentType") || "outro";
  const file = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
  let fileHash: string | null = null;
  let extractedText = sourceText || null;
  let storageKey: string | null = null;
  let readingStatus: "text_available" | "awaiting_storage" = sourceText ? "text_available" : "awaiting_storage";

  if (file) {
    const bytes = await file.arrayBuffer();
    fileHash = await sha256(bytes);
    const proposedKey = `documents/${toProcessSlug(pilotCase.processNumber)}/${fileHash}/${file.name}`;
    const isTextual = file.type.startsWith("text/") || file.name.toLocaleLowerCase("pt-BR").endsWith(".html") || file.name.toLocaleLowerCase("pt-BR").endsWith(".txt");
    if (isTextual && !extractedText) {
      extractedText = await file.text();
      readingStatus = "text_available";
    } else if (!isTextual) {
      storageKey = await storeDocumentBytes({ key: proposedKey, bytes, contentType: file.type });
      if (!storageKey && !sourceText) {
        return NextResponse.json({ error: "O bucket DOCS não está configurado. Para PDF, configure o storage ou informe uma URL/texto antes de registrar o documento." }, { status: 503 });
      }
      readingStatus = storageKey ? "awaiting_storage" : "text_available";
    }
  }

  if (!file && !sourceText && !sourceUrl) {
    return NextResponse.json({ error: "Informe uma URL, texto ou arquivo." }, { status: 400 });
  }

  const document = await createDocument({
    processNumber: pilotCase.processNumber,
    title: field(form, "title") || file?.name || "Documento importado manualmente",
    documentType,
    sourceUrl,
    fileHash,
    storageKey,
    extractedText,
    documentDate: field(form, "documentDate") || null,
    readingStatus,
  });

  const wantsRedirect = (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsRedirect) {
    return NextResponse.redirect(new URL(`/documentos?processNumber=${encodeURIComponent(pilotCase.processNumber)}&created=1`, request.url), { status: 303 });
  }
  return NextResponse.json(document, { status: 201 });
}
