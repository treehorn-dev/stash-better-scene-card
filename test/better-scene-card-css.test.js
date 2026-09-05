const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const stylesheet = fs.readFileSync(
  path.join(__dirname, "..", "plugin", "stashBetterSceneCard", "ui", "better-scene-card.css"),
  "utf8",
);

test("scopes the stock ribbon replacement to native scene cards", () => {
  assert.match(stylesheet, /\.scene-card\.better-scene-card \.rating-banner\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(stylesheet, /^\.rating-banner\s*\{/m);
});

test("renders compact poster badges in a left rail below the native selection control", () => {
  assert.match(stylesheet, /\.better-scene-card__badge-bar\s*\{[\s\S]*flex-direction:\s*column;/);
  assert.match(stylesheet, /\.better-scene-card__configured-chips\s*\{[\s\S]*flex-direction:\s*column;/);
  assert.match(stylesheet, /\.better-scene-card__configured-chips\s*\{[\s\S]*align-items:\s*flex-start;/);
  assert.match(stylesheet, /\.better-scene-card__badge-bar\s*\{[\s\S]*left:\s*0\.7rem;/);
  assert.match(stylesheet, /\.better-scene-card__badge-bar\s*\{[\s\S]*top:\s*0\.7rem;/);
  assert.match(stylesheet, /\.better-scene-card__badge-bar\s*\{[\s\S]*z-index:\s*2;/);
  assert.match(stylesheet, /\.scene-card\.better-scene-card \.card-controls\s*\{[\s\S]*z-index:\s*3;/);
  assert.match(stylesheet, /\.scene-card\.better-scene-card \.card-controls\s*\{[\s\S]*left:\s*0;/);
  assert.match(stylesheet, /\.scene-card\.better-scene-card \.card-controls\s*\{[\s\S]*right:\s*auto;/);
  assert.match(stylesheet, /\.scene-card\.better-scene-card \.card-controls\s*\{[\s\S]*top:\s*0;/);
  assert.match(stylesheet, /\.scene-card\.better-scene-card \.card-check\s*\{[\s\S]*margin:\s*0;/);
  assert.match(stylesheet, /\.scene-card\.better-scene-card \.card-check\s*\{[\s\S]*padding:\s*0;/);
  assert.match(stylesheet, /\.better-scene-card__badge\s*\{[\s\S]*color:\s*#fff;/);
  assert.match(stylesheet, /\.better-scene-card__badge--predicted\s*\{[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.65\)/);
  assert.match(stylesheet, /\.better-scene-card__badge\.rating-100-20\s*\{[\s\S]*--better-scene-card-score-color:\s*#f00;/);
});

test("styles multi-video, fileless, O/play, and clamped age states", () => {
  assert.match(stylesheet, /\.scene-card\.better-scene-card--multi-video\s*\{[\s\S]*border-color:\s*#00c8d7;/);
  assert.match(stylesheet, /\.scene-card\.better-scene-card--fileless\s*\{[\s\S]*filter:\s*grayscale\(1\)/);
  assert.match(stylesheet, /\.better-scene-card--o-play-0[\s\S]*background:\s*#000;/);
  assert.match(stylesheet, /\.better-scene-card--o-play-100[\s\S]*background:\s*#f00;/);
  assert.match(stylesheet, /\.better-scene-card__age--18\s*\{[\s\S]*#f00;/);
  assert.match(stylesheet, /\.better-scene-card__age--34\s*\{[\s\S]*#ff0;/);
  assert.match(stylesheet, /\.better-scene-card__age--50\s*\{[\s\S]*#00f;/);
});
