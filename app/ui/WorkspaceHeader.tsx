import Link from "next/link";
import { LogoutButton } from "@/app/ui/LogoutButton";

const links = [
  { href: "/", label: "Visão geral" },
  { href: "/processos", label: "Carteira" },
  { href: "/oportunidades", label: "Oportunidades" },
  { href: "/importacoes", label: "Importações" },
  { href: "/documentos", label: "Documentos" },
  { href: "/configuracoes/pje", label: "PJe" },
  { href: "/configuracoes/openclaw", label: "Configurações" },
];

export function WorkspaceHeader({
  name,
  current,
}: {
  name: string;
  current?: string;
}) {
  return (
    <header className="border-b border-[#d7dbd0] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-8">
          <Link href="/" className="min-w-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">SIGRJ</p>
            <p className="text-lg font-semibold tracking-tight text-[#171b18]">Inteligência de execução</p>
          </Link>
          <nav aria-label="Navegação principal" className="flex flex-wrap gap-1">
            {links.map((link) => {
              const active = current === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-900 text-white"
                      : "text-[#566052] hover:bg-[#f1f4ed] hover:text-emerald-900"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs uppercase tracking-wide text-[#6a7466]">Sessão restrita</p>
            <p className="text-sm font-medium text-[#293127]">{name}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
