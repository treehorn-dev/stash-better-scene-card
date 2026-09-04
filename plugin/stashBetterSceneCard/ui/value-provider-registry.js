(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StashBetterSceneCardValueRegistry = api;
})(typeof window === "undefined" ? null : window, function () {
  function createValueProviderRegistry({ debounceMs = 0 } = {}) {
    const providers = new Map();
    const listeners = new Set();
    const observedSceneIds = new Map();
    let timer = null;

    function notify() {
      for (const listener of listeners) listener();
    }

    function isObserved(sceneId) {
      return (observedSceneIds.get(String(sceneId)) || 0) > 0;
    }

    function schedule() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, debounceMs);
    }

    function queue(entry, sceneId) {
      if (entry.inFlight.has(sceneId)) return;
      entry.pending.add(sceneId);
      schedule();
    }

    function abortStaleBatches(entry) {
      for (const batch of entry.batches) {
        if (batch.ids.some(isObserved)) continue;
        batch.controller.abort();
        for (const sceneId of batch.ids) {
          if (entry.inFlight.get(sceneId) === batch) entry.inFlight.delete(sceneId);
        }
      }
    }

    function registerValue(name, provider) {
      if (
        typeof name !== "string" ||
        !name ||
        !provider ||
        typeof provider.get !== "function" ||
        typeof provider.load !== "function"
      ) {
        return false;
      }
      providers.set(name, {
        provider,
        pending: new Set(),
        inFlight: new Map(),
        batches: new Set(),
      });
      notify();
      return true;
    }

    function read(entry, scene) {
      if (!entry || !scene || scene.id == null) return { missing: false, value: null };
      let value;
      try {
        value = entry.provider.get({ scene });
      } catch (_error) {
        return { missing: false, value: null };
      }
      if (value != null && typeof value.then === "function") {
        return { missing: false, value: null };
      }
      return { missing: value === undefined, value: value === undefined ? null : value };
    }

    function value(name, scene) {
      const entry = providers.get(name);
      return read(entry, scene).value;
    }

    function request(name, scene) {
      const entry = providers.get(name);
      const result = read(entry, scene);
      if (!entry || !result.missing || !scene || scene.id == null) return;
      queue(entry, String(scene.id));
    }

    function observeScene(scene) {
      if (!scene || scene.id == null) return;
      const sceneId = String(scene.id);
      observedSceneIds.set(sceneId, (observedSceneIds.get(sceneId) || 0) + 1);
      schedule();
    }

    function unobserveScene(scene) {
      if (!scene || scene.id == null) return;
      const sceneId = String(scene.id);
      const count = observedSceneIds.get(sceneId) || 0;
      if (count <= 1) observedSceneIds.delete(sceneId);
      else observedSceneIds.set(sceneId, count - 1);
      for (const entry of providers.values()) abortStaleBatches(entry);
    }

    function startBatch(entry, ids) {
      const controller = new AbortController();
      const batch = { controller, ids };
      entry.batches.add(batch);
      for (const sceneId of ids) entry.inFlight.set(sceneId, batch);
      let load;
      try {
        load = entry.provider.load({ sceneIds: ids, signal: controller.signal });
      } catch (_error) {
        load = undefined;
      }
      return Promise.resolve(load)
        .catch(() => undefined)
        .finally(() => {
          entry.batches.delete(batch);
          for (const sceneId of ids) {
            if (entry.inFlight.get(sceneId) === batch) entry.inFlight.delete(sceneId);
          }
          notify();
        });
    }

    function flush() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      const loads = [];
      for (const entry of providers.values()) {
        const sceneIds = [...entry.pending].filter(isObserved);
        for (const sceneId of sceneIds) entry.pending.delete(sceneId);
        if (sceneIds.length) loads.push(startBatch(entry, sceneIds));
      }
      return Promise.all(loads).then(() => undefined);
    }

    function subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    return {
      flush,
      observeScene,
      request,
      registerValue,
      subscribe,
      unobserveScene,
      value,
    };
  }

  return { createValueProviderRegistry };
});
