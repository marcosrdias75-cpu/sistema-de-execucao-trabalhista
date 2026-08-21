# Backup legado do D1

Os arquivos confidenciais foram removidos do repositório. A exportação original deve ser
mantida somente em cofre/backup privado e usada por caminho externo com
`D1_BACKUP_PATH` durante a migração autorizada.

- `full-export.json`: formato aceito pelo importador, deliberadamente ignorado pelo Git.
- `data.sql`: restauração D1 legada, deliberadamente ignorada pelo Git.

Tokens OpenClaw antigos não são importados. Credenciais de usuário restauradas exigem
troca e devem ser substituídas antes da liberação do sistema.
