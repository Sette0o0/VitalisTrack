# Evidências das correções — 04/10/2026

Estado local com alterações preexistentes preservadas; base Git `c31a6b7`. A identificação exata está em [versao-final.json](versao-final.json), com hashes das 124 fontes/configurações e do APK. Release 1.0.0, minSdk 24, targetSdk 36, ABIs x86/x86_64. Artefato local: `artifacts/android/vitalis-sprint1-1.0.0-451715f4-api24-api36.apk`; SHA-256 `451715f40e3e7408096f08523fc1cd6b0cfccad474b8879e8cf93b39c1b8a221`.

Banco exclusivo `vitalis_qa` em PostgreSQL 18, container `vitalis-sprint1-fixes-20261004`, porta 55432; API de QA em 3011. Dois AVDs temporários com KVM: VitalisFixAPI24/Android 7/x86/Nexus One (480×800, densidade 240) e VitalisFixAPI36/Android 16/x86_64/Pixel 2 (1080×1920, densidade 420). Contas sintéticas distintas. Fuso America/Sao_Paulo; relógio real do aparelho preservado.

## Controles

- `app-tests.txt`, `app-coverage.json`: `pnpm --filter vitalis-track test:coverage`; todas as bibliotecas, estado e `use-submit` no denominador regular. Telas/módulos nativos não são aprovados pelo percentual.
- `server-tests.txt`, `server-coverage.json`: Vitest com PostgreSQL de QA, incluindo transação/idempotência real e as novas regressões.
- `typecheck.txt`, `lint.txt`, `build.txt`: TypeScript, lint e build dos contratos/API.
- `android-build.txt`: Gradle release com `ANDROID_QA=true EXPO_PUBLIC_ANDROID_QA=true EXPO_PUBLIC_API_URL=http://10.0.2.2:3011 NODE_ENV=production BABEL_ENV=production`, arquiteturas x86/x86_64. `apk-metadata.txt` e `apk-sha256.txt` identificam o resultado.
- `api-confirmacao.json`: 14/14 verificações, incluindo travessia integral de 1.000 IDs em data/tipo e 25 leituras/escritas HTTP loopback. `server-load.json`: 1.000 operações concorrentes, 900 únicas + 100 replays, zero falhas. Loopback e saturação não representam 4G normal.
- `seed-activities.json`: 1.000 registros sintéticos para conferir a lista nativa. Os testes regulares também percorrem empates, filtros e limites 7/50/100.

## Evidência nativa

Capturas `api24-*-final-*` e `api36-*-final-*` na raiz pertencem ao APK final. XML é obtido novamente em cada captura; o roteiro exige confirmação de dump e não reaproveita uma hierarquia quando o Android informa falta de ociosidade.

`android_ui.py` opera somente emulator-5554/5556. `database.py` lê apenas estado/fila SQLite dos AVDs de QA, nunca SecureStore. `native-server.json` contém perfil, registros, marcadores e cadeia de sessões sem tokens. `http-native.jsonl` contém somente método, caminho, status, duração, user-agent e horário, sem corpo ou Authorization.

`startup.py` registra dez aberturas frias: timestamp no aparelho antes de `am start`, seguido do marcador após carregamento do provedor, layout da tela e dois frames. Overhead de UIAutomator não entra na medida. Esses resultados são amostras em emulador; não certificam todos os aparelhos.

O seletor DocumentsUI do Android 7 não reconheceu o tipo de ponteiro enviado por `adb input tap` nas miniaturas. `QATap.java` injeta toque com `TOOL_TYPE_FINGER` somente nesse AVD; seleção e recorte então funcionaram. Isso é uma adaptação da automação, sem alteração do produto.

`iteration-1/` a `iteration-4/` conservam experimentos de APKs anteriores. Não são evidência de aprovação da versão final. Incluem uma abertura de 3,27 s sob testes concorrentes e a apresentação decimal corrigida. A auditoria de 03/10 permanece em pasta própria.

O ensaio de 24 horas reais deve ter T0/T+24 h, reinício, ações em momentos distintos e reconexão com conferência dos IDs. Teste com relógio controlado e duração menor não o substituem. Rede móvel 4G+, trajetória física, TalkBack completo e matriz visual integral permanecem separados dos testes instrumentados.


## Resultados finais complementares

- [Foto/refeições e idempotência](native-sync-checks.json): filas dos dois AVDs vazias após reconexão; uma operação processada por UUID; cópia local preservada após novo login.
- [JWT renovado sem login](session-refresh-final.json): 13:52:11 UTC, 59,5 s antes da expiração, com HTTP 200/okhttp no trace.
- [GPS local/servidor](gps-final-checks.json): pausa/reinício em 12 s/0,11 km; retomada em 24 s/0,22 km; seis pontos, dois segmentos, um único ID salvo.
- [Alvos amostrados](touch-targets.json): 27 controles integralmente visíveis com pelo menos 48 dp.
- Abertura: 10 amostras Home e 10 login em cada AVD; máximos API 24 1.617/1.529 ms, API 36 1.064/1.249 ms. Arquivos `startup-emulator-*-home/login.json`.
- [24 horas reais — tentativa 2, estado final](offline-24h-final-status.json): **inconclusiva, encerrada sem aprovação de RNF3**. Lacuna de 4 h 47 min 05 s entre as amostras de 04/10 às 16:42:14 e 21:29:19 Brasília, com atraso do relógio do emulador. [Conferência da interrupção](offline-24h-interruption-checks.json) e [snapshot final](database-emulator-5556-offline-attempt-2-interrupted.json): seis operações e foto local preservadas, sem reconexão. Coletor/inibidor encerrados, somente o AVD do ensaio parado, heartbeat excluído. [Tentativa 1 inconclusiva](offline-attempt-1/offline-24h-final-status.json) preservada separadamente. Um novo ensaio completo é necessário.

Às 14h UTC o usuário conectou um celular ARM/Android 14 API 34. Retestes físicos adicionais serão identificados separadamente; não substituem API 24/36 nem permitem classificar transporte USB como 4G+.

[Retestes no celular Android 14/API 34](physical-api34/README.md), pacote QA separado, APK ARM64 `10fe589f…`. Abertura Home/login máxima 2.207/1.752 ms, foto e refresh reais aprovados no escopo descrito.
