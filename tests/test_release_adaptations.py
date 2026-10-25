"""Regressions for the reviewed downstream release adaptations."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import unittest
from unittest.mock import patch

from tests import test_bash_release as baseline


class PromotionGuardTests(unittest.TestCase):
  def test_confirmed_promotion_rejects_predecessor_absence_and_invalid_reads(self):
    for fault in ("predecessor", "absent", "foreign", "transport", "timeout", "malformed", "overflow", "null"):
      with self.subTest(fault=fault):
        case = baseline.BashPublicationTests()
        case.setUp()
        try:
          if fault != "absent":
            case.change(predecessor=case.predecessor())
          case.change(post_promotion_fault=fault)
          result = case.release()
          events = case.events()
          injected = "post-promotion-injected:" + fault
          self.assertIn(injected, events)
          self.assertNotEqual(result.returncode, 0)
          self.assertNotIn("Publication verified", result.stdout)
          self.assertFalse(set(events[events.index(injected) + 1:]) &
                           {"tag-push", "promote", "release-post", "package-link"}, events)
          self.assertEqual(case.state()["releases"], [])
          self.assertEqual(events.count("promote"), 1)
          self.assertEqual(events.count("tag-push"), 1)
          self.assertIn(case.state()["prepared"], case.state()["objects"])
        finally:
          case.doCleanups()


@unittest.skipUnless(shutil.which("docker"), "Native Docker CLI required for plugin discovery evidence")
class NativePluginTests(unittest.TestCase):
  def setUp(self):
    self.case = baseline.BashPublicationTests()
    self.case.setUp()
    self.addCleanup(self.case.doCleanups)
    self.data = baseline.helper_module()
    self.original = self.case.base / "original-docker"
    self.original.mkdir()
    self.work = self.case.base / "private-auth"
    self.work.mkdir(mode=0o700)
    self.environment = self.case.environment | {"DOCKER_CONFIG": str(self.original)}
    # Native probes must never select the fake Docker command in the publication fixture.
    self.docker = shutil.which("docker")

  def plugin(self, directory, marker):
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "docker-buildx"
    metadata = json.dumps({"SchemaVersion": "0.1.0", "Vendor": "Fixture", "Version": marker,
                           "ShortDescription": "Daemon-free discovery fixture"})
    path.write_text('#!/bin/sh\nif [ "$1" = docker-cli-plugin-metadata ]; then\n' +
                    "  echo '" + metadata + "'\nelse\n  echo '" + marker + "'\nfi\n")
    path.chmod(0o755)
    return path

  def probe(self, environment):
    return subprocess.run([self.docker, "buildx", "version"], cwd=self.case.base,
                          env=environment, capture_output=True, text=True, timeout=10)

  def prepare(self):
    with patch.dict(os.environ, self.environment, clear=True):
      self.data.auth(self.case.root, self.work)
    return self.environment | {"DOCKER_CONFIG": str(self.work / "docker"),
                               "BUILDX_CONFIG": str(self.original / "buildx")}

  def test_config_local_candidate_is_preserved_over_system_plugin(self):
    self.plugin(self.original / "cli-plugins", "config-local-marker")
    before = self.probe(self.environment)
    self.assertEqual(before.returncode, 0, before.stderr)
    self.assertEqual(before.stdout.strip(), "config-local-marker")
    after = self.probe(self.prepare())
    self.assertEqual(after.returncode, 0, after.stderr)
    self.assertEqual(after.stdout, before.stdout)

  def test_system_only_discovery_with_missing_original_config_is_unchanged(self):
    before = self.probe(self.environment)
    after = self.probe(self.prepare())
    self.assertEqual(after.returncode, before.returncode)
    self.assertEqual(after.stdout, before.stdout)
    self.assertFalse((self.original / "config.json").exists())
    self.assertEqual(set(json.loads((self.work / "docker/config.json").read_text())), {"auths"})

  def test_ordered_extra_directories_and_relative_paths_preserve_precedence(self):
    first, second = self.case.base / "first", self.case.base / "second"
    self.plugin(first, "first-marker")
    self.plugin(second, "second-marker")
    self.plugin(self.original / "cli-plugins", "local-marker")
    config = {"cliPluginsExtraDirs": ["first", "second"], "auths": {"foreign.invalid": {"auth": "PRIVATE"}},
              "credsStore": "must-not-run", "credHelpers": {"foreign.invalid": "must-not-run"}}
    (self.original / "config.json").write_text(json.dumps(config))
    self.environment["DOCKER_CONFIG"] = "original-docker"
    before = self.probe(self.environment)
    self.assertEqual(before.stdout.strip(), "first-marker", before.stderr)
    # auth resolves relative caller paths, just as the real release invocation does.
    with patch("os.getcwd", return_value=str(self.case.base)):
      environment = self.prepare()
    after = self.probe(environment)
    self.assertEqual(after.returncode, 0, after.stderr)
    self.assertEqual(after.stdout, before.stdout)
    private = json.loads((self.work / "docker/config.json").read_text())
    self.assertEqual(set(private), {"auths", "cliPluginsExtraDirs"})
    self.assertEqual(private["auths"], {"git.lan": {}})
    self.assertEqual(json.loads((self.original / "config.json").read_text()), config)

  def test_unusable_local_candidate_never_falls_back_after_isolation(self):
    candidate = self.plugin(self.original / "cli-plugins", "broken")
    candidate.chmod(0o644)
    before = self.probe(self.environment)
    self.assertNotEqual(before.returncode, 0)
    try:
      environment = self.prepare()
    except self.data.Refusal:
      return
    after = self.probe(environment)
    self.assertNotEqual(after.returncode, 0, "An unusable local candidate must not expose system fallback")

  def test_invalid_discovery_settings_are_refused_without_copying_secrets(self):
    for value in (None, "not-an-array", [7], [""]):
      with self.subTest(value=value):
        (self.original / "config.json").write_text(json.dumps({"cliPluginsExtraDirs": value}))
        with self.assertRaises(self.data.Refusal):
          self.prepare()
