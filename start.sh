#!/usr/bin/env bash

set -eu
set -o pipefail

bindir=$(realpath "$(dirname "$0")")

. "$bindir"/functions.bash

USAGE="Usage: $0"

run() {
  cmd python3 -mhttp.server 8080 "$@"
}

# --- assumes FB_ENV has already been set.
cwd /fb-site npx @11ty/eleventy
cwd /fb-site/_site run "$@"
