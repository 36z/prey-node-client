#!/bin/sh
basedir=$(dirname "$0")

if [ -x "$basedir/node" ]; then
  "$basedir/node" "$basedir/../lib/conf/cli.js" "$@"
else
  node "$basedir/../lib/conf/cli.js" "$@"
fi
