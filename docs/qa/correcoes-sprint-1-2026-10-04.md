# Correções e retestes da Sprint 1 — 04/10/2026

As falhas de paginação, foto offline, nascimento/fuso e tendência foram corrigidas, com regressões na suíte regular. Também foram corrigidos dois alvos de 40 dp, ruído decimal em Android 7 e corte de rótulos na navegação compacta. **O fechamento integral continua pendente do ensaio real de 24 horas, da rede estável 4G+ e da matriz completa de acessibilidade/Android.**

Proteção de `main` foi excluída pelo usuário e permanece sem alteração. RAM acima de 50 MB foi adiada para outra sprint, sem otimização nesta entrega. Nenhuma das duas ressalvas é declarada atendida.

## Versão entregue

Estado auditado preservado em `main`, com base Git `c31a6b7` e alterações preexistentes incluídas. As correções, os testes e a documentação foram organizados para entrega em commits locais; sem push ou publicação. [Manifesto de fontes](evidence/correcoes-sprint1-2026-10-04/versao-final.json) identifica as 124 fontes/configurações e o conjunto por SHA-256.

APK release de QA **1.0.0**, minSdk **24**, target **36**, x86/x86_64, instalado nos AVDs API 24 e 36. SHA-256 `451715f40e3e7408096f08523fc1cd6b0cfccad474b8879e8cf93b39c1b8a221`. [APK local](/home/rafael/Documentos/github/VitalisTrack/artifacts/android/vitalis-sprint1-1.0.0-451715f4-api24-api36.apk), [metadados](evidence/correcoes-sprint1-2026-10-04/apk-metadata.txt), [build Gradle](evidence/correcoes-sprint1-2026-10-04/android-build.txt).

[Índice de evidências](evidence/correcoes-sprint1-2026-10-04/README.md). Capturas na raiz pertencem à release final; `iteration-*` são experimentos intermediários, sem uso para aprovar a versão final. A auditoria de 03/10 foi preservada como histórica.

## Comportamento corrigido

| Frente | Resultado |
|---|---|
| Paginação | Data/createdAt/ID descendentes; tipo ascendente, data/ID descendentes. Cursor por ID, filtros e limites preservados; desempate local também por ID. |
| Foto offline | Expo FileSystem SDK 54 copia JPEG/PNG/WebP ≤ 5 MiB para diretório persistente por conta. Referência de perfil e operação avatar entram juntas na transação SQLite existente. Prévia, login, pull e reinício preservam pendências; após confirmar, a cópia local permanece. |
| Envio de foto | Fila ordenada separa lotes JSON e multipart; UUID estável em Idempotency-Key. Perfil/ProcessedMutation transacionais, replay não reaplica foto antiga. Respostas antigas/logout não alteram seleção nova ou outra conta. Limpeza local considera estado, fila e envio em andamento. |
| Nascimento | Regra compartilhada usa data civil e fuso do aparelho no momento da validação. PATCH e sync usam relógio do servidor; mutação captura clientTimeZone. Data impossível/futura não é salva. Idade considera aniversário no mesmo fuso; data permanece YYYY-MM-DD/coluna date. |
| Tendência | Indicador reutilizado em Atividades/Progresso: aumento/queda/igualdade, descrição acessível e comparação fixa 7/7 independente do filtro. Base anterior zero conserva “sem base na semana anterior”. |
| Compatibilidade/visual | Wiki alinhada a API 24+. Voltar/calendário com 48 dp; formatador evita casas espúrias no ICU antigo; rótulos Paper usam o tamanho já definido para a navegação compacta. |

Os [contratos da API](../api-sprint1.md) documentam cabeçalhos opcionais, UTC para clientes antigos, validação de fuso, idempotência e compatibilidade da outbox. Nenhuma migração destrutiva de SQLite foi feita.

## Regressão e carga

| Controle | Resultado | Evidência |
|---|---|---|
| App | **163 testes, 24 suítes passaram** | [Log](evidence/correcoes-sprint1-2026-10-04/app-tests.txt) |
| API/PostgreSQL QA | **24 testes, 4 arquivos passaram** | [Log](evidence/correcoes-sprint1-2026-10-04/server-tests.txt) |
| Cobertura regular app | **92,13% de linhas**, 89,57% statements, 87,20% funções, 75,92% branches | [JSON](evidence/correcoes-sprint1-2026-10-04/app-coverage.json) |
| Cobertura API | **84,65% de linhas**, 78,60% branches | [JSON](evidence/correcoes-sprint1-2026-10-04/server-coverage.json) |
| Typecheck/lint/build | Passaram; release Android compilada | [Typecheck](evidence/correcoes-sprint1-2026-10-04/typecheck.txt), [API final](evidence/correcoes-sprint1-2026-10-04/server-typecheck-final.txt), [lint](evidence/correcoes-sprint1-2026-10-04/lint.txt), [build](evidence/correcoes-sprint1-2026-10-04/build.txt) |
| Paginação | **1.000 retornados/1.000 únicos** em data/tipo; empates, filtros e limites 7/50/100 na suíte | [14/14 verificações API](evidence/correcoes-sprint1-2026-10-04/api-confirmacao.json) |
| Carga | **0 falhas/1.000**, 900 registros após 100 replays | [JSON](evidence/correcoes-sprint1-2026-10-04/server-load.json) |

Os quatro testes antes reprovados — duas tendências, foto offline e nascimento futuro após 21h30 em Brasília — agora integram a regressão regular. Casos adicionais cobrem cópia/transação falha, resposta de upload perdida, concorrência, nova seleção durante envio, logout/contas/reinício, replay antigo, limites de arquivo e rollback real da API. Datas incluem meia-noite, fusos positivos/negativos, bissexto e aniversário em formulário/PATCH/sync.

O denominador regular inclui todas as bibliotecas do app, estado e controle de envio, e rotas/bibliotecas da API. Cobertura de lógica não aprova módulos nativos ou todos os estados visuais.

## Retestes Android e critérios antes parciais

AVDs isolados: API 24/Android 7/Nexus One/480×800/densidade 240; API 36/Android 16/Pixel 2/1080×1920/densidade 420. KVM, GPU em software, relógio real, fuso America/Sao_Paulo e contas sintéticas. Os ensaios API 24/36 usaram AVDs isolados.

- Foto: seleção/recorte offline, prévia, force-stop/reinício e reconexão na release final dos dois AVDs. [SQLite antes/depois e servidor concordam](evidence/correcoes-sprint1-2026-10-04/native-sync-checks.json): fila drenada, arquivo local mantido e um marcador para cada operação de foto.
- Refeições: criação em g/mL, aviso 450/400 kcal, edição para 300 kcal e exclusão offline no API 36; reconexão e IDs/tombstones conferidos. API 24 também restaura operações de perfil/peso/atividade/refeição/água já armazenadas ao atualizar o APK, exercitando compatibilidade da fila.
- Peso: sete pontos na semana atual e ambas as semanas preenchidas, com médias 70,3 e 71,0 kg e duas barras no API 36.
- Sessão: ciclo real antecipado/silencioso no APK final, com expiração de 15 min e rotação aproximadamente 60 s antes; nenhuma nova ação de login. [Rotação às 13:52:11 UTC](evidence/correcoes-sprint1-2026-10-04/session-refresh-final.json), 59,5 s antes da expiração; [HTTP nativo 200](evidence/correcoes-sprint1-2026-10-04/http-native.jsonl).
- Volume/tendência: lista com a fixture de 1.000 atividades (mais registros de GPS do ensaio), filtro/ordenação/rolagem e descrição de crescimento de 100% consistente entre Atividades/Progresso. Queda, igualdade e ausência de base cobertas pelos testes atuais.

Os 89 critérios permanecem individualmente na [matriz](matriz-sprint-1.md). “Atendido no escopo verificado” não significa execução manual de todos eles em ambos os Androids. A matriz integral continua aberta em RNF5/RNF9.

## Requisitos transversais e pendências

| Requisito | Situação nesta entrega |
|---|---|
| RNF1 — abertura utilizável < 3 s | Dez amostras por tela/dispositivo: API 24 Home máximo 1.617 ms/login 1.529 ms; API 36 Home 1.064 ms/login 1.249 ms. Marcador após cache carregado, layout e dois frames. Escopo: AVDs controlados; não certifica todos os aparelhos. |
| RNF2 — RAM ≤ 50 MB | **Adiado/excluído desta correção pelo usuário**, sem otimização e sem aprovação. |
| RNF3 — 24 horas reais offline | **Inconclusivo/pendente — tentativa 2 encerrada**. T0 em 04/10 às 15:04:35 Brasília. A continuidade foi perdida entre 16:42:14 e 21:29:19: lacuna de **4 h 47 min 05 s**, com atraso do relógio do emulador. Das 100 amostras, 99 passaram e a última falhou. [Evidência da interrupção](evidence/correcoes-sprint1-2026-10-04/offline-24h-interruption-checks.json): APK/bootId preservados, rede desligada e seis operações originais/foto local ainda presentes. Nenhuma reconexão ou etapa T+6 foi realizada. Coletor encerrado, bloqueio temporário de suspensão liberado, somente o AVD do ensaio parado e heartbeat excluído. [Estado final](evidence/correcoes-sprint1-2026-10-04/offline-24h-final-status.json). Não comprova 24 horas reais; será necessário um novo ensaio completo. [Tentativa 1](evidence/correcoes-sprint1-2026-10-04/offline-attempt-1/offline-24h-final-status.json) também permanece inconclusiva. |
| RNF4 — proteção/revisão Git | Proteção de main **excluída**, sem alteração. Entrega local ainda sem integração/revisão remota desta versão. |
| RNF5 — Material/TalkBack | Amostras de temas, fonte 100/200%, teclado, foto, gráficos, erro e alvos corrigidos conferidas. [Checklist integral](material-3.md) continua pendente, incluindo leitura auditiva/ordem completa de foco e todos os estados. |
| RNF6 — 1.000 atividades | Paginação integral aprovada na API; lista nativa com fixture de 1.000 registros conferida. |
| RNF7 — < 10 falhas/1.000 | **Atendido no ensaio do servidor**, 0 falhas. |
| RNF8 — ≤ 2 s em 4G+ estável | **Pendente nessa condição**. Loopback teve 25 amostras, máximo 35,21 ms. Saturação de 1.000 requisições teve p95 3,216 s/máximo 3,237 s, condição diferente de rede normal. |
| RNF9 — Android mínimo | API **24+** aceita e documentada; instalação/fluxos específicos nos dois AVDs. Matriz integral e execução remota do workflow API 24/36 pendentes. |
| RNF10 — ≥ 70% lógica | **Atendido no denominador regular ampliado** do app e da API. |

As aberturas de builds intermediários, incluindo uma de 3,27 s durante trabalho concorrente, ficaram arquivadas. São evidências de condições anteriores; não foram usadas para aprovar a release final. Não foi reproduzido gargalo no reteste controlado da abertura final.

O ensaio de 24 horas exige manter o computador e os AVDs disponíveis. Depois do prazo: conferir cache/foto/fila, alterações em momentos distintos e reinício; reconectar; comparar cada ID/valor/ProcessedMutation, exigir fila vazia e ausência de duplicação; só então atualizar RNF3. Interrupção, mudança de APK ou perda de continuidade torna o ensaio inconclusivo.

GPS simulado da release final: pausa/reinício conservam 12 s e 0,11 km; após retomar, 24 s e 0,22 km, seis pontos e dois segmentos. [Dados locais e servidor concordam, ID único](evidence/correcoes-sprint1-2026-10-04/gps-final-checks.json). Não certifica trajetória física.

A última restrição IANA rejeita offsets numéricos (por exemplo +03:00) em cabeçalhos e mutações, aceitando Etc/GMT+3. A suíte completa da API foi repetida; nenhuma fonte do app/contratos mudou após os APKs.

## Reteste adicional no celular conectado

Android 14/API 34, modelo 22111317PG; APK ARM64 de QA 1.0.0/SHA `10fe589f316b9d4613d82e7a7e9926b9ffa6b0a46cdef714fc9cb2e3b5d45df6`, [artefato local](/home/rafael/Documentos/github/VitalisTrack/artifacts/android/vitalis-sprint1-qa-1.0.0-10fe589f-arm64.apk). Pacote separado `com.vitalistrack.qa`, preservando o app/dados existentes; [metadados](evidence/correcoes-sprint1-2026-10-04/physical-build.json).

[Provas do celular](evidence/correcoes-sprint1-2026-10-04/physical-api34/README.md): cadastro, hidratação (1.700 mL), nascimento futuro com demais campos válidos, seleção/recorte de foto, prévia sem API após reinício, reconexão com um único processamento e conservação após novo login. Renovação silenciosa real às 18:02:37 UTC, cerca de 59,5 s antes da expiração. Dez aberturas por tela: Home máximo **2.207 ms**, login **1.752 ms**, ambas <3 s.

A API foi acessada por USB; não certifica 4G+. Caminhada física, TalkBack integral e todos os estados visuais continuam pendentes. O ensaio de 24 h usou exclusivamente o AVD, sem interromper a conectividade pessoal do celular.

## Recuperação do ambiente da apresentação — 04/10/2026

O celular apresentou erro interno e falha de sincronização após a remoção do contêiner do PostgreSQL de QA. A API respondia em /health, mas /ready e a renovação da sessão falhavam. O volume disponível continha o esquema sem os dados recentes. A conta sintética foi restaurada com o mesmo UUID e os registros das evidências; um novo login reutilizou o cache/fila do celular. Login, upload da foto, envios JSON e pull retornaram HTTP 200, e o Perfil exibiu **Dados sincronizados**, sem erro. Cinco marcadores possuem cinco mutationIds distintos. [Provas desta recuperação](evidence/correcoes-sprint1-2026-10-04/physical-api34/recuperacao-apresentacao-2026-10-04/checks.json).

O contêiner de QA agora usa reinício unless-stopped; foi salvo um backup local privado do banco. O comando de espelhamento confere /ready, incluindo o banco. Cache/app não foram apagados ou reinstalados; o código da versão testada permaneceu igual. Essa recuperação do ambiente não aprova o ensaio inconclusivo de 24 horas nem as demais verificações pendentes.
