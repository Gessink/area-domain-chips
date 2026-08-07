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

const VERSION = "1.0.0";

/* ------------------------------------------------------------------ *
 * State helpers
 * ------------------------------------------------------------------ */

const UNAVAILABLE = ["unavailable", "unknown"];

// States that count as "active" per domain.
const DOMAIN_ACTIVE_STATES = {
  alarm_control_panel: ["armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass", "arming", "pending", "triggered"],
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
 * ------------------------------------------------------------------ */

const THEME_COLORS = [
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo",
  "blue", "light-blue", "cyan", "teal", "green", "light-green", "lime",
  "yellow", "amber", "orange", "deep-orange", "brown", "grey", "blue-grey",
  "black", "white", "disabled",
];

function colorVars(color) {
  if (!color) {
    return {
      fg: "var(--primary-text-color)",
      bg: "rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.05)",
    };
  }
  if (THEME_COLORS.includes(color)) {
    return {
      fg: `rgb(var(--rgb-${color}-color))`,
      bg: `rgba(var(--rgb-${color}-color), 0.20)`,
    };
  }
  // Raw CSS colour (hex, rgb(), named)
  return { fg: color, bg: "transparent" };
}

/* ------------------------------------------------------------------ *
 * Presets (used by the visual editor)
 * ------------------------------------------------------------------ */

const PRESETS = [
  { key: "lights", label: "Lights on", cfg: { domain: "light", name: "Lights", icon: "mdi:lightbulb", color: "amber" } },
  { key: "switches", label: "Switches on", cfg: { domain: "switch", name: "Switches", icon: "mdi:toggle-switch-variant", color: "blue" } },
  { key: "fans", label: "Fans on", cfg: { domain: "fan", name: "Fans", icon: "mdi:fan", color: "cyan" } },
  { key: "doors", label: "Doors open", cfg: { domain: "binary_sensor", device_class: "door", name: "Doors", icon: "mdi:door-open", color: "red" } },
  { key: "windows", label: "Windows open (binary_sensor)", cfg: { domain: "binary_sensor", device_class: "window", name: "Windows", icon: "mdi:window-open-variant", color: "red" } },
  { key: "covers", label: "Covers open", cfg: { domain: "cover", name: "Covers", icon: "mdi:window-shutter-open", color: "blue" } },
  { key: "locks", label: "Locks unlocked", cfg: { domain: "lock", name: "Locks", icon: "mdi:lock-open-variant", color: "red" } },
  { key: "motion", label: "Motion detected", cfg: { domain: "binary_sensor", device_class: "motion", name: "Motion", icon: "mdi:motion-sensor", color: "orange" } },
  { key: "vacuum", label: "Vacuums running", cfg: { domain: "vacuum", name: "Vacuums", icon: "mdi:robot-vacuum", color: "teal" } },
  { key: "climate", label: "Thermostats active", cfg: { domain: "climate", name: "Climate", icon: "mdi:thermostat", color: "deep-orange" } },
  { key: "media", label: "Media playing", cfg: { domain: "media_player", name: "Media", icon: "mdi:play-circle", color: "purple" } },
  { key: "moisture", label: "Water leak", cfg: { domain: "binary_sensor", device_class: "moisture", name: "Leak", icon: "mdi:water-alert", color: "blue" } },
  { key: "smoke", label: "Smoke alarm", cfg: { domain: "binary_sensor", device_class: "smoke", name: "Smoke", icon: "mdi:smoke-detector-variant-alert", color: "red" } },
  { key: "battery_low", label: "Battery low", cfg: { domain: "binary_sensor", device_class: "battery", name: "Battery", icon: "mdi:battery-alert", color: "orange" } },
  { key: "unavailable", label: "Unavailable entities", cfg: { mode: "unavailable", name: "Offline", icon: "mdi:cloud-off-outline", color: "grey" } },
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
    this._lastCounts = null;
    this._built = false;
    this._holdTimer = null;
    this._held = false;
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
        { domain: "light", name: "Lights", icon: "mdi:lightbulb", color: "amber", hide_when_zero: true },
        { domain: "binary_sensor", device_class: "door", name: "Doors", icon: "mdi:door-open", color: "red", hide_when_zero: true },
        { domain: "cover", name: "Covers", icon: "mdi:window-shutter-open", color: "blue", hide_when_zero: true },
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
        include_hidden: false,
        include_diagnostic: false,
        show_name: false,
        show_area_name: false,
        spacing: 8,
        tap_action: { action: "list" },
        hold_action: { action: "none" },
      },
      config,
      { chips: chips || [] }
    );

    this._index = null;
    this._indexKey = null;
    this._lastCounts = null;
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
    this._index = index;
    this._indexKey = this._registryKey(hass);
  }

  _matchedEntities(chipIndex) {
    const hass = this._hass;
    const chip = this._config.chips[chipIndex];
    const ids = this._index[chipIndex] || [];
    const mode = chip.mode || "active";

    return ids.filter((id) => {
      const stateObj = hass.states[id];
      if (!stateObj) return false;
      if (mode === "all") return true;
      if (mode === "unavailable") return isUnavailable(stateObj);
      return isActive(stateObj, chip);
    });
  }

  /* -------------------- rendering -------------------- */

  _rebuild() {
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
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
        gap: 6px;
        height: var(--adc-height, 36px);
        box-sizing: border-box;
        padding: 0 10px;
        border-radius: var(--adc-border-radius, 18px);
        background: var(--adc-background, var(--card-background-color, #fff));
        border: var(--ha-card-border-width, 1px) solid
                var(--adc-border-color, var(--ha-card-border-color, var(--divider-color, #e0e0e0)));
        box-shadow: var(--ha-card-box-shadow, none);
        color: var(--primary-text-color);
        font-family: var(--paper-font-body1_-_font-family, inherit);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .chip.no-action { cursor: default; }
      .chip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex: 0 0 auto;
      }
      ha-icon { --mdc-icon-size: 18px; }
      .text { display: inline-flex; align-items: baseline; gap: 5px; white-space: nowrap; }
      .count { font-weight: 500; }
      .name { color: var(--secondary-text-color); font-size: 13px; }
      .hidden { display: none !important; }

      /* entity list overlay */
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
        min-width: 280px;
        max-width: 420px;
        width: 100%;
        max-height: 70vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: var(--paper-font-body1_-_font-family, inherit);
      }
      .dialog h3 { margin: 0; padding: 16px 16px 8px; font-size: 18px; font-weight: 500; }
      .list { overflow-y: auto; padding: 0 8px 12px; }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 8px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
      }
      .row:hover { background: var(--secondary-background-color, rgba(0, 0, 0, 0.05)); }
      .row .state { margin-left: auto; color: var(--secondary-text-color); font-size: 13px; }
      .empty { padding: 8px 16px 16px; color: var(--secondary-text-color); font-size: 14px; }
    `;
    root.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.style.setProperty("--adc-gap", `${this._config.spacing}px`);
    root.appendChild(wrap);
    this._wrap = wrap;

    this._chipEls = (this._config.chips || []).map((chip, i) => {
      const el = document.createElement("div");
      el.className = "chip";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");

      const iconWrap = document.createElement("span");
      iconWrap.className = "icon";
      const icon = document.createElement("ha-icon");
      iconWrap.appendChild(icon);

      const text = document.createElement("span");
      text.className = "text";
      const count = document.createElement("span");
      count.className = "count";
      const name = document.createElement("span");
      name.className = "name";
      text.appendChild(count);
      text.appendChild(name);

      el.appendChild(iconWrap);
      el.appendChild(text);

      const colors = colorVars(chip.color);
      iconWrap.style.background = colors.bg;
      icon.style.color = colors.fg;

      this._attachActions(el, i);
      wrap.appendChild(el);

      return { el, icon, iconWrap, count, name };
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

    const entities = this._matchedEntities(chipIndex);

    if (act === "list") {
      this._showList(chipIndex, entities);
    } else if (act === "more-info") {
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

  _showList(chipIndex, entities) {
    const chip = this._config.chips[chipIndex];
    const hass = this._hass;

    const scrim = document.createElement("div");
    scrim.className = "scrim";
    const dialog = document.createElement("div");
    dialog.className = "dialog";

    const title = document.createElement("h3");
    title.textContent = chip.name || this._defaultName(chip);
    dialog.appendChild(title);

    const close = () => {
      scrim.remove();
      document.removeEventListener("keydown", onKey);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") close();
    };

    if (!entities.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No matching entities";
      dialog.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "list";
      entities.forEach((entityId) => {
        const stateObj = hass.states[entityId];
        const row = document.createElement("div");
        row.className = "row";

        const icon = document.createElement("ha-icon");
        icon.icon = this._entityIcon(stateObj) || chip.icon || "mdi:help-circle-outline";
        icon.style.color = colorVars(chip.color).fg;

        const label = document.createElement("span");
        label.textContent =
          (stateObj.attributes && stateObj.attributes.friendly_name) || entityId;

        const state = document.createElement("span");
        state.className = "state";
        state.textContent = hass.formatEntityState
          ? hass.formatEntityState(stateObj)
          : stateObj.state;

        row.appendChild(icon);
        row.appendChild(label);
        row.appendChild(state);
        row.addEventListener("click", () => {
          close();
          this._fireMoreInfo(entityId);
        });
        list.appendChild(row);
      });
      dialog.appendChild(list);
    }

    scrim.addEventListener("click", (ev) => {
      if (ev.target === scrim) close();
    });
    document.addEventListener("keydown", onKey);

    scrim.appendChild(dialog);
    this.shadowRoot.appendChild(scrim);
  }

  _entityIcon(stateObj) {
    return stateObj.attributes ? stateObj.attributes.icon : undefined;
  }

  _defaultName(chip) {
    const domains = asArray(chip.domains).concat(asArray(chip.domain));
    const dc = asArray(chip.device_classes).concat(asArray(chip.device_class));
    if (dc.length) return dc[0];
    if (domains.length) return domains[0];
    return "Entities";
  }

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

    const chips = this._config.chips || [];
    const counts = [];
    for (let i = 0; i < chips.length; i++) {
      counts.push(this._matchedEntities(i).length);
    }

    // Skip DOM work when nothing changed.
    const key = counts.join(",");
    if (this._lastCounts === key) return;
    this._lastCounts = key;

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

      parts.icon.icon = chip.icon || "mdi:help-circle-outline";
      parts.count.textContent = String(count);

      const showName = chip.show_name !== undefined ? chip.show_name : this._config.show_name;
      if (showName) {
        parts.name.textContent = (chip.name || this._defaultName(chip)) + this._areaSuffix();
        parts.name.classList.remove("hidden");
      } else {
        parts.name.textContent = "";
        parts.name.classList.add("hidden");
      }

      parts.el.title = (chip.name || this._defaultName(chip)) + this._areaSuffix();
    }

    // Collapse the whole element when every chip is hidden.
    this.style.display = anyVisible ? "" : "none";
  }
}

customElements.define("area-domain-chips", AreaDomainChips);

/* ------------------------------------------------------------------ *
 * Visual editor
 * ------------------------------------------------------------------ */

const GENERAL_SCHEMA = [
  { name: "areas", selector: { area: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "show_name", selector: { boolean: {} } },
      { name: "show_area_name", selector: { boolean: {} } },
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
          { value: "list", label: "Show matching entities" },
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
          { value: "list", label: "Show matching entities" },
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
      {
        name: "color",
        selector: {
          select: {
            mode: "dropdown",
            custom_value: true,
            options: THEME_COLORS.map((c) => ({ value: c, label: c })),
          },
        },
      },
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
      { name: "show_name", selector: { boolean: {} } },
    ],
  },
];

const LABELS = {
  areas: "Areas (empty = whole home)",
  show_name: "Show name next to the count",
  show_area_name: "Append the area name",
  include_hidden: "Include hidden entities",
  include_diagnostic: "Include diagnostic/config entities",
  tap_action: "Tap action",
  hold_action: "Hold action",
  domain: "Domain",
  device_class: "Device class (door, window, motion, ...)",
  labels: "Labels",
  name: "Name",
  icon: "Icon",
  color: "Colour",
  mode: "Count",
  hide_when_zero: "Hide when zero",
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
          show_name: !!this._config.show_name,
          show_area_name: !!this._config.show_area_name,
          include_hidden: !!this._config.include_hidden,
          include_diagnostic: !!this._config.include_diagnostic,
          tap_action: (this._config.tap_action || { action: "list" }).action,
          hold_action: (this._config.hold_action || { action: "none" }).action,
        },
        GENERAL_SCHEMA,
        (value) => {
          this._config.areas = value.areas || [];
          this._config.show_name = value.show_name;
          this._config.show_area_name = value.show_area_name;
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
      title.textContent = chip.name || chip.device_class || chip.domain || `Chip ${i + 1}`;
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
            color: chip.color || "",
            mode: chip.mode || "active",
            hide_when_zero: chip.hide_when_zero !== false,
            show_name: !!chip.show_name,
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
            if (value.color) next.color = value.color;
            if (value.mode && value.mode !== "active") next.mode = value.mode;
            next.hide_when_zero = value.hide_when_zero !== false;
            if (value.show_name) next.show_name = true;
            this._config.chips[i] = next;
            title.textContent = next.name || next.device_class || next.domain || `Chip ${i + 1}`;
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
        this._config.chips.push({ domain: "light", icon: "mdi:lightbulb", color: "amber", hide_when_zero: true });
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
