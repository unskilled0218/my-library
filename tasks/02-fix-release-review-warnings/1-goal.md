# goal

- [goal](#goal)
  - [command](#command)
  - [goal](#goal-1)

## command

Fix warnings from previous code review.

## goal

Resolve the four warnings in `tasks/01-update-build-image/5-code-review.md`: require the prepared digest after confirmed promotion, preserve Buildx executable selection across authentication isolation, clean up release descendants after test timeouts, and remove the tests' dependency on a pre-existing `/tmp/opencode` directory. Preserve publication safeguards and add regression coverage; do not publish a release as part of this task.
