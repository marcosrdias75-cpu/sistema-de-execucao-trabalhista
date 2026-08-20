# Sistema de Execução Trabalhista

Cópia privada do projeto **SIGRJ Restrito - Marcos**, desenvolvido para apoiar a triagem, revisão e análise de oportunidades em execuções trabalhistas.

## Conteúdo

- Código-fonte completo da aplicação.
- Migrações e esquema do Cloudflare D1.
- Backup dos dados das tabelas users, pilot_edits, app_settings e ai_analysis_runs.
- Contexto funcional e técnico.
- Instruções de restauração.

## Arquitetura

- Vinext/Next.js e TypeScript.
- Execução em Cloudflare Workers.
- Banco Cloudflare D1, vínculo lógico DB.
- Autenticação própria da aplicação.
- Integração de análise com OpenClaw.
- Hospedagem original pelo ChatGPT Sites.

## Estrutura principal

- app/: telas e rotas HTTP.
- lib/: regras de negócio, autenticação, banco e integração OpenClaw.
- db/ e drizzle/: esquema e migrações.
- worker/: entrada do Cloudflare Worker.
- backup/d1/: cópia dos dados do banco.
- docs/: contexto e restauração.

## Segurança

Este repositório deve permanecer **privado**. O backup contém dados jurídicos, identificação de usuário, hash de senha e configuração ativa de integração. Não publique, não faça fork público e não compartilhe o conteúdo sem autorização.

Consulte [docs/CONTEXTO.md](docs/CONTEXTO.md) e [docs/BACKUP_E_RESTAURACAO.md](docs/BACKUP_E_RESTAURACAO.md).
