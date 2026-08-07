# Area Domain Chips

[![hacs][hacs-badge]][hacs-url]

A Home Assistant dashboard element that shows **how many entities are active per area**, as a row of compact chips. Pick one or more areas, then add a chip for every domain / label / device class combination you care about, each with its own icon, colour and "hide when zero" behaviour.

Designed for the **badge region** of a dashboard view (one config renders the whole row of chips), but it also works as a regular card.

> Living room selected → `3 lights on`, `1 door open`, `2 windows open`, `1 vacuum running`, `2 switches on`, `1 thermostat active` — and each chip disappears when its count drops to zero.

## Features

- Pick **one or more areas**, or leave empty for the whole home
- One chip per **domain + label + device class** combination
- Per chip: **icon**, **colour**, **name**, **hide when zero**
- Sensible **active-state detection** per domain (`open` for covers, `unlocked` for locks, `cleaning` for vacuums, anything but `off` for climate, ...), overridable per chip
- **Label filtering** follows Home Assistant semantics: entity labels + device labels + area labels
- **Tap action**: show the matching entities in a list, open more-info, or toggle / turn off everything that is counted
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
    name: Lights
    icon: mdi:lightbulb
    color: amber
  - domain: binary_sensor
    device_class: door
    name: Doors
    icon: mdi:door-open
    color: red
  - domain: binary_sensor
    device_class: window
    name: Windows
    icon: mdi:window-open-variant
    color: red
  - domain: cover
    name: Covers
    icon: mdi:window-shutter-open
    color: blue
  - domain: vacuum
    name: Vacuums
    icon: mdi:robot-vacuum
    color: teal
  - domain: switch
    name: Switches
    icon: mdi:toggle-switch-variant
    color: blue
  - domain: climate
    name: Climate
    icon: mdi:thermostat
    color: deep-orange
```

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
| `exclude_areas` | list | `[]` | Area ids to always skip. |
| `exclude_entities` | list | `[]` | Entity ids to always skip. |
| `include_hidden` | boolean | `false` | Also count entities hidden in the registry. |
| `include_diagnostic` | boolean | `false` | Also count diagnostic/config entities. |
| `show_name` | boolean | `false` | Default for showing the name next to the count. |
| `show_area_name` | boolean | `false` | Append the area name when exactly one area is selected. |
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
| `name` | string | domain / device class | Shown in the tooltip and the entity list dialog. |
| `icon` | string | `mdi:help-circle-outline` | Any MDI icon. |
| `color` | string | theme text colour | A Home Assistant colour name (`red`, `amber`, `teal`, ...) or any CSS colour. |
| `hide_when_zero` | boolean | `true` | Hide the chip when the count is zero. |
| `show_name` | boolean | inherits | Show the name next to the count. |
| `mode` | `active` \| `unavailable` \| `all` | `active` | What to count. |
| `active_states` | list | per domain | Override which states count as active. |
| `inactive_states` | list | – | Inverse of `active_states`: everything else counts as active. |

If every chip is hidden, the whole element hides itself, so it leaves no empty gap in the badge row.

### Colours

Home Assistant theme colours are supported by name: `primary`, `accent`, `red`, `pink`, `purple`, `deep-purple`, `indigo`, `blue`, `light-blue`, `cyan`, `teal`, `green`, `light-green`, `lime`, `yellow`, `amber`, `orange`, `deep-orange`, `brown`, `grey`, `blue-grey`, `black`, `white`, `disabled`. Anything else is passed through as a raw CSS colour.

### Actions

`tap_action` and `hold_action` accept:

| Action | Description |
| --- | --- |
| `list` | Open a dialog listing the matching entities; clicking a row opens more-info. |
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

Override it per chip when your setup differs:

```yaml
- domain: media_player
  name: Playing
  icon: mdi:play-circle
  active_states: [playing]
```

## Styling

The chips pick up your theme automatically. To tweak them, use `card_mod` or a theme with these CSS variables on the element:

| Variable | Default |
| --- | --- |
| `--adc-gap` | `8px` |
| `--adc-height` | `36px` |
| `--adc-border-radius` | `18px` |
| `--adc-background` | `var(--card-background-color)` |
| `--adc-border-color` | `var(--ha-card-border-color)` |

## Notes

- Home Assistant renders one element per entry in `badges:`, so a single Area Domain Chips entry renders the whole row of chips inside that one slot.
- Requires Home Assistant 2024.8 or newer for the badge region. As a card it works on older versions too.
- Label filtering needs the entity/device/area registry in the frontend, which Home Assistant exposes from 2024.4 onwards.

## License

MIT

[hacs-badge]: https://img.shields.io/badge/HACS-Custom-41BDF5.svg
[hacs-url]: https://github.com/hacs/integration
