# Platform preparation

- [Platform preparation](#platform-preparation)
  - [Install AMD64 and ARM64 emulation](#install-amd64-and-arm64-emulation)
  - [Verify runtime support](#verify-runtime-support)

## Install AMD64 and ARM64 emulation

Only an authorized host administrator may run the optional preparation commands below when the selected hosts need emulation rather than native platform nodes.

Check installed tools and Docker/builder connectivity first using the [release process](release-process.md#check-platform-readiness). Missing platform advertising and an inaccessible builder are different failures; privileged emulation setup is not a generic connectivity fix.

```sh
docker run --privileged --rm tonistiigi/binfmt --install amd64,arm64
docker buildx inspect --bootstrap
```

The first command registers emulation handlers in the Docker daemon host's kernel. It requires privileged access and changes host configuration; it is not an ordinary application container. Verify the selected Docker context before running it. The release tool and coding agent do not run this privileged setup automatically.

The builder's advertised platforms should include `linux/amd64` and `linux/arm64`. If builder nodes or runtime daemons use different hosts, prepare each host that needs emulation, or use native nodes for the required architecture. Registering handlers on one host does not configure every remote builder or daemon. Recheck support after host restarts or environment changes.

## Verify runtime support

Builder advertising alone does not prove that containers can execute. On the Docker context used for approved runtime verification, these base-runtime checks can establish Node execution on each architecture:

```sh
docker run --rm --platform linux/amd64 node:24-bookworm node -p 'process.arch'
docker run --rm --platform linux/arm64 node:24-bookworm node -p 'process.arch'
```

Both commands must exit successfully and print `x64` and `arm64` respectively. They may pull Node images and require separate approval before execution. These checks verify base-runtime architecture execution only; they do not verify My Library's Prisma artifacts, Chromium, migrations, storage, health, registry publication, digest promotion, or deletion safety. Use [image usage](image-usage.md) for separately approved checks of the application image on disposable database/storage, and retain the [verification limits](verification.md#release-workflow-checks).
