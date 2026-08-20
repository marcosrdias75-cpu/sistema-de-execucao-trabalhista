import { NextResponse } from "next/server";
import { createSession, getSessionUser } from "@/lib/auth";
import { hashCredential, verifyCredential } from "@/lib/crypto";
import { findUser, updateUserPassword } from "@/lib/database";
import { getSafeNextPath, withNext } from "@/lib/navigation";

async function readChangeRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      currentPassword?: string;
      next?: string;
      newPassword?: string;
      confirmPassword?: string;
    } | null;

    return {
      confirmPassword: body?.confirmPassword ?? "",
      currentPassword: body?.currentPassword ?? "",
      nextPath: getSafeNextPath(body?.next),
      newPassword: body?.newPassword ?? "",
      wantsRedirect: false,
    };
  }

  const form = await request.formData();

  return {
    confirmPassword: String(form.get("confirmPassword") ?? ""),
    currentPassword: String(form.get("currentPassword") ?? ""),
    nextPath: getSafeNextPath(form.get("next")),
    newPassword: String(form.get("newPassword") ?? ""),
    wantsRedirect: true,
  };
}

function redirectTo(request: Request, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url), { status: 303 });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return redirectTo(request, "/login?error=session");
    }

    return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
  }

  const user = await findUser(sessionUser.email);

  if (!user) {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return redirectTo(request, "/login?error=session");
    }

    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  const { confirmPassword, currentPassword, nextPath, newPassword, wantsRedirect } =
    await readChangeRequest(request);

  const matchesStoredHash = await verifyCredential(currentPassword, user.password_hash);
  if (!matchesStoredHash) {
    if (wantsRedirect) {
      return redirectTo(request, `${withNext("/trocar-chave", nextPath)}&error=current`);
    }

    return NextResponse.json({ error: "Chave atual invalida." }, { status: 401 });
  }

  if (newPassword.length < 12) {
    if (wantsRedirect) {
      return redirectTo(request, `${withNext("/trocar-chave", nextPath)}&error=length`);
    }

    return NextResponse.json(
      { error: "A nova chave deve ter pelo menos 12 caracteres." },
      { status: 400 },
    );
  }

  if (newPassword !== confirmPassword) {
    if (wantsRedirect) {
      return redirectTo(request, `${withNext("/trocar-chave", nextPath)}&error=confirm`);
    }

    return NextResponse.json({ error: "A confirmacao nao confere." }, { status: 400 });
  }

  if (newPassword === currentPassword) {
    if (wantsRedirect) {
      return redirectTo(request, `${withNext("/trocar-chave", nextPath)}&error=same`);
    }

    return NextResponse.json(
      { error: "A nova chave precisa ser diferente da temporaria." },
      { status: 400 },
    );
  }

  await updateUserPassword(user.email, await hashCredential(newPassword));
  await createSession(user.email);

  if (wantsRedirect) {
   