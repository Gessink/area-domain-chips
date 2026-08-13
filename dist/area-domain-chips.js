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

const VERSION = "1.4.0";

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

// The counterpart of DOMAIN_ACTIVE_STATES, used by `mode: inactive` to pick the
// word after the count ("4 closed", "2 locked").
const DOMAIN_INACTIVE_STATES = {
  alarm_control_panel: ["disarmed"],
  camera: ["idle"],
  cover: ["closed"],
  device_tracker: ["not_home"],
  lawn_mower: ["docked"],
  lock: ["locked"],
  person: ["not_home"],
  sun: ["below_horizon"],
  timer: ["idle"],
  vacuum: ["docked"],
  valve: ["closed"],
};

function activeStatesFor(chip, domain) {
  if (Array.isArray(chip.active_states) && chip.active_states.length) return chip.active_states;
  return DOMAIN_ACTIVE_STATES[domain] || ["on"];
}

function inactiveStatesFor(chip, domain) {
  if (Array.isArray(chip.inactive_states) && chip.inactive_states.length) return chip.inactive_states;
  return DOMAIN_INACTIVE_STATES[domain] || ["off"];
}

// Some domains report what the device is really doing separately from the mode
// it is set to. A thermostat on `auto` or `heat` sits in that state all day;
// only hvac_action tells you whether it is actually heating right now.
const ACTIVITY_ATTRIBUTES = {
  climate: { attribute: "hvac_action", idle: ["off", "idle"] },
  humidifier: { attribute: "action", idle: ["off", "idle"] },
};

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

  const activity = ACTIVITY_ATTRIBUTES[domain];
  if (activity && chip.use_action !== false) {
    const action = stateObj.attributes ? stateObj.attributes[activity.attribute] : undefined;
    if (action !== undefined && action !== null) return !activity.idle.includes(action);
  }

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

// `component.<domain>.title` lives in a translation category the frontend does
// not always load, while `entity_component` is loaded whenever entities of that
// domain exist. Ask the reliable one first.
function domainName(hass, domain) {
  return (
    tr(hass, `component.${domain}.entity_component._.name`) ||
    tr(hass, `component.${domain}.title`) ||
    domain
  );
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
 * Plurals
 *
 * Home Assistant only ships singular names, so a chip that says "Window" has
 * to be pluralised here. English follows regular rules; Dutch is too irregular
 * for that, so the words Home Assistant actually produces for domains and
 * device classes are listed. Anything unknown stays singular, and `name`
 * always wins.
 * ------------------------------------------------------------------ */

const PLURALS_NL = {
  alarmpaneel: "alarmpanelen",
  apparaat: "apparaten",
  automatisering: "automatiseringen",
  batterij: "batterijen",
  beweging: "bewegingen",
  "binaire sensor": "binaire sensoren",
  bevochtiger: "bevochtigers",
  boiler: "boilers",
  camera: "camera's",
  deur: "deuren",
  garagedeur: "garagedeuren",
  gordijn: "gordijnen",
  grasmaaier: "grasmaaiers",
  klep: "kleppen",
  knop: "knoppen",
  lamp: "lampen",
  licht: "lichten",
  luchtontvochtiger: "luchtontvochtigers",
  mediaspeler: "mediaspelers",
  persoon: "personen",
  raam: "ramen",
  rolluik: "rolluiken",
  schakelaar: "schakelaars",
  scherm: "schermen",
  script: "scripts",
  sensor: "sensoren",
  sirene: "sirenes",
  slot: "sloten",
  stofzuiger: "stofzuigers",
  stopcontact: "stopcontacten",
  thermostaat: "thermostaten",
  update: "updates",
  ventilator: "ventilatoren",
  zonwering: "zonweringen",
};

function pluralEn(word) {
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function matchCase(source, target) {
  if (!source || !target) return target;
  const first = source.charAt(0);
  if (first !== first.toLowerCase()) return target.charAt(0).toUpperCase() + target.slice(1);
  return target;
}

function pluralize(hass, word) {
  if (!word) return word;
  const lang = (hass && hass.language) || "en";
  const key = word.toLocaleLowerCase(lang);

  if (lang.startsWith("nl")) {
    const known = PLURALS_NL[key];
    return known ? matchCase(word, known) : word;
  }
  if (lang.startsWith("en")) return matchCase(word, pluralEn(key));
  return word;
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
  { key: "covers_closed", label: "Covers closed", cfg: { domain: "cover", mode: "inactive", icon: "mdi:window-shutter", color: "grey" } },
  { key: "lights_off", label: "Lights off", cfg: { domain: "light", mode: "inactive", icon: "mdi:lightbulb-off", color: "grey" } },
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
        bulk_actions: "all",
        debug: false,
        exclude_areas: [],
        exclude_entities: [],
        groups: "auto",
        include_hidden: false,
        include_diagnostic: false,
        layout: "stacked",
        pluralize: true,
        color_name: false,
        icon_tint: false,
        exclude_keywords: [],
        include_keywords: [],
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

    // Pre-1.2 option name.
    if (config.exclude_redundant_groups === false && config.groups === undefined) {
      this._config.groups = "include";
    }

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

    let name;
    if (deviceClass) name = deviceClassName(hass, domain || "sensor", deviceClass);
    else if (domain) name = domainName(hass, domain);
    else if (chip.mode === "unavailable") return stateName(hass, "", "", "unavailable");
    else return tr(hass, "ui.panel.config.entities.caption") || "Entities";

    const plural = chip.pluralize !== undefined ? chip.pluralize : this._config.pluralize;
    return plural ? pluralize(hass, name) : name;
  }

  // The word after the count: "6 open", "3 on", "4 closed".
  _chipStateWord(chip) {
    if (chip.state_text !== undefined) return chip.state_text;
    const hass = this._hass;
    const mode = chip.mode || "active";
    if (mode === "all") return "";
    if (mode === "unavailable") return lowerFirst(hass, stateName(hass, "", "", "unavailable"));

    const domain = this._chipDomain(chip);
    if (!domain) return "";
    const deviceClass = this._chipDeviceClass(chip);
    const state = mode === "inactive"
      ? inactiveStatesFor(chip, domain)[0]
      : activeStatesFor(chip, domain)[0];
    return lowerFirst(hass, stateName(hass, domain, deviceClass, state));
  }

  _chipColor(chip) {
    return resolveColor(chip.color, this._chipDomain(chip), this._chipDeviceClass(chip));
  }

  /* -------------------- matching -------------------- */

  _chipMatches(chip, entityId, stateObj, ignoreArea) {
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
    if (!ignoreArea) {
      const areas = asArray(chip.areas).length ? asArray(chip.areas) : asArray(cfg.areas);
      const areaId = entityAreaId(hass, entityId);
      if (areas.length) {
        if (!areaId || !areas.includes(areaId)) return false;
      }
      const excluded = asArray(cfg.exclude_areas);
      if (excluded.length && areaId && excluded.includes(areaId)) return false;
    }

    // Labels
    const labels = asArray(chip.labels).concat(asArray(chip.label));
    if (labels.length) {
      const owned = entityLabelSet(hass, entityId);
      const match = (chip.label_match || "any") === "all"
        ? labels.every((l) => owned.has(l))
        : labels.some((l) => owned.has(l));
      if (!match) return false;
    }

    // Keywords, matched case-insensitively against the entity id and the
    // friendly name. Card-level and chip-level exclusions add up; a chip-level
    // include list replaces the card-level one.
    const excludeWords = asArray(cfg.exclude_keywords).concat(asArray(chip.exclude_keywords));
    const includeWords = asArray(chip.include_keywords).length
      ? asArray(chip.include_keywords)
      : asArray(cfg.include_keywords);

    if (excludeWords.length || includeWords.length) {
      const name = (stateObj.attributes && stateObj.attributes.friendly_name) || "";
      const haystack = `${entityId} ${name}`.toLowerCase();
      const hit = (word) => haystack.includes(String(word).toLowerCase());

      if (excludeWords.some(hit)) return false;
      if (includeWords.length && !includeWords.some(hit)) return false;
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

    const groups = cfg.groups || "auto";
    if (groups !== "include") {
      for (let c = 0; c < index.length; c++) {
        const ids = index[c];
        const present = new Set(ids);
        index[c] = ids.filter((id) => {
          const members = groupMembers(hass.states[id]);
          if (!members || !members.length) return true;

          if (groups === "exclude") {
            this._debug(c, id, "dropped: groups is set to exclude");
            return false;
          }

          const counted = members.filter((m) => this._memberCounted(chips[c], m, present));
          const drop = groups === "strict"
            ? members.every((m) => this._memberNotBlocking(chips[c], m, present))
            : counted.length > 0;

          this._debug(
            c,
            id,
            `${drop ? "dropped" : "kept"}: group of ${members.length}, ` +
              `${counted.length} member(s) counted separately` +
              (drop ? "" : ` (${members.filter((m) => !this._memberCounted(chips[c], m, present)).slice(0, 5).join(", ")})`)
          );
          return !drop;
        });
      }
    }

    this._index = index;
    this._indexKey = this._registryKey(hass);
  }

  // Is this member counted in its own right, making the group double count?
  // Besides members in the candidate list this covers the common setup where
  // the group carries the area and its members have none of their own.
  _memberCounted(chip, memberId, present) {
    if (present.has(memberId)) return true;

    const hass = this._hass;
    const stateObj = hass.states[memberId];
    if (!stateObj) return false;

    if (entityAreaId(hass, memberId)) return false;
    return this._chipMatches(chip, memberId, stateObj, true);
  }

  // For `groups: strict`: a member that no longer exists should not keep an
  // otherwise redundant group alive.
  _memberNotBlocking(chip, memberId, present) {
    if (!this._hass.states[memberId]) return true;
    return this._memberCounted(chip, memberId, present);
  }

  _debug(chipIndex, entityId, message) {
    if (!this._config.debug) return;
    console.info(`[area-domain-chips] chip ${chipIndex} · ${entityId}: ${message}`);
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
      if (mode === "inactive") return !isUnavailable(stateObj) && !isActive(stateObj, chip);
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
      const nameEl = document.createElement("span");
      nameEl.className = "name";
      const valueEl = document.createElement("span");
      valueEl.className = "value";
      labels.appendChild(nameEl);
      labels.appendChild(valueEl);

      el.appendChild(iconWrap);
      el.appendChild(labels);

      if (this._config.icon_tint) el.classList.add("tinted");
      if (this._config.color_name) el.classList.add("colored-name");

      this._attachActions(el, i);
      wrap.appendChild(el);

      return { el, icon, iconWrap, nameEl, valueEl, dynamicIcon };
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

  // Bulk buttons act on every entity in the list, so the count is part of the
  // label: no translation needed to make "acts on all of them" obvious.
  _bulkButtons(chipIndex, ids) {
    const hass = this._hass;
    const chip = this._config.chips[chipIndex];
    const domain = this._chipDomain(chip);
    const kind = controlKind(domain);
    const out = [];
    if (!ids.length) return out;

    const setting = chip.bulk_actions !== undefined ? chip.bulk_actions : this._config.bulk_actions;
    const mode = setting === undefined ? "all" : setting === false ? "none" : setting === true ? "all" : setting;
    if (mode === "none") return out;
    const wantOn = mode === "all";

    const add = (icon, label, service, serviceDomain) => {
      out.push(
        this._textButton(icon, `${label} (${ids.length})`, () =>
          this._call(serviceDomain, service, ids)
        )
      );
    };

    if (kind === "toggle") {
      if (wantOn) {
        add("mdi:flash", tr(hass, "ui.card.common.turn_on") || stateName(hass, domain, undefined, "on"), "turn_on", "homeassistant");
      }
      add("mdi:flash-off", tr(hass, "ui.card.common.turn_off") || stateName(hass, domain, undefined, "off"), "turn_off", "homeassistant");
    } else if (kind === "position") {
      const svc = domain === "valve" ? "valve" : "cover";
      if (wantOn) {
        add("mdi:arrow-up", tr(hass, "ui.card.cover.open_cover") || "Open", domain === "valve" ? "open_valve" : "open_cover", svc);
      }
      add("mdi:arrow-down", tr(hass, "ui.card.cover.close_cover") || "Close", domain === "valve" ? "close_valve" : "close_cover", svc);
    } else if (kind === "lock") {
      add("mdi:lock", tr(hass, "ui.card.lock.lock") || "Lock", "lock", "lock");
    } else if (kind === "vacuum") {
      add("mdi:home-map-marker", tr(hass, "ui.card.vacuum.actions.return_to_base") || "Return to base", "return_to_base", "vacuum");
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
      parts.el.style.setProperty("--adc-color", color);
      parts.el.style.setProperty("--adc-tint", tintOf(color));

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
        parts.nameEl.textContent = "";
        parts.valueEl.textContent = countText;
      } else if (chipLayout === "inline") {
        parts.nameEl.textContent = "";
        parts.valueEl.textContent = `${countText} ${name}`;
      } else {
        parts.nameEl.textContent = name;
        parts.valueEl.textContent = countText;
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
  /* Metrics mirror Home Assistant's own ha-badge so the chips line up with the
     standard badges in the same row. */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: var(--adc-height, var(--ha-badge-size, 36px));
    box-sizing: border-box;
    padding: 0 12px;
    border-radius: var(--adc-border-radius, var(--ha-badge-border-radius, calc(var(--ha-badge-size, 36px) / 2)));
    background: var(--adc-background, var(--ha-card-background, var(--card-background-color, #fff)));
    border: var(--ha-card-border-width, 1px) solid
            var(--adc-border-color, var(--ha-card-border-color, var(--divider-color, #e0e0e0)));
    box-shadow: var(--ha-card-box-shadow, none);
    color: var(--primary-text-color);
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, inherit));
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
    flex: 0 0 auto;
    color: var(--adc-color, var(--primary-text-color));
  }
  .chip.tinted .icon {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--adc-tint, transparent);
    margin-left: -4px;
  }
  ha-icon, ha-state-icon { --mdc-icon-size: 18px; display: inline-flex; }

  .labels {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    white-space: nowrap;
  }
  .name {
    font-size: 10px;
    font-weight: 500;
    line-height: 10px;
    letter-spacing: 0.1px;
    color: var(--primary-text-color);
  }
  .chip.colored-name .name { color: var(--adc-color, var(--primary-text-color)); }
  .value {
    font-size: var(--ha-badge-font-size, 12px);
    font-weight: 500;
    line-height: 16px;
    letter-spacing: 0.1px;
  }
  .name:empty { display: none; }
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
      { name: "pluralize", selector: { boolean: {} } },
      { name: "show_area_name", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "color_name", selector: { boolean: {} } },
      { name: "icon_tint", selector: { boolean: {} } },
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
  { name: "exclude_keywords", selector: { text: { multiple: true } } },
  { name: "include_keywords", selector: { text: { multiple: true } } },
  { name: "debug", selector: { boolean: {} } },
  {
    name: "groups",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "auto", label: "Skip a group as soon as one member is counted" },
          { value: "strict", label: "Skip a group only when every member is counted" },
          { value: "exclude", label: "Never count groups" },
          { value: "include", label: "Count groups like any other entity" },
        ],
      },
    },
  },
  {
    name: "bulk_actions",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "all", label: "Show both, e.g. all on and all off" },
          { value: "off", label: "Only the off / close button" },
          { value: "none", label: "No bulk buttons" },
        ],
      },
    },
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
  { name: "exclude_keywords", selector: { text: { multiple: true } } },
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
              { value: "inactive", label: "Inactive (closed, off, locked, ...)" },
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
      { name: "use_action", selector: { boolean: {} } },
    ],
  },
  {
    name: "",
    type: "grid",
    schema: [
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
  pluralize: "Use plural names",
  color_name: "Colour the name line instead of using the text colour",
  exclude_keywords: "Skip entities whose id or name contains",
  include_keywords: "Only count entities whose id or name contains",
  icon_tint: "Tinted circle behind the icon",
  groups: "Group entities",
  bulk_actions: "Bulk buttons in the entity list",
  debug: "Log why entities are counted or skipped to the console",
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
  use_action: "Climate: count only while actually heating or cooling",
  list_scope: "Entity list shows",
};

class AreaDomainChipsEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._forms = [];
    this._open = [];
    this._lastEmitted = null;
  }

  setConfig(config) {
    const incoming = JSON.stringify(config || {});
    this._config = JSON.parse(incoming);
    if (this._config.types && !this._config.chips) {
      this._config.chips = this._config.types;
      delete this._config.types;
    }
    if (!Array.isArray(this._config.chips)) this._config.chips = [];
    this._open.length = this._config.chips.length;

    // Home Assistant hands the config straight back after every edit. Skipping
    // the rebuild there keeps the expansion panels open and the focused field
    // focused while typing.
    if (incoming === this._lastEmitted) return;
    this._render();
  }

  _moveOpen(from, to) {
    const open = this._open;
    [open[from], open[to]] = [open[to], open[from]];
  }

  set hass(hass) {
    this._hass = hass;
    this._forms.forEach((f) => (f.hass = hass));
  }

  _emit() {
    this._lastEmitted = JSON.stringify(this._config);
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
      ha-expansion-panel { display: block; margin-bottom: 8px; --expansion-panel-content-padding: 12px; }
      .panel-icons { display: flex; align-items: center; gap: 4px; padding-right: 8px; }
      .add-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
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
          pluralize: this._config.pluralize !== false,
          show_area_name: !!this._config.show_area_name,
          color_name: !!this._config.color_name,
          icon_tint: !!this._config.icon_tint,
          exclude_keywords: this._config.exclude_keywords || [],
          include_keywords: this._config.include_keywords || [],
          groups: this._config.groups || (this._config.exclude_redundant_groups === false ? "include" : "auto"),
          bulk_actions: this._config.bulk_actions || "all",
          debug: !!this._config.debug,
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
          this._config.pluralize = value.pluralize !== false;
          this._config.show_area_name = value.show_area_name;
          this._config.color_name = !!value.color_name;
          this._config.icon_tint = !!value.icon_tint;
          this._config.exclude_keywords = value.exclude_keywords || [];
          this._config.include_keywords = value.include_keywords || [];
          this._config.groups = value.groups || "auto";
          this._config.bulk_actions = value.bulk_actions || "all";
          this._config.debug = !!value.debug;
          delete this._config.exclude_redundant_groups;
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

    const usePanel = !!customElements.get("ha-expansion-panel");

    this._config.chips.forEach((chip, i) => {
      const heading = this._chipTitle(chip, i);
      const buttons = [
        this._button("↑", () => {
          const c = this._config.chips;
          [c[i - 1], c[i]] = [c[i], c[i - 1]];
          this._moveOpen(i, i - 1);
          this._emit();
          this._render();
        }, i === 0),
        this._button("↓", () => {
          const c = this._config.chips;
          [c[i + 1], c[i]] = [c[i], c[i + 1]];
          this._moveOpen(i, i + 1);
          this._emit();
          this._render();
        }, i === this._config.chips.length - 1),
        this._button("✕", () => {
          this._config.chips.splice(i, 1);
          this._open.splice(i, 1);
          this._emit();
          this._render();
        }),
      ];

      let box;
      let title;

      if (usePanel) {
        box = document.createElement("ha-expansion-panel");
        box.outlined = true;
        box.header = heading;
        box.expanded = !!this._open[i];
        box.addEventListener("expanded-changed", (ev) => {
          this._open[i] = !!ev.detail.expanded;
        });

        const icons = document.createElement("div");
        icons.slot = "icons";
        icons.className = "panel-icons";
        buttons.forEach((b) => {
          b.addEventListener("click", (ev) => ev.stopPropagation());
          icons.appendChild(b);
        });
        box.appendChild(icons);

        // Keep the header in sync while the form is edited.
        title = { set textContent(value) { box.header = value; } };
      } else {
        box = document.createElement("div");
        box.className = "chip-box";
        const head = document.createElement("div");
        head.className = "chip-head";
        title = document.createElement("span");
        title.textContent = heading;
        const spacer = document.createElement("span");
        spacer.className = "spacer";
        head.appendChild(title);
        head.appendChild(spacer);
        buttons.forEach((b) => head.appendChild(b));
        box.appendChild(head);
      }

      box.appendChild(
        this._makeForm(
          {
            domain: chip.domain || "",
            device_class: chip.device_class || "",
            labels: chip.labels || (chip.label ? [chip.label] : []),
            areas: chip.areas || [],
            exclude_keywords: chip.exclude_keywords || [],
            name: chip.name || "",
            icon: chip.icon || "",
            color: chip.color || "state",
            mode: chip.mode || "active",
            hide_when_zero: chip.hide_when_zero !== false,
            use_action: chip.use_action !== false,
            list_scope: chip.list_scope || "auto",
          },
          CHIP_SCHEMA,
          (value) => {
            const next = {};
            if (value.domain) next.domain = value.domain;
            if (value.device_class) next.device_class = value.device_class;
            if (value.labels && value.labels.length) next.labels = value.labels;
            if (value.areas && value.areas.length) next.areas = value.areas;
            if (value.exclude_keywords && value.exclude_keywords.length) {
              next.exclude_keywords = value.exclude_keywords;
            }
            if (value.name) next.name = value.name;
            if (value.icon) next.icon = value.icon;
            if (value.color && value.color !== "state") next.color = value.color;
            if (value.mode && value.mode !== "active") next.mode = value.mode;
            next.hide_when_zero = value.hide_when_zero !== false;
            if (value.use_action === false) next.use_action = false;
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
        this._open[this._config.chips.length - 1] = true;
        this._emit();
        this._render();
      })
    );
    addRow.appendChild(
      this._button("+ Add empty chip", () => {
        this._config.chips.push({ domain: "light", hide_when_zero: true });
        this._open[this._config.chips.length - 1] = true;
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

/* ------------------------------------------------------------------ *
 * Area Section Header
 * -------------------
 * A section heading card that looks exactly like the native HA heading
 * card, but populates from an HA area and embeds area-domain-chips
 * as inline badges.
 *
 * type: custom:area-section-header
 *
 * https://github.com/Gessink/area-domain-chips
 * ------------------------------------------------------------------ */

class AreaSectionHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._built = false;
    this._chipsEl = null;
    this._headingEl = null;
    this._iconEl = null;
    this._lastArea = null;
  }

  static getConfigElement() {
    return document.createElement("area-section-header-editor");
  }

  static getStubConfig(hass) {
    const areas = hass && hass.areas ? Object.keys(hass.areas) : [];
    return {
      type: "custom:area-section-header",
      area: areas.length ? areas[0] : "",
      chips: [
        { domain: "light", icon: "mdi:lightbulb", color: "amber", hide_when_zero: true },
        { domain: "binary_sensor", device_class: "door", icon: "mdi:door-open", color: "red", hide_when_zero: true },
      ],
    };
  }

  // `area` takes a single area id or a list, so a header that covers more than
  // one HA area (a living room combined with a study, say) still counts chips
  // across all of them instead of silently narrowing to the first.
  _areas() {
    const area = this._config.area;
    if (Array.isArray(area)) return area;
    return area ? [area] : [];
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!config.area || (Array.isArray(config.area) && !config.area.length)) {
      throw new Error("'area' is required");
    }
    this._config = Object.assign({}, config);
    this._built = false;
    if (this._hass) {
      this._rebuild();
      this._update();
    }
  }

  getCardSize() { return 1; }

  getGridOptions() {
    return { columns: "full", rows: "auto", min_columns: 3 };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._rebuild();
    this._update();
  }

  get hass() { return this._hass; }

  /* -------------------- actions -------------------- */

  _isActionable() {
    var action = this._config.tap_action;
    if (!action) return false;
    return action.action && action.action !== "none";
  }

  _handleAction() {
    var action = this._config.tap_action;
    if (!action) return;
    if (action.action === "navigate" && action.navigation_path) {
      history.pushState(null, "", action.navigation_path);
      window.dispatchEvent(
        new CustomEvent("location-changed", { bubbles: true, composed: true })
      );
    } else if (action.action === "more-info" && action.entity) {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId: action.entity },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  /* -------------------- DOM -------------------- */

  _rebuild() {
    var root = this.shadowRoot;
    root.innerHTML = "";

    var style = document.createElement("style");
    style.textContent = HEADER_STYLES;
    root.appendChild(style);

    // ha-card wrapper (matches native heading card)
    var card = document.createElement("ha-card");
    root.appendChild(card);

    var container = document.createElement("div");
    container.className = "container";
    card.appendChild(container);

    // Left side: content (icon + heading text + chevron)
    var content = document.createElement("div");
    var headingStyle = this._config.heading_style || "title";
    content.className = "content " + headingStyle;

    var actionable = this._isActionable();
    if (actionable) {
      content.setAttribute("role", "button");
      content.setAttribute("tabindex", "0");
      content.addEventListener("click", this._handleAction.bind(this));
      content.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this._handleAction();
        }
      }.bind(this));
    }
    container.appendChild(content);

    // Icon
    this._iconEl = document.createElement("ha-icon");
    this._iconEl.style.display = "none";
    content.appendChild(this._iconEl);

    // Heading text
    this._headingEl = document.createElement("p");
    content.appendChild(this._headingEl);

    // Chevron for actionable heading
    if (actionable) {
      var hasIconNext = !!customElements.get("ha-icon-next");
      if (hasIconNext) {
        var next = document.createElement("ha-icon-next");
        content.appendChild(next);
      } else {
        var chevron = document.createElement("ha-icon");
        chevron.icon = "mdi:chevron-right";
        chevron.className = "chevron";
        content.appendChild(chevron);
      }
    }

    // Right side: badges (area-domain-chips)
    var chips = this._config.chips;
    if (chips && chips.length) {
      var badges = document.createElement("div");
      badges.className = "badges";
      container.appendChild(badges);

      this._chipsEl = document.createElement("area-domain-chips");
      this._chipsEl.setConfig({
        type: "custom:area-domain-chips",
        areas: this._areas(),
        chips: chips,
        spacing: 6,
      });
      badges.appendChild(this._chipsEl);
    } else {
      this._chipsEl = null;
    }

    this._built = true;
    this._lastArea = null;
  }

  /* -------------------- update -------------------- */

  _update() {
    if (!this._hass || !this._config || !this._built) return;

    // With several areas, "the area" for a fallback heading/icon is the
    // first one; in practice every real header sets its own heading anyway.
    var areaIds = this._areas();
    var area = areaIds.length && this._hass.areas ? this._hass.areas[areaIds[0]] : undefined;

    // Only update heading / icon when area info changes.
    var areaKey = area ? (area.name + "|" + (area.icon || "")) : "";
    if (areaKey !== this._lastArea) {
      this._lastArea = areaKey;

      var heading = this._config.heading || (area ? area.name : areaIds[0] || "");
      if (this._headingEl) this._headingEl.textContent = heading;

      var icon = this._config.icon || (area ? area.icon : undefined);
      if (this._iconEl) {
        if (icon) {
          this._iconEl.icon = icon;
          this._iconEl.style.display = "";
        } else {
          this._iconEl.style.display = "none";
        }
      }
    }

    // Always pass hass to chips so entity states stay current.
    if (this._chipsEl) {
      this._chipsEl.hass = this._hass;
    }
  }

  disconnectedCallback() {}
}

/* CSS that replicates the native hui-heading-card styles exactly,
   with fallbacks for older HA versions that lack design-system tokens. */

const HEADER_STYLES = `
  :host {
    display: block;
  }
  ha-card {
    background: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border: none;
    box-shadow: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    height: 100%;
    min-height: 24px;
  }
  [role="button"] {
    cursor: pointer;
  }
  ha-icon-next,
  .chevron {
    display: inline-block;
    transition: transform 180ms ease-in-out;
  }
  .container {
    padding: 0 var(--ha-space-1, 4px);
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: nowrap;
    align-items: center;
    overflow: visible;
    gap: var(--ha-space-2, 8px);
  }
  .content:hover ha-icon-next,
  .content:hover .chevron {
    transform: translateX(calc(4px * var(--scale-direction, 1)));
  }
  .container .content {
    flex: 0 1 max-content;
    min-width: 0;
  }
  .container .content:not(:only-child) {
    flex: 1 0 var(--ha-heading-card-title-min-width, 150px);
    max-width: max-content;
    min-width: 0;
  }
  .content {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--ha-space-2, 8px);
    color: var(--ha-heading-card-title-color, var(--primary-text-color));
    font-size: var(--ha-heading-card-title-font-size, var(--ha-font-size-l, 18px));
    font-weight: var(--ha-heading-card-title-font-weight, var(--ha-font-weight-normal, 400));
    line-height: var(--ha-heading-card-title-line-height, var(--ha-line-height-normal, 1.5));
    letter-spacing: 0.1px;
    --mdc-icon-size: 18px;
  }
  .content ha-icon,
  .content ha-icon-next,
  .content .chevron {
    display: flex;
    flex: none;
  }
  .content p {
    margin: 0;
    font-style: normal;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
  }
  .content.subtitle {
    color: var(--ha-heading-card-subtitle-color, var(--secondary-text-color));
    font-size: var(--ha-heading-card-subtitle-font-size, var(--ha-font-size-m, 14px));
    font-weight: var(--ha-heading-card-subtitle-font-weight, var(--ha-font-weight-medium, 500));
    line-height: var(--ha-heading-card-subtitle-line-height, var(--ha-line-height-condensed, 1.2));
  }
  .badges {
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
    overflow: auto;
    max-width: 100%;
    scrollbar-width: none;
  }
  .badges::-webkit-scrollbar {
    display: none;
  }
  .badges area-domain-chips {
    display: block;
  }
`;

customElements.define("area-section-header", AreaSectionHeader);

/* ------------------------------------------------------------------ *
 * Area Section Header — editor
 * ------------------------------------------------------------------ */

const HEADER_SCHEMA = [
  { name: "area", selector: { area: { multiple: true } } },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "heading", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
  {
    name: "heading_style",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "title", label: "Title" },
          { value: "subtitle", label: "Subtitle" },
        ],
      },
    },
  },
  {
    name: "tap_action",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "none", label: "No action" },
          { value: "navigate", label: "Navigate" },
          { value: "more-info", label: "More info" },
        ],
      },
    },
  },
  { name: "navigation_path", selector: { text: {} } },
];

Object.assign(LABELS, {
  area: "Area (one or more)",
  heading: "Heading (empty = area name)",
  heading_style: "Heading style",
  navigation_path: "Navigation path",
});

// Same per-chip options as the standalone card's editor, minus the `areas`
// row: a header's chips are always scoped to the header's own area, so a
// per-chip area override would silently contradict that.
const HEADER_CHIP_SCHEMA = CHIP_SCHEMA.filter((row) => row.name !== "areas");

class AreaSectionHeaderEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._forms = [];
    this._open = [];
    this._lastEmitted = null;
  }

  setConfig(config) {
    const incoming = JSON.stringify(config || {});
    this._config = JSON.parse(incoming);
    if (!Array.isArray(this._config.chips)) this._config.chips = [];
    this._open.length = this._config.chips.length;

    // Home Assistant hands the config back after every edit; skipping the
    // rebuild there keeps panels open and the focused field focused.
    if (incoming === this._lastEmitted) return;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._forms.forEach((f) => (f.hass = hass));
  }

  _emit() {
    this._lastEmitted = JSON.stringify(this._config);
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true })
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
      .chip-box { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .chip-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 500; }
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
      ha-expansion-panel { display: block; margin-bottom: 8px; --expansion-panel-content-padding: 12px; }
      .panel-icons { display: flex; align-items: center; gap: 4px; padding-right: 8px; }
      .add-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
      h4 { margin: 16px 0 8px; }
    `;
    root.appendChild(style);

    const cfg = this._config;
    const action = (cfg.tap_action || {}).action || "none";

    const general = document.createElement("div");
    general.className = "section";
    general.appendChild(
      this._makeForm(
        {
          area: asArray(cfg.area),
          heading: cfg.heading || "",
          icon: cfg.icon || "",
          heading_style: cfg.heading_style || "title",
          tap_action: action,
          navigation_path: (cfg.tap_action || {}).navigation_path || "",
        },
        HEADER_SCHEMA,
        (value) => {
          const areas = value.area || [];
          cfg.area = areas.length === 1 ? areas[0] : areas;
          if (value.heading) cfg.heading = value.heading;
          else delete cfg.heading;
          if (value.icon) cfg.icon = value.icon;
          else delete cfg.icon;
          if (value.heading_style && value.heading_style !== "title") cfg.heading_style = value.heading_style;
          else delete cfg.heading_style;

          if (value.tap_action === "navigate") {
            cfg.tap_action = { action: "navigate", navigation_path: value.navigation_path || "" };
          } else if (value.tap_action === "more-info") {
            cfg.tap_action = { action: "more-info" };
          } else {
            delete cfg.tap_action;
          }
          this._emit();
          // navigation_path only makes sense once "navigate" is picked.
          if (value.tap_action !== action) this._render();
        }
      )
    );
    root.appendChild(general);

    const heading = document.createElement("h4");
    heading.textContent = "Chips";
    root.appendChild(heading);

    const usePanel = !!customElements.get("ha-expansion-panel");

    cfg.chips.forEach((chip, i) => {
      const title = this._chipTitle(chip, i);
      const buttons = [
        this._button("↑", () => {
          const c = cfg.chips;
          [c[i - 1], c[i]] = [c[i], c[i - 1]];
          [this._open[i - 1], this._open[i]] = [this._open[i], this._open[i - 1]];
          this._emit();
          this._render();
        }, i === 0),
        this._button("↓", () => {
          const c = cfg.chips;
          [c[i + 1], c[i]] = [c[i], c[i + 1]];
          [this._open[i + 1], this._open[i]] = [this._open[i], this._open[i + 1]];
          this._emit();
          this._render();
        }, i === cfg.chips.length - 1),
        this._button("✕", () => {
          cfg.chips.splice(i, 1);
          this._open.splice(i, 1);
          this._emit();
          this._render();
        }),
      ];

      let box;
      let titleEl;
      if (usePanel) {
        box = document.createElement("ha-expansion-panel");
        box.outlined = true;
        box.header = title;
        box.expanded = !!this._open[i];
        box.addEventListener("expanded-changed", (ev) => {
          this._open[i] = !!ev.detail.expanded;
        });
        const icons = document.createElement("div");
        icons.slot = "icons";
        icons.className = "panel-icons";
        buttons.forEach((b) => {
          b.addEventListener("click", (ev) => ev.stopPropagation());
          icons.appendChild(b);
        });
        box.appendChild(icons);
        titleEl = { set textContent(value) { box.header = value; } };
      } else {
        box = document.createElement("div");
        box.className = "chip-box";
        const head = document.createElement("div");
        head.className = "chip-head";
        titleEl = document.createElement("span");
        titleEl.textContent = title;
        const spacer = document.createElement("span");
        spacer.className = "spacer";
        head.appendChild(titleEl);
        head.appendChild(spacer);
        buttons.forEach((b) => head.appendChild(b));
        box.appendChild(head);
      }

      box.appendChild(
        this._makeForm(
          {
            domain: chip.domain || "",
            device_class: chip.device_class || "",
            labels: chip.labels || (chip.label ? [chip.label] : []),
            exclude_keywords: chip.exclude_keywords || [],
            name: chip.name || "",
            icon: chip.icon || "",
            color: chip.color || "state",
            mode: chip.mode || "active",
            hide_when_zero: chip.hide_when_zero !== false,
            use_action: chip.use_action !== false,
            list_scope: chip.list_scope || "auto",
          },
          HEADER_CHIP_SCHEMA,
          (value) => {
            const next = {};
            if (value.domain) next.domain = value.domain;
            if (value.device_class) next.device_class = value.device_class;
            if (value.labels && value.labels.length) next.labels = value.labels;
            if (value.exclude_keywords && value.exclude_keywords.length) {
              next.exclude_keywords = value.exclude_keywords;
            }
            if (value.name) next.name = value.name;
            if (value.icon) next.icon = value.icon;
            if (value.color && value.color !== "state") next.color = value.color;
            if (value.mode && value.mode !== "active") next.mode = value.mode;
            next.hide_when_zero = value.hide_when_zero !== false;
            if (value.use_action === false) next.use_action = false;
            if (value.list_scope && value.list_scope !== "auto") next.list_scope = value.list_scope;
            cfg.chips[i] = next;
            titleEl.textContent = this._chipTitle(next, i);
            this._emit();
          }
        )
      );

      root.appendChild(box);
    });

    const addRow = document.createElement("div");
    addRow.className = "add-row";
    addRow.appendChild(
      this._button("+ Add chip", () => {
        cfg.chips.push({ domain: "light", icon: "mdi:lightbulb", color: "amber", hide_when_zero: true });
        this._open[cfg.chips.length - 1] = true;
        this._emit();
        this._render();
      })
    );
    root.appendChild(addRow);
  }
}

customElements.define("area-section-header-editor", AreaSectionHeaderEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "area-section-header",
  name: "Area Section Header",
  description:
    "A section heading that auto-populates from an area, with domain chips as badges.",
  preview: false,
  documentationURL: "https://github.com/Gessink/area-domain-chips",
});

console.info(
  `%c AREA-SECTION-HEADER %c v${VERSION} `,
  "color:#fff;background:#4caf50;font-weight:700",
  "color:#4caf50;background:#fff;font-weight:700"
);
