# Sistema de Execução Trabalhista

Plataforma interna para triagem, revisão humana e recuperação de créditos em
execuções trabalhistas, com foco inicial na carteira Casas Bahia.

## Arquitetura

- Next.js e TypeScript em container Docker.
- PostgreSQL dedicado no Dokploy, com migrations SQL versionadas.
- PDFs originais em volume privado e conversão por Microsoft MarkItDown.
- Integração OpenClaw pela assinatura ChatGPT disponível no servidor.
- Conclusões estruturadas com confiança, eventos, evidências e revisão humana.

## Modelo coberto

A migration PostgreSQL contempla carteira, processos relacionados, documentos,
evidências, timeline, cálculos, crédito, garantias, seguro, pagamentos, alvarás,
eventos de recuperação judicial, regras versionadas, oportunidades e Golden Corpus.

## Comandos

| Comando | Função |
|---|---|
| `npm run dev` | Desenvolvimento local |
| `npm run lint` | Lint |
| `npm run typecheck` | Verificação TypeScript |
| `npm run build` | Build de produção |
| `npm run db:migrate` | Aplica migrations pendentes |
| `npm run db:import-d1` | Importa uma exportação D1 privada uma única vez |
| `npm run db:seed-admin` | Cria/rotaciona o administrador inicial |

## Segurança

O repositório deve permanecer **privado**. Dados jurídicos, documentos, backups,
hashes de credencial e tokens não podem ser versionados. O token OpenClaw legado
é ignorado pelo importador e deve ser substituído por segredo novo no Dokploy.

Consulte [docs/CONTEXTO.md](docs/CONTEXTO.md) e
[docs/BACKUP_E_RESTAURACAO.md](docs/BACKUP_E_RESTAURACAO.md).
