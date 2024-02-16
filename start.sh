#!/usr/bin/env bash

set -eu
set -o pipefail

bindir=$(realpath "$(dirname "$0")")

. "$bindir"/functions.bash

USAGE="Usage: $0"

run() {
  cmd python3 -mhttp.server 8080 "$@"
}

cwd /fb-site/_site run "$@"
