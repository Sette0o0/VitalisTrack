# Testes locais no Android — 03/10/2026

O APK release foi executado no emulador Android deste PC, com Android Studio aberto no projeto nativo. Os fluxos de autenticação, hidratação, cache offline, perfil, alimentação, atividade manual, peso, progresso e tema funcionaram nos cenários descritos abaixo. Foram reproduzidas duas falhas: área de toque insuficiente nos filtros de atividades e treino GPS que não inicia após a solicitação de permissão.

Esta execução complementa a matriz da Sprint 1. Não aprova os 89 critérios nem os cenários não exercitados.

## Ambiente e versão

- Revisão local: `7369a27cce86a83fb6bff911de87b6f30f4d47a9`.
- APK: `artifacts/android/github-37127933080/app-release.apk`, versão 1.0.0 (1), pacote `com.vitalistrack.app`, minSdk 24, targetSdk 36, x86_64.
- Origem: execução de CI 37127933080, commit `cf81ec540a53fc811d0f39c81b0e323b59ad8e5f`. `git diff` entre esse commit e HEAD não encontrou diferenças em `app`, `packages/contracts` ou `server`. O APK existente foi instalado; não houve nova compilação local.
- SHA-256: `8e77c498c563bca86d60f659adeb52dcb23d0b13653af936eb9e22d0476cd4d7`.
- Emulador 37.1.11, Android 16/API 36/Google APIs, KVM disponível, 2 CPUs, 2.560 MB de RAM, 1080 × 1920, 420 dpi, navegação por gestos. Renderização por software.
- AVD `Local_QA_API36`: cópia temporária da configuração existente, com dados em `/dev/shm`. Os AVDs de uso não foram utilizados para os testes. O boot inicial levou aproximadamente 152 segundos.
- Android Studio aberto em `app/android`; interações executadas por ADB, hierarquia UIAutomator e capturas do próprio emulador. Maestro não foi executado nesta sessão.
- API no host em `localhost:3000`, acessada pelo app em `10.0.2.2:3000`. PostgreSQL descartável `vitalis_qa` em `localhost:55432`, container `vitalis-android-qa-20261003`.
- Conta exclusiva de teste: `qa-local-20261003@example.com`, senha `qa-12345678`.

[Ambiente](evidence/android-local-2026-10-03/environment.json), [metadados do APK](evidence/android-local-2026-10-03/apk-metadata.txt) e [assinatura](evidence/android-local-2026-10-03/apk-signature.txt).

## Resultados funcionais

Cada captura PNG tem uma hierarquia XML de mesmo nome, exceto a reprodução do GPS sem UIAutomator.

| Cenário | Esperado e obtido | Resultado / evidência |
|---|---|---|
| Login vazio | Recusar envio e apresentar erro de e-mail. Campos inicialmente vazios. | Passou — [02](evidence/android-local-2026-10-03/02-login-invalido.png). |
| Cadastro | Preencher nome, e-mail, senha e confirmação, ocultando teclado entre campos; abrir resumo. | Passou — [04](evidence/android-local-2026-10-03/04-cadastro-preenchido.png), [05](evidence/android-local-2026-10-03/05-home.png). |
| Atalhos de água | 200 + 500 + 1.000 = 1.700 mL; meta 2.500 → 68%. | Passou — [06](evidence/android-local-2026-10-03/06-agua-online.png). |
| Escrita offline | Em modo avião, adicionar 200 mL e exibir 1.900 mL. | Passou — [07](evidence/android-local-2026-10-03/07-agua-offline.png). |
| Reinício offline | Forçar encerramento e abrir novamente em modo avião; restaurar sessão e os 1.900 mL do SQLite. | Passou — [08](evidence/android-local-2026-10-03/08-agua-offline-reinicio.png). |
| Reconexão | Enviar a pendência e conservar quatro IDs distintos, sem duplicação; total 1.900 mL na API. | Passou — [resposta da API](evidence/android-local-2026-10-03/water-api-after-reconnect.json). |
| Meta de água | Alterar para 2.000 mL e exibir 95% para consumo de 1.900 mL. | Passou — [30](evidence/android-local-2026-10-03/30-agua-meta.png). |
| Água zero | Manter o diálogo aberto com erro, sem criar registro. | Passou — [31](evidence/android-local-2026-10-03/31-agua-zero-invalido.png). |
| Editar/excluir água | Editar registro de 1.000 para 1.100 mL → total 2.000; confirmar exclusão → total 900 mL (45%). | Passou — [32](evidence/android-local-2026-10-03/32-agua-editada.png), [33](evidence/android-local-2026-10-03/33-confirmacao-exclusao.png), [34](evidence/android-local-2026-10-03/34-agua-excluida.png). |
| Perfil inicial | Informar ausência de nascimento/medidas e IMC indisponível. | Passou — [10](evidence/android-local-2026-10-03/10-perfil.png). |
| Perfil/nascimento | Calendário nativo, futuro desabilitado; nascimento 03/10/2000, idade 26; peso 70, altura 175, IMC 22,9 normal. E-mail desabilitado. | Passou — [11](evidence/android-local-2026-10-03/11-editar-perfil.png), [12](evidence/android-local-2026-10-03/12-calendario-nascimento.png), [14](evidence/android-local-2026-10-03/14-perfil-imc.png). |
| Refeição/horário | Seletor nativo de horário; criar “Almoco QA”, 100,5 g e 300 kcal; atualizar alimentação e Home. | Passou — [16](evidence/android-local-2026-10-03/16-horario-nativo.png), [17](evidence/android-local-2026-10-03/17-refeicao-preenchida.png), [18](evidence/android-local-2026-10-03/18-alimentacao.png). |
| Atividade manual | Corrida de 30,5 minutos e 5,2 km; resumo 30.5 min / 5.20 km / 310 kcal. | Passou — [19](evidence/android-local-2026-10-03/19-atividade-preenchida.png), [20](evidence/android-local-2026-10-03/20-atividades.png). |
| Peso/meta | Registrar 69,5 kg; IMC 22,7 normal; meta 65 kg/déficit 500 kcal; previsão 10 semanas; ponto e comparação semanal apresentados. | Passou — [22](evidence/android-local-2026-10-03/22-peso-registrado.png), [23](evidence/android-local-2026-10-03/23-meta-peso.png), [24](evidence/android-local-2026-10-03/24-peso-imc-evolucao.png). |
| Progresso | Alternar 1/7/30 dias, incluindo dias vazios. Água: 76% / 11% / 3%; calorias: 15% / 2% / 1%. | Passou para o conjunto criado — [25](evidence/android-local-2026-10-03/25-progresso-dia.png), [26](evidence/android-local-2026-10-03/26-progresso-semana.png), [27](evidence/android-local-2026-10-03/27-progresso-mes.png). |
| Tema | Alternar claro para escuro e aplicar a preferência ao Home; preservar após reinício. | Passou — [28](evidence/android-local-2026-10-03/28-tema-escuro.png), [29](evidence/android-local-2026-10-03/29-home-escuro.png). |
| Filtros por toque | Toda a área visual mínima de 48 dp deve selecionar o chip. Faixa inferior ignorou toque; centro respondeu. | **Reprovado — D-12**. |
| Permissão GPS | Negação mantém treino pausado. Após conceder e retomar, GPS deve iniciar e o tempo avançar. Permissões concedidas, localização ligada; três retomadas mantiveram 00:00:00 e 0.00 km. | **Reprovado — D-13**. |
| Sair do treino | Voltar exibe confirmação; “Salvar e sair” retorna às atividades. | Passou para treino pausado sem amostras GPS. |
| Logout/deep link | Sair abre login; `vitalistrack://water` sem sessão continua no login. | Passou — [45](evidence/android-local-2026-10-03/45-logout.png), [46](evidence/android-local-2026-10-03/46-deeplink-sem-sessao.png). |
| Senha errada/novo login | Senha errada apresenta “E-mail ou senha inválidos”; senha válida restaura resumo e dados. | Passou — [47](evidence/android-local-2026-10-03/47-login-senha-errada.png), [48](evidence/android-local-2026-10-03/48-login-valido-reinicio.png). |

[Respostas da API durante os testes](evidence/android-local-2026-10-03/api-functional.json) confirmam perfil, refeição e atividade manual. Foram seis leituras locais, HTTP 200, entre 4,23 e 31,50 ms; são amostras via loopback, sem ensaio de carga ou medição de latência de rede Android.

Uma [conferência final](evidence/android-local-2026-10-03/api-final.json) também passou: três consumos ativos e únicos somando 900 mL, meta de água 2.000 mL, peso atual/registro 69,5 kg, meta de peso 65 kg, refeição de 100,5 g e atividade manual de 1.830 segundos. O treino GPS sem tempo não criou uma atividade finalizada.

## Defeitos reproduzidos

### D-12 — filtro com área efetiva de toque de 32 dp

Em Atividades, selecionar o chip “Caminhada” pela faixa inferior de seu retângulo visual não altera a seleção. Tocar no centro seleciona normalmente. A hierarquia informou contêiner de 48 dp e elemento clicável de 32 dp: bounds `[537,1646][817,1772]` e `[540,1649][815,1733]`, respectivamente, com densidade 420 dpi. O toque `(677,1754)` ficou dentro da área visual e fora da área clicável; a seleção permaneceu falsa. O toque central mudou para verdadeira.

Evidências: [medidas e estados](evidence/android-local-2026-10-03/chip-touch-target.json), [borda ignorada](evidence/android-local-2026-10-03/36-chip-toque-borda.png), [centro selecionado](evidence/android-local-2026-10-03/37-chip-toque-centro.png). A aplicação configura `minHeight: 48` no contêiner do Chip em `app/app/activities/index.tsx:124`; isso não aumenta o TouchableRipple interno do Paper. Ajustar a área interativa e retestar todos os filtros, com TalkBack e fonte ampliada. Prioridade P2; D-09 permanece aberto quanto a esse requisito.

### D-13 — retomada de treino não inicia GPS

1. Abrir Registrar → Atividade → Corrida e negar localização.
2. Tocar “Retomar” e conceder localização precisa durante o uso.
3. Tocar “Retomar” novamente, com localização ligada e ambas as permissões concedidas.
4. Repetir a ação e injetar coordenadas pelo console do emulador.

Esperado: “GPS ativo”, avanço de tempo e coleta de pontos. Obtido: treino permanece pausado, tempo `00:00:00`, distância `0.00 km`, sem listener do app no provider. Foram três tentativas após a concessão, uma por coordenadas de toque e captura direta, sem UIAutomator entre o toque e a captura. Não houve crash.

Evidências: [permissão](evidence/android-local-2026-10-03/38-gps-permissao.png), [estado após concessão](evidence/android-local-2026-10-03/40-gps-apos-permissao.png), [nova tentativa](evidence/android-local-2026-10-03/40b-gps-retentativa.png), [reprodução sem UIAutomator](evidence/android-local-2026-10-03/40c-gps-sem-uiautomator.png), [permissões concedidas](evidence/android-local-2026-10-03/gps-package-permissions.txt), [provider habilitado/sem assinatura](evidence/android-local-2026-10-03/gps-location-service.txt), [atividades Android](evidence/android-local-2026-10-03/gps-activity-log.txt).

Provável causa, inferida do código e dos logs: o efeito sempre chama `requestForegroundPermissionsAsync` (`app/app/activities/workout.tsx:129`), e o Android inicia a atividade de solicitação de permissão em cada retomada. O listener de lifecycle pausa o treino ao sair do estado ativo (`:100`), cancelando a inicialização de GPS. Consultar a permissão existente antes de solicitar novamente e revisar a transição durante o diálogo; preservar a pausa ao sair efetivamente do app. Prioridade P1. A rota conhecida, exclusão de deslocamento na pausa, restauração e finalização de treino GPS não puderam ser aprovadas.

O aviso de mapa indisponível também foi observado. A chave do Maps SDK não está configurada no APK; mapa/polilinhas continuam como B-02, separadamente da falha de início do GPS.

## Verificações automatizadas e medições

- App/Jest: **99 testes, 15 suítes, todos passaram** — [log](evidence/android-local-2026-10-03/app-tests.txt).
- API/Vitest no banco de QA: **17 testes, 3 arquivos, todos passaram**. Cobertura: linhas/statements 79,31%, branches 70,55%, funções 90,24% — [log](evidence/android-local-2026-10-03/server-tests.txt).
- `pnpm typecheck` e `pnpm lint`: passaram — [typecheck](evidence/android-local-2026-10-03/typecheck.txt), [lint](evidence/android-local-2026-10-03/lint.txt).

As medições de dez aberturas frias, memória e estabilidade estão em [cold-starts.json](evidence/android-local-2026-10-03/cold-starts.json), [meminfo-home.txt](evidence/android-local-2026-10-03/meminfo-home.txt), [logcat-crash.txt](evidence/android-local-2026-10-03/logcat-crash.txt) e [activity-exit-info.txt](evidence/android-local-2026-10-03/activity-exit-info.txt). A confirmação de tela por hierarquia inclui o custo do UIAutomator; `TotalTime` mede a atividade nativa e não equivale ao tempo até a interface React utilizável. Renderização por software limita a comparação de desempenho com um aparelho físico.

| Medição | Resultado | Conclusão |
|---|---|---|
| Dez aberturas frias, `am start -W` | Mínimo 1.361 ms; mediana 1.466,5 ms; p95 por nearest rank/máximo 1.610 ms. | Tempo nativo abaixo de 3 s; tempo até UI utilizável continua sem medição direta. |
| Confirmação de “Seu resumo” por UIAutomator | Entre 4.725,8 e 5.041,9 ms após início do comando. | Limite superior com custo de inspeção incluído; não equivale ao instante do primeiro frame utilizável. |
| Memória após a décima abertura, Home autenticado | PSS 135.203 KiB ≈ **132,0 MiB**; RSS 249.680 KiB ≈ 243,8 MiB. | **Meta de RAM ≤ 50 MB não atendida nesta amostra.** Não foi medido pico nem ciclo prolongado. |
| Estabilidade observada | Buffer de crash vazio; exit-info contém somente FORCE STOP / USER REQUESTED correspondentes aos testes. | Nenhum crash/ANR registrado; amostra insuficiente para aprovar uma taxa de falha inferior a 1%. |
| Sessão e tema nas dez reaberturas | Todas chegaram ao resumo autenticado; tema escuro preservado. | Passou — [49](evidence/android-local-2026-10-03/49-home-final.png). |

## Limites e estado final

Não foram executados API 24, TalkBack completo, fonte/tamanho de exibição ampliados, três botões, upload de foto, troca entre duas contas, 24 horas reais offline, expiração/revogação de sessão no Android, falhas de rede com respostas perdidas, 1.000 atividades, comparação entre semanas com múltiplos pesos ou toda a matriz de datas de fronteira. O pedômetro real exige teste em aparelho. As falhas de GPS impediram os testes de rota, pausa com deslocamento e finalização única. Os testes unitários desses casos permanecem distintos da aprovação no aparelho.

As interrupções iniciais de automação por ação fora da tela e rótulo flutuante foram corrigidas no controle do teste, com rolagem e seleção do EditText; não foram classificadas como defeitos do app. Nenhum código funcional foi alterado nesta execução.

Android Studio, API de QA e emulador foram mantidos abertos para revisão. O app está autenticado na conta de QA. Os dados do AVD temporário dependem do armazenamento em memória; capturas e logs foram preservados nesta pasta de evidências. O banco de uso existente não recebeu as escritas destes testes.
