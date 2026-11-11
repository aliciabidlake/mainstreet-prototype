# Mainstreet prototype

Clickable HTML prototype of two Mainstreet screens — **Consignment Edit** and **Transport Dispatch** — built from the Figma designs (Mainstreet – Concepting) and styled with the **ONE DS** design system (Supernova, shared draft).

Open `index.html` in a browser, or view the GitHub Pages site.

- `#/dispatch` — Transport Dispatch (default)
- `#/consignment` — Consignment Edit

## Files

| File | What it is |
| --- | --- |
| `index.html` | Markup for both screens, the Filters side sheet and the "not built" page |
| `app.css` | Styles. Figma-match overrides are scoped to `.figma-screen`; everything else follows ONE DS |
| `app.js` | Behaviour: routing, menus, lookups, validation, grids, filters, saved filters, allocation |
| `one-ds-tokens.css` | ONE DS design tokens (light theme, Compact density) exported from Supernova |

No build step and no dependencies. Fonts (Inter, Material Icons) and Font Awesome Free load from CDNs.

All data is sample data.
