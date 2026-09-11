#!/usr/bin/env bash
# Publish the Pomodoro app to Cloudflare Pages, then PROVE it is live.
#
#   ./publish.sh
#
# Never run the steps by hand. The whole point of this script is that the
# deploy is not considered done until it has fetched the live page and compared
# it byte for byte against what was just built. See .claude/skills/verified-publish.
set -euo pipefail

PROJECT="pomodoro"
DOMAIN="pomodoro.kostic.design"
PAGES_HOST="pomodoro-bdo.pages.dev"   # Cloudflare appended -bdo; pomodoro.pages.dev was taken
ACCOUNT="f1c60e50370b99d7301de8fdd49fd774"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

step() { printf '\n=== %s ===\n' "$1"; }
fail() { printf '\nFAILED: %s\n' "$1" >&2; exit 1; }

step "1/5 credentials"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.claude.json')))['mcpServers']['cloudflare-token']['headers']['Authorization'].split(' ',1)[1])" 2>/dev/null || true)}"
[ -n "$CLOUDFLARE_API_TOKEN" ] || fail "no Cloudflare token in ~/.claude.json"
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT"
echo "token loaded"

step "2/5 test, typecheck, build"
pnpm install --silent
pnpm test          # unit tests on the break/well-being maths
pnpm typecheck     # tsc; the build enforces this too, but fail early and clearly
pnpm build
[ -f out/index.html ] || fail "out/index.html missing, build did not export"

# The manifest promises these. Shipping without them gives a blank home-screen icon.
for icon in icon-192x192.png icon-512x512.png; do
  [ -f "out/$icon" ] || fail "out/$icon missing, manifest would 404"
done
echo "build ok"

step "3/5 deploy"
npx -y wrangler pages deploy out \
  --project-name="$PROJECT" --branch=main --commit-dirty=true

step "4/5 wait for the edge to serve the new build"
BUILT_SHA=$(shasum -a 256 out/index.html | cut -d' ' -f1)
for i in $(seq 1 20); do
  LIVE_SHA=$(curl -s "https://$DOMAIN/" | shasum -a 256 | cut -d' ' -f1)
  [ "$LIVE_SHA" = "$BUILT_SHA" ] && break
  printf '  attempt %s: not matching yet\n' "$i"
  sleep 10
done

step "5/5 verify live"
[ "$LIVE_SHA" = "$BUILT_SHA" ] || fail "live index.html never matched the build
   built: $BUILT_SHA
   live : $LIVE_SHA"
echo "index.html byte-identical to the build"

for p in "" manifest.webmanifest icon-192x192.png icon-512x512.png; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/$p")
  [ "$code" = "200" ] || fail "https://$DOMAIN/$p returned $code"
  printf '  /%-22s 200\n' "$p"
done

# kostic.design carries live iCloud mail. Nothing here touches DNS, but a
# publish is a good moment to notice if something else broke it.
step "mail records on kostic.design (should be untouched)"
# Retried, because a single lookup can come back empty on a transient resolver
# hiccup and this check has already cried wolf once: it aborted a good publish
# claiming 0 MX records while every other query returned both iCloud records.
# A false "your email is broken" is worse than no check, so only a domain that
# looks empty on every attempt is treated as a real failure.
MX=0
for _ in 1 2 3; do
  MX=$(dig +short kostic.design MX | wc -l | tr -d ' ')
  [ "$MX" -ge 2 ] && break
  sleep 2
done
[ "$MX" -ge 2 ] || fail "expected 2+ MX records on kostic.design, found $MX after 3 attempts"
dig +short kostic.design MX | sed 's/^/  /'

printf '\nPUBLISHED: https://%s\n' "$DOMAIN"
