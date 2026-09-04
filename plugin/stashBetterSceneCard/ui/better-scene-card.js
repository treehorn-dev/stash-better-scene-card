(function (root) {
  if (!root || !root.PluginApi) return;

  const { PluginApi } = root;
  const React = PluginApi.React;
  const rules = root.StashBetterSceneCardRules;
  const ageCacheApi = root.StashBetterSceneCardAgeCache;
  if (!rules || !ageCacheApi) return;

  const Apollo = PluginApi.libraries.Apollo;
  const scores = new Map();
  const FIND_PERFORMER_BIRTHDATES = Apollo.gql`
    query BetterSceneCardPerformerBirthdates($ids: [ID!]) {
      findPerformers(ids: $ids, filter: { per_page: 100 }) {
        performers {
          id
          birthdate
        }
      }
    }
  `;
  const ageCache = ageCacheApi.createPerformerAgeCache(async (ids) => {
    const response = await PluginApi.utils.StashService.getClient().query({
      query: FIND_PERFORMER_BIRTHDATES,
      variables: { ids },
      fetchPolicy: "cache-first",
    });
    return response.data?.findPerformers?.performers || [];
  });

  function validProductionDate(value) {
    if (typeof value !== "string") return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function AgeLine({ scene }) {
    const performers = (scene.performers || []).filter((performer) => performer.id);
    const [birthdates, setBirthdates] = React.useState(null);
    const ids = performers.map((performer) => String(performer.id));

    React.useEffect(() => {
      let active = true;
      if (!ids.length) return undefined;
      ageCache.getMany(ids).then((values) => {
        if (active) setBirthdates(values);
      });
      return () => {
        active = false;
      };
    }, [ids.join(",")]);

    if (!birthdates) return null;
    if (!validProductionDate(scene.date)) return null;
    const ages = rules.genderedMeanAges(
      performers.map((performer) => ({
        ...performer,
        birthdate: birthdates[String(performer.id)],
      })),
      scene.date,
    );
    if (ages.female === null && ages.male === null) return null;

    const labels = [" "];
    if (ages.female !== null) {
      labels.push(
        React.createElement(
          "span",
          { className: "better-scene-card__age-symbol" },
          "♀",
        ),
        React.createElement(
          "span",
          { className: "better-scene-card__age", style: { color: rules.ageColor(ages.female) } },
          String(ages.female),
        ),
      );
    }
    if (ages.male !== null) {
      if (ages.female !== null) labels.push(" ");
      labels.push(
        React.createElement(
          "span",
          { className: "better-scene-card__age-symbol" },
          "♂",
        ),
        React.createElement(
          "span",
          { className: "better-scene-card__age", style: { color: rules.ageColor(ages.male) } },
          String(ages.male),
        ),
      );
    }
    return React.createElement(
      "span",
      { className: "better-scene-card__ages" },
      ...labels,
    );
  }

  function ScoreBadge({ scene }) {
    const badge = rules.ratingBadge(scene, scores.get(String(scene.id)));
    if (!badge) return null;
    return React.createElement(
      "span",
      {
        className: [
          "better-scene-card__badge",
          `better-scene-card__badge--${badge.mode}`,
          badge.className,
        ].join(" "),
      },
      badge.value.toFixed(1),
    );
  }

  function OPlayBadge({ scene }) {
    const plays = Number(scene.play_count) || 0;
    const oCount = Number(scene.o_counter) || 0;
    const ratio = plays > 0 ? Math.max(0, Math.min(1, oCount / plays)) : 0;
    const bucket = Math.round(ratio * 100);
    return React.createElement(
      "span",
      {
        className: `better-scene-card__badge better-scene-card__o-play better-scene-card__o-play--${bucket}`,
        style: { backgroundColor: rules.oPlayColor(ratio) },
        title: "O-to-play ratio",
      },
      `O/P ${bucket}%`,
    );
  }

  PluginApi.patch.after("SceneCard", (...args) => {
    const props = args[0] || {};
    const result = args.at(-1);
    if (!result?.props) return result;
    const scene = props.scene || {};
    const className = [
      result.props.className,
      "better-scene-card",
      ...rules.cardRuleClasses(scene),
    ]
      .filter(Boolean)
      .join(" ");
    return React.cloneElement(result, { className });
  });

  PluginApi.patch.after("SceneCard.Details", (...args) => {
    const props = args[0] || {};
    const result = args.at(-1);
    if (!result?.props) return result;
    const scene = props.scene || {};
    if (!validProductionDate(scene.date)) return result;
    const children = Array.isArray(result.props.children)
      ? result.props.children
      : [result.props.children];
    const dateIndex = children.findIndex(
      (child) => child?.props?.className === "scene-card__date",
    );
    if (dateIndex < 0) return result;
    const dateLine = children[dateIndex];
    const dateChildren = Array.isArray(dateLine.props.children)
      ? dateLine.props.children
      : [dateLine.props.children];
    children[dateIndex] = React.cloneElement(
      dateLine,
      null,
      ...dateChildren,
      React.createElement(AgeLine, { scene }),
    );
    return React.cloneElement(
      result,
      null,
      ...children,
    );
  });

  PluginApi.patch.after("SceneCard.Overlays", (...args) => {
    const props = args[0] || {};
    const result = args.at(-1);
    if (!result) return result;
    return React.createElement(
      React.Fragment,
      null,
      result,
      React.createElement(
        "div",
        { className: "better-scene-card__badge-bar" },
        React.createElement(ScoreBadge, { scene: props.scene || {} }),
        React.createElement(OPlayBadge, { scene: props.scene || {} }),
      ),
    );
  });

  root.StashBetterSceneCard = {
    clearRecommendationScores() {
      scores.clear();
    },
    setRecommendationScore(sceneId, score) {
      const value = Number(score);
      if (!sceneId || !Number.isFinite(value)) return;
      scores.set(String(sceneId), Math.max(0, Math.min(5, value)));
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
