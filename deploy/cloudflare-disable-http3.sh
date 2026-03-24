#!/usr/bin/env bash
# Désactive HTTP/3 (QUIC) sur la zone Cloudflare et purge le cache.
# Sans ça, Chrome peut afficher ERR_HTTP2_PROTOCOL_ERROR sur les gros JS alors que l’origine est saine.
#
# Usage (une fois) :
#   export CF_API_TOKEN='votre_token_avec_Zone_Settings_Edit_et_Cache_Purge'
#   ./deploy/cloudflare-disable-http3.sh
#
# Token : Cloudflare → Mon profil → Jetons d’API → Créer (permissions : Zone → Zone Settings → Modifier, Zone → Cache Purge → Purger)

set -euo pipefail
ZONE_NAME="${CF_ZONE_NAME:-goodloss.fr}"
TOKEN="${CF_API_TOKEN:?Définir CF_API_TOKEN (voir en-tête du script)}"

if ! command -v curl >/dev/null; then echo "curl requis"; exit 1; fi

echo "Résolution zone: $ZONE_NAME ..."
ZONE_JSON=$(curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}")
if command -v jq >/dev/null; then
  ZONE_ID=$(echo "$ZONE_JSON" | jq -r '.result[0].id // empty')
else
  ZONE_ID=$(python3 -c "import json,sys; d=json.load(sys.stdin); r=d.get('result')or[]; print(r[0]['id'] if r else '')" <<<"$ZONE_JSON")
fi
if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "null" ]; then
  echo "Impossible de trouver la zone. Réponse API:"
  echo "$ZONE_JSON" | head -c 800
  exit 1
fi
echo "Zone ID: $ZONE_ID"

echo "HTTP/3 (QUIC) → off ..."
PATCH=$(curl -sS -X PATCH \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/http3" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"value":"off"}')
echo "$PATCH" | head -c 500
echo ""

echo "Purge cache (tout) ..."
PURGE=$(curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}')
echo "$PURGE" | head -c 500
echo ""
echo "Terminé. Recharge https://nexuscore.goodloss.fr en navigation privée."
