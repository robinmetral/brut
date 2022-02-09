#!/usr/bin/env bash

full_path=$(realpath $0)
dir_path=$(dirname $full_path)
script_path="$dir_path/dist/index.js"

/usr/bin/env node --experimental-specifier-resolution=node $script_path "$@"
