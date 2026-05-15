#!/usr/bin/bash

VERSION="${1}"

if [[ -z "${VERSION}" ]]; then
    echo "Usage: ${0} <version>"
    exit 1
fi

SED_I=$(if [[ "${OSTYPE}" == "darwin"* ]]; then echo " \"\""; else echo ""; fi)

jq --arg v "${VERSION}" '.version = $v' package.json > tmp.json && mv tmp.json package.json

sed -i"${SED_I}" "s/version: \".*\"/version: \"${VERSION}\"/" scripts/build.mjs
sed -i"${SED_I}" "s/version_tag: \"v.*\"/version_tag: \"v${VERSION}\"/" scripts/build.mjs

echo "Version updated to ${VERSION}"
