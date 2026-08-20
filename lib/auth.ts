import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeJson, encodeJson, signValue } from "@/lib/crypto";
import { findUser } from "@/lib/database";

const cookieName = "sigrj_restrito_session";
const sessionSeconds = 60 * 60 * 8;
const sessionSecret =
  "sigrj-restrito-2026-08-20-4f867b3c23a54792b495ef79a21f0fd2";

export interface SessionUser {
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
}

interface SessionPayload {
  email: string;
  exp: number;
}

async function createCookieValue(email: string) {
  const payload = encodeJson({
    email,
    exp: Math.floor(Date.now() / 1000) + sessionSeconds,
  });
  return `${payload}.${await signValue(payload, sessionSecret)}`;
}

async function readCookiePayload() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(cookieName)?.value;

  if (!cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature || (await signValue(payload, sessionSecret)) !== signature) {
    return null;
  }

  const decoded = decodeJson<SessionPayload>(payload);

  if (!decoded || decoded.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return decoded;
}

export async function createSession(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, await createCookieValue(email), {
    httpOnly: true,
    maxAge: sessionSeconds,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const payload = await readCookiePayload();

  if (!payload) {
    return null;
  }

  const user = await findUser(payload.email);

  if (!user) {
    return null;
  }

  return {
    email: user.email,
    mustChangePassword: Boolean(user.must_change_password),
    name: user.name,
    role: user.role,
  };
}

export async function requireUser(options: { allowTemporary?: boolean } = {}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.mustChangePassword && !options.allowTemporary) {
    redirect("/trocar-chave");
  }

  return user;
}
