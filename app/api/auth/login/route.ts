import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { verifyCredential } from "@/lib/crypto";
import { findUser } from "@/lib/database";
import { getSafeNextPath, withNext } from "@/lib/navigation";

async function readLoginRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      email?: string;
      next?: string;
      password?: string;
    } | null;

    return {
      email: body?.email?.trim() ?? "",
      nextPath: getSafeNextPath(body?.next),
      password: body?.password ?? "",
      wantsRedirect: false,
    };
  }

  const form = await request.formData();

  return {
    email: String(form.get("email") ?? "").trim(),
    nextPath: getSafeNextPath(form.get("next")),
    password: String(form.get("password") ?? ""),
    wantsRedirect: true,
  };
}

function redirectTo(request: Request, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url), { status: 303 });
}

export async function POST(request: Request) {
  const { email, nextPath, password, wantsRedirect } = await readLoginRequest(request);

  if (!email || !password) {
    if (wantsRedirect) {
      return redirectTo(request, "/login?error=missing");
    }

    return NextResponse.json({ error: "Informe e-mail e chave." }, { status: 400 });
  }

  const user = await findUser(email);

  const matchesStoredHash = user
    ? await verifyCredential(password, user.password_hash)
    : false;
  if (!user || !matchesStoredHash) {
    if (wantsRedirect) {
      return redirectTo(request, "/login?error=credentials");
    }

    return NextResponse.json({ error: "E-mail ou chave invalida." }, { status: 401 });
  }

  await createSession(user.email);

  if (wantsRedirect) {
    return redirectTo(request, user.must_change_password ? withNext("/trocar-chave", nextPath) : nextPath);
  }

  return NextResponse.json({
    mustChangePassword: Boolean(user.must_change_password),
    redirectTo: user.must_change