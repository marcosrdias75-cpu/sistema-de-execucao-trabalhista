"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm({
  initialError = null,
  nextPath = "/",
}: {
  initialError?: string | null;
  nextPath?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ email, next: nextPath, password }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        mustChangePassword?: boolean;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel entrar.");
      }

      router.replace(result.redirectTo ?? (result.mustChangePassword ? "/trocar-chave" : nextPath));
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha no login.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action="/api/auth/login" method="post" onSubmit={submitLogin} className="grid gap-4">
      <input name="next" type="hidden" value={nextPath} />
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold uppercase text-[#6a7466]">E-mail</span>
        <input
          autoComplete="email"
          className="h-11 rounded-md border border-[#c7ccbf] px-3 text-sm outline-none focus:border-emerald-800"
          name="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="marcosrdias75@gmail.com"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold uppercase text-[#6a7466]">Chave</span>
        <input
          autoComplete="current-password"
          className="h-11 rounded-md border border-[#c7ccbf] px-3 text-sm outline-none focus:border-emerald-800"
          name="password"
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Chave temporaria"
        />
      </label>
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 rounded-md border border-emerald-800 bg-emerald-900 px-4 text-sm font-semibold text-white disabled:opacity-70"
      >
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
