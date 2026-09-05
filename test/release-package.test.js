const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("publishes tag builds as GitHub release assets", () => {
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "release-plugin.yml"), "utf8");

  assert.match(workflow, /tags:\s*\n\s*- "v\*"/);
  assert.match(workflow, /scripts\/build_plugin_package\.py/);
  assert.match(workflow, /gh release create/);
});

test("builds an installable Stash package and matching release index", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-scene-card-release-"));

  try {
    execFileSync("python3", [
      "scripts/build_plugin_package.py",
      "--version",
      "0.1.1",
      "--output-dir",
      outputDir,
    ], { cwd: root });

    const archivePath = path.join(outputDir, "stashBetterSceneCard-0.1.1.zip");
    const index = fs.readFileSync(path.join(outputDir, "index.yml"), "utf8");
    const checksum = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
    const members = execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" });
    const manifest = execFileSync("unzip", ["-p", archivePath, "stashBetterSceneCard.yml"], {
      encoding: "utf8",
    });

    assert.match(index, /^- id: stashBetterSceneCard$/m);
    assert.match(index, /^  version: "0\.1\.1"$/m);
    assert.match(index, /releases\/download\/v0\.1\.1\/stashBetterSceneCard-0\.1\.1\.zip/);
    assert.match(index, new RegExp(`^  sha256: ${checksum}$`, "m"));
    assert.match(members, /^stashBetterSceneCard\.yml$/m);
    assert.match(manifest, /^version: "0\.1\.1"$/m);
    assert.match(members, /^ui\/better-scene-card\.js$/m);
    assert.match(members, /^ui\/better-scene-card\.css$/m);
    assert.match(members, /^docs\/chip-slots-tutorial\.md$/m);

    const tutorial = execFileSync("unzip", ["-p", archivePath, "docs/chip-slots-tutorial.md"], {
      encoding: "utf8",
    });
    const normalizedTutorial = tutorial.toLowerCase().replace(/\s+/g, " ");
    for (const example of [
      "Local rating",
      "External predicted rating",
      "Media count",
      "O/play ratio",
      "helpers.icon",
      "helpers.text",
      '"type": "scale"',
      '"type": "function"',
      "registerValue",
      "get({ scene })",
      "load({ sceneIds, signal })",
      "trusted code",
      "Invalid JSON and formula errors emit one deduplicated console warning",
      "Invalid labels, styles, non-finite values, and absent provider values silently hide only that chip",
    ]) {
      assert.ok(
        normalizedTutorial.includes(example.toLowerCase()),
        `tutorial should include ${example}`,
      );
    }
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
