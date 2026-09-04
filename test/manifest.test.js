const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("plugin manifest declares the Better Scene Card UI assets", () => {
  const manifest = fs.readFileSync(
    path.join(__dirname, "..", "plugin", "stashBetterSceneCard", "stashBetterSceneCard.yml"),
    "utf8"
  );

  assert.match(manifest, /^name: Better Scene Card$/m);
  assert.match(manifest, /^version: "0\.1\.0"$/m);
  assert.match(manifest, /^    type: STRING$/m);
  assert.match(manifest, /^  chip_slots:\n(?:    .*\n)*?    type: STRING$/m);
  assert.match(manifest, /^    - ui\/card-rules-model\.js$/m);
  assert.match(manifest, /^    - ui\/performer-age-cache\.js$/m);
  assert.match(manifest, /^    - ui\/better-scene-card\.js$/m);
  assert.match(manifest, /^    - ui\/better-scene-card\.css$/m);
});
