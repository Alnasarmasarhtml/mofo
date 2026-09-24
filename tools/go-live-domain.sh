#!/bin/sh
# Waits until mindoverfomo.tools points at GitHub Pages, then moves the site onto the domain and turns on HTTPS.
set -e
cd "$(dirname "$0")/.."
DOMAIN=mindoverfomo.tools
echo "waiting for $DOMAIN to point at GitHub Pages..."
until dig +short "$DOMAIN" A @8.8.8.8 | grep -Eq '^185\.199\.(108|109|110|111)\.153$'; do sleep 30; done
echo "dns live: $(dig +short "$DOMAIN" A @8.8.8.8 | tr '\n' ' ')"
echo "$DOMAIN" > public/CNAME
sed -i '' "s#https://alnasarmasarhtml.github.io/mofo/#https://$DOMAIN/#g" index.html
git add -A
git commit -qm "Custom domain: $DOMAIN"
git push -q origin main
sh tools/deploy.sh
gh api -X PUT repos/Alnasarmasarhtml/mofo/pages -f cname="$DOMAIN" >/dev/null
echo "custom domain set on GitHub Pages; waiting for the HTTPS certificate..."
until [ "$(gh api repos/Alnasarmasarhtml/mofo/pages --jq '.https_certificate.state' 2>/dev/null)" = "approved" ]; do sleep 30; done
gh api -X PUT repos/Alnasarmasarhtml/mofo/pages -F https_enforced=true >/dev/null
echo "https on: https://$DOMAIN/"
