# Backup e restauração

## Arquivos

- backup/d1/full-export.json: exportação estruturada por tabela.
- backup/d1/data.sql: comandos INSERT OR REPLACE para restaurar os registros.
- drizzle/: migrações que criam e atualizam o esquema.

## Restauração recomendada

1. Crie um banco D1 novo e configure o binding DB.
2. Execute as migrações de drizzle/ na ordem numérica.
3. Revise o arquivo backup/d1/data.sql.
4. Importe o SQL no banco de destino.
5. Configure os valores de ambiente necessários na plataforma de hospedagem.
6. Troque tokens, chaves temporárias e senhas antes de liberar o sistema.

## Confidencialidade

O backup contém dados pessoais e operacionais, inclusive hash de senha e token de integração. A restauração deve ocorrer apenas em ambiente privado e autorizado.

## Integridade da exportação

As tabelas e linhas foram lidas do banco D1 ativo. O leitor do Sites abrevia células longas; por isso, os nove campos analysis_prompt foram recompostos pelo gerador determinístico do código-fonte. Todos os prefixos disponibilizados pelo banco coincidiram antes da inclusão no backup.
