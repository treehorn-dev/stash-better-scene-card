# Better Scene Card

Better Scene Card augments native Stash `SceneCard` rendering through the UI
patch API. It keeps Stash responsible for card layout, navigation, hover
previews, Studio overlays, duration, interactive-speed overlays, heatmaps, and
count popovers.

## Included Rules

- Replaces only native scene-card rating ribbons with a compact poster badge.
- Shows a local rating when available; otherwise a registered predicted rating.
- Shows an O-to-play ratio badge from black (0%) to red (100%).
- Adds female and male mean-age labels after the scene date when local performer
  birthdates are available.
- Marks cards with two or more video files using a cyan outline.
- Mutes fileless cards without changing their behavior.

Performer birthdates are fetched from the current Stash instance in page-local
batches and cached only in browser memory. The plugin does not persist or send
that data elsewhere.

## Recommendation Provider API

Providers can register a page-local score for a local Stash scene after both
plugins load:

```js
window.StashBetterSceneCard.setRecommendationScore(sceneId, score);
```

`score` is clamped to `0..5`. A local Stash rating always wins over a predicted
score. Remove all provider scores for the current page with:

```js
window.StashBetterSceneCard.clearRecommendationScores();
```

The Stash `SceneCard` patch targets are experimental UI API surface. Validate
the plugin after upgrading Stash, especially `/scenes`, fileless scenes,
multi-video scenes, and cards rendered by other plugins.
