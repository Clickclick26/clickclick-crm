#!/usr/bin/env bash
#
# Deploy the CRM to https://crm.clickclick.video
#
#   npm run deploy
#   npm run deploy -- "Deploy: whatever you changed"
#
# There is no CI on this repo. The live site is the `gh-pages` branch of
# Clickclick26/clickclick-crm, and it only ever shows whatever was last built
# and pushed there by hand. That is how finished work ends up invisible, so
# this script does the whole thing and then checks the live site really changed.
#
# It does not touch main, your working tree, or any Supabase function.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MESSAGE="${1:-Deploy: $(git log -1 --pretty=format:%s)}"
WORKTREE="$(mktemp -d)/gh-pages"

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }

cleanup() {
  git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
  rm -rf "$(dirname "$WORKTREE")"
}
trap cleanup EXIT

# --- Warn about anything that would make the deploy misleading -------------

if [ -n "$(git status --porcelain)" ]; then
  warn "Heads up: you have uncommitted changes. They WILL go live (the build"
  warn "reads your working files), but they are not saved in git yet."
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  warn "Heads up: you are on branch '$BRANCH', not main."
fi

git fetch origin --quiet || warn "Could not reach GitHub to check main. Carrying on."
if [ -n "$(git log --oneline "origin/$BRANCH..$BRANCH" 2>/dev/null || true)" ]; then
  warn "Heads up: '$BRANCH' has commits you have not pushed. Run: git push origin $BRANCH"
fi

# --- Build ------------------------------------------------------------------

say "1/4  Building"
npm run build

BUNDLE="$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1)"
if [ -z "$BUNDLE" ]; then
  echo "Could not find the built bundle in dist/index.html. Stopping." >&2
  exit 1
fi
if [ ! -f dist/CNAME ]; then
  echo "dist/CNAME is missing, so the custom domain would break. Stopping." >&2
  exit 1
fi
echo "Built $BUNDLE"

# --- Copy the build onto gh-pages -------------------------------------------

say "2/4  Copying onto gh-pages"
git worktree prune >/dev/null 2>&1 || true
git fetch origin gh-pages --quiet || true
git worktree add --quiet "$WORKTREE" gh-pages
git -C "$WORKTREE" reset --hard --quiet origin/gh-pages

# Wipe everything except .git, so files deleted from the build also disappear
# from the live site instead of lingering forever.
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/. "$WORKTREE"/

# --- Push -------------------------------------------------------------------

say "3/4  Pushing"
git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "Nothing changed. The live site already matches this build."
  exit 0
fi
git -C "$WORKTREE" commit --quiet -m "$MESSAGE"
git -C "$WORKTREE" push --quiet origin gh-pages
echo "Pushed."

# --- Prove it actually went live --------------------------------------------

say "4/4  Checking the live site"
echo "Looking for $BUNDLE at https://crm.clickclick.video"
for attempt in $(seq 1 20); do
  LIVE="$(curl -fsS --max-time 10 "https://crm.clickclick.video/?cachebust=$RANDOM" 2>/dev/null \
    | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1 || true)"
  if [ "$LIVE" = "$BUNDLE" ]; then
    printf '\n\033[32mLive. crm.clickclick.video is serving your new build.\033[0m\n'
    exit 0
  fi
  printf '.'
  sleep 15
done

printf '\n'
warn "Pushed, but after 5 minutes the live site still shows: ${LIVE:-nothing}"
warn "GitHub Pages is usually just slow. Check again in a few minutes with:"
warn "  curl -s https://crm.clickclick.video/ | grep -o 'assets/index-[A-Za-z0-9_-]*\\.js'"
exit 1
