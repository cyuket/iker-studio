#!/usr/bin/env bash
# Seeds the LOCAL Iker web app (slot-books + local Supabase) with the fictional "Amaka Studio"
# demo business, or resets Tunde's booking for another take.
#
#   fixtures/iker-demo/seed.sh               seed (idempotent, additive; safe to re-run)
#   fixtures/iker-demo/seed.sh reset-tunde   put Tunde's booking back to "Awaiting confirmation"
#
# Reads:
#   Iker-studio/.env                     IKER_DEMO_PASSWORD (owner password, never printed)
#   <slot-books>/apps/web/.env.local     NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#                                        (to upload the sample proof of payment; never printed)
# Optional overrides: SLOT_BOOKS_DIR (default ../slot-books next to Iker-studio),
#                     IKER_DEMO_DB_URL (default the local Supabase database on 127.0.0.1:54322).
#
# Refuses to run unless both the database and the Supabase API are on 127.0.0.1 or localhost.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUDIO="$(cd "$HERE/../.." && pwd)"
SLOT_BOOKS_DIR="${SLOT_BOOKS_DIR:-$(cd "$STUDIO/.." && pwd)/slot-books}"
DB_URL="${IKER_DEMO_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
BUSINESS_ID="7a3e0000-0000-4000-a000-000000000002"
PROOF_PATH="$BUSINESS_ID/7a3e0000-0000-4000-a000-000000000051-sample-transfer-receipt.png"

die() { echo "Error: $*" >&2; exit 1; }

is_local_host() { [[ "$1" == "127.0.0.1" || "$1" == "localhost" ]]; }
url_host() { sed -E 's#^[a-z]+://([^@/]*@)?(\[[^]]*\]|[^:/]+).*#\2#' <<<"$1"; }

# Reads one KEY=value line from a dotenv file without sourcing it (no shell expansion).
env_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

DB_HOST="$(url_host "$DB_URL")"
is_local_host "$DB_HOST" || die "refusing to write to database host '$DB_HOST': only 127.0.0.1 or localhost is allowed."
command -v psql >/dev/null || die "psql is not installed."

if [[ "${1:-}" == "reset-tunde" ]]; then
  psql "$DB_URL" -X -q -f "$HERE/reset-tunde.sql"
  exit 0
fi
[[ -z "${1:-}" ]] || die "unknown argument '$1'. Use no argument to seed, or 'reset-tunde'."

ENV_LOCAL="$SLOT_BOOKS_DIR/apps/web/.env.local"
[[ -f "$ENV_LOCAL" ]] || die "$ENV_LOCAL not found. Set SLOT_BOOKS_DIR."
SUPABASE_URL="$(env_value "$ENV_LOCAL" NEXT_PUBLIC_SUPABASE_URL)"
SERVICE_KEY="$(env_value "$ENV_LOCAL" SUPABASE_SERVICE_ROLE_KEY)"
[[ -n "$SUPABASE_URL" && -n "$SERVICE_KEY" ]] || die "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in $ENV_LOCAL."
API_HOST="$(url_host "$SUPABASE_URL")"
is_local_host "$API_HOST" || die "refusing to upload to Supabase host '$API_HOST': only 127.0.0.1 or localhost is allowed."

IKER_DEMO_PASSWORD="$(env_value "$STUDIO/.env" IKER_DEMO_PASSWORD)"
[[ ${#IKER_DEMO_PASSWORD} -ge 8 ]] || die "IKER_DEMO_PASSWORD in $STUDIO/.env is missing or shorter than 8 characters."
export IKER_DEMO_PASSWORD

echo "Seeding Amaka Studio into $DB_HOST ..."
psql "$DB_URL" -X -q -f "$HERE/seed.sql"

echo "Rendering and uploading the sample proof of payment ..."
mkdir -p "$HERE/.cache"
RECEIPT="$HERE/.cache/sample-transfer-receipt.png"
(cd "$STUDIO" && node "$HERE/render-receipt.mjs" "$RECEIPT" >/dev/null)
STATUS="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  "$SUPABASE_URL/storage/v1/object/payment-proofs/$PROOF_PATH" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: image/png" -H "x-upsert: true" \
  --data-binary "@$RECEIPT")"
[[ "$STATUS" == "200" ]] || die "uploading the proof of payment failed (HTTP $STATUS)."
echo "Proof of payment stored at payment-proofs/$PROOF_PATH"
echo "Done. Public page: http://localhost:3000/amaka-studio  Owner: amaka.owner@example.com"
