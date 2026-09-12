#!/bin/sh
# Ship presentation edits made in ?edit mode: commit ONLY the overrides file,
# push, then build + deploy from a clean checkout of that commit — so nothing
# else sitting uncommitted in this folder goes live by accident.
set -e
cd "$(dirname "$0")/.."
FILE=src/data/gustoDeckOverrides.json

if git diff --quiet -- "$FILE" && git diff --cached --quiet -- "$FILE"; then
  echo "No presentation edits to ship."
else
  git add "$FILE"
  git commit -q -m "Presentation: copy and alignment edits" -- "$FILE"
  echo "Committed $(git rev-parse --short HEAD)"
fi

git push -q origin main || { echo "Push rejected — pull first (git pull --rebase), then run npm run ship again."; exit 1; }

WT=$(mktemp -d)
git worktree add -q "$WT" HEAD
ln -s "$PWD/node_modules" "$WT/node_modules"
( cd "$WT" && npm run build >/dev/null && npx wrangler deploy | tail -2 )
git worktree remove --force "$WT"
echo "Live: https://valentinapdesign.com/website/presentation (hard refresh)"
