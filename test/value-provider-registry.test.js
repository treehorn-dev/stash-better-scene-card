const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createValueProviderRegistry,
} = require("../plugin/stashBetterSceneCard/ui/value-provider-registry.js");

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

test("reads synchronous provider cache values without loading", () => {
  const cache = new Map([["1", 4.2]]);
  const registry = createValueProviderRegistry();
  registry.registerValue("example.score", {
    get: ({ scene }) => cache.get(scene.id),
    load: () => assert.fail("cache hit must not load"),
  });

  assert.equal(registry.value("example.score", { id: "1" }), 4.2);
});

test("coalesces missing scene IDs into one debounced provider batch", async () => {
  const calls = [];
  const registry = createValueProviderRegistry({ debounceMs: 1 });
  registry.registerValue("example.score", {
    get: () => undefined,
    load: ({ sceneIds }) => calls.push(sceneIds),
  });

  registry.observeScene({ id: "1" });
  registry.observeScene({ id: "2" });
  registry.value("example.score", { id: "1" });
  registry.value("example.score", { id: "2" });
  registry.value("example.score", { id: "1" });
  await registry.flush();

  assert.deepEqual(calls, [["1", "2"]]);
});

test("does not reload scene IDs already in flight", async () => {
  const pending = deferred();
  const calls = [];
  const registry = createValueProviderRegistry();
  registry.registerValue("example.score", {
    get: () => undefined,
    load: ({ sceneIds }) => {
      calls.push(sceneIds);
      return pending.promise;
    },
  });

  registry.observeScene({ id: "1" });
  registry.value("example.score", { id: "1" });
  const loading = registry.flush();
  registry.value("example.score", { id: "1" });
  await registry.flush();
  assert.deepEqual(calls, [["1"]]);
  pending.resolve();
  await loading;
});

test("aborts stale provider batches when their scenes unmount", async () => {
  const pending = deferred();
  let signal;
  const registry = createValueProviderRegistry();
  registry.registerValue("example.score", {
    get: () => undefined,
    load: (request) => {
      signal = request.signal;
      return pending.promise;
    },
  });

  registry.observeScene({ id: "old" });
  registry.value("example.score", { id: "old" });
  const loading = registry.flush();
  registry.unobserveScene({ id: "old" });

  assert.equal(signal.aborted, true);
  pending.resolve();
  await loading;
});

test("notifies subscribers after a provider batch settles", async () => {
  const pending = deferred();
  const notifications = [];
  const registry = createValueProviderRegistry();
  registry.registerValue("example.score", {
    get: () => undefined,
    load: () => pending.promise,
  });
  registry.subscribe(() => notifications.push("changed"));

  registry.observeScene({ id: "1" });
  registry.value("example.score", { id: "1" });
  const loading = registry.flush();
  pending.resolve();
  await loading;

  assert.deepEqual(notifications, ["changed"]);
});

test("treats absent providers and invalid provider values as safely absent", () => {
  const registry = createValueProviderRegistry();
  assert.equal(registry.value("missing", { id: "1" }), null);
  assert.equal(registry.registerValue("broken", { get: () => Promise.resolve(1) }), false);
  assert.equal(
    registry.registerValue("async-cache", {
      get: () => Promise.resolve(1),
      load: () => undefined,
    }),
    true,
  );
  assert.equal(registry.value("async-cache", { id: "1" }), null);
});
