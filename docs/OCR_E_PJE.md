# Pipeline de documentos, OCR e PJe

## O que foi implementado

A aplicação agora possui ingestão manual de PDF/HTML/TXT em `/documentos`, hash SHA-256, idempotência por processo e hash, texto extraído, estados de leitura, filas `ocr_runs`, páginas OCR, histórico de revisão humana e endpoints internos protegidos por `OCR_WORKER_TOKEN`.

A rota `/configuracoes/pje` valida números CNJ e gera um plano de captura controlado. A rota não consulta produção, não executa login, não baixa peças e não protocola atos. O módulo `lib/pje.ts` define o contrato para receber conectores oficiais MNI/API por tribunal.

## Storage

O D1 guarda metadados, hashes, texto e estados. Bytes de documentos não são gravados no D1. Se o binding R2 `DOCS` existir, o upload usa a chave `documents/{cnj}/{hash}/{nome}`. Sem o bucket, PDFs binários são recusados para evitar que o sistema registre somente metadados e perca o original. HTML/TXT ou texto colado podem ser registrados sem R2.

## Worker OCR

O arquivo `scripts/ocr-worker.mjs` é um worker externo ao processo web. Ele busca até dez jobs `queued`, marca cada execução como `running`, tenta texto direto com `pdftotext`, tenta `ocrmypdf` com idioma português e, por fim, rasteriza páginas com `pdftoppm` e chama Tesseract. O resultado é enviado para a rota interna autenticada e fica em `documents`, `document_pages` e `ocr_runs`.

Exemplo de configuração:

```bash
export SIGRJ_WORKER_URL="https://seu-sigrj.example.com"
export OCR_WORKER_TOKEN="um-segredo-longo-e-aleatorio"
export OCR_SOURCE_DIR="/var/lib/sigrj-documents"
export OCR_WORKER_ONCE="true"
node scripts/ocr-worker.mjs
```

Para PDFs escaneados, o worker precisa de `pdftoppm`, Tesseract com o pacote de idioma português e, preferencialmente, OCRmyPDF. O ambiente web não deve assumir a presença desses binários; por isso o processamento foi separado do servidor.

## Fluxo recomendado

1. O usuário registra o documento e vincula o processo.
2. O sistema calcula o hash e evita duplicação.
3. Um usuário autorizado solicita OCR.
4. O worker retira o job e registra o início.
5. O worker extrai texto, páginas e confiança.
6. O sistema marca o documento como `review_pending`.
7. O advogado aprova, rejeita ou corrige a evidência.
8. Somente depois da revisão humana o texto deve alimentar fatos processuais, cálculos ou oportunidades.

## PJe

A implementação entregue é deliberadamente um adaptador controlado. O próximo desenvolvimento deve criar conectores por tribunal e ambiente, persistindo endpoint, versão, método de autenticação, referência da credencial, cursor, snapshots, hash de payload e falhas. O primeiro conector deve operar em homologação ou sobre uma API/MNI oficialmente habilitada; automação de navegador deve permanecer como fallback excepcional e autorizado.

## Continuidade implementada

A tela `/configuracoes/pje` agora permite cadastrar o tribunal, ambiente, endpoint HTTPS, método de autenticação e referência externa da credencial. O sistema persiste essa configuração em `pje_connectors`, sem armazenar segredo.

A fila `/api/pje/capture/runs` registra execuções com estados `queued`, `running`, `succeeded`, `partial`, `failed` e `awaiting_authorization`. A rota interna `/api/internal/pje/capture` é protegida por `PJE_CAPTURE_WORKER_TOKEN` e foi preparada para um worker retirar jobs, gravar snapshots por hash e atualizar o resultado. Enquanto o executor oficial do tribunal não estiver implementado, a operação deve permanecer em `awaiting_authorization` ou `plan_only`.

O painel de importações mostra conectores, snapshots e contagens de fila. O próximo incremento será implementar o executor de um tribunal específico, começando em homologação e usando o contrato MNI/API confirmado pelo órgão.

## Fluxo por link individual

O fluxo principal pode ser usado sem API institucional: o usuário escolhe o processo, cola o link individual recebido do PJe e registra o alvo em `/configuracoes/pje`. O sistema aceita somente HTTPS em domínio oficial `.jus.br`, classifica links de detalhe, painel externo e consulta pública e associa a URL ao número CNJ informado.

A captura é sob demanda pelo botão `Capturar agora`. O worker `scripts/pje-link-worker.mjs` retira a execução, acessa somente a URL fornecida, segue redirecionamentos normais, detecta HTTP 401/403, login, CAPTCHA ou sessão expirada e marca `awaiting_authorization` sem tentar contornar a barreira. Quando a página é acessível, ele grava o HTML em snapshot, calcula SHA-256, evita duplicação, cria um documento e enfileira PDFs para OCR.

Variáveis do worker:

```bash
export SIGRJ_WORKER_URL="https://seu-sigrj.example.com"
export PJE_CAPTURE_WORKER_TOKEN="um-segredo-longo-e-aleatorio"
export PJE_SNAPSHOT_DIR="/var/lib/sigrj-pje-snapshots"
export PJE_CAPTURE_WORKER_ONCE="true"
node scripts/pje-link-worker.mjs
```

O sistema não tenta fazer login, resolver CAPTCHA/MFA, extrair conteúdo de área não autorizada nem praticar atos no processo. Quando o link exigir sessão, o usuário deve realizar a autorização no navegador apropriado e, posteriormente, executar a captura de forma compatível com as regras e permissões do tribunal.
