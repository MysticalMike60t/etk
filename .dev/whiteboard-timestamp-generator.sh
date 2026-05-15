#!/usr/bin/sh

trap 'unset main' EXIT

main() {
    printf '\n\033[94m%s\033[0m\n\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" || return 1
    return 0
}

main || exit 1

exit 0
