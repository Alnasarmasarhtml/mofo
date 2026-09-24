#!/bin/sh
# Build and publish dist/ to the gh-pages branch of Alnasarmasarhtml/mofo (GitHub Pages serves it).
set -e
cd "$(dirname "$0")/.."
npx vite build
cd dist
touch .nojekyll
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git commit -qm "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -qf https://github.com/Alnasarmasarhtml/mofo.git gh-pages
rm -rf .git
echo "deployed: https://alnasarmasarhtml.github.io/mofo/"
