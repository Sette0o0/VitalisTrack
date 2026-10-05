# Matriz de aceitação — Sprint 1

Atualizada em 04/10/2026 após as [correções e retestes](correcoes-sprint-1-2026-10-04.md). Estado auditado preservado, base Git `c31a6b7`, com entrega organizada em commits locais, sem push; [hashes da versão final](evidence/correcoes-sprint1-2026-10-04/versao-final.json). A [auditoria de 03/10](auditoria-sprint-1-2026-10-03.md) permanece histórica.

**22 histórias, 89 critérios revisados: 89 atendidos no escopo funcional verificado, sem declarar aprovação integral Android/RNF. As duas falhas funcionais e os sete critérios antes parciais foram corrigidos/retestados. A sprint não tem aprovação integral.**

“Atendido no escopo verificado” identifica a evidência de implementação, automação e/ou Android indicada em cada linha. Não significa execução manual de todos os 89 critérios em ambos os aparelhos. “Parcial” mantém uma lacuna material de comprovação nativa. Não se reaproveitam capturas antigas para aprovar a release final.

## Evidências utilizadas

- **J**: [163 testes/24 suítes do app](evidence/correcoes-sprint1-2026-10-04/app-tests.txt), incluindo os quatro testes reprovados na auditoria; cobertura regular ampliada [92,13% de linhas](evidence/correcoes-sprint1-2026-10-04/app-coverage.json).
- **S**: [24 testes/4 arquivos da API](evidence/correcoes-sprint1-2026-10-04/server-tests.txt) com PostgreSQL de QA; cobertura [84,65%](evidence/correcoes-sprint1-2026-10-04/server-coverage.json).
- **X**: [14/14 verificações complementares](evidence/correcoes-sprint1-2026-10-04/api-confirmacao.json), incluindo paginação integral de 1.000 registros nas duas ordenações.
- **L**: [1.000 sincronizações, zero falhas, 900 registros após 100 replays](evidence/correcoes-sprint1-2026-10-04/server-load.json).
- **N24/N36**: [evidências da release final](evidence/correcoes-sprint1-2026-10-04/README.md), APK 1.0.0/SHA `451715f4…`; capturas da raiz, snapshots SQLite, confirmação no servidor e trace HTTP sem tokens. `iteration-*` são históricos de builds intermediários.
- **N34**: [celular Android 14 em pacote QA separado](evidence/correcoes-sprint1-2026-10-04/physical-api34/README.md), incluindo abertura real, foto persistente, nascimento futuro, hidratação e renovação silenciosa. Não substitui a matriz API 24/36 ou 4G+.
- **Código/Código nativo**: fontes indicadas em cada história, incluídas no manifesto final; revisão do módulo SecureStore instalado. Não há aprovação remota de CI desta revisão local.

## Condições transversais

- Proteção de `main`: excluída por decisão do usuário, sem alteração ou marcação como atendida.
- RAM ≤ 50 MB: adiada para outra sprint, sem otimização nesta entrega e sem marcação como atendida.
- Android: documentação alinhada à decisão API 24+, sem redução para API 23.
- Abertura, acessibilidade integral, rede 4G+ e 24 horas reais offline têm os limites/pendências registrados no [relatório atual](correcoes-sprint-1-2026-10-04.md). A matriz visual integral API 24/36 continua pendente. RNF3 permanece pendente: a tentativa 2 foi encerrada inconclusiva por lacuna de continuidade e atraso do relógio, conforme o [estado final](evidence/correcoes-sprint1-2026-10-04/offline-24h-final-status.json).

## US-001 — Registrar consumo de água

Implementação principal: [app/app/water/index.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/water/index.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-001.C1 | o usuário deve poder registrar rapidamente consumos de 200 mL, 500 mL e 1 L por meio de botões de atalho | Atendido no escopo verificado | **J, S, N24** — Atalhos 200/500/1.000 mL, valor personalizado 200 mL, rejeição de zero e soma diária verificados; schemas compartilhados e SQLite cobertos. |
| US-001.C2 | o usuário deve poder registrar um valor personalizado manualmente por meio de um campo numérico em mL | Atendido no escopo verificado | **J, S, N24** — Atalhos 200/500/1.000 mL, valor personalizado 200 mL, rejeição de zero e soma diária verificados; schemas compartilhados e SQLite cobertos. |
| US-001.C3 | o valor registrado deve ser maior que zero | Atendido no escopo verificado | **J, S, N24** — Atalhos 200/500/1.000 mL, valor personalizado 200 mL, rejeição de zero e soma diária verificados; schemas compartilhados e SQLite cobertos. |
| US-001.C4 | após o registro o consumo deve ser adicionado ao total diário | Atendido no escopo verificado | **J, S, N24** — Atalhos 200/500/1.000 mL, valor personalizado 200 mL, rejeição de zero e soma diária verificados; schemas compartilhados e SQLite cobertos. |

## US-002 — Exibir consumo diário no componente de hidratação

Implementação principal: [app/components/vitalis/hydration.tsx](/home/rafael/Documentos/github/VitalisTrack/app/components/vitalis/hydration.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-002.C1 | o usuário deve poder ver o consumo atual de água do dia | Atendido no escopo verificado | **J, Código, N24/N36** — HydrationSummary é compartilhado entre Home/Água e reage ao estado; 3.600/2.000 mL exibidos como 180% no API 24. |
| US-002.C2 | após novo registro, o total exibido deve ser atualizado | Atendido no escopo verificado | **J, Código, N24/N36** — HydrationSummary é compartilhado entre Home/Água e reage ao estado; 3.600/2.000 mL exibidos como 180% no API 24. |
| US-002.C3 | o componente deve ser reutilizado pela tela inicial da US-014, sem criar uma segunda tela inicial | Atendido no escopo verificado | **J, Código, N24/N36** — HydrationSummary é compartilhado entre Home/Água e reage ao estado; 3.600/2.000 mL exibidos como 180% no API 24. |

## US-003 — Criar meta diária de água

Implementação principal: [app/app/water/index.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/water/index.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-003.C1 | o usuário deve poder informar um valor de meta personalizado em mL | Atendido no escopo verificado | **J, S, N24** — Meta positiva inteira persiste por conta; edição para 2.000 mL e apresentação sem casas espúrias retestadas no Android mínimo. |
| US-003.C2 | o valor informado deve ser maior que zero | Atendido no escopo verificado | **J, S, N24** — Meta positiva inteira persiste por conta; edição para 2.000 mL e apresentação sem casas espúrias retestadas no Android mínimo. |
| US-003.C3 | a meta configurada deve ser registrada nas metas pessoais do usuário | Atendido no escopo verificado | **J, S, N24** — Meta positiva inteira persiste por conta; edição para 2.000 mL e apresentação sem casas espúrias retestadas no Android mínimo. |

## US-004 — Exibir progresso de meta de consumo de água

Implementação principal: [app/state/selectors.ts](/home/rafael/Documentos/github/VitalisTrack/app/state/selectors.ts). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-004.C1 | o progresso da meta diária deve ser exibido por meio de uma barra de progresso | Atendido no escopo verificado | **J, S, N24** — Barra/anel e porcentagem usam consumo/meta; criação, edição e exclusão recalculam o estado compartilhado. |
| US-004.C2 | o sistema deve exibir a porcentagem de consumo de água em relação à meta diária | Atendido no escopo verificado | **J, S, N24** — Barra/anel e porcentagem usam consumo/meta; criação, edição e exclusão recalculam o estado compartilhado. |
| US-004.C3 | a porcentagem deve ser calculada com base no consumo diário atual e na meta diária definida pelo usuário | Atendido no escopo verificado | **J, S, N24** — Barra/anel e porcentagem usam consumo/meta; criação, edição e exclusão recalculam o estado compartilhado. |
| US-004.C4 | após um novo registro, edição ou exclusão de consumo de água, o progresso exibido deve ser atualizado | Atendido no escopo verificado | **J, S, N24** — Barra/anel e porcentagem usam consumo/meta; criação, edição e exclusão recalculam o estado compartilhado. |

## US-005 — Editar e excluir consumo de água

Implementação principal: [app/app/water/index.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/water/index.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-005.C1 | o usuário deve poder editar a quantidade de água de um consumo já registrado | Atendido no escopo verificado | **J, S, N24** — Consumo personalizado editado 200→300 mL e excluído com confirmação; validação positiva e recálculo conferidos. |
| US-005.C2 | o valor editado deve ser maior que zero | Atendido no escopo verificado | **J, S, N24** — Consumo personalizado editado 200→300 mL e excluído com confirmação; validação positiva e recálculo conferidos. |
| US-005.C3 | o usuário deve poder excluir um registro de consumo de água | Atendido no escopo verificado | **J, S, N24** — Consumo personalizado editado 200→300 mL e excluído com confirmação; validação positiva e recálculo conferidos. |
| US-005.C4 | após a edição ou exclusão de um registro, o consumo diário e o progresso da meta devem ser atualizados | Atendido no escopo verificado | **J, S, N24** — Consumo personalizado editado 200→300 mL e excluído com confirmação; validação positiva e recálculo conferidos. |

## US-009 — Criar uma conta

Implementação principal: [app/app/(auth)/register.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/(auth)/register.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-009.C1 | o usuário deve poder informar um endereço de e-mail | Atendido no escopo verificado | **J, S, Código** — Campos de e-mail/senha/confirmação e correspondência validados na suíte atual; cadastro emite sessão e rotas protegidas abrem Home. |
| US-009.C2 | o usuário deve poder informar uma senha | Atendido no escopo verificado | **J, S, Código** — Campos de e-mail/senha/confirmação e correspondência validados na suíte atual; cadastro emite sessão e rotas protegidas abrem Home. |
| US-009.C3 | o usuário deve confirmar a senha informada | Atendido no escopo verificado | **J, S, Código** — Campos de e-mail/senha/confirmação e correspondência validados na suíte atual; cadastro emite sessão e rotas protegidas abrem Home. |
| US-009.C4 | o sistema deve validar o formato do endereço de e-mail | Atendido no escopo verificado | **J, S, Código** — Campos de e-mail/senha/confirmação e correspondência validados na suíte atual; cadastro emite sessão e rotas protegidas abrem Home. |
| US-009.C5 | a conta somente deve ser criada quando a senha e a confirmação de senha corresponderem | Atendido no escopo verificado | **J, S, Código** — Campos de e-mail/senha/confirmação e correspondência validados na suíte atual; cadastro emite sessão e rotas protegidas abrem Home. |

## US-010 — Entrar com e-mail e senha

Implementação principal: [app/app/(auth)/login.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/(auth)/login.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-010.C1 | o usuário deve poder informar seu endereço de e-mail | Atendido no escopo verificado | **J, S, Código** — Formulário vazio valida e-mail antes do envio; credenciais válidas/erradas e retorno à Home cobertos pelos testes da versão final. |
| US-010.C2 | o usuário deve poder informar sua senha | Atendido no escopo verificado | **J, S, Código** — Formulário vazio valida e-mail antes do envio; credenciais válidas/erradas e retorno à Home cobertos pelos testes da versão final. |
| US-010.C3 | o sistema deve validar o formato do endereço de e-mail antes de realizar o login | Atendido no escopo verificado | **J, S, Código** — Formulário vazio valida e-mail antes do envio; credenciais válidas/erradas e retorno à Home cobertos pelos testes da versão final. |
| US-010.C4 | o sistema deve permitir a autenticação utilizando as credenciais informadas | Atendido no escopo verificado | **J, S, Código** — Formulário vazio valida e-mail antes do envio; credenciais válidas/erradas e retorno à Home cobertos pelos testes da versão final. |

## US-012 — Manter a sessão autenticada com JWT

Implementação principal: [app/lib/session.ts](/home/rafael/Documentos/github/VitalisTrack/app/lib/session.ts). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-012.C1 | após o login, o servidor deve emitir um token JWT | Atendido no escopo verificado | **J, S, Código nativo** — JWT/Authorization cobertos; SecureStore utiliza AndroidKeyStore/AES no módulo instalado. Não foi feita inspeção forense de chaves. |
| US-012.C2 | o cliente deve armazenar o token em mecanismo protegido pelo Android, respaldado pelo Android Keystore | Atendido no escopo verificado | **J, S, Código nativo** — JWT/Authorization cobertos; SecureStore utiliza AndroidKeyStore/AES no módulo instalado. Não foi feita inspeção forense de chaves. |
| US-012.C3 | o token JWT deve ser enviado nas requisições que acessam recursos protegidos | Atendido no escopo verificado | **J, S, Código nativo** — JWT/Authorization cobertos; SecureStore utiliza AndroidKeyStore/AES no módulo instalado. Não foi feita inspeção forense de chaves. |

## US-013 — Renovar a sessão automaticamente

Implementação principal: [app/lib/use-session-refresh.ts](/home/rafael/Documentos/github/VitalisTrack/app/lib/use-session-refresh.ts). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-013.C1 | o sistema deve utilizar um refresh token para renovar a autenticação | Atendido no escopo verificado | **J, S, N36** — Refresh rotacionado no Keystore, single flight e falhas transitórias cobertos; renovação real às 13:52:11 UTC, 59,5 s antes de expirar, sem novo login no APK final. |
| US-013.C2 | o refresh token deve ser armazenado de forma segura | Atendido no escopo verificado | **J, S, N36** — Refresh rotacionado no Keystore, single flight e falhas transitórias cobertos; renovação real às 13:52:11 UTC, 59,5 s antes de expirar, sem novo login no APK final. |
| US-013.C3 | a renovação do token JWT deve ocorrer antes de sua expiração | Atendido no escopo verificado | **J, S, N36** — Refresh rotacionado no Keystore, single flight e falhas transitórias cobertos; renovação real às 13:52:11 UTC, 59,5 s antes de expirar, sem novo login no APK final. |
| US-013.C4 | a renovação deve ocorrer de forma silenciosa, sem exigir uma nova ação de login do usuário | Atendido no escopo verificado | **J, S, N36** — Refresh rotacionado no Keystore, single flight e falhas transitórias cobertos; renovação real às 13:52:11 UTC, 59,5 s antes de expirar, sem novo login no APK final. |

## US-014 — Visualizar resumo diário na tela inicial

Implementação principal: [app/app/(tabs)/index.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/(tabs)/index.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-014.C1 | após o login, o usuário deve ser redirecionado para a tela inicial | Atendido no escopo verificado | **J, S, N24/N36** — Home restaurada com resumo compartilhado de passos/calorias/água; pull REST e atualizações locais cobertos. Movimento físico do pedômetro não é certificado pelos dados de fixture. |
| US-014.C2 | a tela inicial deve exibir passos, calorias consumidas e água ingerida | Atendido no escopo verificado | **J, S, N24/N36** — Home restaurada com resumo compartilhado de passos/calorias/água; pull REST e atualizações locais cobertos. Movimento físico do pedômetro não é certificado pelos dados de fixture. |
| US-014.C3 | o resumo deve utilizar os dados obtidos do backend por API REST | Atendido no escopo verificado | **J, S, N24/N36** — Home restaurada com resumo compartilhado de passos/calorias/água; pull REST e atualizações locais cobertos. Movimento físico do pedômetro não é certificado pelos dados de fixture. |
| US-014.C4 | o resumo deve ser atualizado quando houver novos registros relacionados às métricas exibidas | Atendido no escopo verificado | **J, S, N24/N36** — Home restaurada com resumo compartilhado de passos/calorias/água; pull REST e atualizações locais cobertos. Movimento físico do pedômetro não é certificado pelos dados de fixture. |

## US-016 — Visualizar e editar perfil

Implementação principal: [app/app/profile/edit.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/profile/edit.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-016.C1 | o perfil deve permitir visualizar e editar foto, nome, data de nascimento, peso atual, altura e gênero | Atendido no escopo verificado | **J, S, X, N24/N36** — Foto selecionada offline, prévia/reinício e envio multipart idempotente; campos e e-mail bloqueado revistos. Nascimento civil, aniversário e fuso testados no formulário/PATCH/sync. |
| US-016.C2 | o e-mail não deve ser editável | Atendido no escopo verificado | **J, S, X, N24/N36** — Foto selecionada offline, prévia/reinício e envio multipart idempotente; campos e e-mail bloqueado revistos. Nascimento civil, aniversário e fuso testados no formulário/PATCH/sync. |
| US-016.C3 | os dados devem ser validados antes do envio | Atendido no escopo verificado | **J, S, X, N24/N36** — Foto selecionada offline, prévia/reinício e envio multipart idempotente; campos e e-mail bloqueado revistos. Nascimento civil, aniversário e fuso testados no formulário/PATCH/sync. |
| US-016.C4 | a idade deve ser calculada a partir da data de nascimento | Atendido no escopo verificado | **J, S, X, N24/N36** — Foto selecionada offline, prévia/reinício e envio multipart idempotente; campos e e-mail bloqueado revistos. Nascimento civil, aniversário e fuso testados no formulário/PATCH/sync. |
| US-016.C5 | a idade exibida deve ser atualizada automaticamente conforme a data atual | Atendido no escopo verificado | **J, S, X, N24/N36** — Foto selecionada offline, prévia/reinício e envio multipart idempotente; campos e e-mail bloqueado revistos. Nascimento civil, aniversário e fuso testados no formulário/PATCH/sync. |

## US-018 — Registrar e gerenciar refeições

Implementação principal: [app/app/meals/form.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/meals/form.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-018.C1 | o usuário deve poder informar nome do alimento, horário e quantidade | Atendido no escopo verificado | **J, S, N36** — Refeições 100,5 g e 250 mL criadas offline, editadas/excluídas; snapshot/fila atômicos, estatísticas e filtro inclusivo testados. |
| US-018.C2 | a quantidade deve poder ser registrada em gramas ou mililitros | Atendido no escopo verificado | **J, S, N36** — Refeições 100,5 g e 250 mL criadas offline, editadas/excluídas; snapshot/fila atômicos, estatísticas e filtro inclusivo testados. |
| US-018.C3 | as refeições devem ser armazenadas localmente | Atendido no escopo verificado | **J, S, N36** — Refeições 100,5 g e 250 mL criadas offline, editadas/excluídas; snapshot/fila atômicos, estatísticas e filtro inclusivo testados. |
| US-018.C4 | o usuário deve poder editar ou excluir registros de refeições | Atendido no escopo verificado | **J, S, N36** — Refeições 100,5 g e 250 mL criadas offline, editadas/excluídas; snapshot/fila atômicos, estatísticas e filtro inclusivo testados. |
| US-018.C5 | alterações e exclusões devem atualizar a interface e as estatísticas relacionadas | Atendido no escopo verificado | **J, S, N36** — Refeições 100,5 g e 250 mL criadas offline, editadas/excluídas; snapshot/fila atômicos, estatísticas e filtro inclusivo testados. |
| US-018.C6 | o usuário deve poder buscar refeições por uma data selecionada em calendário | Atendido no escopo verificado | **J, S, N36** — Refeições 100,5 g e 250 mL criadas offline, editadas/excluídas; snapshot/fila atômicos, estatísticas e filtro inclusivo testados. |

## US-019 — Sincronizar refeições com o servidor

Implementação principal: [app/state/app-state.tsx](/home/rafael/Documentos/github/VitalisTrack/app/state/app-state.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-019.C1 | refeições cadastradas offline devem ser sincronizadas quando houver conexão com a internet | Atendido no escopo verificado | **J, S, N36** — Avatar e CRUD de refeições enfileirados offline; reinício/reconexão drenam a fila ordenada, preservando IDs e tombstones. Falha/perda de resposta e retries também na suíte regular. |
| US-019.C2 | a sincronização deve utilizar uma fila de itens pendentes | Atendido no escopo verificado | **J, S, N36** — Avatar e CRUD de refeições enfileirados offline; reinício/reconexão drenam a fila ordenada, preservando IDs e tombstones. Falha/perda de resposta e retries também na suíte regular. |
| US-019.C3 | falhas de sincronização devem permitir novas tentativas | Atendido no escopo verificado | **J, S, N36** — Avatar e CRUD de refeições enfileirados offline; reinício/reconexão drenam a fila ordenada, preservando IDs e tombstones. Falha/perda de resposta e retries também na suíte regular. |

## US-022 — Acompanhar consumo e meta de calorias

Implementação principal: [app/app/(tabs)/meals.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/(tabs)/meals.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-022.C1 | o usuário deve poder definir uma meta diária de calorias | Atendido no escopo verificado | **J, S, X, N36** — Metas/limite persistem pela API; seletores somam e calculam saldo. Aviso acima de 400 kcal observado com refeição de 450 kcal; edição para 300 remove o excesso. |
| US-022.C2 | o sistema deve somar as calorias dos alimentos adicionados | Atendido no escopo verificado | **J, S, X, N36** — Metas/limite persistem pela API; seletores somam e calculam saldo. Aviso acima de 400 kcal observado com refeição de 450 kcal; edição para 300 remove o excesso. |
| US-022.C3 | o consumo deve ser comparado com a meta diária | Atendido no escopo verificado | **J, S, X, N36** — Metas/limite persistem pela API; seletores somam e calculam saldo. Aviso acima de 400 kcal observado com refeição de 450 kcal; edição para 300 remove o excesso. |
| US-022.C4 | o saldo de calorias restante deve ser calculado e atualizado em tempo real | Atendido no escopo verificado | **J, S, X, N36** — Metas/limite persistem pela API; seletores somam e calculam saldo. Aviso acima de 400 kcal observado com refeição de 450 kcal; edição para 300 remove o excesso. |
| US-022.C5 | o usuário deve poder definir um limite máximo de calorias por refeição | Atendido no escopo verificado | **J, S, X, N36** — Metas/limite persistem pela API; seletores somam e calculam saldo. Aviso acima de 400 kcal observado com refeição de 450 kcal; edição para 300 remove o excesso. |
| US-022.C6 | o sistema deve avisar quando o limite de uma refeição for excedido | Atendido no escopo verificado | **J, S, X, N36** — Metas/limite persistem pela API; seletores somam e calculam saldo. Aviso acima de 400 kcal observado com refeição de 450 kcal; edição para 300 remove o excesso. |

## US-029 — Registrar e gerenciar atividades físicas

Implementação principal: [app/app/activities/form.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/activities/form.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-029.C1 | o usuário deve poder registrar caminhada, corrida e ciclismo | Atendido no escopo verificado | **J, S, X, Código** — Caminhada/corrida/ciclismo, duração/distância, calorias por peso/MET e CRUD cobertos na versão final; formulário preserva ID/rota. |
| US-029.C2 | o registro deve permitir informar duração e distância percorrida | Atendido no escopo verificado | **J, S, X, Código** — Caminhada/corrida/ciclismo, duração/distância, calorias por peso/MET e CRUD cobertos na versão final; formulário preserva ID/rota. |
| US-029.C3 | o sistema deve calcular calorias gastas com base no peso e no tipo de atividade | Atendido no escopo verificado | **J, S, X, Código** — Caminhada/corrida/ciclismo, duração/distância, calorias por peso/MET e CRUD cobertos na versão final; formulário preserva ID/rota. |
| US-029.C4 | o usuário deve poder editar ou excluir atividades registradas | Atendido no escopo verificado | **J, S, X, Código** — Caminhada/corrida/ciclismo, duração/distância, calorias por peso/MET e CRUD cobertos na versão final; formulário preserva ID/rota. |
| US-029.C5 | adições, alterações e exclusões devem atualizar estatísticas e interface relacionadas | Atendido no escopo verificado | **J, S, X, Código** — Caminhada/corrida/ciclismo, duração/distância, calorias por peso/MET e CRUD cobertos na versão final; formulário preserva ID/rota. |

## US-030 — Rastrear atividade ao ar livre

Implementação principal: [app/app/activities/workout.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/activities/workout.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-030.C1 | o GPS deve coletar localização, rota e distância percorrida | Atendido no escopo verificado | **J, N36** — GPS nativo com posições simuladas: polilinha/tiles/créditos, pausa preservando 00:00:12/0,11 km, reinício restaurado e novo segmento/ritmo após retomada. Trajeto físico não foi percorrido. |
| US-030.C2 | o trajeto deve ser exibido em um mapa por meio de uma polilinha | Atendido no escopo verificado | **J, N36** — GPS nativo com posições simuladas: polilinha/tiles/créditos, pausa preservando 00:00:12/0,11 km, reinício restaurado e novo segmento/ritmo após retomada. Trajeto físico não foi percorrido. |
| US-030.C3 | o usuário deve poder pausar e retomar a atividade | Atendido no escopo verificado | **J, N36** — GPS nativo com posições simuladas: polilinha/tiles/créditos, pausa preservando 00:00:12/0,11 km, reinício restaurado e novo segmento/ritmo após retomada. Trajeto físico não foi percorrido. |
| US-030.C4 | durante a pausa, tempo, distância acumulada e dados já coletados devem ser preservados | Atendido no escopo verificado | **J, N36** — GPS nativo com posições simuladas: polilinha/tiles/créditos, pausa preservando 00:00:12/0,11 km, reinício restaurado e novo segmento/ritmo após retomada. Trajeto físico não foi percorrido. |
| US-030.C5 | para corridas, o sistema deve calcular o ritmo médio em minutos por quilômetro a partir de distância e tempo | Atendido no escopo verificado | **J, N36** — GPS nativo com posições simuladas: polilinha/tiles/créditos, pausa preservando 00:00:12/0,11 km, reinício restaurado e novo segmento/ritmo após retomada. Trajeto físico não foi percorrido. |

## US-031 — Consultar histórico e estatísticas de atividades

Implementação principal: [app/app/activities/index.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/activities/index.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-031.C1 | o histórico deve exibir data, tipo, duração, distância e calorias gastas | Atendido no escopo verificado | **J, S, X, N36** — 1.000 IDs únicos nas travessias data/tipo, filtros e limites; lista Android com 1.000 registros, ordenação/rolagem/edição. Comparação fixa 7/7, independente do filtro, usa indicador acessível compartilhado. |
| US-031.C2 | o usuário deve poder ordenar atividades por data ou tipo | Atendido no escopo verificado | **J, S, X, N36** — 1.000 IDs únicos nas travessias data/tipo, filtros e limites; lista Android com 1.000 registros, ordenação/rolagem/edição. Comparação fixa 7/7, independente do filtro, usa indicador acessível compartilhado. |
| US-031.C3 | o usuário deve poder buscar atividades por uma data selecionada em calendário | Atendido no escopo verificado | **J, S, X, N36** — 1.000 IDs únicos nas travessias data/tipo, filtros e limites; lista Android com 1.000 registros, ordenação/rolagem/edição. Comparação fixa 7/7, independente do filtro, usa indicador acessível compartilhado. |
| US-031.C4 | o sistema deve exibir totais semanais e mensais de calorias gastas e passos acumulados | Atendido no escopo verificado | **J, S, X, N36** — 1.000 IDs únicos nas travessias data/tipo, filtros e limites; lista Android com 1.000 registros, ordenação/rolagem/edição. Comparação fixa 7/7, independente do filtro, usa indicador acessível compartilhado. |
| US-031.C5 | o sistema deve comparar a média de passos dos últimos 7 dias com os 7 dias anteriores | Atendido no escopo verificado | **J, S, X, N36** — 1.000 IDs únicos nas travessias data/tipo, filtros e limites; lista Android com 1.000 registros, ordenação/rolagem/edição. Comparação fixa 7/7, independente do filtro, usa indicador acessível compartilhado. |
| US-031.C6 | a tendência de passos deve ser indicada visualmente por uma seta para cima ou para baixo | Atendido no escopo verificado | **J, S, X, N36** — 1.000 IDs únicos nas travessias data/tipo, filtros e limites; lista Android com 1.000 registros, ordenação/rolagem/edição. Comparação fixa 7/7, independente do filtro, usa indicador acessível compartilhado. |

## US-037 — Calcular IMC

Implementação principal: [app/lib/health.ts](/home/rafael/Documentos/github/VitalisTrack/app/lib/health.ts). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-037.C1 | o cálculo deve utilizar peso e altura | Atendido no escopo verificado | **J, S, Código, N36** — Cálculo kg/m² e quatro classificações cobertos; perfil com 175 cm/71,3 kg mostra IMC 23,3 normal, sem inventar valores ausentes. |
| US-037.C2 | o resultado deve ser classificado como abaixo do peso, normal, sobrepeso ou obesidade | Atendido no escopo verificado | **J, S, Código, N36** — Cálculo kg/m² e quatro classificações cobertos; perfil com 175 cm/71,3 kg mostra IMC 23,3 normal, sem inventar valores ausentes. |

## US-038 — Definir meta de peso e visualizar previsão

Implementação principal: [app/app/weight/index.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/weight/index.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-038.C1 | o usuário deve poder definir uma meta de peso | Atendido no escopo verificado | **J, S, X, Código, N36** — Meta vinculada à conta e déficit informado pelo usuário determinam a previsão em semanas; campos e resultado conferidos com fixture de 65 kg/500 kcal. |
| US-038.C2 | a meta deve ser persistida no perfil do usuário | Atendido no escopo verificado | **J, S, X, Código, N36** — Meta vinculada à conta e déficit informado pelo usuário determinam a previsão em semanas; campos e resultado conferidos com fixture de 65 kg/500 kcal. |
| US-038.C3 | a estimativa deve considerar a meta de peso e o déficit calórico diário atual | Atendido no escopo verificado | **J, S, X, Código, N36** — Meta vinculada à conta e déficit informado pelo usuário determinam a previsão em semanas; campos e resultado conferidos com fixture de 65 kg/500 kcal. |
| US-038.C4 | a previsão deve ser exibida em semanas | Atendido no escopo verificado | **J, S, X, Código, N36** — Meta vinculada à conta e déficit informado pelo usuário determinam a previsão em semanas; campos e resultado conferidos com fixture de 65 kg/500 kcal. |

## US-039 — Acompanhar evolução do peso

Implementação principal: [app/app/weight/index.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/weight/index.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-039.C1 | o sistema deve exibir um gráfico de linhas semanal com a evolução do peso | Atendido no escopo verificado | **J, S, X, N36** — Fixture com 14 datas: linha de sete pontos e barras/médias 71,0 kg anterior e 70,3 kg atual; ambas as semanas preenchidas e descrição acessível conferidas na release final. |
| US-039.C2 | o usuário deve poder comparar dados atuais com semanas anteriores | Atendido no escopo verificado | **J, S, X, N36** — Fixture com 14 datas: linha de sete pontos e barras/médias 71,0 kg anterior e 70,3 kg atual; ambas as semanas preenchidas e descrição acessível conferidas na release final. |
| US-039.C3 | a comparação deve poder ser exibida em gráfico de barras e valores lado a lado | Atendido no escopo verificado | **J, S, X, N36** — Fixture com 14 datas: linha de sete pontos e barras/médias 71,0 kg anterior e 70,3 kg atual; ambas as semanas preenchidas e descrição acessível conferidas na release final. |

## US-054 — Visualizar painel geral de progresso

Implementação principal: [app/app/(tabs)/progress.tsx](/home/rafael/Documentos/github/VitalisTrack/app/app/(tabs)/progress.tsx). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-054.C1 | o painel deve permitir visualização diária, semanal e mensal | Atendido no escopo verificado | **J, S, Código, N36** — Janelas Dia/Semana/Mês incluem dias vazios; indicadores/anéis expõem valores e tendência acessível. Checklist completo de todos os estados permanece em RNF5. |
| US-054.C2 | o progresso deve ser apresentado por indicadores visuais | Atendido no escopo verificado | **J, S, Código, N36** — Janelas Dia/Semana/Mês incluem dias vazios; indicadores/anéis expõem valores e tendência acessível. Checklist completo de todos os estados permanece em RNF5. |
| US-054.C3 | o painel deve utilizar anéis de progresso | Atendido no escopo verificado | **J, S, Código, N36** — Janelas Dia/Semana/Mês incluem dias vazios; indicadores/anéis expõem valores e tendência acessível. Checklist completo de todos os estados permanece em RNF5. |

## US-065 — Usar o aplicativo em modo offline

Implementação principal: [app/lib/local-database.ts](/home/rafael/Documentos/github/VitalisTrack/app/lib/local-database.ts). Critérios reproduzidos do [Backlog](/home/rafael/Documentos/github/VitalisTrack.wiki/Backlog.md).

| ID | Critério de aceite | Resultado | Evidência e constatação |
|---|---|---|---|
| US-065.C1 | o usuário deve poder visualizar registros previamente sincronizados | Atendido no escopo verificado | **J, S, N24/N36** — Cache/fila SQLite por conta e foto local preservados no reinício offline; operações novas aguardam reconexão e retry. Ensaio real de 24 h é uma pendência separada de RNF3. |
| US-065.C2 | novas entradas devem ser armazenadas localmente | Atendido no escopo verificado | **J, S, N24/N36** — Cache/fila SQLite por conta e foto local preservados no reinício offline; operações novas aguardam reconexão e retry. Ensaio real de 24 h é uma pendência separada de RNF3. |
| US-065.C3 | novas entradas devem permanecer em uma fila de sincronização | Atendido no escopo verificado | **J, S, N24/N36** — Cache/fila SQLite por conta e foto local preservados no reinício offline; operações novas aguardam reconexão e retry. Ensaio real de 24 h é uma pendência separada de RNF3. |
