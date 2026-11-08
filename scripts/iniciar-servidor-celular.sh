#!/usr/bin/env bash
set -euo pipefail

presentation_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$presentation_root"

# Reutiliza o banco e o volume normais, sem recriar um servidor existente.
docker compose up -d postgres
presentation_database_ready=false
for presentation_attempt in {1..30}; do
    if docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
        presentation_database_ready=true
        break
    fi
    sleep 1
done
if [[ "$presentation_database_ready" != true ]]; then
    echo 'O PostgreSQL não ficou disponível. Confira: docker compose logs postgres' >&2
    exit 1
fi

if python3 - <<'PY'
import json
import urllib.request
try:
    with urllib.request.urlopen('http://127.0.0.1:3000/ready', timeout=3) as response:
        assert response.status == 200
        assert json.load(response).get('data', {}).get('status') == 'ready'
except Exception:
    raise SystemExit(1)
PY
then
    echo 'A API já está disponível em http://127.0.0.1:3000/ready. Pode seguir para o celular.'
    exit 0
fi

# DATABASE_URL e JWT_SECRET continuam vindo da configuração normal do servidor.
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @vitalis/server db:deploy
pnpm build
export HOST=127.0.0.1
export PORT=3000
export NODE_ENV=production
echo 'Iniciando API. Mantenha este terminal aberto; Ctrl+C encerra o servidor.'
exec pnpm --filter @vitalis/server start
