#!/usr/bin/env bash
# NEXORA-MD → Fly.io, local one-shot deploy.
# Run on YOUR machine (flyctl must be installed and logged in: fly auth login),
# from the repo root:   bash scripts/fly-deploy-local.sh
#
# Why this script exists: deploy tokens minted by `fly tokens deploy create`
# inside a GitHub-SSO-enabled Fly org cannot be discharged headlessly
# ("missing third-party discharge token"), so CI/agent deploys fail until
# SSO is off or a console-minted token is used. Running locally skips that.
#
# Override the app name if you already created one (e.g. FLY_APP=FlyV1).
set -euo pipefail
APP="${FLY_APP:-nexora-md}"

command -v fly >/dev/null || { echo "✗ flyctl not found — install: curl -L https://fly.io/install.sh | sh"; exit 1; }
fly auth whoami >/dev/null 2>&1 || { echo "✗ not logged in — run: fly auth login"; exit 1; }

echo "── ensuring app '$APP' (from fly.toml)…"
if ! fly status -a "$APP" >/dev/null 2>&1; then
  fly launch --no-deploy --copy-config --name "$APP"
fi

echo "── ensuring volumes…"
fly volumes list -a "$APP" -j | grep -q '"name":"nexora_session"'  \
  || fly volumes create nexora_session --size 1 -a "$APP"
fly volumes list -a "$APP" -j | grep -q '"name":"nexora_database"' \
  || fly volumes create nexora_database --size 1 -a "$APP"

echo "── deploying…"
fly deploy -a "$APP"

cat <<'EOF'

✓ Deployed. Next steps:

1. Set secrets (fresh, ROTATED values — Railway's incident means old keys
   stored in Railway env vars should be considered exposed):
   fly secrets set -a APP_NAME OWNER_NUMBERS=234xxxxxxxxxx OWNER_NAME=Resterty \
     PAIRING_ENABLED=true PAIRING_PHONE=233xxxxxxxxx NEXORA_RICH_RESPONSE=1 \
     JAKY_API_KEY=… GEMINI_API_KEY=… (plus any other keys the bot uses)

2. Watch the boot log for the WhatsApp pairing code:
   fly logs -a APP_NAME
   Enter the code on your phone: WhatsApp → Linked devices → Link a device.

3. Health check once paired:
   https://APP_NAME.fly.dev/api/health
EOF
echo "(replace APP_NAME with: $APP)"
