# Configurable Chip Slots

Better Scene Card can render up to three ordered chips on the left side of a
native Stash scene card. Set **Settings > Plugins > Better Scene Card > Chip
Slots** to a JSON array. Leave it blank to use the built-in score and O/play
chips.

## Trusted Code Warning

Formula bodies are trusted JavaScript executed in the Stash browser session.
Only paste formulas you understand and trust. A formula receives only:

```js
function ({ scene, helpers, value }) {
  // scene: the native Stash SceneCard scene object
  // helpers: icon(), text(), and value()
  // value: the already resolved chip value (label/color/mode functions only)
}
```

Function bodies may contain statements and must `return` a result. They can
read any field available on the card's `scene` object. They must return
synchronously: a Promise or other thenable is treated as an error and that chip
is hidden.

Invalid JSON and formula errors emit one deduplicated console warning per
configuration revision. Invalid labels, styles, non-finite values, and absent
provider values silently hide only that chip. A broken chip therefore does not
break Stash's native cards.

## JSON Schema

The root is an array of at most three slot objects, in display order:

```json
[
  {
    "label": { "type": "icon", "name": "star" },
    "value": { "type": "function", "body": "return 4.5;" },
    "mode": "filled",
    "color": {
      "type": "scale",
      "min": { "value": 0, "color": "#000000" },
      "mid": { "value": 2.5, "color": "#ffff00" },
      "max": { "value": 5, "color": "#ff0000" }
    }
  }
]
```

`label` is a typed descriptor, never inferred from a string:

```json
{ "type": "icon", "name": "star" }
{ "type": "text", "value": "O/P" }
```

Use a label function when the label must vary by value. Return
`helpers.icon(name)` or `helpers.text(value)`:

```json
{
  "type": "function",
  "body": "return value >= 4 ? helpers.icon('fire') : helpers.text('OK');"
}
```

`value` is always a function descriptor. It may return a number, string, or
boolean. `mode` is `"filled"`, `"border"`, or a function returning either. A
border chip can specify an optional translucent fill:

```json
"mode": "border",
"fill": { "color": "#000000", "alpha": 0.55 }
```

## Copyable Value Examples

Use these `value` objects in a slot.

### Local Rating

```json
{
  "type": "function",
  "body": "const rating = Number(scene.rating100); return rating > 0 ? rating / 20 : null;"
}
```

### External Predicted Rating

This reads an optional cached provider. It hides until the provider supplies a
value; Better Scene Card itself has no dependency on Stash Recommendations.

```json
{
  "type": "function",
  "body": "return helpers.value('stash-recommendations.predicted-rating', scene);"
}
```

### Local Rating, Then External Predicted Rating

```json
{
  "type": "function",
  "body": "const rating = Number(scene.rating100); return rating > 0 ? rating / 20 : helpers.value('stash-recommendations.predicted-rating', scene);"
}
```

### Media Count

```json
{
  "type": "function",
  "body": "return Array.isArray(scene.files) ? scene.files.length : 0;"
}
```

### O/play Ratio

```json
{
  "type": "function",
  "body": "const plays = Number(scene.play_count) || 0; const oCount = Number(scene.o_counter) || 0; return plays > 0 ? (oCount / plays) * 100 : 0;"
}
```

## Color and Style

Use a three-point `scale` to interpolate a color from the resolved numeric
value. A scale color fills filled chips and supplies the border color for
border-mode chips.

```json
{
  "type": "scale",
  "min": { "value": 0, "color": "#000000" },
  "mid": { "value": 50, "color": "#800000" },
  "max": { "value": 100, "color": "#ff0000" }
}
```

For full control, use a style function. It receives `scene`, `helpers`, and the
resolved `value`, and may return a CSS color string or an object with
`color`, `backgroundColor`, and/or `borderColor`.

```json
{
  "type": "function",
  "body": "if (value >= 80) return { backgroundColor: '#991b1b', color: '#fff' }; return { borderColor: '#64748b', color: '#fff' };"
}
```

## External Value Providers: Cache and Batch

Another local Stash plugin can export named values without becoming a Better
Scene Card dependency. It registers a provider after Better Scene Card loads:

```js
const cache = new Map();

window.StashBetterSceneCard.registerValue("example.prediction", {
  get({ scene }) {
    return cache.has(scene.id) ? cache.get(scene.id) : undefined;
  },
  async load({ sceneIds, signal }) {
    const response = await fetch("/plugin/example/predictions", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sceneIds }),
    });
    const values = await response.json();
    for (const [sceneId, prediction] of Object.entries(values)) {
      cache.set(sceneId, prediction);
    }
  }
});
```

`get({ scene })` must be synchronous and return a cached scalar, `null` for an
intentional absence, or `undefined` when a value must be loaded. Better Scene
Card collects missing values from mounted cards, batches their IDs once per
provider, deduplicates in-flight requests, aborts stale page batches, and
rerenders cards after `load({ sceneIds, signal })` settles. Providers must not
do network work in `get`; fetch and cache only in `load`.

Use that provider in a chip formula:

```json
{
  "type": "function",
  "body": "return helpers.value('example.prediction', scene);"
}
```
