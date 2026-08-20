import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOpenClawSettings, saveOpenClawSettings } from "@/lib/database";

function redirectTo(request: Request, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url), { status: 303 });
}

function isValidOpenClawUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "ws:", "wss:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return redirectTo(request, "/login?next=/configuracoes/openclaw");
  }

  if (user.mustChangePassword) {
    return redirectTo(request, "/trocar-chave?next=/configuracoes/openclaw");
  }

  const form = await request.formData();
  const webhookUrl = String(form.get("webhookUrl") ?? "").trim();
  const webhookToken = String(form.get("webhookToken") ?? "").trim();

  if (!isValidOpenClawUrl(webhookUrl)) {
    return redirectTo(request, "/configuracoes/openclaw?error=url");
  }

  const existing = await getOpenClawSettings();

  if (!webhookToken && !existing.tokenConfigured) {
    return redirectTo(request, "/configuracoes/openclaw?error=auth");
  }

  await saveOpenClawSettings({
    actor: user.name,
    webhookToken,
    webhookUrl,
  });

  return redirectTo(request, "/configuracoes/openclaw?saved=1");
}
