const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_CHIP_SLOTS,
  clearDiagnostics,
  compileSlot,
  helpers,
  parseChipSlots,
  resolveSlot,
} = require("../plugin/stashBetterSceneCard/ui/chip-slots-model.js");

test("default slots preserve score and O-to-play behavior", () => {
  const slots = parseChipSlots();
  assert.equal(slots.length, 2);

  assert.deepEqual(resolveSlot(slots[0], { rating100: 80 }), {
    label: { type: "icon", name: "star" },
    value: 4,
    mode: "filled",
    style: { backgroundColor: "rgb(255, 102, 0)" },
  });
  assert.deepEqual(resolveSlot(slots[1], { o_counter: 3, play_count: 4 }), {
    label: { type: "text", value: "O/P" },
    value: 75,
    mode: "filled",
    style: { backgroundColor: "rgb(192, 0, 0)" },
  });
  assert.equal(resolveSlot(slots[0], { rating100: null }), null);
  assert.equal(DEFAULT_CHIP_SLOTS.length, 2);
});

test("parsing preserves order but caps chip slots at three", () => {
  const source = JSON.stringify(
    Array.from({ length: 4 }, (_, index) => ({
      label: { type: "text", value: String(index) },
      value: { type: "function", body: `return ${index};` },
    })),
  );

  const slots = parseChipSlots(source);
  assert.equal(slots.length, 3);
  assert.deepEqual(
    slots.map((slot) => resolveSlot(slot, {}).label.value),
    ["0", "1", "2"],
  );
});

test("slots support typed static and computed icon/text labels with scalar values", () => {
  const staticSlot = compileSlot({
    label: { type: "text", value: "fa-star" },
    value: { type: "function", body: "return scene.title;" },
  });
  assert.deepEqual(resolveSlot(staticSlot, { title: "Literal text" }), {
    label: { type: "text", value: "fa-star" },
    value: "Literal text",
    mode: "filled",
    style: {},
  });

  const computedSlot = compileSlot({
    label: {
      type: "function",
      body: "return value >= 2 ? helpers.icon('fire') : helpers.text('low');",
    },
    value: { type: "function", body: "return scene.files.length;" },
  });
  assert.deepEqual(resolveSlot(computedSlot, { files: [{}, {}] }), {
    label: { type: "icon", name: "fire" },
    value: 2,
    mode: "filled",
    style: {},
  });
  assert.deepEqual(helpers.icon("star"), { type: "icon", name: "star" });
  assert.deepEqual(helpers.text("fa-star"), { type: "text", value: "fa-star" });
});

test("min/mid/max color scales interpolate numeric values", () => {
  const slot = compileSlot({
    label: { type: "icon", name: "star" },
    value: { type: "function", body: "return scene.score;" },
    color: {
      type: "scale",
      min: { value: 0, color: "#000000" },
      mid: { value: 50, color: "#ff0000" },
      max: { value: 100, color: "#ffffff" },
    },
  });
  assert.equal(resolveSlot(slot, { score: 25 }).style.backgroundColor, "rgb(128, 0, 0)");
  assert.equal(resolveSlot(slot, { score: 75 }).style.backgroundColor, "rgb(255, 128, 128)");
  assert.equal(resolveSlot(slot, { score: -1 }).style.backgroundColor, "rgb(0, 0, 0)");
});

test("color functions accept style objects and receive the resolved value", () => {
  const slot = compileSlot({
    label: { type: "icon", name: "circle" },
    value: { type: "function", body: "return scene.count;" },
    color: {
      type: "function",
      body: "return { color: '#fff', borderColor: value > 1 ? '#0ff' : '#333' };",
    },
    mode: "border",
  });

  assert.deepEqual(resolveSlot(slot, { count: 2 }), {
    label: { type: "icon", name: "circle" },
    value: 2,
    mode: "border",
    style: { color: "#fff", borderColor: "#0ff" },
    fill: { color: "#000000", alpha: 0.55 },
  });
});

test("border slots preserve configured translucent fill color and alpha", () => {
  const slot = compileSlot({
    label: { type: "icon", name: "star" },
    value: { type: "function", body: "return 1;" },
    mode: "border",
    fill: { color: "#101820", alpha: 0.4 },
  });

  assert.deepEqual(resolveSlot(slot, {}), {
    label: { type: "icon", name: "star" },
    value: 1,
    mode: "border",
    style: {},
    fill: { color: "#101820", alpha: 0.4 },
  });
});

test("invalid, throwing, async, and non-scalar slot results are isolated", () => {
  const base = { label: { type: "icon", name: "star" } };
  const samples = [
    { ...base, value: { type: "function", body: "throw new Error('bad');" } },
    { ...base, value: { type: "function", body: "return Promise.resolve(1);" } },
    { ...base, value: { type: "function", body: "return { value: 1 };" } },
    {
      ...base,
      value: { type: "function", body: "return 1;" },
      color: { type: "function", body: "return Promise.resolve('#fff');" },
    },
    {
      ...base,
      value: { type: "function", body: "return 1;" },
      label: { type: "function", body: "return 'untyped';" },
    },
  ];

  for (const sample of samples) {
    assert.equal(resolveSlot(compileSlot(sample), {}), null);
  }
  assert.equal(compileSlot({ label: { type: "icon", name: "star" } }), null);
  assert.equal(parseChipSlots("not JSON").length, 2);
});

test("helpers.value obtains synchronous scalar provider values only", () => {
  const slot = compileSlot({
    label: { type: "text", value: "External" },
    value: {
      type: "function",
      body: "return helpers.value('example.value', scene);",
    },
  });

  assert.equal(
    resolveSlot(slot, { id: "1" }, { value: (name, scene) => `${name}:${scene.id}` }).value,
    "example.value:1",
  );
  assert.equal(
    resolveSlot(slot, {}, { value: () => Promise.resolve(1) }),
    null,
  );
});

test("invalid JSON and formula failures produce deduplicated diagnostics", () => {
  clearDiagnostics();
  const diagnostics = [];
  const options = { onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) };

  parseChipSlots("not JSON", options);
  parseChipSlots("not JSON", options);
  const broken = compileSlot({
    label: { type: "icon", name: "star" },
    value: { type: "function", body: "throw new Error('broken formula');" },
  });
  resolveSlot(broken, {}, options);
  resolveSlot(broken, {}, options);

  assert.deepEqual(diagnostics, [
    "Invalid chip_slots JSON; using defaults.",
    "Chip slot value formula failed; hiding slot.",
  ]);
});
