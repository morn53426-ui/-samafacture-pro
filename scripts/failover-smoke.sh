#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:4000}"
if ! command -v curl >/dev/null 2>&1; then echo 'curl requis'; exit 1; fi

echo '== Smoke failover =='
echo '1) Baseline readiness'
curl -fsS "$BASE_URL/api/ready" >/tmp/samafacture-ready.json
cat /tmp/samafacture-ready.json
echo

if [ "${RUN_DOCKER_FAILOVER:-false}" != "true" ]; then
  echo 'INFO: RUN_DOCKER_FAILOVER=true requis pour piloter Redis Docker automatiquement.'
  echo 'Test manuel recommandé : docker compose stop redis -> /api/ready doit devenir 503 si Redis est obligatoire.'
  echo 'Puis : docker compose start redis -> /api/ready doit revenir à 200.'
  exit 0
fi

docker compose stop redis
sleep 3
status=$(curl -s -o /tmp/samafacture-ready-down.json -w '%{http_code}' "$BASE_URL/api/ready")
cat /tmp/samafacture-ready-down.json; echo
if [ "$status" != '503' ]; then echo "FAIL: readiness après arrêt Redis = HTTP $status"; docker compose start redis; exit 2; fi

docker compose start redis
for i in $(seq 1 30); do
  status=$(curl -s -o /tmp/samafacture-ready-up.json -w '%{http_code}' "$BASE_URL/api/ready" || true)
  if [ "$status" = '200' ]; then cat /tmp/samafacture-ready-up.json; echo; echo 'PASS: Redis récupéré et readiness restaurée.'; exit 0; fi
  sleep 1
done
cat /tmp/samafacture-ready-up.json 2>/dev/null || true
echo 'FAIL: readiness non restaurée dans les 30 secondes.'
exit 3
