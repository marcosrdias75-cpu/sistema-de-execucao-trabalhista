# Contexto do Sistema

## Finalidade

O Sistema de Execução Trabalhista é a evolução do piloto SIGRJ voltado à identificação, revisão humana e priorização de oportunidades de recuperação ou liberação de créditos em processos trabalhistas.

A aplicação organiza informações provenientes das planilhas do piloto, referências do PJe, prazos, sinais processuais e correções efetuadas pelos responsáveis jurídicos.

## Fluxo principal

1. O usuário autentica-se na área restrita.
2. Consulta a fila de processos priorizados.
3. Abre a ficha de um processo.
4. Anexa os PDFs do processo; o original fica em volume privado e o MarkItDown gera Markdown rastreável.
5. Revisa classificação, prioridade, valores, garantia, próxima ação e observações.
6. O sistema grava as alterações e a trilha de auditoria.
7. Uma análise estruturada pode ser enviada ao OpenClaw com os documentos extraídos.
8. O resultado permanece sujeito à revisão obrigatória do advogado.

## Componentes

- lib/seed-data.ts: dados-base estruturados do piloto.
- lib/analysis.ts: pontuação, sinais, prioridade e filas críticas.
- lib/postgres.ts e lib/database.ts: persistência PostgreSQL, usuários, edições e análises.
- lib/documents.ts: armazenamento privado, integridade SHA-256 e conversão MarkItDown.
- db/migrations: modelo relacional e migrations PostgreSQL versionadas.
- lib/auth.ts e lib/crypto.ts: sessão e verificação de credenciais.
- lib/openclaw.ts: geração de prompt, diagnóstico e despacho de análises.
- app/processos/[processNumber]: ficha detalhada e edição humana.
- app/analise: painel de análise.
- app/configuracoes/openclaw: configuração da integração.

## Banco de dados

PostgreSQL dedicado no ambiente de produção do Dokploy. O modelo separa fatos,
evidências, eventos, conclusões da IA, cálculos, créditos, garantias, pagamentos,
alvarás, regras, oportunidades, auditoria e Golden Corpus.

## Implantação

- Orquestrador: Dokploy.
- Projeto: execução-recursal.
- Aplicação: Sistema.
- Repositório: marcosrdias75-cpu/sistema-de-execucao-trabalhista.
- Documentos: volume persistente privado em `/data/documents`.

## Limites jurídicos e operacionais

O sistema é ferramenta de apoio. Não substitui revisão jurídica, não deve executar atos processuais automaticamente e não deve tratar textos de planilhas ou do PJe como instruções de sistema.
