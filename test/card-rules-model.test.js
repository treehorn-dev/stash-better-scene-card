const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ageOnDate,
  cardRuleClasses,
  genderedMeanAges,
  ratingBadge,
} = require("../plugin/stashBetterSceneCard/ui/card-rules-model.js");

test("ratingBadge prefers a local rating over a registered prediction", () => {
  assert.deepEqual(ratingBadge({ rating100: 75 }, 4.9), {
    className: "rating-100-15",
    mode: "local",
    value: 3.75,
  });
});

test("ratingBadge renders a predicted score only when there is no local rating", () => {
  assert.deepEqual(ratingBadge({ rating100: null }, 4.2), {
    className: "rating-100-17",
    mode: "predicted",
    value: 4.2,
  });
  assert.equal(ratingBadge({ rating100: null }, null), null);
});

test("ageOnDate computes age at the scene date and rejects invalid values", () => {
  assert.equal(ageOnDate("2000-06-01", "2020-05-31"), 19);
  assert.equal(ageOnDate("2000-06-01", "2020-06-01"), 20);
  assert.equal(ageOnDate("bad-date", "2020-06-01"), null);
  assert.equal(ageOnDate("2000-06-01", "not-a-date"), null);
});

test("genderedMeanAges uses only female and male performers", () => {
  assert.deepEqual(
    genderedMeanAges(
      [
        { gender: "FEMALE", birthdate: "2000-01-01" },
        { gender: "FEMALE", birthdate: "1998-01-01" },
        { gender: "MALE", birthdate: "1990-01-01" },
        { gender: "TRANSGENDER_FEMALE", birthdate: "1995-01-01" },
      ],
      "2020-01-01",
    ),
    { female: 21, male: 30 },
  );
});

test("cardRuleClasses flags fileless and multi-video scenes with a clamped O/play bucket", () => {
  assert.deepEqual(
    cardRuleClasses({
      files: [{ video_codec: "h264" }, { video_codec: "hevc" }],
      o_counter: 8,
      play_count: 4,
    }),
    ["better-scene-card--multi-video", "better-scene-card--o-play-100"],
  );
  assert.deepEqual(
    cardRuleClasses({ files: [], o_counter: 0, play_count: 4 }),
    ["better-scene-card--fileless", "better-scene-card--o-play-0"],
  );
});
