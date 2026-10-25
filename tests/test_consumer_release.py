"""Check My Library's adoption contract without publication or service access."""

import fnmatch
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import unquote, urlsplit

from tests.release_test_support import temporary_directory


ROOT = Path(__file__).resolve().parents[1]
UPSTREAM_BASELINE_HASHES = {
  "scripts/release.sh": "70c7cd8178760bc3772334f7855a4c4ce912fe8cff7ddab8de33614a431ac70b",
  "scripts/release-common.sh": "34ff0197f467994267beede70083a00dea69c2b8c7b24b966bb2e021a3cfaa9b",
  "scripts/release-data.py": "db250d7f6a0f6b419a9aeb9dcebec1a487c175f1901074b1039e19fcf9b2e5fa",
  "tests/fixtures/bash_release_ports.py": "c0c3cd8c3691db155f4c53538b3fe1d13b9f4ec9c3ccc19aa52f6cb509d3f153",
}
ADAPTED_HASHES = {
  "scripts/release.sh": "8420c6a358aa107a1df885ee6727d835dd890e6a27182aa424f89407d7311a43",
  "scripts/release-common.sh": "d3a282d37e2a522443373d8ddd131a34bd6625ae1f08b371df046fb4509585d6",
  "scripts/release-data.py": "4f6dd3fca52b05a56375dd2d47716c008af6bebbe8bbf1fe01fe3c2cee5cf580",
  "tests/fixtures/bash_release_ports.py": "4650fab536ca47b34bb4eef19e5a0e9f4fee5288c3cd267702476d5f50d55e00",
}


def anchors(text):
  """Resolve the simple GitHub-style headings used in our operator documents."""
  headings = re.findall(r"^#{1,6} (.+)$", re.sub(r"```.*?```", "", text, flags=re.S), re.M)
  seen, result = {}, set()
  for heading in headings:
    slug = re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
    count = seen.get(slug, 0)
    seen[slug] = count + 1
    result.add(slug if count == 0 else f"{slug}-{count}")
  return result


class ConsumerReleaseTests(unittest.TestCase):
  def test_protocol_and_fake_ports_match_documented_immutable_pin(self):
    """Keep upstream baseline evidence distinct from reviewed downstream bytes."""
    provenance = (ROOT / "docs/release-adaptations.md").read_text()
    self.assertIn("5b918ba0aefb9ac9643fa99976140c95d17cb3e2", provenance)
    self.assertEqual(set(UPSTREAM_BASELINE_HASHES), set(ADAPTED_HASHES))
    for name, expected in ADAPTED_HASHES.items():
      with self.subTest(path=name):
        self.assertIn(UPSTREAM_BASELINE_HASHES[name], provenance)
        self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), expected)

  def test_configuration_version_notes_and_npm_metadata_agree(self):
    config = json.loads((ROOT / "scripts/release.json").read_text())
    version = (ROOT / "VERSION").read_text().strip()
    package = json.loads((ROOT / "package.json").read_text())
    lock = json.loads((ROOT / "package-lock.json").read_text())
    self.assertEqual([package["version"], lock["version"], lock["packages"][""]["version"]], [version] * 3)
    self.assertEqual(config, {
      "schema": 1, "gitea": "https://git.lan", "repository": "dev/my-library",
      "image": "git.lan/dev/my-library", "username": "dev", "token_file": "~/.config/git/token",
      "notes": f"docs/releases/{version}.md", "platforms": ["linux/amd64", "linux/arm64"],
    })
    notes = (ROOT / config["notes"]).read_bytes()
    self.assertTrue(notes.startswith(f"# Release v{version}\n".encode()))
    self.assertLessEqual(len(notes), 65536)

  def test_release_labels_come_from_buildx_not_obsolete_build_arguments(self):
    script = (ROOT / "scripts/release.sh").read_text()
    dockerfile = (ROOT / "Dockerfile").read_text()
    for field in ("version", "revision", "source"):
      self.assertIn(f'--label "org.opencontainers.image.{field}=', script)
      self.assertNotIn(f"org.opencontainers.image.{field}=", dockerfile)
    self.assertNotIn("BUILD_VERSION", dockerfile)
    self.assertIn('LABEL org.opencontainers.image.title="My Library"', dockerfile)
    for contract in ("USER node", "prisma ./prisma", "playwright install --with-deps chromium",
                     "HEALTHCHECK", 'ENTRYPOINT ["docker-entrypoint.sh"]', 'CMD ["node", "server.js"]'):
      self.assertIn(contract, dockerfile)
    self.assertIn("prisma migrate deploy", (ROOT / "docker-entrypoint.sh").read_text())

  def test_image_allowlist_includes_build_inputs_but_excludes_secrets_and_release_state(self):
    rules = (ROOT / ".dockerignore").read_text().splitlines()
    self.assertEqual(rules[0], "*")
    allowed = [rule[1:] for rule in rules if rule.startswith("!")]
    for name in ("package.json", "package-lock.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs",
                 "tailwind.config.ts", "tsconfig.json", "docker-entrypoint.sh", "prisma/schema.prisma", "src/app/page.tsx"):
      with self.subTest(input=name):
        self.assertTrue(any(fnmatch.fnmatchcase(name, pattern) for pattern in allowed))
    for name in (".env", "tasks/private.md", "scripts/release.json", ".git/config", ".template-operation.lock",
                 ".release-template/state", ".template-transaction/state", "token"):
      with self.subTest(excluded=name):
        self.assertFalse(any(fnmatch.fnmatchcase(name, pattern) for pattern in allowed))

  def test_full_image_override_preserves_default_and_legacy_selection(self):
    compose = (ROOT / "docker-compose.yml").read_text()
    expression = re.search(r"^    image: (.+)$", compose, re.M).group(1)
    self.assertEqual(expression, "${MY_LIBRARY_IMAGE:-git.lan/dev/my-library:${MY_LIBRARY_VERSION:-latest}}")
    cases = [({}, "git.lan/dev/my-library:latest"), ({"MY_LIBRARY_VERSION": "v0.7.3"}, "git.lan/dev/my-library:v0.7.3"),
             ({"MY_LIBRARY_IMAGE": "git.lan/dev/my-library@sha256:" + "a" * 64, "MY_LIBRARY_VERSION": "ignored"},
              "git.lan/dev/my-library@sha256:" + "a" * 64)]
    environment = {k: v for k, v in os.environ.items() if k not in ("MY_LIBRARY_IMAGE", "MY_LIBRARY_VERSION")}
    for values, expected in cases:
      with self.subTest(values=values):
        result = subprocess.run(["bash", "-c", 'printf "%s" "' + expression + '"'],
                                env=environment | values, capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout, expected)

  def assert_local_reference(self, source, reference):
    url = urlsplit(reference)
    if url.scheme or url.netloc:
      return None
    target = (source.parent / unquote(url.path)).resolve() if url.path else source
    self.assertTrue(target.is_relative_to(ROOT), f"Escaping documentation reference: {source}: {reference}")
    self.assertTrue(target.is_file(), f"Missing documentation target: {source}: {reference}")
    if url.fragment:
      self.assertIn(unquote(url.fragment), anchors(target.read_text()), f"Missing anchor: {source}: {reference}")
    return target

  def test_diagnostic_targets_and_transitive_document_links_resolve_offline(self):
    pending = [ROOT / "docs/publish-a-release.md", ROOT / "docs/verification.md", ROOT / "docs/image-usage.md"]
    diagnostics = set()
    for name in ("release.sh", "release-common.sh", "release-data.py"):
      diagnostics.update(re.findall(r"docs/[\w/-]+\.md(?:#[\w-]+)?", (ROOT / "scripts" / name).read_text()))
    self.assertTrue(diagnostics, "The release diagnostics must expose operator guidance")
    for reference in diagnostics:
      target = self.assert_local_reference(ROOT / "diagnostic", reference)
      pending.append(target)
    visited = set()
    while pending:
      source = pending.pop()
      if source in visited:
        continue
      visited.add(source)
      for reference in re.findall(r"\]\(([^)]+)\)", source.read_text()):
        with self.subTest(source=source.relative_to(ROOT), reference=reference):
          target = self.assert_local_reference(source, reference)
          if target is not None and target.suffix == ".md":
            pending.append(target)

  def test_validation_with_missing_token_cannot_invoke_services_or_create_state(self):
    with temporary_directory(prefix="consumer-release-") as directory:
      base = Path(directory)
      root, binaries = base / "project", base / "bin"
      (root / "scripts").mkdir(parents=True)
      binaries.mkdir()
      config = json.loads((ROOT / "scripts/release.json").read_text())
      for name in ("release.sh", "release-common.sh", "release-data.py", "release.json"):
        shutil.copyfile(ROOT / "scripts" / name, root / "scripts" / name)
      shutil.copyfile(ROOT / "VERSION", root / "VERSION")
      for name in ("Dockerfile", ".dockerignore"):
        shutil.copyfile(ROOT / name, root / name)
      notes = root / config["notes"]
      notes.parent.mkdir(parents=True)
      shutil.copyfile(ROOT / config["notes"], notes)
      marker = base / "external-command-invoked"
      for name in ("git", "curl", "docker"):
        path = binaries / name
        path.write_text(f'#!/bin/bash\ntouch "{marker}"\nexit 99\n')
        path.chmod(0o755)
      before = {path.relative_to(root) for path in root.rglob("*")}
      environment = os.environ | {"PATH": str(binaries) + ":" + os.environ["PATH"],
                                  "GIT_TOKEN": str(base / "missing-token"), "TMPDIR": str(base)}
      result = subprocess.run(["bash", str(root / "scripts/release.sh"), "--validate"], cwd=base,
                              env=environment, capture_output=True, text=True, timeout=10)
      self.assertEqual(result.returncode, 0, result.stderr)
      self.assertIn("no credentials or remote operations", result.stdout)
      self.assertFalse(marker.exists())
      self.assertEqual(before, {path.relative_to(root) for path in root.rglob("*")})
      self.assertFalse(list(base.glob("bash-release.*")))

  def test_legacy_token_interface_is_not_used(self):
    for name in ("scripts/release.sh", "scripts/release-common.sh", "docs/publish-a-release.md"):
      with self.subTest(path=name):
        text = (ROOT / name).read_text()
        self.assertNotIn("FORGEJO_TOKEN", text)
        self.assertNotIn("FORGEJO_USER", text)
    # The pinned helper mentions legacy names only to strip inherited secrets
    # from child environments, not to accept the old inline-token interface.
    spec = importlib.util.spec_from_file_location("consumer_release_data", ROOT / "scripts/release-data.py")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    with patch.dict(os.environ, {"FORGEJO_TOKEN": "PRIVATE_LEGACY_SENTINEL", "FORGEJO_USER": "legacy"}):
      result = helper.command([sys.executable, "-c", "import os; print(os.getenv('FORGEJO_TOKEN')); print(os.getenv('FORGEJO_USER'))"])
    self.assertEqual(result, b"None\nNone\n")
