# Evidências da auditoria — Sprint 1

Parecer e limites de execução: [relatório](../../auditoria-sprint-1-2026-10-03.md). Critérios individuais: [matriz](../../matriz-sprint-1.md), [JSON dos 89 critérios](criterios.json) e [contagens por história](resumo-criterios.json). Versão local e hashes: [versao-auditada.json](versao-auditada.json).

As contas de QA dos scripts são temporárias; a aplicação pessoal conectada não recebeu alterações. Os logs de Android anteriores referidos na matriz pertencem às revisões registradas em cada reteste. Esta pasta não contém uma nova release Android aprovada.

## Regressão regular

Comandos executados na raiz do repositório:

```bash
pnpm -C app test:coverage
DATABASE_URL=postgresql://vitalis:vitalis@127.0.0.1:55432/vitalis_qa NODE_ENV=test pnpm -C server test
pnpm typecheck
pnpm lint
pnpm build
pnpm -C app exec jest --config ../docs/qa/evidence/auditoria-sprint1-2026-10-03/jest-cobertura-completa.json --runInBand --coverage
```

O banco é exclusivamente local de QA. A cobertura ampliada foi resumida em `app-coverage-completa.json`; o log está em `cobertura-completa.txt`. Os testes regulares passaram. `build` compila contratos e API, não um APK Android.

## Cenários adicionais de aceite

```bash
pnpm -C app exec jest --config ../docs/qa/evidence/auditoria-sprint1-2026-10-03/jest-ui.json --runInBand
pnpm -C app exec jest --config ../docs/qa/evidence/auditoria-sprint1-2026-10-03/jest-offline.json --runInBand
TZ=America/Sao_Paulo pnpm -C app exec jest --config ../docs/qa/evidence/auditoria-sprint1-2026-10-03/jest-nascimento.json --runInBand
```

Resultado: 2 testes de metas/aviso de calorias passaram; 2 de setas, 1 de foto offline e 1 de nascimento futuro reprovaram. As falhas são os defeitos documentados no parecer. Os arquivos são diagnósticos adicionais fora da suíte regular do app. As configurações usam os caminhos absolutos desta máquina; ajustar `rootDir`, `roots` e `testMatch` para reproduzir em outro checkout.

## API e carga

```bash
DATABASE_URL=postgresql://vitalis:vitalis@127.0.0.1:55432/vitalis_qa NODE_ENV=test pnpm -C server exec tsx ../docs/qa/evidence/auditoria-sprint1-2026-10-03/api-complementar.mts
DATABASE_URL=postgresql://vitalis:vitalis@127.0.0.1:55432/vitalis_qa NODE_ENV=test pnpm -C server exec tsx ../docs/qa/evidence/auditoria-sprint1-2026-10-03/api-confirmacao.mts
DATABASE_URL=postgresql://vitalis:vitalis@127.0.0.1:55432/vitalis_qa NODE_ENV=test pnpm -C server exec tsx ../docs/qa/evidence/auditoria-sprint1-2026-10-03/carga.mts
```

Os scripts exigem `NODE_ENV=test` e banco `vitalis_qa`, criam conta exclusiva e removem registros/arquivo ao finalizar. A carga deriva do script existente `server/scripts/qa-sprint1.ts`, com caminhos de importação e saída adaptados. O ensaio complementar usa Fastify inject e HTTP loopback, sem rede móvel.

**Leia os campos `passed` de cada verificação nos JSON**: os scripts complementares geram evidências mesmo quando um critério falha. Código de saída zero desses scripts não significa aprovação. As duas travessias paginadas falharam nas duas execuções.

As datas e idades do conjunto complementar são fixtures de 03/10/2026. Ao executar em outra data, algumas expectativas de idade ou períodos precisarão de atualização. O teste de nascimento controla o relógio explicitamente.

## Consultas e integridade

- `github.json`: branch, proteção, reviews e execuções consultadas pelo conector GitHub.
- `github-android-smoke.json`: etapas bem-sucedidas do smoke remoto anterior.
- `aparelho-build.txt`: versão, minSdk/targetSdk e flags do APK conectado.
- `memoria-debug-amostra.txt`: PSS/RSS de uma amostra debug; não é o roteiro de um minuto em release.
- `integridade.json`: comparação final dos hashes das fontes auditadas e da wiki, e conferência das 22 histórias/89 critérios/links dos documentos.
- `sha256.json`: hashes dos arquivos desta pasta, excluindo o próprio manifesto.

Arquivos `app-tests-diagnostico.txt`, `app-lint.txt` e `server-lint.txt` registram verificações adicionais do mesmo estado local; não somam novos casos à contagem de 142 + 17 testes regulares.
