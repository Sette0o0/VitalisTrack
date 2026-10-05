# Continuação autorizada do ensaio real de 24 h

**Estado final da tentativa 2: inconclusiva e encerrada em 04/10 às 21:29:19 Brasília.** Não executar as etapas deste ensaio como continuação válida. [Estado final](offline-24h-final-status.json) e [evidência da lacuna](offline-24h-interruption-checks.json). Uma nova tentativa precisa de nova janela real de 24 h.

Escopo: somente AVD **VitalisFixAPI24/emulator-5556**, app com.vitalistrack.app,
conta sprint1-api24-20261004@example.com, usuário
5a4a15b1-9b93-4d92-a386-a5be1f1b86d0. Não operar outros aparelhos/contas.

Diretório: `/home/rafael/Documentos/github/VitalisTrack/docs/qa/evidence/correcoes-sprint1-2026-10-04`.
`offline-24h.json` é a autoridade para T0, notBefore, bootId, APK, ações e etapas.
APK 451715f40e3e7408096f08523fc1cd6b0cfccad474b8879e8cf93b39c1b8a221.
Não alterar código/APK, relógio, proteções de main ou memória durante o ensaio.

O coletor `offline-continuity.py` registra a cada 60 s. Antes de cada ação, exigir
status in_progress, última amostra <=120 s, nenhuma amostra passed=false,
nenhum intervalo >120 s, bootId original, relógio real, modo avião=1,
Active default network:none, nome de AVD e SHA do APK instalado corretos.
Android 7 não tem sha256sum: puxar apenas o base.apk desse app para /tmp e
calcular SHA local. A primeira amostra foi coletada menos de 60 s após T0.
Se faltar continuidade ou ambiente, registrar inconclusivo, parar o ensaio e
informar o usuário; nunca reconstituir amostras nem presumir que passou.

## Etapas

Registrar cada etapa uma única vez em stages, com data real, ações e snapshot.
Executar a etapa aplicável ao tempo decorrido, mantendo rede desligada.

- T+6 h: reiniciar somente o app (force-stop/start); conferir cache/nome/foto.
  Adicionar 200 mL na hidratação da conta de QA e obter snapshot SQLite.
- T+12 h: editar a refeição identificada por **fixtureMealName** no manifesto de 300 para 350 kcal; novo peso 69,3 kg;
  reiniciar app e obter snapshot, conferindo conservação das seis operações T0.
- T+18 h: conferir cache/foto/fila sem rede; snapshot e captura atual.
- T+24 h ou depois: antes de reconectar, conferir todas as operações, valores e
  referências da foto; cache deve restaurar após novo reinício. Somente depois de
  `notBefore`, registrar início do reteste e parar o coletor mudando status para
  reconnecting. Relógio não deve ser avançado.

Operar via `android_ui.py`, com QA_SERIAL=emulator-5556. Formulários usam rótulos
acessíveis: `Quantidade em mL`, `Calorias (kcal)`, `Peso atual (kg)`.
`database.py ETAPA` lê somente kv/outbox/workout e reinicia o app; não lê SecureStore.
Dialogs têm botões duplicados no fundo: usar tap_in_card no diálogo. O ADB Back
pode fechar dialog se teclado já estiver oculto; observar UI atual e reabrir o
formulário se a automação o fechou, sem registrar uma ação não salva.

## Reconexão e aceite

API 24: `settings put global airplane_mode_on 0`; broadcast
`android.intent.action.AIRPLANE_MODE --ez state false`; `svc data enable` e
`svc wifi enable`. Esperar conexão, renovação da sessão expirada e sincronização
sem novo login. A API QA deve estar ativa em 3011 e o banco em 55432.

Conferir perfil, foto local e fila vazia no SQLite; consultar o banco **vitalis_qa**
com NODE_ENV=test. `native-data.mts` obtém dados das contas sintéticas sem tokens.
Comparar os mutationIds de T0/etapas com ProcessedMutation: exatamente um por
operação. Comparar os IDs/valores finais de água, atividade, refeição e peso com
os snapshots, incluindo mudanças sequenciais; a refeição deve estar em 350 kcal
se a etapa 12 foi realizada. Nenhum ID duplicado. Não comparar somente o total
diário de água: o dia civil mudou. Conferir avatar servido e cache local, e
repetir reconexão/reinício para provar que não cria duplicatas.

No aceite, salvar snapshots antes/depois, métricas de continuidade e consultas,
marcar completed e atualizar RNF3 em relatório/matriz/índice. Se faltar prova,
manter pendente/inconclusivo e descrever a lacuna. As verificações 4G+, TalkBack
integral e matriz visual integral continuam pendentes, mesmo se RNF3 passar.

Ao encerrar/interromper, esperar o coletor terminar (ou encerrar somente o PID deste coletor), liberando seu bloqueio temporário de suspensão. Parar somente o AVD VitalisFixAPI24 deste ensaio. Remover ou pausar o heartbeat de continuação ao concluir/interromper, usando
seu automationId do manifesto. Sem mensagens enquanto estado inalterado;
notificar somente conclusão, falha ou necessidade de intervenção do usuário.
