import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDocumentBytes, storeDocumentBytes } from "@/lib/document-storage";
import { uploadQuestionnaireSubmissionToDrive, type DriveUploadFile } from "@/lib/google-drive";
import { createQuestionnaireSubmission, updateQuestionnaireDriveStatus, listQuestionnaireSubmissions, type QuestionnaireAttachment } from "@/lib/questionnaire-database";
import { renderQuestionnaireReport } from "@/lib/questionnaire-report";
import type { QuestionnaireAnswers } from "@/lib/questionnaire-schema";
import { answerIsYes } from "@/lib/questionnaire-schema";
import { toProcessSlug } from "@/lib/seed-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 140) || "arquivo";
}

function normalizeAnswers(input: QuestionnaireAnswers): QuestionnaireAnswers {
  const answers = {
    ...input,
    appealDeposits: Array.isArray(input.appealDeposits) ? input.appealDeposits : [],
    guarantees: Array.isArray(input.guarantees) ? input.guarantees : [],
    judicialDeposits: Array.isArray(input.judicialDeposits) ? input.judicialDeposits : [],
    newWarrantsAfterBase: Array.isArray(input.newWarrantsAfterBase) ? input.newWarrantsAfterBase : [],
    releaseOrders: Array.isArray(input.releaseOrders) ? input.releaseOrders : [],
    strategicActions: Array.isArray(input.strategicActions) ? input.strategicActions : [],
  };

  if (!answerIsYes(answers.newWarrantAfterBase)) {
    answers.newWarrantsAfterBase = [];
  }

  answers.guarantees = answers.guarantees.map((item) => {
    const next = { ...item };
    if (!answerIsYes(next.substitutedByCash)) {
      next.substitutedMoneyWithdrawn = "";
      next.insurerEnforceableAmount = "";
    }
    if (!next.substitutedByCash.toLocaleLowerCase("pt-BR").includes("parcial")) {
      next.insurerEnforceableAmount = "";
    }
    if (!next.claimStatus.toLocaleLowerCase("pt-BR").startsWith("não ocorreu")) {
      next.hasOfficePetitionForClaim = "";
    }
    return next;
  });

  if (!answerIsYes(answers.releasePetitionStatus)) {
    answers.releasePetitionNetAmount = "";
    answers.releasePetitionFeesAmount = "";
  }

  if (!answerIsYes(answers.paymentPetitionStatus)) {
    answers.paymentPetitionNetAmount = "";
    answers.paymentPetitionFeesAmount = "";
  }

  return answers;
}

function parseAnswers(form: FormData) {
  const raw = form.get("answers");

  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Questionário não recebido.");
  }

  const parsed = JSON.parse(raw) as QuestionnaireAnswers;
  const answers = normalizeAnswers(parsed);
  answers.processNumber = answers.processNumber.trim();
  answers.claimantName = answers.claimantName.trim();
  answers.court = answers.court.trim();
  answers.pjeUrl = answers.pjeUrl.trim();
  return answers;
}

async function storeUploadedFiles(input: {
  files: File[];
  processNumber: string;
  submissionId: string;
}) {
  const maxSize = Number(process.env.MAX_QUESTIONARIO_FILE_BYTES ?? 104_857_600);
  const processSlug = toProcessSlug(input.processNumber) || input.processNumber.replace(/\W+/g, "-");
  const attachments: QuestionnaireAttachment[] = [];
  const driveFiles: DriveUploadFile[] = [];

  for (const file of input.files) {
    if (file.size > maxSize) {
      throw new Error(`O arquivo ${file.name} excede o limite de ${Math.round(maxSize / 1024 / 1024)} MB.`);
    }

    const bytes = await file.arrayBuffer();
    const hash = await sha256(bytes);
    const safeName = sanitizeFilename(file.name);
    const key = `questionarios/${processSlug}/${input.submissionId}/anexos/${hash}-${safeName}`;
    const storageKey = await storeDocumentBytes({
      bytes,
      contentType: file.type || "application/octet-stream",
      key,
    });

    attachments.push({
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      sha256: hash,
      size: file.size,
      storageKey,
    });
    driveFiles.push({
      buffer: Buffer.from(bytes),
      fileName: `anexo-${String(attachments.length).padStart(2, "0")}-${safeName}`,
      mimeType: file.type || "application/octet-stream",
    });
  }

  return { attachments, driveFiles };
}

export async function GET() {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });
  return NextResponse.json(await listQuestionnaireSubmissions());
}

export async function POST(request: Request) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });

  try {
    const form = await request.formData();
    const answers = parseAnswers(form);
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);

    if (!answers.processNumber) {
      return NextResponse.json({ error: "Informe o número do processo." }, { status: 400 });
    }

    if (!answers.executionType) {
      return NextResponse.json({ error: "Informe o tipo da execução." }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "Anexe ao menos um arquivo do processo." }, { status: 400 });
    }

    const submissionId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    const { attachments, driveFiles } = await storeUploadedFiles({
      files,
      processNumber: answers.processNumber,
      submissionId,
    });
    const reportText = renderQuestionnaireReport({
      answers,
      attachments,
      submittedAt,
      submittedBy: `${user.name} <${user.email}>`,
    });
    const processSlug = toProcessSlug(answers.processNumber) || answers.processNumber.replace(/\W+/g, "-");
    const reportStorageKey = await storeDocumentBytes({
      bytes: Buffer.from(reportText, "utf8"),
      contentType: "text/plain; charset=utf-8",
      key: `questionarios/${processSlug}/${submissionId}/questionario.txt`,
    });
    const jsonBuffer = Buffer.from(JSON.stringify({ answers, attachments, submittedAt, submittedBy: user.email }, null, 2), "utf8");

    await storeDocumentBytes({
      bytes: jsonBuffer,
      contentType: "application/json",
      key: `questionarios/${processSlug}/${submissionId}/questionario.json`,
    });

    await createQuestionnaireSubmission({
      answers,
      attachments,
      id: submissionId,
      reportStorageKey,
      submittedAt,
      submittedBy: user.email,
      submittedByName: user.name,
    });

    const filesForDrive: DriveUploadFile[] = [
      {
        buffer: await getDocumentBytes(reportStorageKey),
        fileName: "questionario-respostas.txt",
        mimeType: "text/plain; charset=utf-8",
      },
      {
        buffer: jsonBuffer,
        fileName: "questionario-respostas.json",
        mimeType: "application/json",
      },
      ...driveFiles,
    ];

    try {
      const driveResult = await uploadQuestionnaireSubmissionToDrive({
        answers,
        files: filesForDrive,
        submittedAt,
        submittedBy: user.name,
        submissionId,
      });
      await updateQuestionnaireDriveStatus({
        driveFiles: driveResult.files,
        driveFolderId: driveResult.folderId,
        driveFolderUrl: driveResult.folderUrl,
        id: submissionId,
        status: driveResult.status,
      });
    } catch (error) {
      await updateQuestionnaireDriveStatus({
        driveError: error instanceof Error ? error.message : "Falha desconhecida no Drive.",
        id: submissionId,
        status: "failed",
      });
    }

    const wantsRedirect = (request.headers.get("accept") ?? "").includes("text/html");
    if (wantsRedirect) {
      return NextResponse.redirect(new URL(`/questionarios?created=${submissionId}`, request.url), { status: 303 });
    }

    return NextResponse.json({ id: submissionId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao registrar questionário.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
