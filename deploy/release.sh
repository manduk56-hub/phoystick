#!/usr/bin/env bash
set -euo pipefail
ulimit -c 0
# Node sizes its default heap from physical RAM and does not count swap.
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=1536"

sha=${1:?commit SHA required}
bundle=${2:?Git bundle required}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$bundle" =~ ^/tmp/phoystick-[0-9a-f]{40}-[0-9]+\.bundle$ ]]
root=/opt/motion-games
mkdir -p "$root/releases" "$root/shared"
exec 9>"$root/shared/deploy.lock"
flock -w 120 9
previous=$(readlink -f "$root/current" || true)
release="$root/releases/$sha-$(date +%s)-$$"
switched=false
stopped=false
service() {
  if [[ $EUID -eq 0 ]]; then systemctl "$@"; else sudo -n systemctl "$@"; fi
}
cleanup() {
  status=$?
  trap - EXIT
  if [[ $status -ne 0 && "$stopped" == true ]]; then
    if [[ "$switched" == true && -n "$previous" ]]; then
      ln -s "$previous" "$root/current.rollback.$$"
      mv -Tf "$root/current.rollback.$$" "$root/current"
    fi
    service restart motion-games-api.service motion-games.service || true
  fi
  rm -f -- "$bundle"
  exit "$status"
}
trap cleanup EXIT

command -v node >/dev/null
command -v npm >/dev/null
command -v git >/dev/null
node -e 'if (+process.versions.node.split(".")[0] < 22) process.exit(1)'
service cat motion-games.service >/dev/null
service cat motion-games-api.service >/dev/null
if [[ -e "$root/current" && ! -L "$root/current" ]]; then
  echo 'current must be a symlink; convert the existing installation before deploying.' >&2
  exit 1
fi

repo="$root/shared/repository.git"
if [[ ! -d "$repo" ]]; then git init --bare "$repo"; fi
git --git-dir="$repo" fetch "$bundle" refs/heads/master
[[ "$(git --git-dir="$repo" rev-parse FETCH_HEAD)" == "$sha" ]]
mkdir "$release"
git --git-dir="$repo" archive "$sha" | tar -x -C "$release"
cd "$release"

# Supply runtime configuration through shared files, never through Git.
for file in .env .env.production .env.production.local .dev.vars; do
  if [[ -f "$root/shared/$file" ]]; then ln -s "$root/shared/$file" "$release/$file"; fi
done
npm ci --include=dev
npx tsc --noEmit
# The pairing integration test needs the running API; all other tests run before activation.
mapfile -t tests < <(find tests -name '*.test.mjs' ! -name 'link.test.mjs' | sort)
node --test "${tests[@]}"
npm run build
printf '%s\n' "$sha" > "$release/REVISION"

# Preserve existing Wrangler databases at both conventional state locations.
stopped=true
service stop motion-games.service motion-games-api.service
for relative in .wrangler dist/server/.wrangler; do
  shared="$root/shared/runtime/$relative"
  if [[ -n "$previous" && -L "$previous/$relative" ]]; then
    shared=$(readlink -f "$previous/$relative")
    case "$shared" in
      "$root/shared/"*) ;;
      *) echo 'Existing database symlink must point into shared/.' >&2; exit 1 ;;
    esac
  fi
  mkdir -p "$(dirname "$shared")"
  if [[ ! -d "$shared" ]]; then
    if [[ -n "$previous" && -d "$previous/$relative" ]]; then
      cp -aL "$previous/$relative" "$shared"
    else
      mkdir -p "$shared"
    fi
  fi
  if [[ -e "$release/$relative" ]]; then
    mv "$release/$relative" "$release/${relative}.build"
  fi
  ln -s "$shared" "$release/$relative"
done
ln -s "$release" "$root/current.next.$$"
mv -Tf "$root/current.next.$$" "$root/current"
switched=true
service restart motion-games-api.service motion-games.service
healthy=false
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:3001/ >/dev/null &&
     TEST_BASE_URL=http://127.0.0.1:3002 node --test tests/link.test.mjs; then
    healthy=true
    break
  fi
  sleep 2
done
[[ "$healthy" == true ]]
service is-active --quiet motion-games.service
service is-active --quiet motion-games-api.service
# Validation fixtures are not needed after the deployment check.
rm -rf -- "$release/tests"
echo "Deployed $sha"
