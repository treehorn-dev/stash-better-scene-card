# Better Scene Card

Better Scene Card augments native Stash `SceneCard` rendering through the UI
patch API. It keeps Stash responsible for card layout, navigation, hover
previews, Studio overlays, duration, interactive-speed overlays, heatmaps, and
count popovers.

## Included Rules

- Adds up to three configurable chips in a left poster rail.
- Ships score and O-to-play defaults, with user-defined labels, formulas, and styles.
- Adds female and male mean-age labels after the scene date when local performer
  birthdates are available.
- Marks cards with two or more video files using a cyan outline.
- Mutes fileless cards without changing their behavior.

Performer birthdates are fetched from the current Stash instance in page-local
batches and cached only in browser memory. The plugin does not persist or send
that data elsewhere.

## Chip Configuration

Configure up to three ordered card chips through the `Chip Slots` setting. The
setting accepts JSON and supports trusted JavaScript formula bodies, typed icon
or text labels, color scales, custom style functions, and optional batched
external value providers.

See the complete, copyable guide: [Chip Slots Tutorial](docs/chip-slots-tutorial.md).

The tutorial is also included in every release ZIP as
`docs/chip-slots-tutorial.md`.

The Stash `SceneCard` patch targets are experimental UI API surface. Validate
the plugin after upgrading Stash, especially `/scenes`, fileless scenes,
multi-video scenes, and cards rendered by other plugins.

## Installation

Add this package source in Stash:

```text
https://github.com/treehorn-dev/stash-better-scene-card/releases/latest/download/index.yml
```

Tagged releases attach the Stash package archive and `index.yml` automatically.
