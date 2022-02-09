#!/usr/bin/env bash

# adapted from https://stackoverflow.com/questions/70496353/how-to-get-yargs-auto-complete-working-when-using-experimental-specifier-reso
full_path=$(realpath $0)
dir_path=$(dirname $full_path)
script_path="$dir_path/dist/index.js"

/usr/bin/env node --experimental-specifier-resolution=node $script_path "$@"
