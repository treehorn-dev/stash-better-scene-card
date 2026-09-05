# Configurable Chip Slots Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render a configurable left chip rail with isolated user formulas and optional batched external values.

**Architecture:** A pure model parses the `chip_slots` JSON setting, compiles function bodies once, and resolves labels, values, and colors. The UI owns card lifecycle batching for external providers. Stash Recommendations optionally registers a provider; Better Scene Card has no recommendation-specific code.

**Tech Stack:** Stash raw UI plugin API, JavaScript, Node built-in test runner, CSS, GraphQL/Apollo.

### Task 1: Add the Pure Chip Configuration Model

**Files:**
- Create: `plugin/stashBetterSceneCard/ui/chip-slots-model.js`
- Create: `test/chip-slots-model.test.js`
- Modify: `plugin/stashBetterSceneCard/stashBetterSceneCard.yml`

**Step 1: Write failing tests**
Test default score and O/play slots, a three-slot cap, typed static and computed labels, scalar values, min/mid/max scales, style-object colors, and isolated invalid/async formula failures.

**Step 2: Run the focused test**
Run: `node --test test/chip-slots-model.test.js`
Expected: FAIL because the model does not exist.

**Step 3: Implement the model**
Add `parseChipSlots`, `compileSlot`, `resolveSlot`, `helpers.icon`, `helpers.text`, `helpers.value`, and color interpolation. Function context is `{ scene, helpers, value }`; value functions may use scene/helpers, color functions also receive resolved value. Treat thrown errors, thenables, and invalid results as absent. Add a JSON string `chip_slots` setting with defaults matching current score and O/play behavior.

**Step 4: Run focused tests**
Run: `node --test test/chip-slots-model.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add plugin/stashBetterSceneCard/ui/chip-slots-model.js plugin/stashBetterSceneCard/stashBetterSceneCard.yml test/chip-slots-model.test.js
git commit -m "feat: add configurable chip slot model"
```

### Task 2: Correct Card Layout and Age Rendering

**Files:**
- Modify: `plugin/stashBetterSceneCard/ui/better-scene-card.js`
- Modify: `plugin/stashBetterSceneCard/ui/better-scene-card.css`
- Modify: `test/better-scene-card.test.js`
- Modify: `test/better-scene-card-css.test.js`

**Step 1: Write failing tests**
Assert a vertical left rail that leaves the native selection control available on hover. Assert the age text is injected in the date child as `date ♀22 ♂20`, with only each number colored.

**Step 2: Run focused tests**
Run: `node --test test/better-scene-card.test.js test/better-scene-card-css.test.js`
Expected: FAIL against the top rail and standalone age line.

**Step 3: Implement minimal layout changes**
Replace the badge bar with a left overlay rail below the selection-checkbox hit area. Use CSS stacking to keep the native checkbox above the rail on hover. Rewrite `AgeLine` to append inline to the native date output and wrap symbols separately from colored numbers.

**Step 4: Run focused tests**
Run: `node --test test/better-scene-card.test.js test/better-scene-card-css.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add plugin/stashBetterSceneCard/ui/better-scene-card.js plugin/stashBetterSceneCard/ui/better-scene-card.css test/better-scene-card.test.js test/better-scene-card-css.test.js
git commit -m "fix: align card chip rail and age line"
```

### Task 3: Add the External Value Provider Registry

**Files:**
- Create: `plugin/stashBetterSceneCard/ui/value-provider-registry.js`
- Create: `test/value-provider-registry.test.js`
- Modify: `plugin/stashBetterSceneCard/stashBetterSceneCard.yml`
- Modify: `plugin/stashBetterSceneCard/ui/better-scene-card.js`

**Step 1: Write failing tests**
Test synchronous cache reads, missing IDs coalescing into one debounced batch, in-flight deduplication, stale batches receiving an abort signal, completion subscriptions, and absent-provider safety.

**Step 2: Run focused tests**
Run: `node --test test/value-provider-registry.test.js`
Expected: FAIL because the registry does not exist.

**Step 3: Implement the registry**
Expose `window.StashBetterSceneCard.registerValue(name, { get, load })`. Card-mounted slot evaluation queues missing provider values by name and debounces one `load({ sceneIds, signal })` per provider. Abort stale requests and rerender subscribers after loads settle. Never await in formula evaluation or React render.

**Step 4: Run focused tests**
Run: `node --test test/value-provider-registry.test.js test/better-scene-card.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add plugin/stashBetterSceneCard/ui/value-provider-registry.js plugin/stashBetterSceneCard/ui/better-scene-card.js plugin/stashBetterSceneCard/stashBetterSceneCard.yml test/value-provider-registry.test.js test/better-scene-card.test.js
git commit -m "feat: add batched external chip values"
```

### Task 4: Render Configured Slots and Adapt Recommendations

**Files:**
- Modify: `plugin/stashBetterSceneCard/ui/better-scene-card.js`
- Modify: `test/better-scene-card.test.js`
- Modify: `../stash-recommendations/plugin/stashRecommendations/ui/recommendations.js`
- Modify: `../stash-recommendations/tests/ui/recommendations.test.js`

**Step 1: Write failing tests**
Test ordered configured rendering, a three-slot cap, and absent-provider behavior. In Recommendations, test provider registration with its cached score map and a no-op when Better Scene Card is absent.

**Step 2: Run focused tests**
Run: `node --test test/better-scene-card.test.js`
Run: `node --test tests/ui/recommendations.test.js`
Expected: FAIL because configured rendering and generic registration do not exist.

**Step 3: Implement minimal integration**
Replace `ScoreBadge` and `OPlayBadge` with resolved slots. Adapt the Recommendations score map to register `stash-recommendations.predicted-rating` through the generic API. Do not add imports or manifests coupling the repositories.

**Step 4: Run focused tests**
Run: `node --test test/better-scene-card.test.js`
Run: `node --test tests/ui/recommendations.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add plugin/stashBetterSceneCard/ui/better-scene-card.js test/better-scene-card.test.js
git -C ../stash-recommendations add plugin/stashRecommendations/ui/recommendations.js tests/ui/recommendations.test.js
git commit -m "feat: render configured chip slots"
```

### Task 5: Publish the Tutorial and Verify Packages

**Files:**
- Create: `docs/chip-slots-tutorial.md`
- Modify: `README.md`
- Modify: `test/release-package.test.js`
- Modify: `scripts/build_plugin_package.py`

**Step 1: Write failing documentation/package checks**
Assert the tutorial is packaged and contains copyable examples for rating, external prediction, media count, O/play, labels, scales, style functions, and provider cache semantics.

**Step 2: Run the focused test**
Run: `node --test test/release-package.test.js`
Expected: FAIL because the tutorial is absent.

**Step 3: Write the tutorial**
Document JSON schema, trusted-code warning, descriptors, error behavior, external provider API, cache/batching requirements, defaults, and complete examples.

**Step 4: Run full verification**
Run: `npm test`
Expected: PASS.

Run: `python3 scripts/build_plugin_package.py --version 0.1.1 --output-dir /tmp/better-scene-card-release && unzip -t /tmp/better-scene-card-release/stashBetterSceneCard-0.1.1.zip`
Expected: archive verification succeeds and contains the tutorial.

**Step 5: Commit**
```bash
git add docs/chip-slots-tutorial.md README.md test/release-package.test.js scripts/build_plugin_package.py
git commit -m "docs: add configurable chip slots tutorial"
```
