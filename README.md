# VitalisTrack

Aplicativo Android-first de acompanhamento de saúde, com cliente Expo offline-first e API REST em Node.js, Fastify, Zod, Prisma e PostgreSQL.

## Ambiente local

Requer Node.js 24+, pnpm 11+, Docker e Android SDK com um emulador ou aparelho Android.

```bash
npx pnpm install
docker compose up -d postgres
npx pnpm db:generate
npx pnpm db:migrate
npx pnpm db:seed
npx pnpm dev:server
```

Em outro terminal, execute `ANDROID_QA=true pnpm -C app android` para gerar e instalar o APK debug. Após instalado, use `pnpm dev:app` para iniciar o Metro. O mapa usa MapLibre/OpenStreetMap sem chave do Google e exige build próprio, conforme [instruções do app](app/README.md). O seed cria `rafael@email.com` com senha `12345678`. A API fica em `http://localhost:3000`, o Swagger em `/docs` e os health checks em `/health` e `/ready`.

Copie `app/.env.example` para `app/.env.local`. Use `http://10.0.2.2:3000` no emulador Android; em aparelho físico, use o IP local do computador.

## Verificações

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @vitalis/server load:sync
```

O app mantém dados no SQLite e uma outbox enviada em lotes quando a rede volta. UUIDs e `mutationId` tornam retries idempotentes; exclusões usam tombstones. Tokens ficam no SecureStore e o refresh é rotacionado silenciosamente.

O GPS e o pedômetro são coletados em primeiro plano. O teste de carga usa `API_URL`, `LOAD_EMAIL` e `LOAD_PASSWORD` quando definidos.
