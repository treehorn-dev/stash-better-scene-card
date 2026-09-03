(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StashBetterSceneCardRules = api;
})(typeof window === "undefined" ? null : window, function () {
  function validDateParts(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return { year, month, day };
  }

  function ageOnDate(birthdate, referenceDate) {
    const birth = validDateParts(birthdate);
    const reference = validDateParts(referenceDate);
    if (!birth || !reference || reference.year < birth.year) return null;

    const birthdayPassed =
      reference.month > birth.month ||
      (reference.month === birth.month && reference.day >= birth.day);
    return reference.year - birth.year - (birthdayPassed ? 0 : 1);
  }

  function mean(values) {
    if (!values.length) return null;
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  }

  function genderedMeanAges(performers, sceneDate) {
    const ages = { female: [], male: [] };
    for (const performer of performers || []) {
      const age = ageOnDate(performer.birthdate, sceneDate);
      if (age === null) continue;
      if (performer.gender === "FEMALE") ages.female.push(age);
      if (performer.gender === "MALE") ages.male.push(age);
    }
    return { female: mean(ages.female), male: mean(ages.male) };
  }

  function ratingBadge(scene, predictedScore) {
    const local = Number(scene && scene.rating100);
    const prediction = Number(predictedScore);
    const localAvailable = Number.isFinite(local) && local > 0;
    const predictionAvailable = Number.isFinite(prediction) && prediction > 0;
    if (!localAvailable && !predictionAvailable) return null;

    const value = localAvailable ? local / 20 : Math.min(prediction, 5);
    return {
      className: `rating-100-${Math.round(value * 4)}`,
      mode: localAvailable ? "local" : "predicted",
      value,
    };
  }

  function cardRuleClasses(scene) {
    const files = Array.isArray(scene && scene.files) ? scene.files : [];
    const classes = [];
    if (files.length === 0) classes.push("better-scene-card--fileless");
    if (files.filter((file) => file.video_codec).length >= 2) {
      classes.push("better-scene-card--multi-video");
    }

    const plays = Number(scene && scene.play_count) || 0;
    const oCount = Number(scene && scene.o_counter) || 0;
    const ratio = plays > 0 ? Math.max(0, Math.min(1, oCount / plays)) : 0;
    classes.push(`better-scene-card--o-play-${Math.round(ratio * 100)}`);
    return classes;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function rgb(red, green, blue) {
    return `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
  }

  function ageColor(age) {
    const value = clamp(Number(age) || 18, 18, 50);
    if (value <= 34) {
      const progress = (value - 18) / 16;
      return rgb(255, progress * 255, 0);
    }
    const progress = (value - 34) / 16;
    return rgb(255 * (1 - progress), 255 * (1 - progress), progress * 255);
  }

  function oPlayColor(ratio) {
    return rgb(clamp(Number(ratio) || 0, 0, 1) * 255, 0, 0);
  }

  return {
    ageColor,
    ageOnDate,
    cardRuleClasses,
    genderedMeanAges,
    oPlayColor,
    ratingBadge,
  };
});
