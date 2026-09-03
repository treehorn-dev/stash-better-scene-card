const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createPerformerAgeCache,
} = require("../plugin/stashBetterSceneCard/ui/performer-age-cache.js");

test("getMany batches simultaneous unique performer IDs and caches birthdates", async () => {
  const queries = [];
  const cache = createPerformerAgeCache(async (ids) => {
    queries.push(ids);
    return [
      { id: "1", birthdate: "1990-01-01" },
      { id: "2", birthdate: "1995-02-02" },
    ];
  });

  const [first, second] = await Promise.all([
    cache.getMany(["1", "2"]),
    cache.getMany(["2"]),
  ]);

  assert.deepEqual(queries, [["1", "2"]]);
  assert.deepEqual(first, {
    1: "1990-01-01",
    2: "1995-02-02",
  });
  assert.deepEqual(second, { 2: "1995-02-02" });

  assert.deepEqual(await cache.getMany(["1"]), { 1: "1990-01-01" });
  assert.deepEqual(queries, [["1", "2"]]);
});

test("getMany resolves missing data after a failed request without immediate retries", async () => {
  let calls = 0;
  const cache = createPerformerAgeCache(async () => {
    calls += 1;
    throw new Error("network unavailable");
  });

  assert.deepEqual(await cache.getMany(["9"]), { 9: null });
  assert.deepEqual(await cache.getMany(["9"]), { 9: null });
  assert.equal(calls, 1);
});
