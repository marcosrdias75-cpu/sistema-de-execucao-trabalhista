import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDocumentBytes } from "@/lib/document-storage";
import { uploadQuestionnaireSubmissionToDrive, type DriveUploadFile } from "@/lib/google-drive";
import { getQuestionnaireSubmission, updateQuestionnaireDriveStatus } from "@/lib/questionnaire-database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireReadyUser();
  if (!user) return NextResponse.json({ error: "Login obrigatório." }, { status: 401 });

  const { id } = await context.params;
  const submission = await getQuestionnaireSubmission(id);
  if (!submission) return NextResponse.json({ error: "Questionário não encontrado." }, { status: 404 });
  if (!submission.reportStorageKey) return NextResponse.json({ error: "Relatório local não encontrado." }, { status: 409 });

  const files: DriveUploadFile[] = [
    {
      buffer: await getDocumentBytes(submission.reportStorageKey),
      fileName: "questionario-respostas.txt",
      mimeType: "text/plain; charset=utf-8",
    },
  ];

  for (const [index, attachment] of submission.attachments.entries()) {
    files.push({
      buffer: await getDocumentBytes(attachment.storageKey),
      fileName: `anexo-${String(index + 1).padStart(2, "0")}-${attachment.originalName}`,
      mimeType: attachment.mimeType || "application/octet-stream",
    });
  }

  try {
    const driveResult = await uploadQuestionnaireSubmissionToDrive({
      answers: submission.answers,
      files,
      submittedAt: submission.submittedAt,
      submittedBy: user.name,
      submissionId: submission.id,
    });
    await updateQuestionnaireDriveStatus({
      driveFiles: driveResult.files,
      driveFolderId: driveResult.folderId,
      driveFolderUrl: driveResult.folderUrl,
      id: submission.id,
      status: driveResult.status,
    });
  } catch (error) {
    await updateQuestionnaireDriveStatus({
      driveError: error instanceof Error ? error.message : "Falha desconhecida no Drive.",
      id: submission.id,
      status: "failed",
    });
  }

  const wantsRedirect = (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsRedirect) {
    return NextResponse.redirect(new URL(`/questionarios/${submission.id}`, request.url), { status: 303 });
  }

  return NextResponse.json(await getQuestionnaireSubmission(submission.id));
}
