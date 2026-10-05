# Reteste Android — filtros e OpenStreetMap — 03/10/2026

As duas alterações solicitadas foram implementadas e verificadas no APK Android: os filtros possuem área clicável real de 48 dp e o mapa usa MapLibre/OpenStreetMap sem chave do Google Maps. Também foi corrigida a solicitação repetida de permissão que impedia retomar o GPS. Este reteste cobre esses fluxos em API 36; a matriz completa, TalkBack, API 24 e outras plataformas continuam pendentes.

## Versão e ambiente

- Código: `70156c947f41d698378438ae71b9404314a99db0` (`patch 1`).
- APK release de QA gerado localmente: `artifacts/android/openstreetmap/vitalis-osm-api36-release.apk`; SHA-256 `66a654aea7136cf1b3c7622e5757d009bcb8bc4098882ee38df5bb0d50a0299f`.
- Pacote `com.vitalistrack.app`, versão `1.0.0`/1, minSdk 24, targetSdk 36. Assinatura Android Debug verificada; APK instalado e executado.
- AVD descartável `Local_OSM_QA_API36`, Android 16/API 36, x86_64, 1080 × 1920, 420 dpi, KVM, GPU por software, 2 GB RAM, navegação por gestos, tema claro.
- Android Studio aberto com `app/android`. API `http://10.0.2.2:3000`, PostgreSQL descartável `vitalis_qa` no container `vitalis-android-qa-20261003`; conta `qa-local-20261003@example.com`.
- A compilação instalou NDK/CMake e pressionou o espaço do ambiente anterior. Após a interrupção/reinício, o APK já estava gerado e o host tinha espaço suficiente. Os logs temporários anteriores não sobreviveram; a validação foi feita no APK com o hash acima.
- O primeiro boot do AVD apresentou um aviso de ANR do **System UI**, dispensado com “Wait”. O app passou a funcionar; o trecho de logs dos retestes e os motivos de saída não registraram crash/ANR do VitalisTrack. Isso não constitui aprovação de desempenho.

[Metadados](evidence/android-osm-2026-10-03/build-device-metadata.json), [hash do APK](evidence/android-osm-2026-10-03/apk-sha256.txt), [checagens de runtime](evidence/android-osm-2026-10-03/runtime-checks.json) e [motivos de saída](evidence/android-osm-2026-10-03/exit-info.txt).

## Resultados

| Cenário | Passos e resultado | Evidência |
|---|---|---|
| D-12: alvo dos filtros | Tocar 8 px acima da borda inferior de Corrida, Caminhada, Ciclismo e Todas. Os quatro selecionaram corretamente; cada área clicável mede 126 px = **48 dp**. | [Bounds, coordenadas e estados](evidence/android-osm-2026-10-03/filter-touch-targets.json), [fonte normal](evidence/android-osm-2026-10-03/02-filtros-fonte-normal.png). |
| Filtros com fonte 150% | Reiniciar o processo após aplicar `font_scale=1.5`, confirmar configuração Android e textos maiores; repetir os quatro toques inferiores. Todos passaram, com 48 dp e rótulos acomodados em linhas. Fonte normal restaurada no final. | [Fonte ampliada](evidence/android-osm-2026-10-03/03-filtros-fonte-150.png), JSON dos alvos acima. |
| Mapa sem chave | Abrir treino no APK próprio: tiles HTTPS carregaram, créditos © OpenStreetMap contributors permaneceram visíveis, rota e marcadores inicial/atual foram desenhados. | [Mapa e rota](evidence/android-osm-2026-10-03/06-openstreetmap-rota.png). |
| D-13: permissão e retomada | Negar localização: treino permaneceu pausado. Conceder localização precisa e ativar a precisão solicitada no primeiro uso do AVD. Retomar: GPS ativo e cronômetro avançando. A retomada posterior não abriu novamente a atividade de permissão. | [Permissão](evidence/android-osm-2026-10-03/04-permissao-gps.png), [negação](evidence/android-osm-2026-10-03/05-gps-negado.png), [GPS ativo](evidence/android-osm-2026-10-03/06a-gps-ativo.png), checagens de runtime. |
| GPS e pausa | Simular cinco posições entre `(-38.5267, -3.7319)` e `(-38.5259, -3.7311)`. Pausar em **00:02:29 / 0,12 km**, mover o GPS durante a pausa e aguardar: tempo e distância permaneceram iguais. | [Pausa](evidence/android-osm-2026-10-03/07-treino-pausado-rota.png), [métricas](evidence/android-osm-2026-10-03/pause-metrics.json). |
| Restauração e segmentos | Forçar encerramento, abrir novamente e entrar no treino: mesma rota, tempo e distância, com treino pausado. Retomar em outra posição e simular mais um deslocamento: **00:02:38 / 0,15 km**; mapa manteve os segmentos separados sem ligar o deslocamento da pausa. | [Restauração](evidence/android-osm-2026-10-03/08-rota-restaurada.png), [métricas](evidence/android-osm-2026-10-03/restore-metrics.json), [segmentos](evidence/android-osm-2026-10-03/10-segmentos-apos-pausa.png). |
| Salvar offline e sincronizar | Desligar Wi-Fi/dados, finalizar e confirmar. Registro salvo; reinício offline preservou a atividade. Reativar rede: API retornou **exatamente um novo treino GPS**, com 158 s, 154,354 m e 7 pontos. A outra atividade é a corrida manual de 5,2 km da execução anterior. | [Confirmação offline](evidence/android-osm-2026-10-03/11-finalizacao-offline.png), [reinício offline](evidence/android-osm-2026-10-03/13-registro-restaurado-offline.png), [API após reconexão](evidence/android-osm-2026-10-03/activities-api-after-reconnect.json). |

O UIAutomator não conseguia obter estado ocioso durante as atualizações do cronômetro. As capturas ativas foram feitas diretamente por `screencap`, e as hierarquias foram capturadas após pausar; esses timeouts de automação não foram classificados como falhas do app. Na ampliação da fonte, foi necessário reiniciar completamente o processo para confirmar o tamanho efetivamente renderizado.

## Verificações automatizadas e implementação

`pnpm --filter vitalis-track test --runInBand`: **103 testes em 17 suítes passaram**, incluindo conversão longitude/latitude, separação dos segmentos e retomada com permissão existente/negação. `typecheck` e `lint` passaram sem avisos. [Testes](evidence/android-osm-2026-10-03/app-tests.txt), [tipos](evidence/android-osm-2026-10-03/typecheck.txt), [lint](evidence/android-osm-2026-10-03/lint.txt).

O Chip aumenta o conteúdo interno clicável, além do contêiner. O mapa usa `@maplibre/maplibre-react-native` 11.4.1 e raster tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, com identificação do aplicativo, cache nativo e créditos visíveis. `react-native-maps`, a configuração da chave do Google e o secret da CI foram removidos. MapLibre exige APK próprio e recompilação; não está incluído no Expo Go. A rota GPS continua independente dos tiles.

Os servidores públicos do OpenStreetMap têm capacidade limitada e disponibilidade sem garantia. A integração não oferece download de regiões offline; seguir a [política de tiles do OSM](https://operations.osmfoundation.org/policies/tiles/). [Documentação do MapLibre para Expo](https://maplibre.org/maplibre-react-native/docs/setup/expo/).

Capturas, XML, dados e hashes ficam em [evidence/android-osm-2026-10-03](evidence/android-osm-2026-10-03/sha256.json). Android Studio, AVD, API e banco de QA foram deixados abertos para inspeção. Os dados são exclusivos da conta de testes.
