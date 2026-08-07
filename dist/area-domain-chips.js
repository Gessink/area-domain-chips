/*
 * Area Domain Chips
 * -----------------
 * One badge/card element that renders a row of chips. Each chip counts the
 * active entities for a combination of area(s) + domain + label + device class,
 * with its own icon, colour and "hide when zero" setting.
 *
 * Works in the badge region (`badges:`) and in the card region (`cards:`).
 *
 * type: custom:area-domain-chips
 *
 * https://github.com/Gessink/area-domain-chips
 */

const VERSION = "1.1.0";

/* ------------------------------------------------------------------ *
 * State helpers
 * ------------------------------------------------------------------ */

const UNAVAILABLE = ["unavailable", "unknown"];

// States that count as "active" per domain. The first entry doubles as the
// word shown next to the count ("6 open", "3 on").
const DOMAIN_ACTIVE_STATES = {
  alarm_control_panel: ["triggered", "armed_away", "armed_home", "armed_night", "armed_vacation", "armed_custom_bypass", "arming", "pending"],
  automation: ["on"],
  binary_sensor: ["on"],
  camera: ["recording", "streaming"],
  climate: ["heat", "cool", "heat_cool", "auto", "dry", "fan_only"],
  cover: ["open", "opening"],
  device_tracker: ["home"],
  fan: ["on"],
  group: ["on", "home", "open", "unlocked", "playing"],
  humidifier: ["on"],
  input_boolean: ["on"],
  lawn_mower: ["mowing", "returning", "error"],
  light: ["on"],
  lock: ["unlocked", "open", "opening", "unlocking"],
  media_player: ["playing", "buffering", "on"],
  person: ["home"],
  remote: ["on"],
  script: ["on"],
  siren: ["on"],
  sun: ["above_horizon"],
  switch: ["on"],
  timer: ["active", "paused"],
  update: ["on"],
  vacuum: ["cleaning", "returning", "error"],
  valve: ["open", "opening"],
  water_heater: ["eco", "electric", "performance", "high_demand", "heat_pump", "gas", "on"],
};

// Generic fallback for domains that are not in the table above.
const OFF_LIKE = [
  "off", "closed", "locked", "docked", "idle", "standby", "disarmed",
  "not_home", "below_horizon", "unavailable", "unknown", "",
];

// Fallback icons when no icon is configured and ha-state-icon is unavailable.
const DOMAIN_ICONS = {
  binary_sensor: "mdi:radiobox-blank",
  climate: "mdi:thermostat",
  cover: "mdi:window-shutter",
  fan: "mdi:fan",
  humidifier: "mdi:air-humidifier",
  light: "mdi:lightbulb",
  lock: "mdi:lock",
  media_player: "mdi:cast",
  switch: "mdi:toggle-switch-variant",
  vacuum: "mdi:robot-vacuum",
  valve: "mdi:pipe-valve",
};

function activeStatesFor(chip, domain) {
  if (Array.isArray(chip.active_states) && chip.active_states.length) return chip.active_states;
  return DOMAIN_ACTIVE_STATES[domain] || ["on"];
}

function isActive(stateObj, chip) {
  const state = stateObj.state;
  if (UNAVAILABLE.includes(state)) return false;

  if (Array.isArray(chip.inactive_states) && chip.inactive_states.length) {
    return !chip.inactive_states.includes(state);
  }
  if (Array.isArray(chip.active_states) && chip.active_states.length) {
    return chip.active_states.includes(state);
  }

  const domain = stateObj.entity_id.split(".")[0];
  const known = DOMAIN_ACTIVE_STATES[domain];
  if (known) return known.includes(state);

  return !OFF_LIKE.includes(state);
}

function isUnavailable(stateObj) {
  return UNAVAILABLE.includes(stateObj.state);
}

// Group-style entities expose their children in the `entity_id` attribute.
function groupMembers(stateObj) {
  const attrs = stateObj.attributes || {};
  return Array.isArray(attrs.entity_id) ? attrs.entity_id : null;
}

/* ------------------------------------------------------------------ *
 * Localisation
 * ------------------------------------------------------------------ */

function tr(hass, key) {
  if (!hass || !hass.localize || !key) return "";
  try {
    return hass.localize(key) || "";
  } catch (err) {
    return "";
  }
}

function domainName(hass, domain) {
  return tr(hass, `component.${domain}.title`) || domain;
}

function deviceClassName(hass, domain, deviceClass) {
  return (
    tr(hass, `component.${domain}.entity_component.${deviceClass}.name`) ||
    tr(hass, `component.sensor.entity_component.${deviceClass}.name`) ||
    deviceClass
  );
}

function stateName(hass, domain, deviceClass, state) {
  if (deviceClass) {
    const withClass = tr(hass, `component.${domain}.entity_component.${deviceClass}.state.${state}`);
    if (withClass) return withClass;
  }
  return (
    tr(hass, `component.${domain}.entity_component._.state.${state}`) ||
    tr(hass, `state.default.${state}`) ||
    state
  );
}

function lowerFirst(hass, text) {
  if (!text) return text;
  const lang = hass && hass.language ? hass.language : undefined;
  return text.charAt(0).toLocaleLowerCase(lang) + text.slice(1);
}

/* ------------------------------------------------------------------ *
 * Registry helpers
 * ------------------------------------------------------------------ */

function entityAreaId(hass, entityId) {
  const ent = hass.entities ? hass.entities[entityId] : undefined;
  if (!ent) return undefined;
  if (ent.area_id) return ent.area_id;
  if (ent.device_id && hass.devices) {
    const dev = hass.devices[ent.device_id];
    if (dev) return dev.area_id;
  }
  return undefined;
}

// Mirrors how HA expands label targets: entity labels + device labels + area labels.
function entityLabelSet(hass, entityId) {
  const out = new Set();
  const ent = hass.entities ? hass.entities[entityId] : undefined;
  if (!ent) return out;
  (ent.labels || []).forEach((l) => out.add(l));

  let areaId = ent.area_id;
  if (ent.device_id && hass.devices) {
    const dev = hass.devices[ent.device_id];
    if (dev) {
      (dev.labels || []).forEach((l) => out.add(l));
      if (!areaId) areaId = dev.area_id;
    }
  }
  if (areaId && hass.areas) {
    const area = hass.areas[areaId];
    if (area) (area.labels || []).forEach((l) => out.add(l));
  }
  return out;
}

function asArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value.slice() : [value];
}

/* ------------------------------------------------------------------ *
 * Colours
 *
 * Values match Home Assistant's own `ui_color` selector: a theme colour name,
 * `state` (the colour HA gives that domain when active), `none`, or any raw
 * CSS colour. The tint is derived with color-mix so it works for all of them.
 * ------------------------------------------------------------------ */

const THEME_COLORS = [
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo",
  "blue", "light-blue", "cyan", "teal", "green", "light-green", "lime",
  "yellow", "amber", "orange", "deep-orange", "brown", "light-grey", "grey",
  "dark-grey", "blue-grey", "black", "white", "disabled",
];

function resolveColor(color, domain, deviceClass) {
  if (!color || color === "state") {
    const chain = [];
    if (domain && deviceClass) chain.push(`--state-${domain}-${deviceClass}-color`);
    if (domain) chain.push(`--state-${domain}-active-color`);
    chain.push("--state-active-color");
    // Nested fallbacks: var(--a, var(--b, var(--c, <literal>)))
    return chain.reduceRight(
      (fallback, name) => `var(${name}, ${fallback})`,
      "var(--primary-color)"
    );
  }
  if (color === "none") return "var(--primary-text-color)";
  if (THEME_COLORS.includes(color)) return `var(--${color}-color)`;
  return color;
}

function tintOf(color) {
  return `color-mix(in srgb, ${color} 20%, transparent)`;
}

/* ------------------------------------------------------------------ *
 * Controls shown in the entity list
 * ------------------------------------------------------------------ */

const TOGGLE_DOMAINS = [
  "light", "switch", "fan", "input_boolean", "humidifier", "siren", "remote",
  "automation", "media_player",
];

// Cover / valve supported_features bits
const FEAT_OPEN = 1;
const FEAT_CLOSE = 2;
const FEAT_STOP = 8;

function controlKind(domain) {
  if (TOGGLE_DOMAINS.includes(domain)) return "toggle";
  if (domain === "cover" || domain === "valve") return "position";
  if (domain === "lock") return "lock";
  if (domain === "vacuum") return "vacuum";
  return "none";
}

/* ------------------------------------------------------------------ *
 * Presets (used by the visual editor)
 * ------------------------------------------------------------------ */

const PRESETS = [
  { key: "lights", label: "Lights on", cfg: { domain: "light", icon: "mdi:lightbulb", color: "amber" } },
  { key: "switches", label: "Switches on", cfg: { domain: "switch", icon: "mdi:toggle-switch-variant", color: "blue" } },
  { key: "fans", label: "Fans on", cfg: { domain: "fan", icon: "mdi:fan", color: "cyan" } },
  { key: "doors", label: "Doors open", cfg: { domain: "binary_sensor", device_class: "door", icon: "mdi:door-open", color: "red" } },
  { key: "windows", label: "Windows open (binary_sensor)", cfg: { domain: "binary_sensor", device_class: "window", icon: "mdi:window-open-variant", color: "red" } },
  { key: "covers", label: "Covers open", cfg: { domain: "cover", icon: "mdi:window-shutter-open", color: "blue" } },
  { key: "locks", label: "Locks unlocked", cfg: { domain: "lock", icon: "mdi:lock-open-variant", color: "red" } },
  { key: "motion", label: "Motion detected", cfg: { domain: "binary_sensor", device_class: "motion", icon: "mdi:motion-sensor", color: "orange" } },
  { key: "vacuum", label: "Vacuums running", cfg: { domain: "vacuum", icon: "mdi:robot-vacuum", color: "teal" } },
  { key: "climate", label: "Thermostats active", cfg: { domain: "climate", icon: "mdi:thermostat", color: "deep-orange" } },
  { key: "media", label: "Media playing", cfg: { domain: "media_player", icon: "mdi:play-circle", color: "purple" } },
  { key: "moisture", label: "Water leak", cfg: { domain: "binary_sensor", device_class: "moisture", icon: "mdi:water-alert", color: "blue" } },
  { key: "smoke", label: "Smoke alarm", cfg: { domain: "binary_sensor", device_class: "smoke", icon: "mdi:smoke-detector-variant-alert", color: "red" } },
  { key: "battery_low", label: "Battery low", cfg: { domain: "binary_sensor", device_class: "battery", icon: "mdi:battery-alert", color: "orange" } },
  { key: "unavailable", label: "Unavailable entities", cfg: { mode: "unavailable", icon: "mdi:cloud-off-outline", color: "grey" } },
];

const DOMAIN_OPTIONS = [
  "light", "switch", "fan", "cover", "valve", "lock", "binary_sensor", "sensor",
  "climate", "water_heater", "humidifier", "media_player", "vacuum", "lawn_mower",
  "input_boolean", "automation", "script", "scene", "timer", "person",
  "device_tracker", "alarm_control_panel", "remote", "siren", "camera", "update", "button",
];

/* ------------------------------------------------------------------ *
 * The badge / card element
 * ------------------------------------------------------------------ */

class AreaDomainChips extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._index = null;       // per chip: array of candidate entity ids
    this._indexKey = null;    // registry fingerprint the index was built from
    this._lastRender = null;
    this._built = false;
    this._holdTimer = null;
    this._held = false;
    this._dialog = null;
  }

  static getConfigElement() {
    return document.createElement("area-domain-chips-editor");
  }

  static getStubConfig(hass) {
    const areas = hass && hass.areas ? Object.keys(hass.areas) : [];
    return {
      type: "custom:area-domain-chips",
      areas: areas.length ? [areas[0]] : [],
      chips: [
        { domain: "light", icon: "mdi:lightbulb", color: "amber", hide_when_zero: true },
        { domain: "binary_sensor", device_class: "door", icon: "mdi:door-open", color: "red", hide_when_zero: true },
        { domain: "cover", icon: "mdi:window-shutter-open", color: "blue", hide_when_zero: true },
      ],
    };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");

    // `types` is accepted as an alias for `chips`.
    const chips = config.chips !== undefined ? config.chips : config.types;
    if (chips !== undefined && !Array.isArray(chips)) {
      throw new Error("`chips` must be a list");
    }

    this._config = Object.assign(
      {
        areas: [],
        exclude_areas: [],
        exclude_entities: [],
        exclude_redundant_groups: true,
        include_hidden: false,
        include_diagnostic: false,
        layout: "stacked",
        show_state_text: true,
        show_area_name: false,
        spacing: 8,
        list_scope: "auto",
        tap_action: { action: "list" },
        hold_action: { action: "none" },
      },
      config,
      { chips: chips || [] }
    );

    this._index = null;
    this._indexKey = null;
    this._lastRender = null;
    this._closeDialog();
    if (this._built) this._rebuild();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { rows: 1, columns: 12, min_rows: 1 };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._rebuild();
    this._update();
  }

  get hass() {
    return this._hass;
  }

  /* -------------------- chip metadata -------------------- */

  _chipDomain(chip) {
    const domains = asArray(chip.domains).concat(asArray(chip.domain));
    return domains.length ? domains[0] : undefined;
  }

  _chipDeviceClass(chip) {
    const dc = asArray(chip.device_classes).concat(asArray(chip.device_class));
    return dc.length ? dc[0] : undefined;
  }

  // Localised default name: device class first, then the domain.
  _chipName(chip) {
    if (chip.name) return chip.name;
    const hass = this._hass;
    const domain = this._chipDomain(chip);
    const deviceClass = this._chipDeviceClass(chip);
    if (deviceClass) return deviceClassName(hass, domain || "sensor", deviceClass);
    if (domain) return domainName(hass, domain);
    if (chip.mode === "unavailable") return stateName(hass, "", "", "unavailable");
    return tr(hass, "ui.panel.config.entities.caption") || "Entities";
  }

  // The word after the count: "6 open", "3 on".
  _chipStateWord(chip) {
    if (chip.state_text !== undefined) return chip.state_text;
    const hass = this._hass;
    const mode = chip.mode || "active";
    if (mode === "all") return "";
    if (mode === "unavailable") return lowerFirst(hass, stateName(hass, "", "", "unavailable"));

    const domain = this._chipDomain(chip);
    if (!domain) return "";
    const deviceClass = this._chipDeviceClass(chip);
    const state = activeStatesFor(chip, domain)[0];
    return lowerFirst(hass, stateName(hass, domain, deviceClass, state));
  }

  _chipColor(chip) {
    return resolveColor(chip.color, this._chipDomain(chip), this._chipDeviceClass(chip));
  }

  /* -------------------- matching -------------------- */

  _chipMatches(chip, entityId, stateObj) {
    const hass = this._hass;
    const cfg = this._config;

    // Domain
    const domains = asArray(chip.domains).concat(asArray(chip.domain));
    if (domains.length) {
      const domain = entityId.split(".")[0];
      if (!domains.includes(domain)) return false;
    }

    // Device class (lives on the state, not in the registry)
    const deviceClasses = asArray(chip.device_classes).concat(asArray(chip.device_class));
    if (deviceClasses.length) {
      const dc = stateObj.attributes ? stateObj.attributes.device_class : undefined;
      if (!dc || !deviceClasses.includes(dc)) return false;
    }

    // Area: a chip may override the card-level areas.
    const areas = asArray(chip.areas).length ? asArray(chip.areas) : asArray(cfg.areas);
    const areaId = entityAreaId(hass, entityId);
    if (areas.length) {
      if (!areaId || !areas.includes(areaId)) return false;
    }
    const excluded = asArray(cfg.exclude_areas);
    if (excluded.length && areaId && excluded.includes(areaId)) return false;

    // Labels
    const labels = asArray(chip.labels).concat(asArray(chip.label));
    if (labels.length) {
      const owned = entityLabelSet(hass, entityId);
      const match = (chip.label_match || "any") === "all"
        ? labels.every((l) => owned.has(l))
        : labels.some((l) => owned.has(l));
      if (!match) return false;
    }

    // Optional explicit entity whitelist
    const only = asArray(chip.entities);
    if (only.length && !only.includes(entityId)) return false;

    return true;
  }

  _registryKey(hass) {
    return [
      hass.entities ? Object.keys(hass.entities).length : 0,
      hass.devices ? Object.keys(hass.devices).length : 0,
      hass.areas ? Object.keys(hass.areas).length : 0,
      Object.keys(hass.states).length,
    ].join(":");
  }

  // Candidate entity ids per chip. Rebuilt only when the registry changes, so a
  // plain state update only has to read the cached ids.
  _buildIndex() {
    const hass = this._hass;
    const cfg = this._config;
    const chips = cfg.chips || [];
    const exclude = new Set(asArray(cfg.exclude_entities));

    const index = chips.map(() => []);
    const entityIds = Object.keys(hass.states);

    for (let i = 0; i < entityIds.length; i++) {
      const entityId = entityIds[i];
      if (exclude.has(entityId)) continue;

      const reg = hass.entities ? hass.entities[entityId] : undefined;
      if (reg) {
        if (!cfg.include_hidden && reg.hidden) continue;
        if (!cfg.include_diagnostic && reg.entity_category) continue;
      }
      const stateObj = hass.states[entityId];

      for (let c = 0; c < chips.length; c++) {
        if (this._chipMatches(chips[c], entityId, stateObj)) index[c].push(entityId);
      }
    }

    // Drop group-style entities whose children are all counted anyway, so a
    // light group next to its own bulbs does not inflate the number.
    if (cfg.exclude_redundant_groups !== false) {
      for (let c = 0; c < index.length; c++) {
        const ids = index[c];
        const present = new Set(ids);
        index[c] = ids.filter((id) => {
          const members = groupMembers(hass.states[id]);
          if (!members || !members.length) return true;
          return !members.every((m) => present.has(m));
        });
      }
    }

    this._index = index;
    this._indexKey = this._registryKey(hass);
  }

  _candidates(chipIndex) {
    return (this._index && this._index[chipIndex]) || [];
  }

  _matchedEntities(chipIndex) {
    const hass = this._hass;
    const chip = this._config.chips[chipIndex];
    const mode = chip.mode || "active";

    return this._candidates(chipIndex).filter((id) => {
      const stateObj = hass.states[id];
      if (!stateObj) return false;
      if (mode === "all") return true;
      if (mode === "unavailable") return isUnavailable(stateObj);
      return isActive(stateObj, chip);
    });
  }

  // Which entities the dialog lists. Controllable domains show everything in
  // scope so the bulk buttons have something to act on; read-only domains only
  // show what is actually counted.
  _listEntities(chipIndex) {
    const chip = this._config.chips[chipIndex];
    const scope = chip.list_scope || this._config.list_scope || "auto";
    const domain = this._chipDomain(chip);
    const kind = controlKind(domain);

    let resolved = scope;
    if (scope === "auto") {
      resolved = kind === "none" || (chip.mode && chip.mode !== "active") ? "matching" : "all";
    }
    if (resolved === "matching") return this._matchedEntities(chipIndex);

    const hass = this._hass;
    const matched = new Set(this._matchedEntities(chipIndex));
    const ids = this._candidates(chipIndex).filter((id) => hass.states[id]);
    // Active first, then alphabetically by friendly name.
    return ids.sort((a, b) => {
      const activeDiff = (matched.has(b) ? 1 : 0) - (matched.has(a) ? 1 : 0);
      if (activeDiff) return activeDiff;
      return this._friendlyName(a).localeCompare(this._friendlyName(b));
    });
  }

  _friendlyName(entityId) {
    const stateObj = this._hass.states[entityId];
    return (stateObj && stateObj.attributes && stateObj.attributes.friendly_name) || entityId;
  }

  /* -------------------- rendering -------------------- */

  _rebuild() {
    const root = this.shadowRoot;
    root.innerHTML = "";
    this._dialog = null;

    const style = document.createElement("style");
    style.textContent = STYLES;
    root.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.style.setProperty("--adc-gap", `${this._config.spacing}px`);
    root.appendChild(wrap);
    this._wrap = wrap;

    const layout = this._config.layout || "stacked";
    const useStateIcon = !!customElements.get("ha-state-icon");

    this._chipEls = (this._config.chips || []).map((chip, i) => {
      const el = document.createElement("div");
      el.className = `chip layout-${chip.layout || layout}`;
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");

      const iconWrap = document.createElement("span");
      iconWrap.className = "icon";
      const dynamicIcon = !chip.icon && useStateIcon;
      const icon = document.createElement(dynamicIcon ? "ha-state-icon" : "ha-icon");
      iconWrap.appendChild(icon);

      const labels = document.createElement("span");
      labels.className = "labels";
      const primary = document.createElement("span");
      primary.className = "primary";
      const secondary = document.createElement("span");
      secondary.className = "secondary";
      labels.appendChild(primary);
      labels.appendChild(secondary);

      el.appendChild(iconWrap);
      el.appendChild(labels);

      this._attachActions(el, i);
      wrap.appendChild(el);

      return { el, icon, iconWrap, primary, secondary, dynamicIcon };
    });

    this._built = true;
  }

  _attachActions(el, chipIndex) {
    const tap = (this._config.tap_action || {}).action || "none";
    const hold = (this._config.hold_action || {}).action || "none";
    if (tap === "none" && hold === "none") {
      el.classList.add("no-action");
      return;
    }

    const start = () => {
      this._held = false;
      if (hold === "none") return;
      this._holdTimer = window.setTimeout(() => {
        this._held = true;
        this._runAction(this._config.hold_action, chipIndex);
      }, 500);
    };
    const end = () => {
      if (this._holdTimer) {
        window.clearTimeout(this._holdTimer);
        this._holdTimer = null;
      }
    };

    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointerleave", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("click", () => {
      if (this._held) {
        this._held = false;
        return;
      }
      this._runAction(this._config.tap_action, chipIndex);
    });
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        this._runAction(this._config.tap_action, chipIndex);
      }
    });
  }

  _runAction(action, chipIndex) {
    const act = (action || {}).action || "none";
    if (act === "none") return;

    if (act === "list") {
      this._showList(chipIndex);
      return;
    }

    const entities = this._matchedEntities(chipIndex);

    if (act === "more-info") {
      const target = action.entity || entities[0];
      if (target) this._fireMoreInfo(target);
    } else if (act === "navigate") {
      if (action.navigation_path) {
        history.pushState(null, "", action.navigation_path);
        window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
      }
    } else if (act === "toggle" || act === "turn_off") {
      if (!entities.length) return;
      const service = act === "toggle" ? "toggle" : "turn_off";
      this._hass.callService("homeassistant", service, {}, { entity_id: entities });
    }
  }

  _fireMoreInfo(entityId) {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  /* -------------------- entity list dialog -------------------- */

  _iconButton(iconName, label, onClick) {
    const btn = document.createElement("button");
    btn.className = "iconbtn";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    const icon = document.createElement("ha-icon");
    icon.icon = iconName;
    btn.appendChild(icon);
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onClick();
    });
    return btn;
  }

  _textButton(iconName, label, onClick) {
    const btn = document.createElement("button");
    btn.className = "textbtn";
    const icon = document.createElement("ha-icon");
    icon.icon = iconName;
    const span = document.createElement("span");
    span.textContent = label;
    btn.appendChild(icon);
    btn.appendChild(span);
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onClick();
    });
    return btn;
  }

  _call(domain, service, entityId) {
    this._hass.callService(domain, service, {}, { entity_id: entityId });
  }

  // Returns {el, update} so the dialog can refresh in place instead of being
  // rebuilt on every state change.
  _buildRow(chipIndex, entityId) {
    const hass = this._hass;
    const chip = this._config.chips[chipIndex];
    const domain = entityId.split(".")[0];
    const kind = controlKind(domain);

    const row = document.createElement("div");
    row.className = "row";

    const iconWrap = document.createElement("span");
    iconWrap.className = "row-icon";
    const useStateIcon = !!customElements.get("ha-state-icon");
    const icon = document.createElement(useStateIcon ? "ha-state-icon" : "ha-icon");
    iconWrap.appendChild(icon);

    const name = document.createElement("span");
    name.className = "row-name";
    name.textContent = this._friendlyName(entityId);

    const state = document.createElement("span");
    state.className = "row-state";

    const controls = document.createElement("span");
    controls.className = "row-controls";

    row.appendChild(iconWrap);
    row.appendChild(name);
    row.appendChild(state);
    row.appendChild(controls);

    row.addEventListener("click", () => {
      this._closeDialog();
      this._fireMoreInfo(entityId);
    });

    let toggle = null;
    const buttons = [];

    if (kind === "toggle") {
      if (customElements.get("ha-switch")) {
        toggle = document.createElement("ha-switch");
        toggle.addEventListener("click", (ev) => ev.stopPropagation());
        toggle.addEventListener("change", (ev) => {
          ev.stopPropagation();
          this._call("homeassistant", toggle.checked ? "turn_on" : "turn_off", entityId);
        });
        controls.appendChild(toggle);
      } else {
        const btn = this._iconButton("mdi:power", tr(hass, "ui.card.common.toggle") || "Toggle", () =>
          this._call("homeassistant", "toggle", entityId)
        );
        controls.appendChild(btn);
        buttons.push({ btn, enabled: () => true });
      }
    } else if (kind === "position") {
      const svc = domain === "valve" ? "valve" : "cover";
      const openBtn = this._iconButton("mdi:arrow-up", tr(hass, "ui.card.cover.open_cover") || "Open", () =>
        this._call(svc, domain === "valve" ? "open_valve" : "open_cover", entityId)
      );
      const stopBtn = this._iconButton("mdi:stop", tr(hass, "ui.card.cover.stop_cover") || "Stop", () =>
        this._call(svc, domain === "valve" ? "stop_valve" : "stop_cover", entityId)
      );
      const closeBtn = this._iconButton("mdi:arrow-down", tr(hass, "ui.card.cover.close_cover") || "Close", () =>
        this._call(svc, domain === "valve" ? "close_valve" : "close_cover", entityId)
      );
      controls.appendChild(openBtn);
      controls.appendChild(stopBtn);
      controls.appendChild(closeBtn);
      const feat = () => {
        const s = hass.states[entityId];
        return (s && s.attributes && s.attributes.supported_features) || 0;
      };
      buttons.push({ btn: openBtn, enabled: () => !!(feat() & FEAT_OPEN) });
      buttons.push({ btn: stopBtn, enabled: () => !!(feat() & FEAT_STOP) });
      buttons.push({ btn: closeBtn, enabled: () => !!(feat() & FEAT_CLOSE) });
    } else if (kind === "lock") {
      const lockBtn = this._iconButton("mdi:lock", tr(hass, "ui.card.lock.lock") || "Lock", () =>
        this._call("lock", "lock", entityId)
      );
      const unlockBtn = this._iconButton("mdi:lock-open-variant", tr(hass, "ui.card.lock.unlock") || "Unlock", () =>
        this._call("lock", "unlock", entityId)
      );
      controls.appendChild(lockBtn);
      controls.appendChild(unlockBtn);
      buttons.push({ btn: lockBtn, enabled: () => true });
      buttons.push({ btn: unlockBtn, enabled: () => true });
    } else if (kind === "vacuum") {
      const startBtn = this._iconButton("mdi:play", tr(hass, "ui.card.vacuum.actions.start_cleaning") || "Start", () =>
        this._call("vacuum", "start", entityId)
      );
      const homeBtn = this._iconButton("mdi:home-map-marker", tr(hass, "ui.card.vacuum.actions.return_to_base") || "Return to base", () =>
        this._call("vacuum", "return_to_base", entityId)
      );
      controls.appendChild(startBtn);
      controls.appendChild(homeBtn);
      buttons.push({ btn: startBtn, enabled: () => true });
      buttons.push({ btn: homeBtn, enabled: () => true });
    }

    const update = () => {
      const stateObj = this._hass.states[entityId];
      if (!stateObj) return;
      const active = isActive(stateObj, chip);
      const unavailable = isUnavailable(stateObj);

      row.classList.toggle("inactive", !active);
      if (useStateIcon) {
        icon.hass = this._hass;
        icon.stateObj = stateObj;
      } else {
        icon.icon =
          (stateObj.attributes && stateObj.attributes.icon) ||
          chip.icon ||
          DOMAIN_ICONS[domain] ||
          "mdi:help-circle-outline";
      }
      icon.style.color = active ? this._chipColor(chip) : "var(--secondary-text-color)";

      state.textContent = this._hass.formatEntityState
        ? this._hass.formatEntityState(stateObj)
        : stateObj.state;

      if (toggle) {
        toggle.checked = active;
        toggle.disabled = unavailable;
      }
      buttons.forEach((b) => {
        b.btn.disabled = unavailable || !b.enabled();
      });
    };

    update();
    return { el: row, update };
  }

  _bulkButtons(chipIndex, ids) {
    const hass = this._hass;
    const domain = this._chipDomain(this._config.chips[chipIndex]);
    const kind = controlKind(domain);
    const out = [];
    if (!ids.length) return out;

    if (kind === "toggle") {
      const onWord = stateName(hass, domain, undefined, "on");
      const offWord = stateName(hass, domain, undefined, "off");
      out.push(
        this._textButton("mdi:flash", tr(hass, "ui.card.common.turn_on") || onWord, () =>
          this._call("homeassistant", "turn_on", ids)
        )
      );
      out.push(
        this._textButton("mdi:flash-off", tr(hass, "ui.card.common.turn_off") || offWord, () =>
          this._call("homeassistant", "turn_off", ids)
        )
      );
    } else if (kind === "position") {
      const svc = domain === "valve" ? "valve" : "cover";
      out.push(
        this._textButton("mdi:arrow-up", tr(hass, "ui.card.cover.open_cover") || "Open", () =>
          this._call(svc, domain === "valve" ? "open_valve" : "open_cover", ids)
        )
      );
      out.push(
        this._textButton("mdi:arrow-down", tr(hass, "ui.card.cover.close_cover") || "Close", () =>
          this._call(svc, domain === "valve" ? "close_valve" : "close_cover", ids)
        )
      );
    } else if (kind === "lock") {
      out.push(
        this._textButton("mdi:lock", tr(hass, "ui.card.lock.lock") || "Lock", () =>
          this._call("lock", "lock", ids)
        )
      );
    } else if (kind === "vacuum") {
      out.push(
        this._textButton("mdi:home-map-marker", tr(hass, "ui.card.vacuum.actions.return_to_base") || "Return to base", () =>
          this._call("vacuum", "return_to_base", ids)
        )
      );
    }
    return out;
  }

  _showList(chipIndex) {
    this._closeDialog();

    const chip = this._config.chips[chipIndex];
    const ids = this._listEntities(chipIndex);

    const scrim = document.createElement("div");
    scrim.className = "scrim";
    const dialog = document.createElement("div");
    dialog.className = "dialog";

    const header = document.createElement("div");
    header.className = "dialog-header";
    const titles = document.createElement("div");
    titles.className = "dialog-titles";
    const title = document.createElement("h3");
    title.textContent = this._chipName(chip) + this._areaSuffix();
    const subtitle = document.createElement("div");
    subtitle.className = "dialog-subtitle";
    titles.appendChild(title);
    titles.appendChild(subtitle);

    const closeBtn = this._iconButton("mdi:close", tr(this._hass, "ui.common.close") || "Close", () =>
      this._closeDialog()
    );
    closeBtn.classList.add("close");

    header.appendChild(titles);
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const bulk = this._bulkButtons(chipIndex, ids);
    if (bulk.length) {
      const bulkRow = document.createElement("div");
      bulkRow.className = "bulk";
      bulk.forEach((b) => bulkRow.appendChild(b));
      dialog.appendChild(bulkRow);
    }

    const list = document.createElement("div");
    list.className = "list";
    const rows = ids.map((id) => {
      const row = this._buildRow(chipIndex, id);
      list.appendChild(row.el);
      return row;
    });
    if (!ids.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = tr(this._hass, "ui.panel.lovelace.cards.empty_state.title") || "Nothing to show";
      dialog.appendChild(empty);
    } else {
      dialog.appendChild(list);
    }

    const onKey = (ev) => {
      if (ev.key === "Escape") this._closeDialog();
    };
    scrim.addEventListener("click", (ev) => {
      if (ev.target === scrim) this._closeDialog();
    });
    document.addEventListener("keydown", onKey);

    scrim.appendChild(dialog);
    this.shadowRoot.appendChild(scrim);

    this._dialog = { chipIndex, ids, rows, subtitle, scrim, onKey };
    this._refreshDialog();
  }

  _refreshDialog() {
    const dlg = this._dialog;
    if (!dlg) return;

    // Rebuild if the entity set changed (a new device, a changed area, ...).
    const current = this._listEntities(dlg.chipIndex);
    if (current.length !== dlg.ids.length || current.some((id, i) => id !== dlg.ids[i])) {
      this._showList(dlg.chipIndex);
      return;
    }

    dlg.rows.forEach((r) => r.update());

    const chip = this._config.chips[dlg.chipIndex];
    const count = this._matchedEntities(dlg.chipIndex).length;
    const word = this._chipStateWord(chip);
    dlg.subtitle.textContent = word ? `${count} ${word}` : String(count);
  }

  _closeDialog() {
    const dlg = this._dialog;
    if (!dlg) return;
    document.removeEventListener("keydown", dlg.onKey);
    dlg.scrim.remove();
    this._dialog = null;
  }

  /* -------------------- update -------------------- */

  _areaSuffix() {
    if (!this._config.show_area_name) return "";
    const areas = asArray(this._config.areas);
    if (areas.length !== 1) return "";
    const area = this._hass.areas ? this._hass.areas[areas[0]] : undefined;
    return area && area.name ? ` ${area.name}` : "";
  }

  _update() {
    const hass = this._hass;
    if (!hass || !this._chipEls) return;

    if (!this._index || this._indexKey !== this._registryKey(hass)) {
      this._buildIndex();
    }

    this._refreshDialog();

    const chips = this._config.chips || [];
    const matched = chips.map((_, i) => this._matchedEntities(i));
    const counts = matched.map((m) => m.length);

    // Skip DOM work when nothing changed. The language is part of the key so
    // switching language re-renders the localised labels.
    const key = `${hass.language}|${counts.join(",")}|${matched.map((m) => m[0] || "").join(",")}`;
    if (this._lastRender === key) return;
    this._lastRender = key;

    const layout = this._config.layout || "stacked";
    let anyVisible = false;

    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      const parts = this._chipEls[i];
      if (!parts) continue;

      const count = counts[i];
      const hideWhenZero = chip.hide_when_zero !== false;
      const hidden = count === 0 && hideWhenZero;

      parts.el.classList.toggle("hidden", hidden);
      if (hidden) continue;
      anyVisible = true;

      const color = this._chipColor(chip);
      parts.icon.style.color = color;
      parts.iconWrap.style.background = tintOf(color);

      if (parts.dynamicIcon) {
        const first = matched[i][0] || this._candidates(i)[0];
        parts.icon.hass = hass;
        parts.icon.stateObj = first ? hass.states[first] : undefined;
      } else {
        parts.icon.icon =
          chip.icon || DOMAIN_ICONS[this._chipDomain(chip)] || "mdi:help-circle-outline";
      }

      const name = this._chipName(chip) + this._areaSuffix();
      const showState = chip.show_state_text !== undefined
        ? chip.show_state_text
        : this._config.show_state_text;
      const word = showState ? this._chipStateWord(chip) : "";
      const countText = word ? `${count} ${word}` : String(count);
      const chipLayout = chip.layout || layout;

      if (chipLayout === "count") {
        parts.primary.textContent = countText;
        parts.secondary.textContent = "";
      } else if (chipLayout === "inline") {
        parts.primary.textContent = `${countText} ${name}`;
        parts.secondary.textContent = "";
      } else {
        parts.primary.textContent = name;
        parts.secondary.textContent = countText;
      }

      parts.el.title = `${name}: ${countText}`;
    }

    // Collapse the whole element when every chip is hidden.
    this.style.display = anyVisible ? "" : "none";
  }

  disconnectedCallback() {
    this._closeDialog();
  }
}

const STYLES = `
  :host { display: block; }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--adc-gap, 8px);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--adc-height, 36px);
    box-sizing: border-box;
    padding: 4px 12px 4px 8px;
    border-radius: var(--adc-border-radius, 20px);
    background: var(--adc-background, var(--card-background-color, #fff));
    border: var(--ha-card-border-width, 1px) solid
            var(--adc-border-color, var(--ha-card-border-color, var(--divider-color, #e0e0e0)));
    box-shadow: var(--ha-card-box-shadow, none);
    color: var(--primary-text-color);
    font-family: var(--paper-font-body1_-_font-family, inherit);
    line-height: 1.2;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .chip.no-action { cursor: default; }
  .chip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .chip.layout-count, .chip.layout-inline { padding: 0 12px 0 8px; }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    flex: 0 0 auto;
  }
  ha-icon, ha-state-icon { --mdc-icon-size: 18px; display: inline-flex; }

  .labels { display: flex; flex-direction: column; justify-content: center; white-space: nowrap; }
  .primary { font-size: 13px; font-weight: 500; }
  .secondary { font-size: 12px; color: var(--secondary-text-color); }
  .layout-count .primary, .layout-inline .primary { font-size: 14px; }
  .secondary:empty { display: none; }
  .hidden { display: none !important; }

  /* entity list dialog */
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 9;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .dialog {
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color);
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    min-width: 300px;
    max-width: 460px;
    width: 100%;
    max-height: 76vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--paper-font-body1_-_font-family, inherit);
    cursor: default;
  }
  .dialog-header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 16px 12px 8px 16px;
  }
  .dialog-titles { flex: 1; min-width: 0; }
  .dialog h3 { margin: 0; font-size: 18px; font-weight: 500; }
  .dialog-subtitle { color: var(--secondary-text-color); font-size: 13px; margin-top: 2px; }
  .bulk { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 16px 12px; }

  .textbtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--divider-color, #e0e0e0);
    background: transparent;
    color: var(--primary-text-color);
    border-radius: 16px;
    padding: 5px 12px 5px 8px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .textbtn:hover { background: var(--secondary-background-color, rgba(0, 0, 0, 0.05)); }
  .textbtn ha-icon { --mdc-icon-size: 16px; }

  .iconbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--secondary-text-color);
    cursor: pointer;
    padding: 0;
  }
  .iconbtn:hover:not(:disabled) { background: var(--secondary-background-color, rgba(0, 0, 0, 0.05)); }
  .iconbtn:disabled { opacity: 0.35; cursor: default; }
  .iconbtn ha-icon { --mdc-icon-size: 20px; }
  .iconbtn.close { color: var(--primary-text-color); }

  .list { overflow-y: auto; padding: 0 8px 12px; }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    min-height: 44px;
    box-sizing: border-box;
  }
  .row:hover { background: var(--secondary-background-color, rgba(0, 0, 0, 0.05)); }
  .row.inactive .row-name { color: var(--secondary-text-color); }
  .row-icon { display: inline-flex; flex: 0 0 auto; }
  .row-icon ha-icon, .row-icon ha-state-icon { --mdc-icon-size: 22px; }
  .row-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-state { color: var(--secondary-text-color); font-size: 13px; white-space: nowrap; }
  .row-controls { display: inline-flex; align-items: center; gap: 2px; flex: 0 0 auto; }
  .empty { padding: 0 16px 20px; color: var(--secondary-text-color); font-size: 14px; }
`;

customElements.define("area-domain-chips", AreaDomainChips);

/* ------------------------------------------------------------------ *
 * Visual editor
 * ------------------------------------------------------------------ */

const LAYOUT_OPTIONS = [
  { value: "stacked", label: "Name above the count" },
  { value: "inline", label: "Count and name on one line" },
  { value: "count", label: "Count only" },
];

const GENERAL_SCHEMA = [
  { name: "areas", selector: { area: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "layout", selector: { select: { mode: "dropdown", options: LAYOUT_OPTIONS } } },
      { name: "show_state_text", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "show_area_name", selector: { boolean: {} } },
      { name: "exclude_redundant_groups", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "include_hidden", selector: { boolean: {} } },
      { name: "include_diagnostic", selector: { boolean: {} } },
    ],
  },
  {
    name: "tap_action",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "list", label: "Show entity list with controls" },
          { value: "more-info", label: "More info (first entity)" },
          { value: "toggle", label: "Toggle all matching entities" },
          { value: "turn_off", label: "Turn off all matching entities" },
          { value: "none", label: "No action" },
        ],
      },
    },
  },
  {
    name: "hold_action",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "none", label: "No action" },
          { value: "list", label: "Show entity list with controls" },
          { value: "toggle", label: "Toggle all matching entities" },
          { value: "turn_off", label: "Turn off all matching entities" },
        ],
      },
    },
  },
];

const CHIP_SCHEMA = [
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "domain",
        selector: {
          select: {
            mode: "dropdown",
            custom_value: true,
            options: DOMAIN_OPTIONS.map((d) => ({ value: d, label: d })),
          },
        },
      },
      { name: "device_class", selector: { text: {} } },
    ],
  },
  { name: "labels", selector: { label: { multiple: true } } },
  { name: "areas", selector: { area: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      // Home Assistant's own colour picker, including the "state" (domain colour) option.
      { name: "color", selector: { ui_color: { default_color: "state", include_state: true, include_none: true } } },
      {
        name: "mode",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "active", label: "Active" },
              { value: "unavailable", label: "Unavailable" },
              { value: "all", label: "All" },
            ],
          },
        },
      },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "hide_when_zero", selector: { boolean: {} } },
      {
        name: "list_scope",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "auto", label: "Auto" },
              { value: "all", label: "All entities in scope" },
              { value: "matching", label: "Only the counted entities" },
            ],
          },
        },
      },
    ],
  },
];

const LABELS = {
  areas: "Areas (empty = whole home)",
  layout: "Chip layout",
  show_state_text: "Show the state word after the count",
  show_area_name: "Append the area name",
  exclude_redundant_groups: "Skip groups whose members are all counted",
  include_hidden: "Include hidden entities",
  include_diagnostic: "Include diagnostic/config entities",
  tap_action: "Tap action",
  hold_action: "Hold action",
  domain: "Domain",
  device_class: "Device class (door, window, motion, ...)",
  labels: "Labels",
  name: "Name (empty = translated domain / device class)",
  icon: "Icon (empty = entity icon)",
  color: "Colour",
  mode: "Count",
  hide_when_zero: "Hide when zero",
  list_scope: "Entity list shows",
};

class AreaDomainChipsEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._forms = [];
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    if (this._config.types && !this._config.chips) {
      this._config.chips = this._config.types;
      delete this._config.types;
    }
    if (!Array.isArray(this._config.chips)) this._config.chips = [];
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._forms.forEach((f) => (f.hass = hass));
  }

  _emit() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _makeForm(data, schema, onChange) {
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.schema = schema;
    form.data = data;
    form.computeLabel = (s) => LABELS[s.name] || s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      onChange(ev.detail.value);
    });
    this._forms.push(form);
    return form;
  }

  _button(label, fn, disabled) {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener("click", (ev) => {
      ev.preventDefault();
      fn();
    });
    return b;
  }

  _chipTitle(chip, i) {
    if (chip.name) return chip.name;
    if (chip.device_class && this._hass) return deviceClassName(this._hass, chip.domain || "sensor", chip.device_class);
    if (chip.domain && this._hass) return domainName(this._hass, chip.domain);
    return chip.device_class || chip.domain || `Chip ${i + 1}`;
  }

  _render() {
    const root = this.shadowRoot;
    root.innerHTML = "";
    this._forms = [];

    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      .section { margin-bottom: 16px; }
      .chip-box {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .chip-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 500;
      }
      .chip-head .spacer { flex: 1; }
      .btn {
        border: 1px solid var(--divider-color, #e0e0e0);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        border-radius: 6px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 13px;
      }
      .btn:hover:not(:disabled) { background: var(--secondary-background-color, rgba(0, 0, 0, 0.05)); }
      .btn:disabled { opacity: 0.4; cursor: default; }
      .add-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      select {
        padding: 6px;
        border-radius: 6px;
        border: 1px solid var(--divider-color, #e0e0e0);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        max-width: 100%;
      }
      h4 { margin: 16px 0 8px; }
    `;
    root.appendChild(style);

    // General settings
    const general = document.createElement("div");
    general.className = "section";
    general.appendChild(
      this._makeForm(
        {
          areas: this._config.areas || [],
          layout: this._config.layout || "stacked",
          show_state_text: this._config.show_state_text !== false,
          show_area_name: !!this._config.show_area_name,
          exclude_redundant_groups: this._config.exclude_redundant_groups !== false,
          include_hidden: !!this._config.include_hidden,
          include_diagnostic: !!this._config.include_diagnostic,
          tap_action: (this._config.tap_action || { action: "list" }).action,
          hold_action: (this._config.hold_action || { action: "none" }).action,
        },
        GENERAL_SCHEMA,
        (value) => {
          this._config.areas = value.areas || [];
          this._config.layout = value.layout || "stacked";
          this._config.show_state_text = value.show_state_text !== false;
          this._config.show_area_name = value.show_area_name;
          this._config.exclude_redundant_groups = value.exclude_redundant_groups !== false;
          this._config.include_hidden = value.include_hidden;
          this._config.include_diagnostic = value.include_diagnostic;
          this._config.tap_action = { action: value.tap_action || "list" };
          this._config.hold_action = { action: value.hold_action || "none" };
          this._emit();
        }
      )
    );
    root.appendChild(general);

    const heading = document.createElement("h4");
    heading.textContent = "Chips";
    root.appendChild(heading);

    this._config.chips.forEach((chip, i) => {
      const box = document.createElement("div");
      box.className = "chip-box";

      const head = document.createElement("div");
      head.className = "chip-head";
      const title = document.createElement("span");
      title.textContent = this._chipTitle(chip, i);
      const spacer = document.createElement("span");
      spacer.className = "spacer";
      head.appendChild(title);
      head.appendChild(spacer);

      head.appendChild(
        this._button("↑", () => {
          const c = this._config.chips;
          [c[i - 1], c[i]] = [c[i], c[i - 1]];
          this._emit();
          this._render();
        }, i === 0)
      );
      head.appendChild(
        this._button("↓", () => {
          const c = this._config.chips;
          [c[i + 1], c[i]] = [c[i], c[i + 1]];
          this._emit();
          this._render();
        }, i === this._config.chips.length - 1)
      );
      head.appendChild(
        this._button("✕", () => {
          this._config.chips.splice(i, 1);
          this._emit();
          this._render();
        })
      );
      box.appendChild(head);

      box.appendChild(
        this._makeForm(
          {
            domain: chip.domain || "",
            device_class: chip.device_class || "",
            labels: chip.labels || (chip.label ? [chip.label] : []),
            areas: chip.areas || [],
            name: chip.name || "",
            icon: chip.icon || "",
            color: chip.color || "state",
            mode: chip.mode || "active",
            hide_when_zero: chip.hide_when_zero !== false,
            list_scope: chip.list_scope || "auto",
          },
          CHIP_SCHEMA,
          (value) => {
            const next = {};
            if (value.domain) next.domain = value.domain;
            if (value.device_class) next.device_class = value.device_class;
            if (value.labels && value.labels.length) next.labels = value.labels;
            if (value.areas && value.areas.length) next.areas = value.areas;
            if (value.name) next.name = value.name;
            if (value.icon) next.icon = value.icon;
            if (value.color && value.color !== "state") next.color = value.color;
            if (value.mode && value.mode !== "active") next.mode = value.mode;
            next.hide_when_zero = value.hide_when_zero !== false;
            if (value.list_scope && value.list_scope !== "auto") next.list_scope = value.list_scope;
            this._config.chips[i] = next;
            title.textContent = this._chipTitle(next, i);
            this._emit();
          }
        )
      );

      root.appendChild(box);
    });

    const addRow = document.createElement("div");
    addRow.className = "add-row";

    const select = document.createElement("select");
    PRESETS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.key;
      opt.textContent = p.label;
      select.appendChild(opt);
    });

    addRow.appendChild(select);
    addRow.appendChild(
      this._button("+ Add preset", () => {
        const preset = PRESETS.find((p) => p.key === select.value);
        if (!preset) return;
        this._config.chips.push(Object.assign({ hide_when_zero: true }, preset.cfg));
        this._emit();
        this._render();
      })
    );
    addRow.appendChild(
      this._button("+ Add empty chip", () => {
        this._config.chips.push({ domain: "light", hide_when_zero: true });
        this._emit();
        this._render();
      })
    );
    root.appendChild(addRow);
  }
}

customElements.define("area-domain-chips-editor", AreaDomainChipsEditor);

/* ------------------------------------------------------------------ *
 * Registration
 * ------------------------------------------------------------------ */

const DESCRIPTOR = {
  type: "area-domain-chips",
  name: "Area Domain Chips",
  description: "Count active lights, doors, windows, vacuums and more per area as compact chips.",
  preview: true,
  documentationURL: "https://github.com/Gessink/area-domain-chips",
};

window.customBadges = window.customBadges || [];
window.customBadges.push(DESCRIPTOR);

window.customCards = window.customCards || [];
window.customCards.push(DESCRIPTOR);

console.info(
  `%c AREA-DOMAIN-CHIPS %c v${VERSION} `,
  "color:#fff;background:#03a9f4;font-weight:700",
  "color:#03a9f4;background:#fff;font-weight:700"
);
