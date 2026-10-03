# Sprint 1 — implementação e verificação

Data: 03/10/2026. Branch: `codex/sprint-1-quality`. Base: `7ce5161`.

Os seis blocos de correção foram implementados. A regressão automatizada passa, mas **a sprint ainda não está aprovada no Android**: não há APK instalado/validado, capturas das telas, execução Maestro, ensaio real offline de 24 horas ou medições de abertura e RAM. Os obstáculos e procedimentos para concluir essa aprovação estão registrados abaixo.

Reteste posterior do erro de lockfile no GitHub: a configuração pnpm aninhada em `app/` foi removida e o comando exato do prebuild passou localmente. Veja a [correção e as verificações da CI](correcao-ci-lockfile.md).

## Rastreabilidade

A [matriz](matriz-sprint-1.md) relaciona **22 histórias e 89 critérios**, com resultado esperado, obtido, evidência, defeito e reteste. A referência foi a Sprint 1 de [Home.md](/home/rafael/Documentos/github/VitalisTrack.wiki/Home.md), os critérios de [Backlog.md](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md) e os requisitos de [Requisitos.md](/home/rafael/Documentos/github/VitalisTrack.wiki/Requisitos.md). Os [hashes das fontes](evidence/source-hashes.txt) permitem identificar a versão analisada. A wiki permanece sem alterações.

“Testes passam” na matriz se refere aos cenários automatizados associados. Revisão de código, mocks de APIs nativas e compilação do bundle não aprovam a interface, o Keystore, o SQLite nativo ou o GPS de um aparelho.

## Alterações entregues

| Bloco | Comportamento resultante |
|---|---|
| Sessão | Tokens armazenados juntos no SecureStore; refresh 60 s antes de expirar e no primeiro plano; requisições compartilham refresh; falhas transitórias preservam sessão; rotas protegidas; cadastro com senha mínima de oito caracteres e confirmação; credenciais demonstrativas removidas. |
| Sincronização | Snapshot + mutação em transação SQLite; todas as escritas SQLite (incluindo treino/cursor/ack) e sincronização serializadas; todos os lotes drenados; retry após registro/reconexão; cache/fila por conta; pull preserva alterações pendentes; servidor verifica propriedade e aplica mutação + idempotência atomicamente. |
| Validação/perfil | Schemas compartilhados, datas reais, nascimento futuro, horários, limites numéricos e timestamps validados; vírgula decimal aceita quando apropriada; e-mail bloqueado; avatar exibido com cache; feedback distingue salvamento local de sincronização. |
| Histórico | Passos por data, deltas acumulados, virada diária sem apagar histórico; janelas móveis de 7/30 dias com dias sem registros; comparação 7/7; duração em segundos; pesos agrupados por datas reais; valores ausentes exibidos sem inventar medições. |
| GPS | Restauração antes da primeira persistência; treino retomado pausado; segundos/rota/distância preservados; deslocamento na pausa excluído; segmentos separados no mapa; permissões/serviço/assinaturas tratados; primeiro plano exige retomada; finalização usa ID estável. |
| Material 3 | React Native Paper 5, temas MD3 claro/escuro/sistema com identidade Vitalis; Appbar, navegação inferior, campos, botões, cartões, diálogos, seletores, FAB e feedback; calendários/horários Android; insets, teclado e Voltar integrados. |

O estado local/SQLite está na versão 2. A duração legada em minutos migra para segundos. O escalar legado de passos não possuía data: foi atribuído ao dia da migração; **não é possível reconstruir datas históricas que nunca foram armazenadas**. A atividade GPS é pausada ao sair do primeiro plano; não foi implementado rastreamento em segundo plano nesta sprint.

## Verificações executadas

| Controle | Resultado | Evidência |
|---|---|---|
| Jest + React Native Testing Library | **99 testes, 15 suítes, passam** | [Saída da regressão](evidence/app-regression.txt) |
| Vitest + PostgreSQL de QA | **17 testes, 3 arquivos, passam** | [Saída da regressão](evidence/server-regression.txt) |
| Cobertura de linhas do app | **88,31%**; statements 85,58%; funções 82,19%; branches 67,55% | [JSON](evidence/app-coverage.json) |
| Cobertura de linhas do servidor | **79,31%**; funções 90,24%; branches 70,55% | [JSON](evidence/server-coverage.json) |
| Typecheck | App, contratos e servidor passam | [Controles](evidence/build-and-checks.txt) |
| Lint | App e servidor sem avisos | [Controles](evidence/build-and-checks.txt) |
| Build | Contratos e servidor passam | [Controles](evidence/build-and-checks.txt) |
| Expo prebuild Android | Projeto nativo gerado; manifest QA permite HTTP somente com `ANDROID_QA=true` | [Controles](evidence/build-and-checks.txt) |
| Bundle Android/Hermes | Compilou 1.827 módulos; bundle de 5,64 MB | [Controles](evidence/build-and-checks.txt) |
| Lockfile/CI/flows | Lockfile congelado validado offline; YAML e shell válidos | [Controles](evidence/build-and-checks.txt) |

O denominador do app é a lógica de negócio: sessão/API/refresh, fila/SQLite, validação, cálculos/GPS, reducer/migração/selectors, provedor e controle de envio. Telas não integram esse percentual; quatro cenários RNTL verificam os formulários de cadastro/login, quantidade decimal de alimento e atalhos de água. O servidor agora mede rotas, autenticação e serialização, além de datas/cálculos/concorrência. Por isso os percentuais iniciais (30,79% de todas as linhas do app; 93,54% de duas bibliotecas do servidor) **não são diretamente comparáveis** aos finais.

Os testes cobrem refresh concorrente/antecipado/falhas transitórias, atomicidade SQLite com ponte de testes baseada em SQLite real, isolamento/reinício, pull concorrente, mais de 100 mutações, retries, timestamps/datas, segundos e pausas GPS, janelas com zeros e peso pendente. Uma regressão adicional reproduziu, na ponte SQLite, a gravação independente do treino sendo revertida junto com uma transação que falhou; após serializar todas as escritas, o treino permanece salvo. O Expo documenta que escritas concorrentes com transações exclusivas podem falhar por banco bloqueado; o comportamento nativo ainda exige reteste. A API é exercitada em PostgreSQL exclusivo: login, CRUD, metas/agregados, acesso entre contas e rollback real provocado depois do upsert, sem deixar registro ou marcador de idempotência.

## Requisitos transversais e medições

| Requisito | Resultado / aprovação |
|---|---|
| RNF1 — abertura < 3 s | **Pendente**: APK release não executado. |
| RNF2 — RAM ≤ 50 MB | **Pendente**: nenhuma medição de RAM do app. |
| RNF3 — 24 h offline | Cache e fila sobrevivem a 24 h com relógio controlado e reinício nos testes. **Ensaio de 24 h no Android pendente.** |
| RNF4 — Git | Commits semânticos incrementais na branch; alterações locais não relacionadas preservadas. Proteção remota de `main` não foi verificada/modificada. |
| RNF5 — Material | Componentes MD3 implementados; 22 pares de contraste dos tokens passam ≥ 4,5:1. **Inspeção visual/TalkBack pendente.** Ver [checklist](material-3.md). |
| RNF6 — 1.000 atividades | API listou 100 de 1.000 em **17 ms**, buscou por data/tipo em **8 ms**, com resultados correspondentes ao filtro. Lista Android virtualizada implementada; desempenho/rolagem no APK pendentes. |
| RNF7 — falhas < 1% | Ensaio local: **0/1.000 falhas**, 900 registros únicos após 100 replays. **Estabilidade do APK pendente.** |
| RNF8 — API ≤ 2 s | Pico local de 1.000 requisições: p95 **4.429 ms**, máximo **4.452 ms**. Meta não atendida nesse pico; condições normais de rede/aparelho ainda precisam de medição. |
| RNF9 — API 23+ | **Divergência aceita pelo usuário:** implementação segue **API 24+**. Expo 54 requer Android 7+ e compila/alveja API 36. A documentação existente API 23 não foi alterada. Compatibilidade executada no APK ainda pendente. |
| RNF10 — lógica ≥ 70% | Atendido no escopo instrumentado. Limites de linhas/statements na CI; servidor também exige branches/funções ≥ 70%. |

O [ensaio antes da limitação de concorrência](evidence/server-load-before.json) teve 677 falhas/1.000. Após limitar as transações simultâneas a oito, o [ensaio final](evidence/server-load.json) teve zero falhas e nenhum registro duplicado. As execuções ocorreram por **Fastify inject + PostgreSQL local**, sem rede móvel, HTTP externo ou APK. Uma execução anterior após a correção chegou a cerca de 20 s no pico; a diferença confirma que esses números dependem da carga do ambiente e não aprovam o RNF8.

## Android Studio e obstáculos confirmados

Android Studio foi aberto no projeto `app`. Foram instalados a plataforma Android 36 e os system images Google APIs **API 24 x86** e **API 36 x86_64**. Foram criados `Vitalis_Compact_API24` (Nexus One, 480 × 800) e `Vitalis_Pixel_API36` (Pixel 8). O Pixel 8 original não completou o boot por software na tentativa inicial.

Na verificação final não existia `/dev/kvm`, e a VM não expõe as flags de virtualização necessárias para aceleração. Havia aproximadamente **4 GB livres**. A tentativa do AVD compacto saiu com erro: userdata precisava de **7.372,80 MB**, mas tinha **3.997,57 MB** disponíveis. O script de build interrompeu antes de baixar NDK/compilar porque exige 15 GB livres. Veja [ambiente](evidence/android-environment.txt), [emulador](evidence/android-emulator.txt) e [preflight do build](evidence/android-build.txt).

Não foi removido conteúdo do usuário para liberar espaço. Não há dispositivo conectado. A chave Android do Maps SDK não foi fornecida; sem ela, a tela informa mapa indisponível e preserva o registro GPS. **Mapa real no APK continua obrigatório para US-030.**

## Continuação da aprovação

1. Expor virtualização aninhada/KVM à VM ou usar host Android com aceleração; liberar pelo menos 15–20 GB. Confirmar `/dev/kvm`, `emulator -accel-check`, boot e `adb shell getprop sys.boot_completed` retornando `1`.
2. Configurar uma chave restrita para `com.vitalistrack.app` e o certificado do APK em `app/.env.local`: `GOOGLE_MAPS_API_KEY`. Usar `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` e API com banco exclusivo de QA.
3. Executar `bash scripts/build-android-qa.sh`. Instalar `artifacts/android/vitalis-debug.apk` para diagnóstico e `vitalis-release.apk` para aprovação. O build release de QA inclui o bundle e não depende de Metro; não é uma publicação em loja.
4. Executar o [roteiro Android](roteiro-android.md), os 89 critérios da matriz e o checklist Material nos dois AVDs; recolher capturas, logs e medições. Atualizar cada reteste com resultado real e caminho da evidência.
5. Executar o workflow `Android QA` em ambiente com KVM ou `maestro test -e QA_EMAIL=qa-UNICO@example.com .maestro/sprint-1-smoke.yaml`. O fluxo e o workflow foram preparados e têm YAML válido; **não foram executados**, localmente ou remotamente.

As pendências ambientais são B-01/B-02; a pendência de desempenho é B-03 no [relatório de defeitos](defeitos-retestes.md). Não há capturas de telas do aplicativo nem APK validado nesta entrega; devem ser adicionados após a execução Android, sem substituir essa evidência por imagens de mockups ou do emulador sem boot.

## Histórico de commits

O [histórico](commits-semanticos.md) relaciona os commits de implementação e verificação. Para incluir o commit que contém este relatório, executar `git log --reverse --oneline 7ce5161..HEAD`. Nenhum push ou PR foi criado. `README.md`, `.idea/` da raiz e `package-lock.json` preexistentes foram preservados fora do staging.

## Referências verificadas

[Expo 54 e compatibilidade Android](https://docs.expo.dev/versions/v54.0.0/), [SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/), [Location](https://docs.expo.dev/versions/v54.0.0/sdk/location/), [mapas em APK próprio](https://docs.expo.dev/versions/v54.0.0/sdk/map-view/), [Paper e MD3](https://oss.callstack.com/react-native-paper/docs/guides/theming), [acessibilidade Android](https://developer.android.com/guide/topics/ui/accessibility/apps), [config plugins Expo](https://docs.expo.dev/config-plugins/plugins/), [Maestro launchApp](https://docs.maestro.dev/reference/commands-available/launchapp) e [setLocation: Android API 31+](https://docs.maestro.dev/reference/commands-available/setlocation).
