import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSafeNextPath, withNext } from "@/lib/navigation";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

const loginErrors: Record<string, string> = {
  credentials: "E-mail ou chave invalida.",
  missing: "Informe e-mail e chave.",
  session: "Sessao expirada. Entre novamente.",
};

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage(props: LoginPageProps) {
  const searchParams = await props.searchParams;
  const errorCode = typeof searchParams?.error === "string" ? searchParams.error : null;
  const nextPath = getSafeNextPath(searchParams?.next);
  const user = await getSessionUser();

  if (user?.mustChangePassword) {
    redirect(withNext("/trocar-chave", nextPath));
  }

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f2] px-5 py-8 text-[#171b18]">
      <section className="w-full max-w-md rounded-md border border-[#d7dbd0] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-emerald-800">SIGRJ Restrito</p>
        <h1 className="mt-1 text-2xl font-semibold">Acesso aos processos reais</h1>
        <p className="mt-3 text-sm leading-6 text-[#566052]">
          Entre com o e-mail e a chave temporaria. No primeiro acesso, a troca
          da chave sera obrigatoria.
        </p>
        <div className="mt-5">
          <LoginForm initialError={errorCode ? loginErrors[errorCode] : null} nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
