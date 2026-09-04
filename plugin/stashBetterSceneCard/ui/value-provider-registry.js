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
        for (const sceneId of batch.ids) entry.inFlight.delete(sceneId);
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
        inFlight: new Set(),
        batches: new Set(),
      });
      notify();
      return true;
    }

    function value(name, scene) {
      const entry = providers.get(name);
      if (!entry || !scene || scene.id == null) return null;
      let result;
      try {
        result = entry.provider.get({ scene });
      } catch (_error) {
        return null;
      }
      if (result != null && typeof result.then === "function") return null;
      if (result !== undefined) return result;
      queue(entry, String(scene.id));
      return null;
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
      for (const sceneId of ids) entry.inFlight.add(sceneId);
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
          for (const sceneId of ids) entry.inFlight.delete(sceneId);
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
      registerValue,
      subscribe,
      unobserveScene,
      value,
    };
  }

  return { createValueProviderRegistry };
});
