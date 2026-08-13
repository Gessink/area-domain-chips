# Area Domain Chips

[![hacs][hacs-badge]][hacs-url]

A Home Assistant dashboard element that shows **how many entities are active per area**, as a row of compact chips. Pick one or more areas, then add a chip for every domain / label / device class combination you care about, each with its own icon, colour and "hide when zero" behaviour.

Designed for the **badge region** of a dashboard view (one config renders the whole row of chips), but it also works as a regular card.

> Living room selected → `Lights / 3 on`, `Door / 1 open`, `Window / 2 open`, `Vacuum / 1 cleaning`. Tap a chip to get the list of entities with working controls; each chip disappears when its count drops to zero.

## Features

- Pick **one or more areas**, or leave empty for the whole home
- One chip per **domain + label + device class** combination
- **Two-line layout** matching Home Assistant's own badges: the name on top, `3 on` below, same font sizes and height
- Names and state words come from **Home Assistant's own translations**, pluralised, so `binary_sensor` + `window` reads "Ramen / 2 open" on a Dutch instance
- Count what is **inactive** too, for chips like "4 covers closed"
- **Keyword filtering** to drop the odd entity that should not be counted
- Colours use HA's **`ui_color` picker**, including `state` for the domain's own active colour
- Tap opens an **entity list with real controls**: toggles for lights, switches and fans, open/stop/close for covers, lock/unlock, vacuum start/return, plus bulk buttons like turn everything on or off
- **Redundant groups are skipped**: a light group whose members are all counted anyway does not inflate the number, with a hard `groups: exclude` switch when you never want groups at all
- Sensible **active-state detection** per domain, overridable per chip
- **Label filtering** follows Home Assistant semantics: entity labels + device labels + area labels
- Counts **unavailable** entities too, with `mode: unavailable`
- Full **visual editor** with collapsible chip panels, area picker, icon picker, colour picker and ready-made presets
- No dependencies, no build step

## Installation

### HACS (recommended)

1. In HACS, open the three-dot menu → **Custom repositories**
2. Add `https://github.com/Gessink/area-domain-chips` with category **Dashboard**
3. Search for **Area Domain Chips** and install it
4. Reload your browser (Ctrl+F5)

### Manual

1. Copy `dist/area-domain-chips.js` to `<config>/www/area-domain-chips.js`
2. Add the resource under **Settings → Dashboards → three-dot menu → Resources**:
   - URL: `/local/area-domain-chips.js`
   - Type: **JavaScript module**
3. Reload your browser (Ctrl+F5)

## Usage

Open a dashboard in edit mode and add **Area Domain Chips** from the badge picker (or the card picker). The visual editor covers everything; the YAML below is what it produces.

```yaml
type: custom:area-domain-chips
areas:
  - living_room
chips:
  - domain: light
    icon: mdi:lightbulb
    color: amber
  - domain: binary_sensor
    device_class: door
    icon: mdi:door-open
    color: red
  - domain: binary_sensor
    device_class: window
    icon: mdi:window-open-variant
    color: red
  - domain: cover
    icon: mdi:window-shutter-open
    color: blue
  - domain: vacuum
    icon: mdi:robot-vacuum
    color: teal
  - domain: switch
    icon: mdi:toggle-switch-variant
    color: blue
  - domain: climate
    icon: mdi:thermostat
    color: deep-orange
```

Leaving `name` out is the point: each chip picks up the translated device class or domain name from Home Assistant.

Placing it in the badge region of a view:

```yaml
views:
  - title: Living room
    badges:
      - type: custom:area-domain-chips
        areas: [living_room]
        chips:
          - domain: light
            icon: mdi:lightbulb
            color: amber
```

## Configuration

### Top level

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | string | **required** | `custom:area-domain-chips` |
| `areas` | list | `[]` | Area ids to count in. Empty means the whole home. |
| `chips` | list | `[]` | The chips to render. See below. |
| `layout` | `stacked` \| `inline` \| `count` | `stacked` | `stacked` puts the name above the count, `inline` renders `3 on Lights`, `count` shows the number only. |
| `show_state_text` | boolean | `true` | Append the translated state word after the count (`3 on` instead of `3`). |
| `pluralize` | boolean | `true` | Use plural names. See [Naming](#naming). |
| `show_area_name` | boolean | `false` | Append the area name when exactly one area is selected. |
| `color_name` | boolean | `false` | Draw the name line in the chip colour instead of the normal text colour. |
| `exclude_keywords` | list | `[]` | Skip entities whose id or friendly name contains any of these, case-insensitive. |
| `include_keywords` | list | `[]` | Only count entities whose id or friendly name contains one of these. |
| `icon_tint` | boolean | `false` | Put a tinted circle behind the icon. Off matches the standard HA badge. |
| `groups` | `auto` \| `strict` \| `exclude` \| `include` | `auto` | How to treat group entities. See [Groups](#groups). |
| `bulk_actions` | `all` \| `off` \| `none` | `all` | Which bulk buttons the entity list gets. `off` drops the "all on" / "open all" side. |
| `debug` | boolean | `false` | Log to the browser console why group entities are counted or skipped. |
| `exclude_areas` | list | `[]` | Area ids to always skip. |
| `exclude_entities` | list | `[]` | Entity ids to always skip. |
| `include_hidden` | boolean | `false` | Also count entities hidden in the registry. |
| `include_diagnostic` | boolean | `false` | Also count diagnostic/config entities. |
| `list_scope` | `auto` \| `all` \| `matching` | `auto` | What the entity list dialog shows. See [Entity list](#entity-list). |
| `spacing` | number | `8` | Gap between chips in pixels. |
| `tap_action` | object | `{action: list}` | See [Actions](#actions). |
| `hold_action` | object | `{action: none}` | See [Actions](#actions). |

### Per chip

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `domain` / `domains` | string / list | – | Match one or more domains, e.g. `light` or `[light, switch]`. |
| `device_class` / `device_classes` | string / list | – | Match on device class, e.g. `door`, `window`, `motion`. |
| `label` / `labels` | string / list | – | Match on label. Entity, device and area labels all count. |
| `label_match` | `any` \| `all` | `any` | Whether one or every label must match. |
| `areas` | list | – | Override the top-level `areas` for this chip only. |
| `exclude_keywords` | list | – | Extra keywords to skip, on top of the card-level list. |
| `include_keywords` | list | – | Replaces the card-level include list for this chip. |
| `entities` | list | – | Restrict the chip to these entity ids. |
| `name` | string | translated | Empty means the translated device class name, or the domain name. |
| `icon` | string | entity icon | Empty means the icon of the first matching entity. |
| `color` | string | `state` | See [Colours](#colours). |
| `hide_when_zero` | boolean | `true` | Hide the chip when nothing currently matches. |
| `hide_when_absent` | boolean | `true` | Hide the chip when the entity type does not exist in scope at all, regardless of `hide_when_zero`. |
| `layout` | string | inherits | Override the top-level `layout` for this chip. |
| `show_state_text` | boolean | inherits | Override the top-level setting for this chip. |
| `pluralize` | boolean | inherits | Override the top-level setting for this chip. |
| `state_text` | string | translated | Force the word after the count. |
| `mode` | `active` \| `inactive` \| `unavailable` \| `all` \| `value` | `active` | What to count, or `value` to show a live reading instead of a count. See [Showing a value instead of a count](#showing-a-value-instead-of-a-count). |
| `use_action` | boolean | `true` | For `climate` and `humidifier`, count on `hvac_action` / `action` rather than the mode. See [Active-state detection](#active-state-detection). |
| `active_states` | list | per domain | Override which states count as active. The first entry is also the word shown after the count. |
| `inactive_states` | list | – | Inverse of `active_states`: everything else counts as active. |
| `list_scope` | string | inherits | Override the top-level setting for this chip. |
| `bulk_actions` | string | inherits | Override the top-level setting for this chip. |

If every chip is hidden, the whole element hides itself, so it leaves no empty gap in the badge row.

### Showing zero, not nothing

`hide_when_zero` and `hide_when_absent` answer two different questions, and can be set independently:

- `hide_when_absent` (default `true`): is the entity type even here? A room with no door sensor never shows a door chip, whatever `hide_when_zero` says.
- `hide_when_zero` (default `true`): is anything currently matching? A room with a door sensor that happens to be closed shows nothing by default.

Set `hide_when_zero: false` to keep the chip visible whenever the entity type is present, counting down to `0` instead of disappearing:

```yaml
- domain: binary_sensor
  device_class: door
  hide_when_zero: false
# -> "0 open" once every door in scope is closed, gone entirely in a room with no door sensor
```

### Naming

With no `name`, a chip asks Home Assistant for the translation, so the same config reads differently per language:

| Chip | English | Dutch |
| --- | --- | --- |
| `domain: light` | Lights / 3 on | Lichten / 3 aan |
| `domain: binary_sensor`, `device_class: window` | Windows / 2 open | Ramen / 2 open |
| `domain: cover` | Covers / 1 open | Rolluiken / 1 open |
| `domain: cover`, `mode: inactive` | Covers / 4 closed | Rolluiken / 4 gesloten |
| `domain: vacuum` | Vacuums / 1 cleaning | Stofzuigers / 1 bezig met stofzuigen |

Home Assistant only ships singular names, so the plural is added here. English follows the regular rules. Dutch is too irregular for that, so the words Home Assistant actually produces for domains and device classes are held in a list; anything not in it stays singular. Every other language stays singular as well. Set `pluralize: false` to switch it off, or give the chip a `name` to decide for yourself. Corrections and additions to the Dutch list are welcome. `mode: value` (below) defaults to singular instead, since it is one reading, not several.

### Showing a value instead of a count

A count makes no sense for a continuous reading: "1 temperature sensor" says nothing a number would. `mode: value` shows the entity's own state instead, formatted with its unit exactly like a tile or entity row would show it:

```yaml
- domain: sensor
  device_class: temperature
  mode: value
# -> Temperatuur / 21.4 °C
```

With more than one matching entity, the first one's reading is shown; `mode: value` is meant for a chip that resolves to a single sensor, which an area-scoped chip usually does. `hide_when_zero` still hides the chip when nothing matches, based on whether an entity was found, never on the reading itself, so a temperature of 0°C is not mistaken for "nothing here."

### Keyword filtering

Some entities just do not belong in a count: a Christmas tree among the lights, a test switch, a debug sensor. `exclude_keywords` drops anything whose entity id or friendly name contains one of the words, case-insensitive and matched as a plain substring.

```yaml
type: custom:area-domain-chips
areas: [living_room]
exclude_keywords: [kerst, test]     # applies to every chip
chips:
  - domain: light
    exclude_keywords: [nachtlamp]   # only this chip, on top of the list above
```

`include_keywords` works the other way round and keeps only what matches. A chip-level include list replaces the card-level one, so a single chip can opt out of the card-wide narrowing.

### Colours

`color` accepts the same values as Home Assistant's own colour picker, which the visual editor uses:

- `state` (the default) uses the colour HA gives that domain when active, via `--state-<domain>-active-color`
- `none` uses the normal text colour
- a theme colour name: `primary`, `accent`, `red`, `pink`, `purple`, `deep-purple`, `indigo`, `blue`, `light-blue`, `cyan`, `teal`, `green`, `light-green`, `lime`, `yellow`, `amber`, `orange`, `deep-orange`, `brown`, `light-grey`, `grey`, `dark-grey`, `blue-grey`, `black`, `white`, `disabled`
- any raw CSS colour, e.g. `#e91e63`

The circular tint behind the icon is derived from the chosen colour with `color-mix`, so it follows every one of those options.

### Entity list

The default tap action opens a dialog listing the entities behind the chip, with controls in the row:

| Domain | Control |
| --- | --- |
| `light`, `switch`, `fan`, `input_boolean`, `humidifier`, `siren`, `remote`, `automation`, `media_player` | Toggle |
| `cover`, `valve` | Open / stop / close, respecting `supported_features` |
| `lock` | Lock / unlock |
| `vacuum` | Start / return to base |
| everything else | Read-only; clicking the row opens more-info |

Above the list sit bulk buttons that act on every entity in it: on and off for toggleable domains, open and close for covers and valves, lock for locks, return to base for vacuums. Each label carries the number it will act on, so a cover chip listing twelve covers shows `Open (12)` and `Close (12)`.

`bulk_actions: off` keeps only the off / close button, for chips where turning everything on is not something you want one tap away. `bulk_actions: none` removes the row. Both can be set per chip.

`list_scope` decides which entities are listed:

- `auto` (default): controllable domains list every entity in scope, so the bulk buttons and toggles have something to act on; read-only domains such as `binary_sensor` list only what is counted
- `all`: always list every entity in scope, active ones first
- `matching`: always list only the counted entities

### Actions

`tap_action` and `hold_action` accept:

| Action | Description |
| --- | --- |
| `list` | Open the entity list described above. |
| `more-info` | Open more-info for the first matching entity, or for `entity` if set. |
| `navigate` | Navigate to `navigation_path`. |
| `toggle` | Call `homeassistant.toggle` on every matching entity. |
| `turn_off` | Call `homeassistant.turn_off` on every matching entity. |
| `none` | Do nothing. |

```yaml
tap_action:
  action: list
hold_action:
  action: turn_off
```

### Groups

Group helpers expose their members in the `entity_id` attribute. `groups` decides what happens to them:

| Value | Behaviour |
| --- | --- |
| `auto` (default) | Drop a group as soon as **one** member is counted separately, because from that point on the group is double counting. A house-wide "All lights" group disappears from a living-room chip the moment one living-room lamp is counted. |
| `strict` | Drop a group only when **every** member is counted separately. Keeps house-wide groups visible in an area chip. |
| `exclude` | Never count any group entity. |
| `include` | Count groups like any other entity. |

A member counts as counted separately when the same chip matches it, or when it has no area of its own — that second case covers the common setup where the group carries the area and its members do not. A group whose members are all hidden, or that no longer exist, is kept under `auto`, because then nothing else represents it; use `groups: exclude` to get rid of those too.

Not sure why a particular group survives? Set `debug: true` and open the browser console: every group decision is logged with the members it found.

### Active-state detection

Without `active_states`, a chip uses the table below; unlisted domains count anything that is not `off`, `closed`, `locked`, `docked`, `idle`, `standby`, `disarmed`, `not_home` or unavailable.

| Domain | Active states |
| --- | --- |
| `light`, `switch`, `fan`, `input_boolean`, `siren`, `remote`, `automation`, `script`, `update`, `humidifier`, `binary_sensor` | `on` |
| `cover`, `valve` | `open`, `opening` |
| `lock` | `unlocked`, `open`, `opening`, `unlocking` |
| `vacuum` | `cleaning`, `returning`, `error` |
| `lawn_mower` | `mowing`, `returning`, `error` |
| `climate` | whatever `hvac_action` reports, see below; otherwise `heat`, `cool`, `heat_cool`, `auto`, `dry`, `fan_only` |
| `media_player` | `playing`, `buffering`, `on` |
| `alarm_control_panel` | any armed / arming / pending / triggered state |
| `person`, `device_tracker` | `home` |
| `timer` | `active`, `paused` |
| `camera` | `recording`, `streaming` |

Override it per chip when your setup differs. The first entry doubles as the word after the count:

```yaml
- domain: media_player
  icon: mdi:play-circle
  active_states: [playing]
```

#### Thermostats and humidifiers

A thermostat set to `auto` or `heat` sits in that state all day, so counting the state would report it as active even while the setpoint is reached and nothing is running. When the integration reports `hvac_action`, that decides instead: the thermostat counts only while it is heating, cooling, drying or preheating, not while it is `idle` or `off`. Humidifiers work the same way through their `action` attribute. Integrations that do not report the attribute fall back to the state.

Set `use_action: false` on the chip to count the mode again, or give the chip explicit `active_states` to bypass both.

`mode: inactive` counts the other side of the same line: everything that is neither active nor unavailable. The word after the count then comes from the domain's inactive state (`closed` for covers, `locked` for locks, `docked` for vacuums, `off` for the rest), or from the first entry of `inactive_states`.

```yaml
- domain: cover
  mode: inactive
  icon: mdi:window-shutter
  color: grey
# -> Covers / 4 closed
```

## Styling

The chips reuse Home Assistant's own badge metrics, so they line up with the standard badges next to them: `--ha-badge-size` for the height, `--ha-badge-border-radius`, `--ha-badge-font-size` for the count line, and a 10px name line above it. To tweak them further, use `card_mod` or a theme with these CSS variables on the element:

| Variable | Default |
| --- | --- |
| `--adc-gap` | `8px` |
| `--adc-height` | `var(--ha-badge-size, 36px)` |
| `--adc-border-radius` | `var(--ha-badge-border-radius, 18px)` |
| `--adc-background` | `var(--ha-card-background)` |
| `--adc-border-color` | `var(--ha-card-border-color)` |

## Notes

- Home Assistant renders one element per entry in `badges:`, so a single Area Domain Chips entry renders the whole row of chips inside that one slot.
- Requires Home Assistant 2024.8 or newer for the badge region and the `ui_color` picker. As a card it works on slightly older versions too.
- Label filtering needs the entity/device/area registry in the frontend, which Home Assistant exposes from 2024.4 onwards.

## Area Section Header

`custom:area-section-header` is a `type: heading` card that populates itself from an area and shows Area Domain Chips as its badges, so a room does not need a heading card and a chips card side by side:

```yaml
type: custom:area-section-header
area: living_room          # a single area id, or a list for a combined header
heading: Woonkamer          # optional, defaults to the area's name
icon: mdi:sofa               # optional, defaults to the area's own icon
tap_action:
  action: navigate
  navigation_path: /dashboard-mobile/detail-woonkamer
chips:
  - domain: light
    icon: mdi:lightbulb-group-outline
    color: orange
    hide_when_zero: true
  - domain: binary_sensor
    device_class: door
    icon: mdi:door-open
    color: red
    hide_when_zero: true
```

It matches the native heading card's look exactly — same layout, same CSS variables, with fallbacks so it still looks right on older Home Assistant that has not defined the newer design-system tokens. `area` accepts a list when a header covers more than one HA area; the chips then count across all of them, same as passing that list to `areas:` on a standalone chips card. Every per-chip option documented above works here too, except a chip's own `areas` override, which the header does not offer: its chips are always scoped to the header's own area, so an override would silently fight that.

The chips render as Home Assistant's own heading badges do: icon and a bare number, no background, no name, no trailing word — not the pill look a standalone `area-domain-chips` card has. That comes from `native_badges: true`, which the header sets on its embedded chips automatically; there is nothing to configure. Using `area-domain-chips` directly still gets the full pill card, name line included, since that is a deliberately different, standalone design.

Leaving out `heading` or `icon` falls back to the area's own name/icon from the registry. Setting either to `false` forces it off instead, even if the area does have one — for a room whose heading never showed an icon and should not start showing one just because someone later sets an icon on that area in Home Assistant.

## License

MIT

[hacs-badge]: https://img.shields.io/badge/HACS-Custom-41BDF5.svg
[hacs-url]: https://github.com/hacs/integration
