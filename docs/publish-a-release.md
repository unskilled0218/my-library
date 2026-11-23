# Publish a release

- [Publish a release](#publish-a-release)
  - [Inputs and provenance](#inputs-and-provenance)
  - [Verify and publish](#verify-and-publish)
  - [Readiness and recovery](#readiness-and-recovery)

## Inputs and provenance

Root `VERSION` is authoritative; keep `package.json` and both root version fields in `package-lock.json` synchronized. Configuration in `scripts/release.json` targets `dev/my-library` and `git.lan/dev/my-library`; its committed [release notes](releases/0.7.11.md) must begin with the matching release heading. No version-tag image alias is created: deploy a verified digest or mutable `latest` using [image usage](image-usage.md).

The three protocol files derive from [container-release-template commit 5b918ba0aefb9ac9643fa99976140c95d17cb3e2](https://git.lan/dev/container-release-template/src/commit/5b918ba0aefb9ac9643fa99976140c95d17cb3e2), template version 0.6.1, with explicit [local protocol and test adaptations](release-adaptations.md). They are not unchanged upstream copies. Original baseline hashes and current adapted hashes are checked separately. No managed updater runs. Root `tests/` retains upstream fixture resolution and safety scenarios, with consumer documentation assertions, supervision, and regression additions. Historical upstream evidence is not consumer verification.

## Verify and publish

Read [configuration and credentials](bash-configuration.md), [release process](release-process.md), and [platform preparation](platform-preparation.md) first. Provision a private token file outside this checkout; do not place tokens in `.env`, arguments, logs, or Git. Publication uses Bash, Python 3.11+, Git, curl, and Docker Buildx; application verification additionally requires Node/npm and a disposable PostgreSQL database.

```sh
./scripts/release.sh --validate
python3 -B -m unittest discover -s tests -v
```

Run the [application checks and browser tests](verification.md) separately. Commit all release inputs, merge the reviewed implementation, and push `main` separately before publication. From clean, already-pushed `main`, with exclusive publication and package-association writers and all readiness gates satisfied:

```sh
./scripts/release.sh
```

The command builds a committed snapshot into a staging image, verifies both platforms and labels, publishes the deterministic annotated Git tag, promotes the digest to `latest`, creates the notes-only release, and verifies the package link. It does not push source or run application tests. Only the final `Publication verified` summary establishes success.

## Readiness and recovery

Live publication remains blocked pending code review of the [local N1/N2 adaptations](release-adaptations.md#verification-and-review-status) and all independent readiness gates. Local regression success does not certify image builds, browser/runtime behavior, remote version availability, or service permissions. An implementation branch must never publish.

Promotion precedes release creation: a failure can leave `latest` changed and publication incomplete. Preserve accepted objects and the original checkout/pin, follow [retry states](bash-publication.md#retry-states), and inspect exact evidence. Never blindly retry an uncertain write, delete release evidence, roll back `latest`, or reassign a package to force success. See [troubleshooting](release-process.md#troubleshooting).
