# Contratos das correções da Sprint 1

## Nascimento e fuso do aparelho

As requisições podem enviar `X-Client-Time-Zone` com um identificador IANA, por exemplo `America/Sao_Paulo`. Ausência usa UTC para clientes anteriores; valor inválido retorna HTTP 400, código `INVALID_TIME_ZONE`.

O PATCH `/v1/profile` compara nascimento com o dia civil nesse fuso, usando o relógio do servidor no momento da validação. Datas impossíveis ou futuras retornam HTTP 400. A idade nas respostas de perfil usa o mesmo fuso. `birthDate` permanece `YYYY-MM-DD`, armazenado como data, sem representar horário.

Mutações de perfil em POST `/v1/sync` podem incluir `clientTimeZone` no mesmo nível de `mutationId`, `entity` e `clientUpdatedAt`. O app captura o fuso ao criar a alteração. A API prefere esse valor para validar a pendência; sem ele, usa o cabeçalho da requisição ou UTC. Valor inválido reprova a validação do corpo; nascimento inválido produz resultado `failed` para a operação e não altera o perfil.

## Foto do perfil

POST multipart `/v1/profile/avatar` mantém o campo `file`, tipos JPEG/PNG/WebP e limite de **5 MiB (5.242.880 bytes)**. O cabeçalho opcional `Idempotency-Key` deve conter UUID; chave inválida retorna HTTP 400. Sem cabeçalho, cada chamada é uma nova operação, mantendo compatibilidade com clientes anteriores.

A deduplicação usa `(userId, mutationId)` em `ProcessedMutation`. Perfil e marcador são gravados na mesma transação, com bloqueio por operação. Replays retornam o perfil atual sem reaplicar uma foto anterior. Reutilização da chave de uma mutação JSON em upload retorna HTTP 409; o caminho inverso resulta em `failed` no sync. Os replays continuam sujeitos à validação do arquivo enviado.

O app usa `expo-file-system ~19.0.24`, a [API de arquivos do Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/), para copiar a imagem para `Paths.document/avatars/<userId>/<mutationId>.<extensão>`. Referência de perfil e operação local `avatar` são salvas na mesma transação SQLite. O esquema atual e `outbox_v2` são mantidos, incluindo operações previamente armazenadas.

A fila é processada pela sequência SQLite. Lotes JSON terminam antes da próxima foto; fotos são enviadas individualmente por multipart, conservando a ordem. Operações `avatar` e seus caminhos locais não são enviados para `/v1/sync`. Retry conserva a chave; confirmação de foto antiga não substitui uma seleção posterior. Cache, login e pull preservam uma foto pendente ou a cópia local da foto confirmada. A coleta de arquivos locais considera estado persistido, fila e envios em andamento, separadamente por conta.

## Atividades e Android

GET `/v1/activities` mantém cursor por ID, filtros e limite de página. Ordenação por data: `date DESC, createdAt DESC, id DESC`. Por tipo: `type ASC, date DESC, id DESC`. A lista local também desempata por ID.

Compatibilidade aprovada: **Android API 24+**, target API 36. O workflow Android QA gera releases e smoke separados para API 24/x86 e API 36/x86_64, com hash do APK. Essas builds são de QA e usam a ponte HTTP do emulador; publicação exige a configuração HTTPS de produção.
