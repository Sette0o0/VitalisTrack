#!/usr/bin/env bash
set -euo pipefail

cd /home/rafael/Documentos/github/VitalisTrack

# Banco exclusivo já preparado para a apresentação.
docker start vitalis-sprint1-fixes-20261004 >/dev/null
presentation_database_ready=false
for presentation_attempt in {1..30}; do
    if docker exec vitalis-sprint1-fixes-20261004 pg_isready -U vitalis -d vitalis_qa >/dev/null 2>&1; then
        presentation_database_ready=true
        break
    fi
    sleep 1
done
if [[ "$presentation_database_ready" != true ]]; then
    echo 'O PostgreSQL de QA não ficou disponível. Confira o contêiner antes de continuar.' >&2
    exit 1
fi

if python3 - <<'PY'
import urllib.request
try:
    with urllib.request.urlopen('http://127.0.0.1:3012/ready', timeout=3) as response:
        assert response.status == 200
except Exception:
    raise SystemExit(1)
PY
then
    echo 'A API já está disponível em http://127.0.0.1:3012/ready. Pode seguir para o celular.'
    exit 0
fi

export DATABASE_URL='postgresql://vitalis:vitalis@127.0.0.1:55432/vitalis_qa'
# Chave local do ambiente sintético existente; mantém a identidade da sessão.
export JWT_SECRET='sprint1-qa-only-secret-at-least-32-characters'
export HOST=127.0.0.1
export PORT=3012
export PUBLIC_BASE_URL=http://127.0.0.1:3011
export NODE_ENV=development

pnpm install --frozen-lockfile
pnpm --filter @vitalis/contracts build
pnpm db:generate
pnpm --filter @vitalis/server db:deploy
echo 'Iniciando API. Mantenha este terminal aberto; Ctrl+C encerra o servidor.'
exec pnpm dev:server
