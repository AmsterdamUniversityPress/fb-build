#!/usr/bin/env bash

set -eu
set -o pipefail

bindir=$(realpath "$(dirname "$0")")

. "$bindir"/functions.bash

USAGE="Usage: $0"

prepare() {
  if [ "$FB_ENV" = tst ]; then
    ln -s /index-tst.html /index.html
  elif [ "$FB_ENV" = acc ]; then
    ln -s /index-acc.html /index.html
  elif [ "$FB_ENV" = prd ]; then
    ln -s /index-prd.html /index.html
  else
    error nope "$FB_ENV"
  fi
}

run() {
  cmd python3 -mhttp.server 8080 "$@"
}

info 'hi omgeving is '"${FB_ENV:-null}"
prepare
run "$@"
