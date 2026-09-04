# Configurable Chip Slots Design

## Goals

Better Scene Card will place up to three chips in a left-side poster rail. The
selection checkbox must remain unobstructed when the card is hovered. Performer
ages render inline after a scene date and use the date text color for the sex
symbols.

Chip values must be user-configurable without coupling Better Scene Card to
Stash Recommendations or any other plugin.

## Configuration

The plugin stores an ordered list of at most three slot objects. Each slot has
a typed label descriptor, a JavaScript function body, a color specification,
and a presentation mode (`filled` or `border`). Border mode also defines the
chip fill color and alpha. A label is never inferred from a string:

```js
{ type: "icon", name: "star" }
{ type: "text", value: "fa-star" }
```

Static labels and computed labels use the same descriptor contract. Formulae
return descriptors through `helpers.icon(name)` and `helpers.text(value)`.

The function is compiled once when configuration changes and is invoked as:

```js
function ({ scene, helpers }) {
  return scene.files.filter((file) => file.video_codec).length;
}
```

Built-in choices are function templates, not a limit on custom expressions.
Value functions must synchronously return a scalar. Invalid code, exceptions,
promises, and non-scalar results hide that slot for the affected card and
produce a deduplicated diagnostic.

Color specifications are either a declarative min/mid/max interpolation scale
or a JavaScript function. A color function receives `{ scene, value, helpers }`
and returns either a CSS color string or an explicit style object containing
`color`, `backgroundColor`, and/or `borderColor`.

## External Values

Better Scene Card exposes a generic global registry. Plugins register named
providers with a synchronous cache read and an optional batched asynchronous
loader. Formulae synchronously call `helpers.value(name, scene)`; they never
await while rendering.

```js
registerValue("provider.value", {
  get({ scene }) { return cache.get(scene.id); },
  load({ sceneIds, signal }) { return populateCache(sceneIds, signal); },
});
```

Mounted cards queue missing values by provider. A short debounce batches the
current page's scene IDs, deduplicates in-flight loads, aborts stale page
requests, and rerenders after caches change. Stash Recommendations may register
its predicted rating through this API, but Better Scene Card contains no
recommendation-specific logic.

## Documentation

The release includes a tutorial covering slot anatomy, static and dynamic
labels, value and color functions, built-in templates, external providers,
cache and batching semantics, error behavior, and copyable examples for rating,
media count, and O-to-play ratio chips. It explicitly states that formulas are
trusted local JavaScript and must not fetch during render.

## Verification

Tests will cover slot ordering and maximum count, left-rail/check-box behavior,
inline age rendering, typed label handling, formula failure isolation, scale
and color-function rendering, provider batching/deduplication/abort behavior,
absent-provider handling, and tutorial examples.
