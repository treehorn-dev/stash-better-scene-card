const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rules = require("../plugin/stashBetterSceneCard/ui/card-rules-model.js");
const chipSlotsApi = require("../plugin/stashBetterSceneCard/ui/chip-slots-model.js");
const valueRegistryApi = require("../plugin/stashBetterSceneCard/ui/value-provider-registry.js");

function loadPlugin({ chipSlots = chipSlotsApi, registryApi = valueRegistryApi } = {}) {
  const patches = new Map();
  let root;
  const React = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children } };
    },
    cloneElement(element, props, ...children) {
      return {
        ...element,
        props: { ...element.props, ...props, children: children.length ? children : element.props.children },
      };
    },
    useEffect(effect) {
      root.__effects.push(effect);
    },
    useState(initial) {
      return [root.__ageBirthdates ?? initial, () => {}];
    },
  };
  root = {
    PluginApi: {
      React,
      hooks: {
        useSettings: () => ({
          plugins: { stashBetterSceneCard: { chip_slots: root.__chipSlots || "" } },
        }),
      },
      libraries: { Apollo: { gql: (strings) => strings.join("") } },
      patch: {
        after(name, callback) {
          patches.set(name, callback);
        },
      },
      utils: {
        StashService: {
          getClient: () => ({ query: async () => ({ data: { findPerformers: { performers: [] } } }) }),
        },
      },
    },
    StashBetterSceneCardRules: rules,
    StashBetterSceneCardChipSlots: chipSlots,
    StashBetterSceneCardAgeCache: {
      createPerformerAgeCache: () => ({ getMany: async () => ({}) }),
    },
    StashBetterSceneCardValueRegistry: registryApi,
    __effects: [],
  };
  root.globalThis = root;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "plugin", "stashBetterSceneCard", "ui", "better-scene-card.js"), "utf8"),
    root,
  );
  return { patches, root };
}

test("renders configured chip slots in order, caps them at three, and hides absent provider values", () => {
  const { patches, root } = loadPlugin();
  root.__chipSlots = JSON.stringify([
    { label: { type: "text", value: "First" }, value: { type: "function", body: "return 1;" } },
    { label: { type: "text", value: "Missing" }, value: { type: "function", body: "return helpers.value('missing.provider', scene);" } },
    { label: { type: "text", value: "Second" }, value: { type: "function", body: "return 2;" } },
    { label: { type: "text", value: "Third" }, value: { type: "function", body: "return 3;" } },
    { label: { type: "text", value: "Fourth" }, value: { type: "function", body: "return 4;" } },
  ]);

  const overlay = patches.get("SceneCard.Overlays")(
    { scene: { id: "42" } },
    undefined,
    { type: "native-overlays", props: { children: [] } },
  );
  const configuredSlotsElement = overlay.props.children[1].props.children[0];
  const slotRail = configuredSlotsElement.type(configuredSlotsElement.props);
  const chips = slotRail.props.children;
  assert.deepEqual(chips.map((chip) => chip.props["data-chip-label"]), ["First", "Second"]);
  assert.deepEqual(chips.map((chip) => chip.props.children[1]), ["1", "2"]);

  const lifecycleElement = overlay.props.children[1].props.children[1];
  assert.equal(lifecycleElement.type.name, "ProviderLifecycle");
  assert.equal(typeof root.StashBetterSceneCard.registerValue, "function");
});

test("default score chip falls back to a registered external value provider", () => {
  const { patches, root } = loadPlugin();
  root.StashBetterSceneCard.registerValue("stash-recommendations.predicted-rating", {
    get: () => 4.2,
    load: () => undefined,
  });

  const overlay = patches.get("SceneCard.Overlays")(
    { scene: { id: "42", rating100: null } },
    undefined,
    { type: "native-overlays", props: { children: [] } },
  );
  const configuredSlotsElement = overlay.props.children[1].props.children[0];
  const slotRail = configuredSlotsElement.type(configuredSlotsElement.props);
  const scoreChip = slotRail.props.children[0];
  assert.equal(scoreChip.props.children[1], "4.2");
  assert.equal(scoreChip.props.className.includes("better-scene-card__badge--border"), true);
});

test("shares compiled slots between rendering and provider lifecycle until configuration changes", () => {
  let parseCalls = 0;
  const { patches, root } = loadPlugin({
    chipSlots: {
      ...chipSlotsApi,
      parseChipSlots(source) {
        parseCalls += 1;
        return chipSlotsApi.parseChipSlots(source);
      },
    },
  });
  root.__chipSlots = JSON.stringify([
    { label: { type: "text", value: "Score" }, value: { type: "function", body: "return 1;" } },
  ]);

  const overlay = patches.get("SceneCard.Overlays")(
    { scene: { id: "compiled" } },
    undefined,
    { type: "native-overlays", props: { children: [] } },
  );
  const [configuredSlots, lifecycle] = overlay.props.children[1].props.children;
  configuredSlots.type(configuredSlots.props);
  lifecycle.type(lifecycle.props);
  assert.equal(parseCalls, 1);
});

test("evaluates mounted card chip formulas through the registry without awaiting", async () => {
  const { patches, root } = loadPlugin();
  const batches = [];
  root.__chipSlots = JSON.stringify([
    {
      label: { type: "icon", name: "star" },
      value: {
        type: "function",
        body: "return helpers.value('example.score', scene);",
      },
    },
  ]);
  root.StashBetterSceneCard.registerValue("example.score", {
    get: () => undefined,
    load: ({ sceneIds }) => batches.push(sceneIds),
  });

  const overlay = patches.get("SceneCard.Overlays")(
    { scene: { id: "missing-value" } },
    undefined,
    { type: "native-overlays", props: { children: [] } },
  );
  const lifecycleElement = overlay.props.children[1].props.children[1];
  lifecycleElement.type(lifecycleElement.props);
  const cleanups = root.__effects.splice(0).map((effect) => effect()).filter(Boolean);
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.deepEqual(batches, [["missing-value"]]);
  cleanups.forEach((cleanup) => cleanup());
});

test("requests missing chip values from the committed lifecycle rather than render", () => {
  const requests = [];
  const registry = {
    observeScene() {},
    request(name, scene) {
      requests.push([name, scene.id]);
    },
    subscribe() {
      return () => {};
    },
    unobserveScene() {},
    value() {
      return null;
    },
  };
  const { patches, root } = loadPlugin({
    registryApi: { createValueProviderRegistry: () => registry },
  });
  root.__chipSlots = JSON.stringify([
    {
      label: { type: "icon", name: "star" },
      value: { type: "function", body: "return helpers.value('example.score', scene);" },
    },
  ]);
  const overlay = patches.get("SceneCard.Overlays")(
    { scene: { id: "committed" } },
    undefined,
    { type: "native-overlays", props: { children: [] } },
  );
  const lifecycleElement = overlay.props.children[1].props.children[1];
  lifecycleElement.type(lifecycleElement.props);
  assert.deepEqual(requests, []);

  root.__effects.splice(0).forEach((effect) => effect());
  assert.deepEqual(requests, [["example.score", "committed"]]);
});

test("patches the native root with card rule classes", () => {
  const { patches } = loadPlugin();
  const nativeCard = { type: "native-card", props: { className: "scene-card" } };
  const result = patches.get("SceneCard")(
    { scene: { files: [], o_counter: 1, play_count: 2 } },
    undefined,
    nativeCard,
  );

  assert.equal(result.props.className.includes("better-scene-card--fileless"), true);
  assert.equal(result.props.className.includes("better-scene-card--o-play-50"), true);
});

test("appends gendered ages to the native date line with only numbers colored", () => {
  const { patches, root } = loadPlugin();
  root.__ageBirthdates = { "1": "2000-01-01", "2": "1990-01-01" };
  const dateLine = {
    type: "span",
    props: { className: "scene-card__date", children: ["2020-01-01"] },
  };
  const details = patches.get("SceneCard.Details")(
    {
      scene: {
        date: "2020-01-01",
        performers: [
          { id: "1", gender: "FEMALE" },
          { id: "2", gender: "MALE" },
        ],
      },
    },
    undefined,
    { type: "native-details", props: { children: [dateLine, "details"] } },
  );

  const patchedDateLine = details.props.children[0];
  assert.equal(patchedDateLine.props.className, "scene-card__date");
  assert.equal(patchedDateLine.props.children[0], "2020-01-01");
  const ageLineElement = patchedDateLine.props.children[1];
  const ageLine = ageLineElement.type(ageLineElement.props);
  const [leadingSpace, femaleSymbol, femaleAge, separator, maleSymbol, maleAge] = ageLine.props.children;
  assert.equal(leadingSpace, " ");
  assert.equal(femaleSymbol.props.children[0], "♀");
  assert.equal(femaleSymbol.props.style, undefined);
  assert.equal(femaleAge.props.children[0], "20");
  assert.equal(femaleAge.props.style.color, "rgb(255, 32, 0)");
  assert.equal(separator, " ");
  assert.equal(maleSymbol.props.children[0], "♂");
  assert.equal(maleSymbol.props.style, undefined);
  assert.equal(maleAge.props.children[0], "30");
  assert.equal(maleAge.props.style.color, "rgb(255, 191, 0)");
});

test("omits performer ages when the scene has no valid production date", () => {
  const { patches, root } = loadPlugin();
  root.__ageBirthdates = { "1": "2000-01-01" };
  const dateLine = {
    type: "span",
    props: { className: "scene-card__date", children: [""] },
  };
  const details = patches.get("SceneCard.Details")(
    { scene: { performers: [{ id: "1", gender: "FEMALE" }] } },
    undefined,
    { type: "native-details", props: { children: [dateLine] } },
  );

  assert.equal(details.props.children.length, 1);
  assert.deepEqual(details.props.children[0].props.children, [""]);
});

test("uses ISO year and year-month scene dates for ages without changing displayed date text", () => {
  for (const [sceneDate, expectedAge] of [["2022", "21"], ["2022-03", "22"]]) {
    const { patches, root } = loadPlugin();
    root.__ageBirthdates = { "1": "2000-02-15" };
    const dateLine = {
      type: "span",
      props: { className: "scene-card__date", children: [sceneDate] },
    };
    const details = patches.get("SceneCard.Details")(
      {
        scene: {
          date: sceneDate,
          performers: [{ id: "1", gender: "FEMALE" }],
        },
      },
      undefined,
      { type: "native-details", props: { children: [dateLine] } },
    );

    const patchedDateLine = details.props.children[0];
    assert.equal(patchedDateLine.props.children[0], sceneDate);
    const ageLineElement = patchedDateLine.props.children[1];
    const ageLine = ageLineElement.type(ageLineElement.props);
    assert.equal(ageLine.props.children[2].props.children[0], expectedAge);
  }
});
