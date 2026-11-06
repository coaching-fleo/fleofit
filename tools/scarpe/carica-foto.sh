#!/usr/bin/env bash
# Carica le foto di tools/scarpe/foto/<slug>.png sul bucket `scarpe` e salva
# foto_url sul modello. Lo lancia il committente, dopo il sì alla migrazione.
#
# Servono nell'ambiente (MAI scritti in questo file):
#   SUPABASE_URL                 es. https://<progetto>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY    chiave di servizio: bypassa la RLS, da tenere segreta
#
# Le foto qui sono scontornate (trasparenti): niente "#sfondo" nell'URL.
set -euo pipefail

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Mancano SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY nell'ambiente. Niente da fare." >&2
  exit 1
fi

cd "$(dirname "$0")"
command -v jq >/dev/null || { echo "Serve jq." >&2; exit 1; }
AUTH=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

for file in foto/*.png; do
  slug=$(basename "$file" .png)
  marca=$(jq -r --arg s "$slug" '.[] | select(.slug==$s) | .marca' schede.json)
  modello=$(jq -r --arg s "$slug" '.[] | select(.slug==$s) | .modello' schede.json)
  if [ -z "$marca" ]; then echo "[$slug] non è in schede.json, salto."; continue; fi

  id=$(curl -fsS "${AUTH[@]}" -G "$SUPABASE_URL/rest/v1/scarpe_catalogo" \
        --data-urlencode "select=id" \
        --data-urlencode "marca=ilike.$marca" \
        --data-urlencode "modello=ilike.$modello" | jq -r '.[0].id // empty')
  if [ -z "$id" ]; then echo "[$slug] modello non trovato nel catalogo, salto."; continue; fi

  curl -fsS -X POST "${AUTH[@]}" -H "Content-Type: image/png" -H "x-upsert: true" \
    --data-binary "@$file" "$SUPABASE_URL/storage/v1/object/scarpe/$id.png" >/dev/null

  url="$SUPABASE_URL/storage/v1/object/public/scarpe/$id.png?v=$(date +%s)"
  curl -fsS -X PATCH "${AUTH[@]}" -H "Content-Type: application/json" \
    "$SUPABASE_URL/rest/v1/scarpe_catalogo?id=eq.$id" \
    -d "$(jq -n --arg u "$url" '{foto_url:$u}')" >/dev/null
  echo "[$slug] caricata."
done
