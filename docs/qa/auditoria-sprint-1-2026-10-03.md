# Auditoria de aceitação — Sprint 1

> **Registro histórico.** Parecer e evidências atuais: [correções de 04/10/2026](correcoes-sprint-1-2026-10-04.md). A proteção de `main` está excluída e RAM foi adiada por decisão do usuário.

Data: 03/10/2026, horário de Brasília. **Resultado: a Sprint 1 não atende integralmente ao backlog e não pode ser considerada concluída.**

Foram conferidas as **22 histórias, os 89 critérios de aceite e os 10 requisitos globais de qualidade**. Dos critérios funcionais, **80 estão atendidos no escopo verificado, 7 têm comprovação parcial e 2 apresentam falhas reproduzidas**. Há outras falhas nos requisitos transversais; os 80 critérios não representam aprovação da definição de pronto das respectivas histórias.

A [matriz completa](matriz-sprint-1.md) reproduz cada critério da wiki e registra implementação, evidência e limitação. “Atendido no escopo verificado” significa comprovação por código, testes e/ou cenário Android identificado na linha. “Parcial” significa lacuna material de comprovação. “Não atendido” significa falha observada. Esses resultados não equivalem a uma porcentagem de conclusão da sprint.

## Escopo e versão

- Referências: [Sprint 1 em Home.md](/home/rafael/Documentos/github/VitalisTrack.wiki/Home.md), [critérios de aceite e definição de pronto](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md) e [requisitos](/home/rafael/Documentos/github/VitalisTrack.wiki/Requisitos.md).
- Código local: branch `main`, HEAD `c31a6b78382793c4e5b01a1417b318687a0f5db4`, incluindo alterações e arquivos não commitados que já existiam antes da auditoria. [Hashes da versão examinada](evidence/auditoria-sprint1-2026-10-03/versao-auditada.json).
- GitHub consultado: `main` remoto em `7369a27`; a [CI passou nesse commit](https://github.com/Sette0o0/VitalisTrack/actions/runs/37132893642). O [smoke Android passou em `2c74ebf`](https://github.com/Sette0o0/VitalisTrack/actions/runs/37130130924). Nenhuma dessas execuções certifica todo o estado local atual. [Snapshot consultado](evidence/auditoria-sprint1-2026-10-03/github.json) e [etapas do smoke](evidence/auditoria-sprint1-2026-10-03/github-android-smoke.json).
- Ambiente de testes: Node 24, pnpm 11, PostgreSQL exclusivo `vitalis_qa`; API exercitada por Fastify inject e HTTP local. Contas, registros e imagem temporários dos ensaios foram removidos pelos scripts.
- Evidência nativa reaproveitada: APKs anteriores em API 36 e relatos posteriores no POCO/API 34. Nesta auditoria, o aparelho conectado foi consultado apenas para metadados e uma amostra de memória; não foram alterados seus dados pessoais nem executada uma nova matriz completa nele.

A auditoria criou documentos, evidências e testes de diagnóstico em `docs/qa/`. Não alterou a implementação do app/API, a wiki, a proteção da branch ou os commits existentes. Não houve commit nem push.

## Falhas confirmadas

### F-01 — Paginação de atividades omite e repete registros — RNF6

**Prioridade alta.** Com 1.000 atividades na mesma conta e páginas de 100 itens, percorrer todas as páginas retornou:

| Ordenação | Páginas | Itens retornados | IDs únicos | Problema |
|---|---:|---:|---:|---|
| Data | 10 | 999 | 999 | 1 registro omitido |
| Tipo | 9 | 807 | 781 | 219 registros omitidos e 26 repetições |

O resultado foi reproduzido em uma segunda conta independente. [Primeiro ensaio](evidence/auditoria-sprint1-2026-10-03/api-complementar.json), [confirmação com quantidade semeada explícita](evidence/auditoria-sprint1-2026-10-03/api-confirmacao.json) e [script](evidence/auditoria-sprint1-2026-10-03/api-confirmacao.mts).

A [consulta de atividades](/home/rafael/Documentos/github/VitalisTrack/server/src/routes/activities.ts:54) ordena por data/criação ou tipo/data, mas usa cursor por ID sem incluir um desempate único na ordenação. Isso é consistente com a paginação instável observada. A correção deve assegurar uma ordem total e testar que a travessia retorna exatamente os 1.000 IDs uma única vez nas duas ordenações.

O app atual carrega atividades pelo sincronismo e filtra uma `FlatList` local; este ensaio comprova o defeito do endpoint paginado. Não foi demonstrada perda desses mesmos itens na lista Android, cujo desempenho com 1.000 atividades ainda precisa de reteste.

### F-02 — Troca de foto não é preservada offline — RNF3 / US-016

**Prioridade alta.** O [uploadAvatar](/home/rafael/Documentos/github/VitalisTrack/app/state/app-state.tsx:409) exige resposta do POST antes de atualizar o perfil. A foto não é copiada para persistência própria nem inserida em uma fila de envio. Ao simular falta de rede no provedor, o teste recebeu rejeição `Offline` em vez de salvar a alteração localmente. [Teste](evidence/auditoria-sprint1-2026-10-03/offline-criterios.test.tsx) e [resultado](evidence/auditoria-sprint1-2026-10-03/offline-criterios.txt).

A API recebeu e serviu a imagem PNG no ensaio online; isso não cobre edição offline nem comprova a seleção/renderização pelo APK. A correção precisa persistir arquivo e operação por conta, exibir o estado local e sincronizar depois da reconexão sem perder a foto em um reinício.

### F-03 — Nascimento futuro é enviado apesar do erro visível — US-016.C3

**Prioridade média.** No horário controlado de **03/10/2026 às 21h30 em Brasília**, digitar **04/10/2026** mostrou “Nascimento não pode estar no futuro.”. Pressionar “Salvar perfil” mesmo assim despachou `PROFILE` com essa data. [Teste reproduzível](evidence/auditoria-sprint1-2026-10-03/nascimento-criterios.test.tsx) e [falha](evidence/auditoria-sprint1-2026-10-03/nascimento-criterios.txt).

O campo compara o dia local, enquanto o [schema compartilhado](/home/rafael/Documentos/github/VitalisTrack/packages/contracts/src/index.ts:55) compara `toISOString()`, que nessa hora já representa o dia seguinte em UTC. O [salvamento](/home/rafael/Documentos/github/VitalisTrack/app/app/profile/edit.tsx:57) não bloqueia pelo erro do campo. É necessário unificar a regra de data e impedir envio de valor inválido. O teste comprova envio pelo formulário; não foi feita essa alteração na conta pessoal do aparelho.

### F-04 — Falta seta de tendência de passos — US-031.C6

**Prioridade média.** O backlog exige seta indicando aumento ou queda em relação à semana anterior. O [Progresso](/home/rafael/Documentos/github/VitalisTrack/app/app/(tabs)/progress.tsx:87) exibe o texto “Em crescimento”/“Em queda”, mas não apresenta a seta; a tela de atividades também não a apresenta.

Os dois testes adicionais renderizaram cenários de aumento e queda. O texto apareceu, mas a verificação do indicador visual exigido falhou em ambos. [Teste](evidence/auditoria-sprint1-2026-10-03/ui-criterios.test.tsx) e [resultado](evidence/auditoria-sprint1-2026-10-03/ui-criterios.txt). Incluir a seta correspondente ao sinal da comparação e verificar sua descrição acessível fecha esse critério.

### F-05 — Proteção de `main` não está atendida — RNF4

**Prioridade alta para integração.** A resposta do GitHub informa `protected: false`, proteção desabilitada e checks obrigatórios desligados. A lista de reviews formais do PR #1 está vazia; isso significa ausência de registro de review nessa API, não prova que nunca houve revisão por outro meio. Existe também commit local com mensagem `patch 1`, fora do padrão semântico exigido. [Evidência remota](evidence/auditoria-sprint1-2026-10-03/github.json).

A entrega precisa demonstrar revisão antes da integração, proteção da branch e commits semânticos. Nenhuma configuração remota foi modificada nesta checagem.

### F-06 — Amostras de RAM excedem 50 MB — RNF2

O [ensaio anterior em release/API 36](testes-android-local-2026-10-03.md) mediu **135.203 KiB de PSS, aproximadamente 132 MiB**, na Home autenticada. A amostra atual do app **debug/API 34** mediu **398.564 KiB, aproximadamente 389 MiB**. [Amostra atual](evidence/auditoria-sprint1-2026-10-03/memoria-debug-amostra.txt) e [metadados do APK](evidence/auditoria-sprint1-2026-10-03/aparelho-build.txt).

Ambas excedem o limite escrito. A amostra debug não é comparação válida de desempenho com release; nenhuma delas mede todo o roteiro de um minuto exigido. Não há base para aprovar RAM na versão atual. É necessário medir uma release correspondente aos hashes auditados, durante o roteiro completo, e resolver o consumo ou formalizar uma mudança do requisito.

### F-07 — Divergência de compatibilidade Android — RNF9

A wiki exige **API 23**. O APK consultado declara **minSdk 24 / targetSdk 36**, portanto não instala em API 23. O [relatório anterior](relatorio-sprint-1.md) registra que o usuário aceitou API 24+; essa exceção histórica foi respeitada, mas a wiki ainda contém o requisito antigo.

Mesmo considerando a exceção API 24+, não existe comprovação completa dos fluxos no Android mínimo. Há evidências em API 34 e 36. É necessário alinhar a documentação ao escopo aprovado e executar a matriz em API 24; a auditoria não propõe desfazer a escolha de plataforma.

## Verificações executadas agora

| Verificação | Resultado | Evidência |
|---|---|---|
| Suíte regular do app | 142 testes / 21 suítes passaram | [Log](evidence/auditoria-sprint1-2026-10-03/app-tests.txt) |
| Suíte regular da API com PostgreSQL | 17 testes / 3 arquivos passaram | [Log](evidence/auditoria-sprint1-2026-10-03/server-tests.txt) |
| Typecheck do workspace | Passou | [Log](evidence/auditoria-sprint1-2026-10-03/typecheck.txt) |
| Lint do app e API | Passou | [Log](evidence/auditoria-sprint1-2026-10-03/lint.txt) |
| Build de contratos e API | Passou; este comando não compila uma nova release Android | [Log](evidence/auditoria-sprint1-2026-10-03/build.txt) |
| Interface: meta/limite de calorias e aviso | 2 testes adicionais passaram | [Log](evidence/auditoria-sprint1-2026-10-03/ui-criterios.txt) |
| Interface: setas de aumento/queda | 2 testes adicionais reprovaram | [Log](evidence/auditoria-sprint1-2026-10-03/ui-criterios.txt) |
| Provedor: foto offline | 1 teste adicional reprovou | [Log](evidence/auditoria-sprint1-2026-10-03/offline-criterios.txt) |
| Perfil: nascimento futuro após 21h | 1 teste adicional reprovou | [Log](evidence/auditoria-sprint1-2026-10-03/nascimento-criterios.txt) |
| API complementar | 12 de 14 verificações passaram; paginação por data/tipo reprovou, inclusive na confirmação | [JSON](evidence/auditoria-sprint1-2026-10-03/api-confirmacao.json) |
| Carga de sincronização | 0 falhas / 1.000 operações concorrentes; 900 registros únicos após 100 replays | [JSON](evidence/auditoria-sprint1-2026-10-03/server-load.json) |
| Leitura/escrita HTTP local | 25 respostas bem-sucedidas por execução; máximo 43,39 ms no primeiro ensaio e 35,67 ms na confirmação | [Primeiro](evidence/auditoria-sprint1-2026-10-03/api-complementar.json), [confirmação](evidence/auditoria-sprint1-2026-10-03/api-confirmacao.json) |

**Os 159 testes regulares passaram, mas não cobriam as falhas encontradas pelos novos cenários de aceite.** Os testes adicionais estão arquivados com as evidências e não foram incorporados à suíte regular nem usados para corrigir o produto nesta tarefa. Configurações e comandos estão no [índice de evidências](evidence/auditoria-sprint1-2026-10-03/README.md).

## Requisitos globais de qualidade

| Requisito | Parecer | Evidência e limite |
|---|---|---|
| RNF1 — abertura a frio < 3 s | Pendente de comprovação completa | Release anterior: atividade nativa 1.361–1.610 ms. Isso não mede a interface React utilizável; confirmação por UIAutomator levou cerca de 4,7–5,0 s e inclui overhead. Falta medição adequada da versão atual no aparelho mínimo. |
| RNF2 — RAM ≤ 50 MB durante 1 min na Home | Não atendido nas amostras disponíveis | Release anterior ≈132 MiB; debug atual ≈389 MiB. Falta roteiro completo em release atual. |
| RNF3 — 24 h offline e reconexão | Não atendido integralmente | Água/GPS têm ensaios nativos e fila tem testes de persistência/retry; foto offline falhou. Falta ensaio real de 24 h, incluindo refeições e todas as operações aplicáveis. |
| RNF4 — Git, commits semânticos, revisão e `main` protegida | Não atendido | Proteção remota desabilitada; revisão formal não registrada no PR consultado; mensagem `patch 1`. |
| RNF5 — Material e acessibilidade Android | Parcial | Paper/MD3, contraste e filtros de 48 dp em fonte 100%/150% têm evidência. [Checklist](material-3.md) ainda não aprova todas as telas, estados e TalkBack. |
| RNF6 — listagem/busca com 1.000 atividades | Não atendido | Primeira página 18 ms e busca 9 ms; travessia completa omitiu/repetiu IDs. Falta também medir rolagem/busca na lista Android com os 1.000 itens. |
| RNF7 — menos de 10 falhas / 1.000 operações concorrentes | Atendido no ensaio de servidor | 0/1.000 falhas e idempotência preservada. Fastify inject + PostgreSQL local; não é teste de estresse do APK. |
| RNF8 — todas as requisições ≤ 2 s em rede estável 4G+ | Pendente nessa condição | HTTP loopback passou nas amostras; carga de 1.000 teve p95 3.430 ms e máximo 3.452 ms. Carga extrema não equivale à condição normal de rede, e loopback não substitui 4G. |
| RNF9 — todos os fluxos desde API 23 | Divergente da wiki; exceção API 24+ relatada | minSdk 24 impede API 23. Mesmo com a exceção, falta matriz completa no mínimo API 24. |
| RNF10 — ≥ 70% de linhas de lógica de negócio | Atendido no escopo instrumentado | App ampliado 89,45% (628/702 linhas); API 79,31% (1.089/1.373). Os denominadores e arquivos estão nos JSON de cobertura. |

Cobertura: a configuração regular do app mede uma lista fixa de bibliotecas/estado e registrou 89,16%. Foi executada também cobertura ampliada para todas as bibliotecas `lib/**/*.ts`, estado e `use-submit`, incluindo formatação/filtro de datas e outras bibliotecas recentes, obtendo **89,45%**. A CI deve acompanhar esses arquivos novos; nesta auditoria eles não derrubaram o limite de 70%. Telas e módulos nativos não são certificados pelo percentual. Schemas compartilhados são exercitados pelos testes dos consumidores; não há relatório separado de cobertura do pacote de contratos. [App ampliado](evidence/auditoria-sprint1-2026-10-03/app-coverage-completa.json), [API](evidence/auditoria-sprint1-2026-10-03/server-coverage.json).

## Critérios com comprovação parcial

| Critério | Reteste que falta |
|---|---|
| US-013.C3/C4 — renovação antecipada e silenciosa | Executar o ciclo real de expiração/renovação no APK, incluindo interrupção e retorno de rede. Testes unitários de concorrência/refresh passaram. |
| US-016.C1 — foto e dados do perfil | Selecionar, alterar e conferir a foto renderizada no APK, incluindo reinício. Upload online da API passou; offline possui a falha F-02. |
| US-019.C1 — refeição offline até reconexão | Criar/editar/excluir refeições sem rede no APK, reiniciar, reconectar e conferir dados/ausência de duplicação. Automação com ponte SQLite e API passou. |
| US-039.C1/C2/C3 — gráficos e comparação de peso | Preencher várias datas nas duas semanas e conferir gráfico, médias e barras no APK. API/lógica passaram; captura anterior tem só um ponto e semana anterior vazia. |

Também devem integrar a regressão nativa final: criação de água com valor personalizado positivo, edição/exclusão de refeições e atividades, aviso de calorias, passos por movimento e virada de data, tamanhos de fonte e leitura TalkBack. Para esses caminhos há implementação/testes ou evidências parciais de componentes; eles não foram todos repetidos nesta auditoria em uma única release atual.

## Como fechar a sprint

1. Corrigir a paginação, persistência offline da foto, validação de nascimento e setas. Transformar os cenários reproduzidos em regressões da suíte regular.
2. Registrar revisão e aplicar proteção/controles na branch principal. Integrar a versão final com commits semânticos para que os testes remotos correspondam ao código entregue.
3. Alinhar o requisito Android à exceção API 24+ já relatada e resolver a meta de RAM com medição de release atual ou alteração formal do requisito.
4. Gerar uma release identificada por commit/hash e executar os retestes pendentes, os 89 critérios e o checklist de acessibilidade em API mínima e versão mais recente suportada. Medir abertura utilizável, RAM por um minuto e HTTP em 4G estável.
5. Executar o ensaio real de 24 h offline com reinício/reconexão, conferir os registros no servidor e atualizar a matriz com evidências da mesma release.

## Atualização das evidências históricas

O [relatório anterior](relatorio-sprint-1.md) conserva resultados de uma etapa anterior, incluindo smoke inicialmente falho e dependência de Google Maps. O smoke posterior passou e o [reteste MapLibre/OSM](reteste-filtros-openstreetmap-2026-10-03.md) comprovou mapa/rota, pausa, restauração e finalização offline. Chave Google não é pendência da implementação atual. Esses resultados foram considerados sem estender uma aprovação antiga para os novos arquivos locais.

O [reteste de formato/biometria](reteste-formato-br-biometria-2026-10-03.md) e o [reteste de períodos/nascimento](reteste-periodos-nascimento-2026-10-03.md) documentam melhorias posteriores. Biometria não acrescenta uma história ao recorte de 22 definido para esta sprint. A nova falha de fuso horário é um caso adicional ao preenchimento normal do nascimento já relatado.
