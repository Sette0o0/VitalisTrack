FROM node:24-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile --filter @vitalis/server...
COPY packages/contracts packages/contracts
COPY server server
RUN pnpm --filter @vitalis/server db:generate && pnpm --filter @vitalis/server build

FROM node:24-alpine
WORKDIR /workspace
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /workspace /workspace
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @vitalis/server db:deploy && pnpm --filter @vitalis/server start"]
