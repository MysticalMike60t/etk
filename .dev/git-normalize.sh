#!/usr/bin/sh

main() {
    pwd="$(pwd)"
    printf 'Normalize: \"%s\"? [Y/n]: ' "${pwd}" && IFS= read -r input && printf '\n'
    if [ "${input}" = "y" ] || [ "${input}" = "Y" ] || [ -z "${input}" ]; then
        git add --renormalize "${pwd}" || return 1
    else
        return 1
    fi
    printf '\033[0;32mNormalized\033[0m.\n'
    return 0
}

main || exit 1
