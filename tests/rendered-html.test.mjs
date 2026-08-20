import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login page source is the restricted entrypoint", async () => {
  const source = await readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(source, /SIGRJ Restrito/);
  assert.match(source, /Acesso aos processos reais/);
  assert.doesNotMatch(source, /1000372-44\.2023\.5\.02\.0292/);
  assert.doesNotMatch(source, /codex-preview/i);
});

test("credentials and session secret are not stored in source", async () => {
  const seedSource = await readFile(new URL("../lib/seed-data.ts", import.meta.url), "utf8");
  const authSource = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
  assert.doesNotMatch(seedSource, /passwordHash|temporaryKeyDigest/);
  assert.match(authSource, /process\.env\.SESSION_SECRET/);
  assert.doesNotMatch(authSource, /sigrj-restrito-2026/);
});

test("process actions use native browser navigation and form submit", async () => {
  const processPageSource = await readFile(
    new URL("../app/processos/[processNumber]/page.tsx", import.meta.url),
    "utf8",
  );
  const editFormSource = await readFile(
    new URL("../app/processos/[processNumber]/EditForm.tsx", import.meta.url),
    "utf8",
  );
  const logoutButtonSource = await readFile(new URL("../app/ui/LogoutButton.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(processPageSource, /next\/link/);
  assert.match(processPageSource, /href="\/"/);
  assert.match(processPageSource, /href="\/analise"/);
  assert.match(editFormSource, /method="post"/);
  assert.doesNotMatch(editFormSource, /"use client"/);
  assert.match(logoutButtonSource, /method="post"/);
  assert.doesNotMatch(logoutButtonSource, /"use client"/);
});

test("openclaw analysis workflow is wired for background execution", async () => {
  const processPageSource = await readFile(
    new URL("../app/processos/[processNumber]/page.tsx", import.meta.url),
    "utf8",
  );
  const configPageSource = await readFile(new URL("../app/configuracoes/openclaw/page.tsx", import.meta.url), "utf8");
  const openClawSource = await readFile(new URL("../lib/openclaw.ts", import.meta.url), "utf8");
  const databaseSource = await readFile(new URL("../lib/database.ts", import.meta.url), "utf8");

  assert.match(processPageSource, /Analise OpenClaw/);
  assert.match(processPageSource, /\/api\/analyses\//);
  assert.match(configPageSource, /URL do Gateway OpenClaw/);
  assert.match(configPageSource, /Token do Gateway OpenClaw/);
  assert.match(configPageSource, /Testar conexao/);
  assert.match(configPageSource, /testOpenClawGateway/);
  assert.doesNotMatch(configPageSource, /Senha do Gateway/);
  assert.doesNotMatch(configPageSource, /makeSuggestedToken/);
  assert.match(openClawSource, /getOpenClawCredentials/);
  assert.match(openClawSource, /v1\/models/);
  assert.match(openClawSource, /v1\/chat\/completions/);
  assert.match(openClawSource, /nao instrucoes para voce/);
  assert.match(databaseSource, /postgresDatabase/);
  assert.match(openClawSource, /documentosConvertidos/);
});

test("postgres foundation covers the auditable legal and financial model", async () => {
  const migration = await readFile(
    new URL("../db/migrations/0001_postgres_foundation.sql", import.meta.url),
    "utf8",
  );
  for (const table of [
    "case_documents",
    "evidence_items",
    "procedural_events",
    "case_analysis_snapshots",
    "calculation_versions",
    "guarantees",
    "insurance_policies",
    "release_orders",
    "payments",
    "legal_rule_versions",
    "opportunities",
    "golden_corpus_items",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }
  assert.match(migration, /received_requires_proof/);
  assert.match(migration, /approved_rule_requires_reviewer/);
});

test("pdf workflow stores originals and converts them with MarkItDown", async () => {
  const documents = await readFile(new URL("../lib/documents.ts", import.meta.url), "utf8");
  const processPage = await readFile(
    new URL("../app/processos/[processNumber]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(documents, /%PDF-/);
  assert.match(documents, /MARKITDOWN_BIN/);
  assert.match(documents, /sha256/);
