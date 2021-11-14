#!/usr/bin/env bash
DIR=$(dirname $0)
/usr/bin/env node --experimental-specifier-resolution=node "${DIR}"/dist/index.js "$@"
