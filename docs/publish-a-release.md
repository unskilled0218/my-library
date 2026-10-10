# Publish a release

The release command requires a clean `main` checkout whose `package.json` and `package-lock.json` contain the same unreleased semantic version. It runs the static checks, tests, and production build; pushes `main`; reserves the version with an annotated Git tag; builds and publishes `linux/amd64` and `linux/arm64`; creates the matching Forgejo release; and updates `latest` only after those immutable release records succeed. Restrict package-write access to release maintainers so the Git tag remains the serialization lock for semantic-version publication.

Create a Forgejo access token with repository-write and package-write permission, and store it outside the repository in a user-only file:

```bash
install -d -m 700 "$HOME/.config/forgejo"
umask 077
read -rsp "Forgejo token: " token
printf '%s' "$token" > "$HOME/.config/forgejo/forgejo-token"
unset token
stat -c '%a %n' "$HOME/.config/forgejo/forgejo-token"
```

The token file must have mode `600`. Do not put the token in this repository, `.env`, Compose, release arguments, or shell history. The release helper uses a temporary Docker configuration and removes its registry credentials on exit. Before publishing, run `npm run test:e2e` against a migrated disposable database and commit the intended package version. Then release with:

```bash
FORGEJO_TOKEN="$(<"$HOME/.config/forgejo/forgejo-token")" \
  ./scripts/release.sh
```

The workstation needs Docker Buildx with AMD64/ARM64 emulation. On a Linux Docker host, install binfmt support once and bootstrap the builder before the first cross-platform release:

```bash
docker run --privileged --rm tonistiigi/binfmt --install amd64,arm64
docker buildx inspect --bootstrap
```

The helper logs into `git.lan` as Forgejo user `dev`; set `FORGEJO_USER` when the token belongs to another account. It refuses positional arguments, dirty or non-`main` checkouts, malformed or inconsistent package versions, existing Git tags or Forgejo releases, and an existing immutable registry image. A failed release never moves `latest`; the reserved Git tag intentionally remains after a later failure to prevent another invocation from overwriting that version. Inspect and resolve any version image, tag, or release created before the failure rather than rerunning blindly.
