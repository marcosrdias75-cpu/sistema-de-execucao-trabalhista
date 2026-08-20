import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPilotCase, toProcessSlug } from "@/lib/seed-data";
import { getPilotEdit, savePilotEdit } from "@/lib/database";

interface RouteContext {
  params: Promise<{ processNumber: string }>;
}

async function requireReadyUser() {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

async function readEditRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return {
      input: (await request.json().catch(() => ({}))) as Record<string, unknown>,
      wantsRedirect: false,
    };
  }

  const form = await request.formData();

  return {
    input: Object.fromEntries(form.entries()),
    wantsRedirect: true,
  };
}

function redirectTo(request: Request, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url), { status: 303 });
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireReadyUser();

  if (!user) {
    return NextResponse.json({ error: "Login obrigatorio." }, { status: 401 });
  }

  const { processNumber } = await context.params;
  const decodedProcessNumber = decodeURIComponent(processNumber);
  const pilotCase = getPilotCase(decodedProcessNumber);

  if (!pilotCase) {
    return NextResponse.json({ error: "Processo nao encontrado." }, { status: 404 });
  }

  return NextResponse.json(await getPilotEdit(pilotCase.processNumber));
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await requireReadyUser();

  if (!user) {
    return NextResponse.json({ error: "Login obrigatorio." }, { status: 401 });
  }

  const { processNumber } = await context.params;
  const decodedProcessNumber = decodeURIComponent(processNumber);
  const pilotCase = getPilotCase(decodedProcessNumber);

  if (!pilotCase) {
    return NextResponse.json({ error: "Processo nao encontrado." }, { status: 404 });
  }

  const { input } = await readEditRequest(request);
  return NextResponse.json(await savePilotEdit(pilotCase.processNumber, input, user.name));
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireReadyUser();

  if (!user) {
    return redirectTo(request, "/login?error=session");
  }

  const { processNumber } = await context.params;
  const decodedProcessNumber = decodeURIComponent(processNumber);
  const pilotCase = getPilotCase(decodedProcessNumber);

  if (!pilotCase) {
    return NextResponse.json({ error: "Processo nao encontrado." }, { status: 404 });
  }

  const { input, wantsRedirect } = await readEditRequest(request);
  await savePilotEdit(pilotCase.processNumber, input, user.name);

  if (wantsRedirect) {
    return redirectTo(request, `/processos/${toProcessSlug(pilotCase.processNumber)}?saved=1`);
  }

  return NextResponse.json(await getPilotEdit(pilotCase.processNumber));
}
