# Roteiro de aprovação Android — Sprint 1

Estado atual: preparado, **não executado**. Associar cada observação aos IDs `US-xxx.Cn` da [matriz](matriz-sprint-1.md); registrar defeito e repetir a regressão afetada após cada correção. Usar commits `fix(escopo): ...`, `test(escopo): ...` e `docs(qa): ...` após verificar cada mudança coerente.

## Preparação

Abrir `app` no Android Studio. Em Device Manager usar `Vitalis_Compact_API24` e `Vitalis_Pixel_API36`, com Google APIs. Primeiro resolver KVM/virtualização no host e espaço; não usar execução por software para aprovar desempenho. Confirmar boot com `adb shell getprop sys.boot_completed` e serviço de pacotes disponível.

Configurar `GOOGLE_MAPS_API_KEY` em `app/.env.local`, restrita ao pacote `com.vitalistrack.app` e certificado do APK; habilitar Maps SDK for Android. Configurar `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`. `ANDROID_QA=true` habilita HTTP apenas no manifest do build de QA; o script de QA define esse sinalizador. A configuração de produção mantém HTTP bloqueado.

Em um PostgreSQL descartável, usar **somente** `vitalis_qa`. Exemplo de ambiente local:

```bash
docker run --name vitalis-sprint1-qa -e POSTGRES_DB=vitalis_qa -e POSTGRES_USER=vitalis -e POSTGRES_PASSWORD=vitalis -p 127.0.0.1:55432:5432 -d postgres:18-alpine
DATABASE_URL=postgresql://vitalis:vitalis@localhost:55432/vitalis_qa NODE_ENV=test pnpm -C server db:deploy
DATABASE_URL=postgresql://vitalis:vitalis@localhost:55432/vitalis_qa NODE_ENV=test PUBLIC_BASE_URL=http://10.0.2.2:3000 pnpm -C server dev
```

Se o container `vitalis-sprint1-qa` já existir, usar `docker start vitalis-sprint1-qa` em vez de criar outro com o mesmo nome.

O servidor também precisa do `JWT_SECRET` de testes (pelo menos 32 caracteres). Não reutilizar dados/segredos de produção. O container usado na verificação automatizada desta entrega é descartável; recriá-lo se já tiver sido removido.

Gerar APKs com `bash scripts/build-android-qa.sh`. Instalar debug para diagnosticar; depois instalar o release de QA para executar a matriz e medições. Guardar hash SHA-256, versão, commit, certificado, data, AVD/API/resolução/densidade, tema, fonte, navegação e rede. APK release de QA não depende de Metro. O projeto Android gerado pelo Expo fica em `app/android` e não é versionado.

## Fluxos funcionais

| Cenário | Dados e esperado |
|---|---|
| Cadastro/login | E-mail inválido, senha curta, confirmação diferente e credenciais erradas devem falhar; cadastro válido deve abrir o resumo. Logout e deep link protegido devem abrir login. Campos iniciais vazios. |
| Sessão | JWT com duração curta no servidor de QA; voltar do segundo plano próximo da expiração; disparar várias operações; observar um refresh e renovação silenciosa. Interromper a rede/API durante refresh: sessão/cache preservados. Refresh revogado: acesso protegido encerrado. |
| Água | Atalhos 200 + 500 + 1.000 = 1.700 mL; meta 2.000 = 85%. Editar um registro, excluir outro e conferir Home/Água/barra/porcentagem. Zero, negativos e frações devem ser rejeitados quando a API exige inteiros. |
| Perfil | Selecionar e enviar foto, voltar e reiniciar; editar nome/nascimento/peso/altura/gênero; e-mail bloqueado; futuro/impossível/limites inválidos rejeitados; idade antes/no/depois do aniversário. Sem medidas, IMC indisponível. |
| Refeições | Criar 100,5 g e 250 mL, editar/excluir, escolher data/horário nativos. Meta 2.000 e duas refeições de 300/450 = saldo 1.250; limite por refeição 400 avisa para 450. Conferir recálculo e calendário. |
| Atividades | Caminhada/corrida/ciclismo; duração e distância com vírgula; editar/excluir; calorias por tipo/peso; rota preservada ao editar; calendário, sort por tipo/data; totais de 7/30 e tendência 7/7 incluindo zeros. |
| Peso | Peso 70/altura 175 → IMC ≈ 22,86 (normal); conferir limites de classificação nos testes. Meta e déficit persistem após reinício; previsão em semanas/sem previsão/meta atingida. Pesos em datas irregulares e múltiplos no mesmo dia; linha por data, barras/comparação lado a lado e “—” quando vazio. |
| Progresso | Registrar dados em hoje, 6, 7, 29 e 30 dias atrás; conferir inclusão de fronteiras de 1/7/30, dias sem registros e metas; editar/excluir e comparar app/API. |
| Offline e contas | Após sincronizar, modo avião; criar/editar/excluir nos quatro domínios; reiniciar; consultar cache. Login em conta B não mostra dados/fila de A. Retornar a A e reconectar: conferir propriedade, filas drenadas e nenhum duplicado. |

## Falhas, volume e duração

Executar API indisponível, timeout, perda da resposta após o servidor aplicar uma mutação, rede intermitente, refresh concorrente e mais de 100 mutações pendentes. Reenviar o mesmo mutationId deve manter um único registro. Durante pull, editar/excluir localmente e assegurar que a pendência prevalece até o push. Repetir sincronização após a finalização de cada CRUD online.

O teste de 24 horas com relógio controlado já passou. Para aprovação real: sincronizar T0, desconectar por 24 h, registrar ações em vários horários, reiniciar durante o período e continuar consultando; em T+24 h, reconectar e comparar registros/valores na API e no app. Registrar timestamps e contagens antes/depois.

O ensaio automatizado do servidor está em `server/scripts/qa-sprint1.ts` e só aceita `NODE_ENV=test`/banco `vitalis_qa`:

```bash
DATABASE_URL=postgresql://vitalis:vitalis@localhost:55432/vitalis_qa NODE_ENV=test pnpm -C server exec tsx scripts/qa-sprint1.ts
```

Esse comando sobrescreve `docs/qa/evidence/server-load.json` com a execução atual, cria e remove somente a conta do ensaio. São 900 mutações únicas + 100 replays concorrentes e 1.000 atividades para listagem/busca. Separar esse pico de uma medição de leituras/escritas normais por HTTP/rede real.

## GPS conhecido, permissões e lifecycle

Emulador conectado: `adb -s SERIAL emu geo fix LONGITUDE LATITUDE`. No Maestro, `setLocation` exige Android API 31+; usar API 36 para esse comando e controles do Android Studio/console em API 24.

1. Iniciar corrida e esperar GPS ativo; posição A: latitude −3,7319, longitude −38,5267.
2. Após receber A, mover a B: latitude −3,7309, mesma longitude. Segmento ≈ 111,19 m.
3. Pausar; anotar tempo/distância/rota. Mover durante a pausa para C: latitude −3,6319, mesma longitude. Tempo/distância devem permanecer inalterados.
4. Retomar em C; aguardar amostra inicial. Mover a D: latitude −3,6309, mesma longitude. Distância total esperada ≈ 222,39 m; deslocamento B→C excluído. Definir tolerância de até 5 m no emulador com localização controlada.
5. Conferir ritmo = minutos ativos / km; dois segmentos no mapa. Voltar/segundo plano pausa e preserva; reiniciar restaura ID/segundos/distância/rota pausados.
6. Finalizar e repetir a ação/retry após resposta perdida: exatamente um registro com o ID estável. Editar duração/distância preservando rota.
7. Repetir permissão negada, aproximação de localização, serviço GPS desligado, erro do provider e desmontagem/retomada. Conferir mensagem e ausência de assinatura/timer ativos fora do treino.

Não aprovar o mapa usando Expo Go: o Maps SDK precisa ser exercitado no APK próprio com a chave configurada.

## Material, capturas e desempenho

Executar todos os itens de [Material 3](material-3.md). Capturar Home, água/meta/erro, login/cadastro, perfil, refeições/calendário/limite, atividade manual/histórico/GPS/pausa, peso vazio/gráficos e progresso. Nomear capturas por API/tema/fonte/tela; vincular ao critério correspondente.

No APK release, realizar pelo menos dez aberturas frias após `adb shell am force-stop com.vitalistrack.app`; registrar `adb shell am start -W -n com.vitalistrack.app/.MainActivity` e gravação até a primeira tela utilizável. `TotalTime` sozinho não mede o tempo até a interface React estar pronta. Coletar `adb shell dumpsys meminfo com.vitalistrack.app` (PSS/RSS, pico e após ciclos de mapa/listas), logcat de crashes/ANRs e listagem/busca/rolagem com 1.000 atividades.

Metas: abertura < 3 s, RAM ≤ 50 MB, API ≤ 2 s em condições normais e falhas < 1%. Registrar p50/p95/máximo, número de amostras e condições; valores não medidos são “pendentes”. Os limites não atingidos podem permanecer como pendências conforme a escolha do usuário, sem serem declarados atendidos.

## Automação e aceite

`CI` executa typecheck/lint/build, testes e cobertura. `Android QA` gera APK release, inicia API de QA, usa KVM/API 36 e prepara upload de APK/resultado Maestro. Ambos os workflows precisam de execução remota para confirmar seu funcionamento. O smoke Maestro cobre cadastro, atalhos de água, modo avião, reinício/cache e logout; **não substitui os demais fluxos desta matriz**.

Após corrigir um defeito, executar seu reteste e regressão afetada; revisar staging e criar commit semântico. Somente aprovar os critérios funcionais/Material quando houver resultado Android correspondente. Guardar APK/hash, capturas, matriz preenchida, logs, cobertura e medições como um conjunto da mesma revisão.
