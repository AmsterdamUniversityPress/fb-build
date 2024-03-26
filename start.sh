#!/usr/bin/env bash

set -eu
set -o pipefail

bindir=$(realpath "$(dirname "$0")")

. "$bindir"/functions.bash

USAGE="Usage: $0"

fbsite_dir=/fb-site
fbsite_server_dir="$fbsite_dir"/server
nginx_dir=/etc/nginx

tail-with-tag() {
  local tag=$1
  local file=$2
  local line
  cmd tail -f "$file" | while read line; do
    echo "[$tag] $line"
  done
}

nginx-clear-site-conf() {
  cmd rm -f "$nginx_dir"/sites-enabled/*
}

nginx-enable-site-conf() {
  local which=$1
  cmd cp -f "$fbsite_server_dir"/nginx.deploy-"$which".conf "$nginx_dir"/sites-enabled
}

nginx-configure-main() {
  cmd rm -f "$nginx_dir"/nginx.conf
  cmd cp -f "$fbsite_server_dir"/nginx.conf "$nginx_dir"
}

# --- APP_ENV must have already been set.

fun nginx-clear-site-conf
fun nginx-enable-site-conf "$APP_ENV"
fun nginx-configure-main

service nginx start
sleep 1
fun forkit tail-with-tag 'nginx → access.log' /var/log/nginx/access.log
fun forkit tail-with-tag 'nginx → error.log' /var/log/nginx/error.log

cwd /fb-site bin/run-backend
