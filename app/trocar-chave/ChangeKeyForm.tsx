"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ChangeKeyForm({
  email,
  initialError = null,
  nextPath = "/",
}: {
  email: string;
  initialError?: string | null;
  nextPath?: string;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/change-key", {
        body: JSON.stringify({ confirmPassword, currentPassword, newPassword, next: nextPath }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel trocar a chave.");
      }

      router.replace(result.redirectTo ?? nextPath);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao trocar chave.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action="/api/auth/change-key" method="post" onSubmit={submitChange} className="grid gap-4">
      <input name="next" type="hidden" value={nextPath} />
      <p className="rounded-md border border-[#e3e6dd] bg-[#fbfcf8] p-3 text-sm">
        Conta: <span className="font-semibold">{email}</span>
      </p>
      <input
        autoComplete="current-password"
        className="h-11 rounded-md border border-[#c7ccbf] px-3 text-sm outline-none focus:border-emerald-800"
        name="currentPassword"
        required
        type="password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        placeholder="Chave temporaria"
      />
      <input
        autoComplete="new-password"
        className="h-11 rounded-md border border-[#c7ccbf] px-3 text-sm outline-none focus:border-emerald-800"
        name="newPassword"
        required
        type="password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        placeholder="Nova chave com pelo menos 12 caracteres"
      />
      <input
        autoComplete="new-password"
        className="h-11 rounded-md border border-[#c7ccbf] px-3 text-sm outline-none focus:border-emerald-800"
        name="confirmPassword"
        required
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Confirmar nova chave"
      />
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
        {isSubmitting ? "Salvando..." : "Trocar chave"}
      </button>
    </form>
  );
}
