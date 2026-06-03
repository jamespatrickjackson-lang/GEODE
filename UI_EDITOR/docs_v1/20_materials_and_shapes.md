# Materials And Shapes

**Status:** active standalone editor material catalog.

This document defines the visual variables the standalone editor needs in the
Inspector, Library, and style presets to rebuild GeoSee-style editor panels.

## Material Variables

| Variable | Use |
| --- | --- |
| Fill color | Panel, card, row, shape, and swatch color. |
| Fill alpha | Transparent/frosted UI material strength. |
| Opacity | Whole-element visibility strength. |
| Border color | Hairlines, cards, rows, and shape outlines. |
| Border alpha | Subtle GeoSee-style line strength. |
| Border width | 0 px, 1 px, 2 px, and custom values. |
| Radius | Square, small, card, pill, and custom radius. |
| Backdrop blur | Frosted overlay material. |
| Backdrop saturation | Frosted overlay material intensity. |
| Shadow | Card/HUD elevation. |
| Text color | Labels, values, headings, muted text. |
| Typography | Font family, size, weight, line height. |
| Line width | Lines, dividers, icon strokes where applicable. |

## GeoSee Material Presets

| Preset | Variables |
| --- | --- |
| Overlay card | Semi-transparent fill, border alpha, blur, saturation, radius, shadow. |
| Editor chrome | Dark/neutral panel fill, compact radius, subtle border, tight typography. |
| Navigator | Pill or bar material, active/inactive fill, border alpha, label style. |
| Label | Text color, size, weight, optional chip background. |
| Layer row | Compact height, row fill, hover/active state, icon color, label color. |
| Page row | Indent, active mark, icon color, text color, optional child indicator. |
| Save footer | Footer fill, save icon sizing, status label, border top. |

## Shape Primitives

| Shape | Required inspector fields |
| --- | --- |
| Rectangle | x, y, width, height, fill, opacity, radius, border. |
| Ellipse | x, y, width, height, fill, opacity, border. |
| Line | x, y, width/height or endpoints, line width, color, opacity. |
| Divider | Orientation, length, line width, color, opacity. |
| Swatch | Color, radius, border, label/name. |

Shapes are Components unless wrapped into an Assembly.

## Text And Icon Materials

Text controls need:

- Content.
- Font family.
- Font size.
- Font weight.
- Text color.
- Alignment.
- Optional label preset.

Icon controls need:

- Glyph.
- Size.
- Color.
- Stroke/fill handling where the glyph supports it.
- Optional button/background material.

## Library Entries

The Library should expose:

- Colour swatches for common GeoSee panel/text/border colors.
- Token entries for radius, alpha, blur, saturation, shadow, spacing, and line
  width.
- Style entries for overlay card, editor chrome, navigator, labels, page rows,
  layer rows, and save footer.
- Shape Components for rectangle, ellipse, line, divider, swatch, and icon.

## Acceptance

1. Inspector controls can edit every material variable listed here.
2. Style presets apply compatible variables without mutating incompatible ones.
3. Shape primitives can be created, selected, resized, styled, saved, and
   re-instantiated.
4. GeoSee-style overlay/card/navigation materials can be rebuilt in the editor.
