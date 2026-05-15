#!/usr/bin/bash

VERSION="${1}"

ROOT="$(cd "$(dirname "${0}")/.." && pwd)"

if [[ -z "${VERSION}" ]]; then
    echo "Usage: ${0} <version>"
    exit 1
fi

SED_I=$(if [[ "${OSTYPE}" == "darwin"* ]]; then echo " \"\""; else echo ""; fi)

jq --arg v "${VERSION}" '.version = $v' package.json > tmp.json && mv tmp.json package.json

sed -i"${SED_I}" "s/version: \".*\"/version: \"${VERSION}\"/" scripts/build.mjs
sed -i"${SED_I}" "s/version_tag: \"v.*\"/version_tag: \"v${VERSION}\"/" scripts/build.mjs
while IFS= read -r -d '' file; do
    sed -i"${SED_I}" "s/@version .*/\@version ${VERSION}/" "${file}"
    echo "  updated ${file}"
done < <(find "${ROOT}/src" scripts \( -name "*.ts" -o -name "*.mjs" \) -print0)

echo "Version updated to ${VERSION}"
