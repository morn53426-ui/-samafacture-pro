#!/usr/bin/env bash
# Benchmark reproductible : liveness séparé de readiness, dashboard avec JWT distinct par utilisateur.
set -uo pipefail

# Correctif 2026-08-31 : sous Git Bash / MINGW64 (Windows), MSYS convertit automatiquement
# tout argument ou variable d'environnement qui ressemble à un chemin POSIX absolu
# (ex: "/api/health") en chemin Windows (ex: "C:/Program Files/Git/api/health") avant même
# que Node ne le reçoive. C'est la cause exacte des "ERR_INVALID_URL" observés à 100% des
# requêtes sur /api/health dans test-scalabilite.sh (voir run du 31/08/2026) : LOAD_ENDPOINT
# valait en réalité un chemin Windows mangé, jamais "/api/health". MSYS_NO_PATHCONV=1 (et son
# équivalent MSYS2_ARG_CONV_EXCL="*") désactivent cette conversion. Sans effet sous
# Linux/macOS/bash natif — sûr à exporter inconditionnellement.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

API_URL="${API_URL:-http://localhost:4000}"; DOSSIER_RESULTATS="${DOSSIER_RESULTATS:-./resultats-charge}"; DUREE="${LOAD_DURATION:-10}"
read -r -a NIVEAUX <<< "${LOAD_LEVELS:-10 50 100 250 500 1000}"
mkdir -p "$DOSSIER_RESULTATS"; failures=0
command -v node >/dev/null || { echo "❌ Node.js introuvable."; exit 1; }
command -v curl >/dev/null || { echo "❌ curl introuvable."; exit 1; }

echo "== 1. Prérequis =="; echo "✅ Node $(node --version), curl présent."
curl -sf "$API_URL/api/health" >/dev/null || { echo "❌ serveur non joignable"; exit 1; }; echo "✅ Liveness /api/health OK."

echo; echo "== 2. Utilisateurs de charge distincts =="
TOKEN_FILE="${LOAD_TOKENS_FILE:-$DOSSIER_RESULTATS/load-test-tokens.json}"
if [ ! -s "$TOKEN_FILE" ] || [ "${FORCE_RECREATE_LOAD_USERS:-0}" = "1" ]; then
  LOAD_TOKENS_FILE="$TOKEN_FILE" API_URL="$API_URL" LOAD_USERS="${LOAD_USERS:-1000}" node load/prepare-test-users.js || exit 1
else echo "✅ Tokens existants : $TOKEN_FILE"; fi
count=$(node -e "const x=require(process.argv[1]); process.stdout.write(String(x.length))" "$TOKEN_FILE")
[ "$count" -ge "${NIVEAUX[-1]}" ] || { echo "❌ Seulement $count tokens, ${NIVEAUX[-1]} requis."; exit 1; }
echo "✅ $count utilisateurs distincts disponibles."

echo; echo "== 3. Tests de charge liveness =="
for n in "${NIVEAUX[@]}"; do
  echo; echo "--- sante-publique : $n connexions simultanées, ${DUREE}s ---"
  f="$DOSSIER_RESULTATS/sante-publique-${n}conns.json"
  # Health est volontairement sans auth et ne doit jamais dépendre de la DB.
  if ! LOAD_ENDPOINT=/api/health LOAD_DURATION="$DUREE" API_URL="$API_URL" node load/dashboard-load.js "$n" >"${f}.log" 2>&1; then failures=$((failures+1)); fi
  cat "${f}.log"
done

echo; echo "== 4. Tests de charge dashboard — JWT distincts =="
for n in "${NIVEAUX[@]}"; do
  echo; echo "--- tableau-de-bord-authentifie : $n utilisateurs distincts, ${DUREE}s ---"
  f="$DOSSIER_RESULTATS/tableau-de-bord-authentifie-${n}conns.json"
  if ! LOAD_TOKENS_FILE="$TOKEN_FILE" LOAD_RESULT_FILE="$f" LOAD_DURATION="$DUREE" API_URL="$API_URL" node load/dashboard-load.js "$n" >"${f}.log" 2>&1; then failures=$((failures+1)); fi
  cat "${f}.log"
done

echo; echo "== Terminé =="; echo "Résultats détaillés : $DOSSIER_RESULTATS/"
if [ "$failures" -gt 0 ]; then echo "❌ $failures palier(s) en échec."; exit 1; fi
echo "✅ Tous les paliers sont PASS."; exit 0
