# Area Domain Chips

[![hacs][hacs-badge]][hacs-url]

A Home Assistant dashboard element that shows **how many entities are active per area**, as a row of compact chips. Pick one or more areas, then add a chip for every domain / label / device class combination you care about, each with its own icon, colour and "hide when zero" behaviour.

Designed for the **badge region** of a dashboard view (one config renders the whole row of chips), but it also works as a regular card.

> Living room selected → `Lights / 3 on`, `Door / 1 open`, `Window / 2 open`, `Vacuum / 1 cleaning`. Tap a chip to get the list of entities with working controls; each chip disappears when its count drops to zero.

## Features

- Pick **one or more areas**, or leave empty for the whole home
- One chip per **domain + label + device class** combination
- **Two-line layout** like a Mushroom badge: the name on top, `3 on` below
- Names and state words come from **Home Assistant's own translations**, so `binary_sensor` + `window` reads "Raam / 2 open" on a Dutch instance
- Colours use HA's **`ui_color` picker**, including `state` for the domain's own active colour
- Tap opens an **entity list with real controls**: toggles for lights, switches and fans, open/stop/close for covers, lock/unlock, vacuum start/return, plus bulk buttons like turn everything on or off
- **Redundant groups are skipped**: a light group whose members are all counted anyway does not inflate the number
- Sensible **active-state detection** per domain, overridable per chip
- **Label filtering** follows Home Assistant semantics: entity labels + device labels + area labels
- Counts **unavailable** entities too, with `mode: unavailable`
- Full **visual editor** with area picker, icon picker, colour picker and ready-made presets
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
| `show_area_name` | boolean | `false` | Append the area name when exactly one area is selected. |
| `exclude_redundant_groups` | boolean | `true` | Skip group-style entities whose members are all counted anyway. |
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
| `entities` | list | – | Restrict the chip to these entity ids. |
| `name` | string | translated | Empty means the translated device class name, or the domain name. |
| `icon` | string | entity icon | Empty means the icon of the first matching entity. |
| `color` | string | `state` | See [Colours](#colours). |
| `hide_when_zero` | boolean | `true` | Hide the chip when the count is zero. |
| `layout` | string | inherits | Override the top-level `layout` for this chip. |
| `show_state_text` | boolean | inherits | Override the top-level setting for this chip. |
| `state_text` | string | translated | Force the word after the count. |
| `mode` | `active` \| `unavailable` \| `all` | `active` | What to count. |
| `active_states` | list | per domain | Override which states count as active. The first entry is also the word shown after the count. |
| `inactive_states` | list | – | Inverse of `active_states`: everything else counts as active. |
| `list_scope` | string | inherits | Override the top-level setting for this chip. |

If every chip is hidden, the whole element hides itself, so it leaves no empty gap in the badge row.

### Naming

With no `name`, a chip asks Home Assistant for the translation, so the same config reads differently per language:

| Chip | English | Dutch |
| --- | --- | --- |
| `domain: light` | Light / 3 on | Licht / 3 aan |
| `domain: binary_sensor`, `device_class: window` | Window / 2 open | Raam / 2 open |
| `domain: cover` | Cover / 1 open | Rolluik / 1 open |
| `domain: vacuum` | Vacuum / 1 cleaning | Stofzuiger / 1 bezig met stofzuigen |

Home Assistant only ships singular names, so set `name: Windows` yourself if you prefer a plural.

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

Above the list sit bulk buttons: turn everything on or off for toggleable domains, open or close everything for covers, lock everything for locks.

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

### Redundant groups

Group helpers expose their members in the `entity_id` attribute. When every member of such a group is itself counted by the same chip, the group is dropped, so a "All living room lights" group next to its own three bulbs reports `3 on` rather than `4 on`. A group that reaches outside the chip's scope is kept, because its members are not represented otherwise. Set `exclude_redundant_groups: false` to count groups like any other entity.

### Active-state detection

Without `active_states`, a chip uses the table below; unlisted domains count anything that is not `off`, `closed`, `locked`, `docked`, `idle`, `standby`, `disarmed`, `not_home` or unavailable.

| Domain | Active states |
| --- | --- |
| `light`, `switch`, `fan`, `input_boolean`, `siren`, `remote`, `automation`, `script`, `update`, `humidifier`, `binary_sensor` | `on` |
| `cover`, `valve` | `open`, `opening` |
| `lock` | `unlocked`, `open`, `opening`, `unlocking` |
| `vacuum` | `cleaning`, `returning`, `error` |
| `lawn_mower` | `mowing`, `returning`, `error` |
| `climate` | `heat`, `cool`, `heat_cool`, `auto`, `dry`, `fan_only` |
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

## Styling

The chips pick up your theme automatically. To tweak them, use `card_mod` or a theme with these CSS variables on the element:

| Variable | Default |
| --- | --- |
| `--adc-gap` | `8px` |
| `--adc-height` | `36px` (minimum) |
| `--adc-border-radius` | `20px` |
| `--adc-background` | `var(--card-background-color)` |
| `--adc-border-color` | `var(--ha-card-border-color)` |

## Notes

- Home Assistant renders one element per entry in `badges:`, so a single Area Domain Chips entry renders the whole row of chips inside that one slot.
- Requires Home Assistant 2024.8 or newer for the badge region and the `ui_color` picker. As a card it works on slightly older versions too.
- Label filtering needs the entity/device/area registry in the frontend, which Home Assistant exposes from 2024.4 onwards.

## License

MIT

[hacs-badge]: https://img.shields.io/badge/HACS-Custom-41BDF5.svg
[hacs-url]: https://github.com/hacs/integration
