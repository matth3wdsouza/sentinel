// Registry for the colour-scheme picker in Settings. Each entry needs a
// matching pair of blocks in globals.css (:root[data-scheme="id"] and
// .dark[data-scheme="id"]) — docs/internal/validate-palettes.js asserts
// that the two stay in sync and that every value meets WCAG AA.
//
// All five schemes are Sentinel originals: each block overrides the same
// 13 tokens (neutral ramp + interactive hue family) in both modes, and
// nothing else. The CSS is the source of truth for actual values.
// Unlisted tokens fall through to the base :root / :root.dark values.
//
// The picker stores the chosen id in localStorage ("sentinel-scheme").
// The init script in layout.js reads it before paint and sets
// data-scheme on <html> to prevent a flash.

export const COLOR_SCHEMES = [
  { id: "default", label: "Sentinel", swatch: "#286c6d" },
  { id: "ember", label: "Ember", swatch: "#a04b28" },
  { id: "moss", label: "Moss", swatch: "#2c6e46" },
  { id: "dusk", label: "Dusk", swatch: "#6d4494" },
  { id: "graphite", label: "Graphite", swatch: "#356a83" },
];
