import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeJson, encodeJson, signValue } from "@/lib/crypto";
import { findUser } from "@/lib/database";

const cookieName = "sigrj_restrito_session";
const sessionSeconds = 60 * 60 * 8;

function getSessionSecret() {
  const value = process.env.SESSION_SECRET?.trim();

  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres.");
  }

  return value;
}

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
  return `${payload}.${await signValue(payload, getSessionSecret())}`;
}

async function readCookiePayload() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(cookieName)?.value;

  if (!cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature || (await signValue(payload, getSessionSecret())) !== signature) {
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
