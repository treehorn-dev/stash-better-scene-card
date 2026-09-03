# Initial Card Rules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add reusable visual rules to native Stash scene cards: replace the stock rating ribbon with a compact badge, show gendered mean performer ages after the scene date, and style fileless/multi-video/O-to-play cases.

**Architecture:** The plugin patches native `SceneCard.Details` and `SceneCard.Overlays`; it does not replace `SceneCard`, its player preview, navigation, or controls. A public `window.StashBetterSceneCard` score registry lets providers such as Stash Recommendations register predicted ratings by local scene ID. Performer birthdates are loaded through one batched, cached GraphQL broker and are combined with the scene date (or today if absent) for female and male mean-age labels.

**Tech Stack:** Stash UI Plugin API, React, Apollo GraphQL, CSS, Node built-in test runner.

### Task 1: Define pure rule models

**Files:**
- Create: `plugin/stashBetterSceneCard/ui/card-rules-model.js`
- Create: `test/card-rules-model.test.js`

**Step 1: Write failing tests**

Add table-driven tests for:
- `ratingBadge` preferring local `rating100`, then a registered predicted score, otherwise no badge;
- local badges using the native `rating-100-N` class and predicted badges having an outline/black-alpha mode;
- age calculation against `scene.date`, returning no value for invalid birthdate/date;
- gendered means using only `FEMALE` and `MALE` performer records;
- `cardRuleClasses` returning `fileless`, `multi-video`, and an O/play ratio bucket where ratio is clamped to `[0, 1]`.

**Step 2: Run the test to verify it fails**

Run: `node --test test/card-rules-model.test.js`

Expected: FAIL because `card-rules-model.js` does not exist.

**Step 3: Implement the minimum pure helpers**

Implement deterministic, dependency-free functions. Preserve Stash's existing rating color scale by mapping a five-point value to the nearest `rating-100-N` class. Define the O/play class as `better-scene-card--o-play-0` through `--o-play-100` and leave the color mapping in CSS.

**Step 4: Run the focused test to verify it passes**

Run: `node --test test/card-rules-model.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add plugin/stashBetterSceneCard/ui/card-rules-model.js test/card-rules-model.test.js
git commit -m "feat: add native scene card rule models"
```

### Task 2: Implement batched performer birthdate lookup

**Files:**
- Create: `plugin/stashBetterSceneCard/ui/performer-age-cache.js`
- Create: `test/performer-age-cache.test.js`

**Step 1: Write failing tests**

Write a fake Apollo client test proving that simultaneous `getMany` calls:
- combine unique IDs into one `findPerformers(ids: ...)` query;
- cache returned `{id, birthdate}` values;
- notify every waiting caller;
- return no age data when a request fails, without retrying each rendered card immediately.

**Step 2: Run the test to verify it fails**

Run: `node --test test/performer-age-cache.test.js`

Expected: FAIL because the cache module does not exist.

**Step 3: Implement the minimum broker**

Implement one in-memory cache per browser page. Queue unseen performer IDs in the current tick, issue a single Apollo query with `ids`, store successful values, and resolve subscriber callbacks. Do not persist personal data, query remote sources, or issue one request per scene card.

**Step 4: Run the focused test to verify it passes**

Run: `node --test test/performer-age-cache.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add plugin/stashBetterSceneCard/ui/performer-age-cache.js test/performer-age-cache.test.js
git commit -m "feat: batch performer age metadata for scene cards"
```

### Task 3: Patch native cards and publish the score registry

**Files:**
- Modify: `plugin/stashBetterSceneCard/ui/better-scene-card.js`
- Modify: `test/manifest.test.js`
- Create: `test/better-scene-card.test.js`

**Step 1: Write failing tests**

Build a minimal Plugin API/React harness and assert that registration:
- patches `SceneCard.Details` and `SceneCard.Overlays` without replacing `SceneCard`;
- appends a date-adjacent age element only after birthdate data is available;
- appends a compact overlay badge for local or registered predicted ratings;
- exposes `window.StashBetterSceneCard.setRecommendationScore(sceneId, score)` and `clearRecommendationScores()`;
- applies rule classes to the native scene-card root through the patch path.

**Step 2: Run the focused test to verify it fails**

Run: `node --test test/better-scene-card.test.js`

Expected: FAIL because the UI entry currently does not register patches.

**Step 3: Implement the smallest patch adapter**

Use `PluginApi.patch.after` so native rendering remains authoritative. The `Details` patch adds female/male age labels after the date. The `Overlays` patch returns native overlays plus a badge container. Publish only the documented score-registry methods on `window.StashBetterSceneCard`; scores are page-local and keyed by scene ID.

**Step 4: Run the focused test to verify it passes**

Run: `node --test test/better-scene-card.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add plugin/stashBetterSceneCard/ui/better-scene-card.js test/manifest.test.js test/better-scene-card.test.js
git commit -m "feat: patch native scene cards with badges and ages"
```

### Task 4: Add native-compatible styling

**Files:**
- Modify: `plugin/stashBetterSceneCard/ui/better-scene-card.css`
- Create: `test/better-scene-card-css.test.js`

**Step 1: Write failing CSS contract tests**

Assert the stylesheet:
- hides `.scene-card .rating-banner` but does not target other card types;
- positions the compact badge inside the poster overlay with translucent black fill and white text;
- imports no color scale incompatible with native `rating-100-N` colors;
- gives `multi-video` a cyan border and `fileless` a muted/grayscale presentation;
- defines a black-to-red O/play gradient for the clamped ratio buckets;
- defines red/yellow/blue age-badge colors with clamped 18/34/50 anchors.

**Step 2: Run the focused test to verify it fails**

Run: `node --test test/better-scene-card-css.test.js`

Expected: FAIL because the stylesheet is only a placeholder.

**Step 3: Implement the styles**

Use scoped `.scene-card.better-scene-card` selectors. Preserve native card dimensions, hover preview behavior, Studio overlay, duration, interactive speed, heatmap, and count popovers. A predicted rating uses the same hue as its native score class with a translucent black fill and contrasting border rather than a solid local-rating fill.

**Step 4: Run the focused test to verify it passes**

Run: `node --test test/better-scene-card-css.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add plugin/stashBetterSceneCard/ui/better-scene-card.css test/better-scene-card-css.test.js
git commit -m "feat: style native scene card rules"
```

### Task 5: Verify, package, and PR

**Files:**
- Modify: `README.md`
- Modify: `plugin/stashBetterSceneCard/stashBetterSceneCard.yml` only if the package version changes.

**Step 1: Document the public API**

Document the score registry methods, local-only age data use, supported rules, and the fact that SceneCard patch targets are experimental Stash UI API.

**Step 2: Run full verification**

Run: `npm test`

Expected: all tests pass.

**Step 3: Commit**

```bash
git add README.md plugin/stashBetterSceneCard/stashBetterSceneCard.yml
git commit -m "docs: describe better scene card rules"
```

**Step 4: Push and create a PR**

Push `feat/initial-card-rules`, create a PR against `main`, and include the verified test command and explicit manual QA checklist for `/scenes` cards, fileless cards, multi-video cards, and recommendations cards.

