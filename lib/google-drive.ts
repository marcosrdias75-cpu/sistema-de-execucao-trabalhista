import { createSign, randomUUID } from "node:crypto";
import type { QuestionnaireAnswers } from "@/lib/questionnaire-schema";
import { driveParentFolderId } from "@/lib/questionnaire-schema";

export interface DriveUploadFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface DriveUploadedFile {
  id: string;
  name: string;
  webViewLink: string | null;
  mimeType: string | null;
  size: number | null;
}

export interface DriveUploadResult {
  files: DriveUploadedFile[];
  folderId: string | null;
  folderUrl: string | null;
  status: "uploaded" | "pending_credentials";
}

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function readCredentials(): ServiceAccountCredentials | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (json) {
    const parsed = JSON.parse(json) as { client_email?: string; private_key?: string };
    if (parsed.client_email && parsed.private_key) {
      return {
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replaceAll("\\n", "\n"),
      };
    }
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim()?.replaceAll("\\n", "\n");

  if (!clientEmail || !privateKey) {
    return null;
  }

  return { clientEmail, privateKey };
}

async function getAccessToken(credentials: ServiceAccountCredentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    iss: credentials.clientEmail,
    scope: "https://www.googleapis.com/auth/drive.file",
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(credentials.privateKey);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Falha ao autenticar no Google Drive (${response.status}).`);
  }

  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Google Drive não retornou access_token.");
  return data.access_token;
}

async function createDriveFolder(input: {
  accessToken: string;
  name: string;
  parentFolderId: string;
}) {
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true", {
    body: JSON.stringify({
      mimeType: "application/vnd.google-apps.folder",
      name: input.name,
      parents: [input.parentFolderId],
    }),
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao criar pasta no Drive (${response.status}): ${detail.slice(0, 300)}`);
  }

  return response.json() as Promise<{ id: string; name: string; webViewLink?: string }>;
}

async function uploadDriveFile(input: {
  accessToken: string;
  file: DriveUploadFile;
  parentFolderId: string;
}) {
  const boundary = `sigrj_${randomUUID().replaceAll("-", "")}`;
  const metadata = {
    mimeType: input.file.mimeType,
    name: input.file.fileName,
    parents: [input.parentFolderId],
  };
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${input.file.mimeType || "application/octet-stream"}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType,size&supportsAllDrives=true", {
    body: Buffer.concat([head, input.file.buffer, tail]),
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao enviar arquivo ao Drive (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json() as {
    id: string;
    mimeType?: string;
    name: string;
    size?: string;
    webViewLink?: string;
  };

  return {
    id: data.id,
    mimeType: data.mimeType ?? null,
    name: data.name,
    size: data.size ? Number(data.size) : null,
    webViewLink: data.webViewLink ?? null,
  };
}

function cleanFolderName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
}

export async function uploadQuestionnaireSubmissionToDrive(input: {
  answers: QuestionnaireAnswers;
  files: DriveUploadFile[];
  submittedAt: string;
  submittedBy: string;
  submissionId: string;
}) : Promise<DriveUploadResult> {
  const credentials = readCredentials();

  if (!credentials) {
    return {
      files: [],
      folderId: null,
      folderUrl: null,
      status: "pending_credentials",
    };
  }

  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID?.trim() || driveParentFolderId;
  const accessToken = await getAccessToken(credentials);
  const folderName = cleanFolderName(`${input.answers.processNumber} - ${input.submittedBy} - ${input.submittedAt.slice(0, 10)}`);
  const folder = await createDriveFolder({ accessToken, name: folderName, parentFolderId });
  const uploaded: DriveUploadedFile[] = [];

  for (const file of input.files) {
    uploaded.push(await uploadDriveFile({ accessToken, file, parentFolderId: folder.id }));
  }

  return {
    files: uploaded,
    folderId: folder.id,
    folderUrl: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`,
    status: "uploaded",
  };
}
