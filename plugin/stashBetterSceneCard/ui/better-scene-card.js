(function (root) {
  if (!root || !root.PluginApi) return;

  const { PluginApi } = root;
  const React = PluginApi.React;
  const rules = root.StashBetterSceneCardRules;
  const chipSlotsApi = root.StashBetterSceneCardChipSlots;
  const ageCacheApi = root.StashBetterSceneCardAgeCache;
  const valueRegistryApi = root.StashBetterSceneCardValueRegistry;
  if (!rules || !chipSlotsApi || !ageCacheApi || !valueRegistryApi) return;

  const Apollo = PluginApi.libraries.Apollo;
  const valueRegistry = valueRegistryApi.createValueProviderRegistry();
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

  function normalizedProductionDate(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2] || "01");
    const day = Number(match[3] || "01");
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
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
    const productionDate = normalizedProductionDate(scene.date);
    if (!productionDate) return null;
    const ages = rules.genderedMeanAges(
      performers.map((performer) => ({
        ...performer,
        birthdate: birthdates[String(performer.id)],
      })),
      productionDate,
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

  function rgba(hex, alpha) {
    const match = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!match) return hex;
    const value = match[1];
    return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)}, ${alpha})`;
  }

  function chipStyle(slot) {
    const style = { ...slot.style };
    if (slot.mode !== "border") return style;
    const borderColor = style.borderColor || style.backgroundColor || style.color;
    if (borderColor) style.borderColor = borderColor;
    if (slot.fill) style.backgroundColor = rgba(slot.fill.color, slot.fill.alpha);
    return style;
  }

  function renderChipLabel(label) {
    if (label.type === "text") return label.value;
    const FontAwesomeIcon = PluginApi.libraries.ReactFontAwesome?.FontAwesomeIcon;
    const icons = PluginApi.libraries.FontAwesomeSolid || {};
    const iconKey = `fa${label.name.replace(/(?:^|-)([a-z])/g, (_match, letter) => letter.toUpperCase())}`;
    if (FontAwesomeIcon && icons[iconKey]) {
      return React.createElement(FontAwesomeIcon, { fixedWidth: true, icon: icons[iconKey] });
    }
    return React.createElement("span", { "data-icon": label.name }, label.name);
  }

  function ConfiguredChipSlots({ scene }) {
    const [, setVersion] = React.useState(0);
    const settings = PluginApi.hooks.useSettings();
    const slots = chipSlotsApi.parseChipSlots(settings?.plugins?.stashBetterSceneCard?.chip_slots);
    React.useEffect(() => valueRegistry.subscribe(() => {
      setVersion((version) => version + 1);
    }), []);
    const resolved = slots
      .map((slot) => chipSlotsApi.resolveSlot(slot, scene, {
        value(name, requestedScene) {
          return valueRegistry.value(name, requestedScene || scene);
        },
      }))
      .filter(Boolean)
      .slice(0, 3);
    return React.createElement(
      "div",
      { className: "better-scene-card__configured-chips" },
      ...resolved.map((slot, index) => React.createElement(
        "span",
        {
          "data-chip-label": slot.label.type === "text" ? slot.label.value : slot.label.name,
          className: `better-scene-card__badge better-scene-card__badge--${slot.mode}`,
          key: `${slot.label.type}:${slot.label.type === "text" ? slot.label.value : slot.label.name}:${index}`,
          style: chipStyle(slot),
        },
        renderChipLabel(slot.label),
        String(slot.value),
      )),
    );
  }

  function ProviderLifecycle({ scene }) {
    const [, setVersion] = React.useState(0);
    const settings = PluginApi.hooks.useSettings();
    const source = settings?.plugins?.stashBetterSceneCard?.chip_slots;
    const slots = chipSlotsApi.parseChipSlots(source);
    const requestedValues = new Map();
    for (const slot of slots) {
      chipSlotsApi.resolveSlot(slot, scene, {
        value(name, requestedScene) {
          const targetScene = requestedScene || scene;
          if (targetScene && targetScene.id != null) {
            requestedValues.set(`${name}:${targetScene.id}`, { name, scene: targetScene });
          }
          return valueRegistry.value(name, targetScene);
        },
      });
    }
    const requestKey = [...requestedValues.keys()].sort().join(",");
    React.useEffect(() => {
      if (!scene || scene.id == null) return undefined;
      const unsubscribe = valueRegistry.subscribe(() => {
        setVersion((version) => version + 1);
      });
      valueRegistry.observeScene(scene);
      for (const request of requestedValues.values()) {
        valueRegistry.request(request.name, request.scene);
      }
      return () => {
        unsubscribe();
        valueRegistry.unobserveScene(scene);
      };
    }, [scene && scene.id, requestKey]);
    return null;
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
    if (!normalizedProductionDate(scene.date)) return result;
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
        React.createElement(ConfiguredChipSlots, { scene: props.scene || {} }),
        React.createElement(ProviderLifecycle, { scene: props.scene || {} }),
      ),
    );
  });

  root.StashBetterSceneCard = {
    registerValue(name, provider) {
      return valueRegistry.registerValue(name, provider);
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
