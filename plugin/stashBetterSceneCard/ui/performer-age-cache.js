(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StashBetterSceneCardAgeCache = api;
})(typeof window === "undefined" ? null : window, function () {
  function createPerformerAgeCache(fetchBirthdates) {
    const values = new Map();
    const pendingIds = new Set();
    const waiters = [];
    let scheduled = false;

    function resultFor(ids) {
      return Object.fromEntries(ids.map((id) => [id, values.get(id) || null]));
    }

    async function flush() {
      scheduled = false;
      const ids = [...pendingIds];
      pendingIds.clear();
      let performers = [];
      try {
        performers = await fetchBirthdates(ids);
      } catch (_) {
        performers = [];
      }

      const returned = new Map(
        (performers || []).map((performer) => [
          String(performer.id),
          performer.birthdate || null,
        ]),
      );
      for (const id of ids) values.set(id, returned.get(id) || null);

      const ready = waiters.splice(0);
      for (const waiter of ready) waiter.resolve(resultFor(waiter.ids));
    }

    function getMany(ids) {
      const uniqueIds = [...new Set((ids || []).map(String))];
      const unseen = uniqueIds.filter((id) => !values.has(id));
      if (!unseen.length) return Promise.resolve(resultFor(uniqueIds));

      for (const id of unseen) pendingIds.add(id);
      const promise = new Promise((resolve) => waiters.push({ ids: uniqueIds, resolve }));
      if (!scheduled) {
        scheduled = true;
        setTimeout(flush, 0);
      }
      return promise;
    }

    return { getMany };
  }

  return { createPerformerAgeCache };
});
