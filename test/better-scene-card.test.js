const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rules = require("../plugin/stashBetterSceneCard/ui/card-rules-model.js");

function loadPlugin() {
  const patches = new Map();
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
      return [initial, () => {}];
    },
  };
  const root = {
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
  };
  root.globalThis = root;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "plugin", "stashBetterSceneCard", "ui", "better-scene-card.js"), "utf8"),
    root,
  );
  return { patches, root };
}

test("registers only after patches and exposes the page-local score registry", () => {
  const { patches, root } = loadPlugin();

  assert.deepEqual([...patches.keys()].sort(), ["SceneCard", "SceneCard.Details", "SceneCard.Overlays"]);
  assert.equal(typeof root.StashBetterSceneCard.setRecommendationScore, "function");
  assert.equal(typeof root.StashBetterSceneCard.clearRecommendationScores, "function");
  root.StashBetterSceneCard.setRecommendationScore("42", 4.2);

  const overlay = patches.get("SceneCard.Overlays")(
    { scene: { id: "42", rating100: null } },
    { type: "native-overlays", props: { children: [] } },
  );
  const badgeElement = overlay.props.children[1].props.children[0];
  const badge = badgeElement.type(badgeElement.props);
  assert.equal(badge.props.className.includes("better-scene-card__badge--predicted"), true);
  assert.equal(badge.props.children[0], "4.2");
  root.StashBetterSceneCard.clearRecommendationScores();
});

test("patches the native root with card rule classes", () => {
  const { patches } = loadPlugin();
  const nativeCard = { type: "native-card", props: { className: "scene-card" } };
  const result = patches.get("SceneCard")(
    { scene: { files: [], o_counter: 1, play_count: 2 } },
    nativeCard,
  );

  assert.equal(result.props.className.includes("better-scene-card--fileless"), true);
  assert.equal(result.props.className.includes("better-scene-card--o-play-50"), true);
});
