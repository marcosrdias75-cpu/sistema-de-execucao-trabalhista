# Backup, migração e restauração

## Artefatos protegidos

- exportação D1 original: mantida fora do Git, em armazenamento privado;
- `db/migrations/`: fonte da verdade do PostgreSQL;
- volume `/data/documents`: PDFs originais privados;
- `pg_dump`: backup lógico do banco dedicado.

## Migração inicial

1. Crie/restaure o PostgreSQL dedicado em rede privada.
2. Execute `npm run db:migrate`.
3. Aponte `D1_BACKUP_PATH` para a exportação privada e execute
   `npm run db:import-d1` uma única vez.
4. O importador não restaura o token OpenClaw legado e força troca de senha dos
   usuários importados.
5. Configure segredos novos no Dokploy e execute `npm run db:seed-admin`.
6. Valide login, upload, MarkItDown, OpenClaw e restauração antes da liberação.

## Rotina de backup

- `pg_dump --format=custom` diário, retenção mínima de 14 cópias;
- cópia do volume de documentos preservando permissões e hashes;
- teste de restauração periódico em banco isolado;
- nunca registrar conteúdo jurídico ou segredo em logs.

## Confidencialidade

Backups contêm dados pessoais e jurídicos. O acesso deve ser restrito, auditado e
compatível com as políticas internas e de LGPD do escritório.
