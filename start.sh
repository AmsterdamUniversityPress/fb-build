#!/usr/bin/env bash

set -eu
set -o pipefail

bindir=$(realpath "$(dirname "$0")")

. "$bindir"/functions.bash

USAGE="Usage: $0"

run() {
  cmd python3 -mhttp.server 8080 "$@"
}

# --- assumes APP_ENV has already been set.
cwd /fb-site bin/run-backend-dev &
sleep 5
cwd /fb-site/frontend/build-"$APP_ENV" run "$@"
