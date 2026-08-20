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

test("temporary key is not stored in source", async () => {
  const seedSource = await readFile(new URL("../lib/seed-data.ts", import.meta.url), "utf8");
  assert.match(seedSource, /passwordHash/);
  assert.doesNotMatch(seedSource, /U9jqWKYiKqufor3nR8EeCzen/);
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
  assert.match(databaseSource, /CREATE TABLE IF NOT EXISTS ai_analysis_runs/);
  assert.match(databaseSource, /CREATE TABLE IF NOT EXISTS app_settings/);
});
