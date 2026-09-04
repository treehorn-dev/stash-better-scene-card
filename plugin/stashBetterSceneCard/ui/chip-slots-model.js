(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StashBetterSceneCardChipSlots = api;
})(typeof window === "undefined" ? null : window, function () {
  const DEFAULT_CHIP_SLOTS = [
    {
      label: { type: "icon", name: "star" },
      value: {
        type: "function",
        body: "const rating = Number(scene.rating100); return rating > 0 ? rating / 20 : null;",
      },
      color: {
        type: "scale",
        min: { value: 0, color: "#000000" },
        mid: { value: 2.5, color: "#ffff00" },
        max: { value: 5, color: "#ff0000" },
      },
    },
    {
      label: { type: "text", value: "O/P" },
      value: {
        type: "function",
        body:
          "const plays = Number(scene.play_count) || 0; const oCount = Number(scene.o_counter) || 0; return plays > 0 ? Math.max(0, Math.min(1, oCount / plays)) * 100 : 0;",
      },
      color: {
        type: "scale",
        min: { value: 0, color: "#000000" },
        mid: { value: 50, color: "#800000" },
        max: { value: 100, color: "#ff0000" },
      },
    },
  ];
  const reportedDiagnostics = new Set();

  function clearDiagnostics() {
    reportedDiagnostics.clear();
  }

  function reportDiagnostic(options, key, message) {
    if (reportedDiagnostics.has(key)) return;
    reportedDiagnostics.add(key);
    if (options && typeof options.onDiagnostic === "function") {
      options.onDiagnostic(message);
      return;
    }
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn(`[Better Scene Card] ${message}`);
    }
  }

  function isThenable(value) {
    return value != null && typeof value.then === "function";
  }

  function isScalar(value) {
    return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  }

  function icon(name) {
    return typeof name === "string" && name ? { type: "icon", name } : null;
  }

  function text(value) {
    return typeof value === "string" ? { type: "text", value } : null;
  }

  function validLabel(value) {
    if (!value || typeof value !== "object") return null;
    if (value.type === "icon") return icon(value.name);
    if (value.type === "text") return text(value.value);
    return null;
  }

  function createHelpers(valueResolver) {
    return {
      icon,
      text,
      value(name, scene) {
        if (typeof valueResolver !== "function") return null;
        try {
          const result = valueResolver(name, scene);
          return isThenable(result) || !isScalar(result) ? null : result;
        } catch (_error) {
          return null;
        }
      },
    };
  }

  const helpers = createHelpers();

  function compileFunction(body, options, key, message) {
    if (typeof body !== "string") return null;
    try {
      return new Function(
        "context",
        `"use strict"; const { scene, helpers, value } = context; ${body}`,
      );
    } catch (_error) {
      reportDiagnostic(options, `${key}:syntax`, `${message}; hiding slot.`);
      return null;
    }
  }

  function parseColor(color) {
    if (typeof color !== "string") return null;
    const shortHex = /^#([0-9a-f]{3})$/i.exec(color);
    const longHex = /^#([0-9a-f]{6})$/i.exec(color);
    const hex = shortHex
      ? shortHex[1]
          .split("")
          .map((part) => part + part)
          .join("")
      : longHex && longHex[1];
    if (!hex) return null;
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }

  function rgb(channels) {
    return `rgb(${channels.map((channel) => Math.round(channel)).join(", ")})`;
  }

  function interpolateColor(start, end, progress) {
    return rgb(start.map((channel, index) => channel + (end[index] - channel) * progress));
  }

  function compileScale(spec) {
    const anchors = [spec.min, spec.mid, spec.max].map((anchor) => ({
      value: Number(anchor && anchor.value),
      color: parseColor(anchor && anchor.color),
    }));
    if (
      anchors.some((anchor) => !Number.isFinite(anchor.value) || !anchor.color) ||
      anchors[0].value > anchors[1].value ||
      anchors[1].value > anchors[2].value
    ) {
      return null;
    }
    return anchors;
  }

  function resolveScale(anchors, value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    if (numericValue <= anchors[0].value) return rgb(anchors[0].color);
    if (numericValue >= anchors[2].value) return rgb(anchors[2].color);
    const [lower, upper] = numericValue <= anchors[1].value
      ? [anchors[0], anchors[1]]
      : [anchors[1], anchors[2]];
    const range = upper.value - lower.value;
    if (range === 0) return rgb(upper.color);
    return interpolateColor(lower.color, upper.color, (numericValue - lower.value) / range);
  }

  function compileSlot(slot, options) {
    if (!slot || typeof slot !== "object") return null;
    const value = compileFunction(
      slot.value && slot.value.body,
      options,
      `value:${slot.value && slot.value.body}`,
      "Chip slot value formula is invalid",
    );
    if (!value) return null;

    let label = validLabel(slot.label);
    if (!label && slot.label && slot.label.type === "function") {
      label = compileFunction(
        slot.label.body,
        options,
        `label:${slot.label.body}`,
        "Chip slot label formula is invalid",
      );
    }
    if (!label) return null;

    let color = null;
    if (slot.color && slot.color.type === "scale") {
      color = { type: "scale", anchors: compileScale(slot.color) };
      if (!color.anchors) return null;
    } else if (slot.color && slot.color.type === "function") {
      const fn = compileFunction(
        slot.color.body,
        options,
        `color:${slot.color.body}`,
        "Chip slot color formula is invalid",
      );
      if (!fn) return null;
      color = { type: "function", fn };
    }

    const mode = slot.mode === "border" ? "border" : "filled";
    let fill = null;
    if (mode === "border") {
      const configuredFill = slot.fill || {};
      const color = typeof configuredFill.color === "string" && parseColor(configuredFill.color)
        ? configuredFill.color
        : "#000000";
      const alpha = Number(configuredFill.alpha);
      fill = {
        color,
        alpha: Number.isFinite(alpha) && alpha >= 0 && alpha <= 1 ? alpha : 0.55,
      };
    }

    return {
      color,
      fill,
      label,
      mode,
      value,
    };
  }

  function parseChipSlots(source, options) {
    if (source == null || source === "") {
      return DEFAULT_CHIP_SLOTS.map((slot) => compileSlot(slot, options));
    }
    try {
      const parsed = typeof source === "string" ? JSON.parse(source) : source;
      if (!Array.isArray(parsed)) throw new Error("chip_slots must be an array");
      return parsed
        .slice(0, 3)
        .map((slot) => compileSlot(slot, options))
        .filter(Boolean);
    } catch (_error) {
      reportDiagnostic(options, `invalid-json:${String(source)}`, "Invalid chip_slots JSON; using defaults.");
      return DEFAULT_CHIP_SLOTS.map((slot) => compileSlot(slot, options));
    }
  }

  function resolveFunction(fn, context, options, key, message) {
    try {
      const result = fn(context);
      if (isThenable(result)) {
        reportDiagnostic(options, `${key}:async`, `${message}; hiding slot.`);
        return null;
      }
      return result;
    } catch (_error) {
      reportDiagnostic(options, `${key}:error`, `${message}; hiding slot.`);
      return null;
    }
  }

  function validStyle(value) {
    if (typeof value === "string") return { backgroundColor: value };
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const style = {};
    for (const key of ["color", "backgroundColor", "borderColor"]) {
      if (typeof value[key] === "string") style[key] = value[key];
    }
    return Object.keys(style).length ? style : null;
  }

  function resolveSlot(slot, scene, options = {}) {
    if (!slot) return null;
    const context = { scene, helpers: createHelpers(options.value), value: undefined };
    const value = resolveFunction(
      slot.value,
      context,
      options,
      `value:${slot.value.toString()}`,
      "Chip slot value formula failed",
    );
    if (!isScalar(value) || value === null || (typeof value === "number" && !Number.isFinite(value))) {
      return null;
    }
    context.value = value;
    const label =
      typeof slot.label === "function"
        ? resolveFunction(
            slot.label,
            context,
            options,
            `label:${slot.label.toString()}`,
            "Chip slot label formula failed",
          )
        : slot.label;
    const validResolvedLabel = validLabel(label);
    if (!validResolvedLabel) return null;

    let style = {};
    if (slot.color) {
      const result =
        slot.color.type === "scale"
          ? resolveScale(slot.color.anchors, value)
          : resolveFunction(
              slot.color.fn,
              context,
              options,
              `color:${slot.color.fn.toString()}`,
              "Chip slot color formula failed",
            );
      style = validStyle(result);
      if (!style) return null;
    }
    const result = { label: validResolvedLabel, value, mode: slot.mode, style };
    if (slot.fill) result.fill = slot.fill;
    return result;
  }

  return {
    DEFAULT_CHIP_SLOTS,
    clearDiagnostics,
    compileSlot,
    helpers,
    parseChipSlots,
    resolveSlot,
  };
});
