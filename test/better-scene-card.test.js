const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rules = require("../plugin/stashBetterSceneCard/ui/card-rules-model.js");
const valueRegistryApi = require("../plugin/stashBetterSceneCard/ui/value-provider-registry.js");

function loadPlugin() {
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
    useEffect() {},
    useState(initial) {
      return [root.__ageBirthdates ?? initial, () => {}];
    },
  };
  root = {
    PluginApi: {
      React,
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
    StashBetterSceneCardAgeCache: {
      createPerformerAgeCache: () => ({ getMany: async () => ({}) }),
    },
    StashBetterSceneCardValueRegistry: valueRegistryApi,
  };
  root.globalThis = root;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "plugin", "stashBetterSceneCard", "ui", "better-scene-card.js"), "utf8"),
    root,
  );
  return { patches, root };
}

test("registers only after patches and exposes provider registration with overlay lifecycle", () => {
  const { patches, root } = loadPlugin();

  assert.deepEqual([...patches.keys()].sort(), ["SceneCard", "SceneCard.Details", "SceneCard.Overlays"]);
  assert.equal(typeof root.StashBetterSceneCard.setRecommendationScore, "function");
  assert.equal(typeof root.StashBetterSceneCard.clearRecommendationScores, "function");
  assert.equal(typeof root.StashBetterSceneCard.registerValue, "function");
  assert.equal(
    root.StashBetterSceneCard.registerValue("example.score", {
      get: () => 4.2,
      load: () => undefined,
    }),
    true,
  );
  root.StashBetterSceneCard.setRecommendationScore("42", 4.2);

  const overlay = patches.get("SceneCard.Overlays")(
    { scene: { id: "42", rating100: null } },
    undefined,
    { type: "native-overlays", props: { children: [] } },
  );
  const badgeElement = overlay.props.children[1].props.children[0];
  const badge = badgeElement.type(badgeElement.props);
  assert.equal(badge.props.className.includes("better-scene-card__badge--predicted"), true);
  assert.equal(badge.props.children[0], "4.2");

  const oPlayBadgeElement = overlay.props.children[1].props.children[1];
  const oPlayBadge = oPlayBadgeElement.type(oPlayBadgeElement.props);
  assert.equal(oPlayBadge.props.className.includes("better-scene-card__o-play--0"), true);
  const lifecycleElement = overlay.props.children[1].props.children[2];
  assert.equal(lifecycleElement.type.name, "ProviderLifecycle");

  root.StashBetterSceneCard.clearRecommendationScores();
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
