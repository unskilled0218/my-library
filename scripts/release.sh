#!/bin/bash

set -euo pipefail

if [ "$#" -ne 0 ]; then
  echo "Usage: $0" >&2
  exit 2
fi

for command in curl docker git node npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is not installed: $command" >&2
    exit 1
  fi
done

: "${FORGEJO_TOKEN:?set FORGEJO_TOKEN to a token with repository and package write access}"
FORGEJO_USER=${FORGEJO_USER:-dev}

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
registry_image=git.lan/dev/my-library
api_url=https://git.lan/api/v1/repos/dev/my-library
packages_url=https://git.lan/api/v1/packages/dev

if [ -n "$(git -C "$project_root" status --porcelain --untracked-files=all)" ]; then
  echo "The worktree has uncommitted changes; refusing to release" >&2
  exit 1
fi

current_branch=$(git -C "$project_root" branch --show-current)
if [ "$current_branch" != "main" ]; then
  echo "Releases must run from main; current branch is ${current_branch:-detached HEAD}" >&2
  exit 1
fi

version=$(node -p "require('$project_root/package.json').version")
lock_version=$(node -p "require('$project_root/package-lock.json').version")
lock_package_version=$(node -p "require('$project_root/package-lock.json').packages[''].version")
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "package.json version is not semantic: $version" >&2
  exit 1
fi
if [ "$lock_version" != "$version" ] || [ "$lock_package_version" != "$version" ]; then
  echo "package-lock.json version does not match package.json $version" >&2
  exit 1
fi

release_tag="v$version"
version_image="$registry_image:$release_tag"
head_commit=$(git -C "$project_root" rev-parse HEAD)

git -C "$project_root" fetch --tags origin
if git -C "$project_root" rev-parse -q --verify "refs/tags/$release_tag" >/dev/null; then
  echo "Release tag already exists: $release_tag" >&2
  exit 1
fi

auth_config=$(mktemp)
docker_config=$(mktemp -d)
release_payload=$(mktemp)
response=$(mktemp)
cleanup() {
  rm -f "$auth_config" "$release_payload" "$response"
  rm -rf "$docker_config"
}
trap cleanup EXIT
chmod 600 "$auth_config"
chmod 700 "$docker_config"
printf 'header = "Authorization: token %s"\n' "$FORGEJO_TOKEN" > "$auth_config"
export DOCKER_CONFIG=$docker_config

assert_version_image_absent() {
  local package_status
  package_status=$(curl --silent --show-error \
    --config "$auth_config" \
    --output "$response" \
    --write-out '%{http_code}' \
    "$packages_url/container/my-library/$release_tag")
  if [ "$package_status" = "200" ]; then
    echo "Registry image already exists: $version_image" >&2
    exit 1
  fi
  if [ "$package_status" != "404" ]; then
    echo "Forgejo package lookup failed with HTTP $package_status" >&2
    exit 1
  fi
}

release_status=$(curl --silent --show-error \
  --config "$auth_config" \
  --output "$response" \
  --write-out '%{http_code}' \
  "$api_url/releases/tags/$release_tag")
if [ "$release_status" = "200" ]; then
  echo "Forgejo release already exists: $release_tag" >&2
  exit 1
fi
if [ "$release_status" != "404" ]; then
  echo "Forgejo release lookup failed with HTTP $release_status" >&2
  exit 1
fi
assert_version_image_absent

(
  cd "$project_root"
  npm ci
  npm run format:check
  npm run lint
  npm run typecheck
  npm test
  npm run build
)

if ! docker buildx version >/dev/null 2>&1; then
  echo "Docker Buildx is not available" >&2
  exit 1
fi
if ! docker buildx inspect --bootstrap >/dev/null 2>&1; then
  echo "Docker Buildx builder could not start" >&2
  exit 1
fi

printf '%s' "$FORGEJO_TOKEN" | docker login git.lan \
  --username "$FORGEJO_USER" \
  --password-stdin

assert_version_image_absent

git -C "$project_root" push origin main

node - "$release_tag" "$head_commit" > "$release_payload" <<'NODE'
const [tag, commit] = process.argv.slice(2)
process.stdout.write(
  JSON.stringify({
    tag_name: tag,
    target: commit,
    message: `Release ${tag}`,
  }),
)
NODE

tag_status=$(curl --silent --show-error \
  --config "$auth_config" \
  --header 'Content-Type: application/json' \
  --output "$response" \
  --write-out '%{http_code}' \
  --request POST \
  --data-binary "@$release_payload" \
  "$api_url/tags")
if [ "$tag_status" != "201" ]; then
  echo "Forgejo tag reservation failed with HTTP $tag_status" >&2
  node -e "const fs=require('node:fs'); process.stderr.write(fs.readFileSync(process.argv[1], 'utf8'))" "$response"
  exit 1
fi

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg "BUILD_VERSION=$version" \
  --build-arg "BUILD_REVISION=$head_commit" \
  --build-arg "BUILD_SOURCE=https://git.lan/dev/my-library" \
  --tag "$version_image" \
  --push \
  "$project_root"

manifest=$(docker buildx imagetools inspect --raw "$version_image")
printf '%s' "$manifest" | node -e '
let body = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => { body += chunk })
process.stdin.on("end", () => {
  const manifest = JSON.parse(body)
  const platforms = new Set(
    (manifest.manifests ?? [])
      .filter((entry) => entry.platform)
      .map((entry) => `${entry.platform.os}/${entry.platform.architecture}`),
  )
  for (const required of ["linux/amd64", "linux/arm64"]) {
    if (!platforms.has(required)) {
      console.error(`Published manifest is missing ${required}`)
      process.exit(1)
    }
  }
})
'
version_digest="sha256:$(printf '%s' "$manifest" | sha256sum | cut -d ' ' -f 1)"

node - "$release_tag" "$head_commit" > "$release_payload" <<'NODE'
const [tag, commit] = process.argv.slice(2)
process.stdout.write(
  JSON.stringify({
    tag_name: tag,
    target_commitish: commit,
    name: tag,
    draft: false,
    prerelease: false,
  }),
)
NODE

release_status=$(curl --silent --show-error \
  --config "$auth_config" \
  --header 'Content-Type: application/json' \
  --output "$response" \
  --write-out '%{http_code}' \
  --request POST \
  --data-binary "@$release_payload" \
  "$api_url/releases")
if [ "$release_status" != "201" ]; then
  echo "Forgejo release creation failed with HTTP $release_status" >&2
  node -e "const fs=require('node:fs'); process.stderr.write(fs.readFileSync(process.argv[1], 'utf8'))" "$response"
  exit 1
fi

docker buildx imagetools create \
  --tag "$registry_image:latest" \
  "$registry_image@$version_digest"

echo "Released $release_tag ($head_commit)"
echo "Image: $version_image"
echo "Manifest: $version_digest"
