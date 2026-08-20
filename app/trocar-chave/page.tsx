import { requireUser } from "@/lib/auth";
import { getSafeNextPath } from "@/lib/navigation";
import { ChangeKeyForm } from "./ChangeKeyForm";

export const dynamic = "force-dynamic";

const changeKeyErrors: Record<string, string> = {
  confirm: "A confirmacao nao confere.",
  current: "Chave atual invalida.",
  length: "A nova chave deve ter pelo menos 12 caracteres.",
  same: "A nova chave precisa ser diferente da temporaria.",
};

interface ChangeKeyPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ChangeKeyPage(props: ChangeKeyPageProps) {
  const searchParams = await props.searchParams;
  const errorCode = typeof searchParams?.error === "string" ? searchParams.error : null;
  const nextPath = getSafeNextPath(searchParams?.next);
  const user = await requireUser({ allowTemporary: true });

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f2] px-5 py-8 text-[#171b18]">
      <section className="w-full max-w-md rounded-md border border-[#d7dbd0] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-emerald-800">SIGRJ Restrito</p>
        <h1 className="mt-1 text-2xl font-semibold">Trocar chave no primeiro acesso</h1>
        <p className="mt-3 text-sm leading-6 text-[#566052]">
          Depois da troca, a chave temporaria deixa de valer.
        </p>
        <div className="mt-5">
          <ChangeKeyForm
            email={user.email}
            initialError={errorCode ? changeKeyErrors[errorCode] : null}
            nextPath={nextPath}
          />
        </div>
   