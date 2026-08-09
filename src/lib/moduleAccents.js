// Literal, complete class strings per accent — Tailwind's build-time scanner
// only picks up classes it can see written out in full in the source (same
// reason ResultCard/GeneratorResultCard do this for verdict colors). These
// accents are decorative-only identity colors for each module, kept
// separate from match/mismatch/fallback (which carry verdict meaning inside
// ResultCard) so they never collide with a result's actual meaning.
//
// Shared between the home page (module grid) and each module's own
// PageHeader, so a module's color carries through from the card you click
// on the home screen to the page it opens — one visual thread instead of
// ten unrelated pages.
//
// The palette is intentionally finite (eight hues). One hue is assigned per
// category: emerald → Passwords & Passphrases, amber → Inspect & Analyse,
// blue → Developer Tools, violet → Miscellaneous. Adding a new module means
// using its category's hue rather than minting a new CSS variable.
//
// Note: "emerald" was previously named "green" in this palette. The rename
// reflects the actual hue more precisely and avoids confusion if a true
// lime/green were ever added.
export const ACCENTS = {
  // Fallback only — used by ModulePage and PageHeader when no module matches
  // the current pathname. Never assign this to a category in modules.js.
  teal:    { chipBg: "bg-teal-light",             chipText: "text-teal-chip"         },

  // Active — one per category (see modules.js)
  emerald: { chipBg: "bg-accent-emerald-light",   chipText: "text-accent-emerald"   }, // Passwords & Passphrases
  amber:   { chipBg: "bg-accent-amber-light",     chipText: "text-accent-amber"     }, // Inspect & Analyse
  blue:    { chipBg: "bg-accent-blue-light",       chipText: "text-accent-blue"      }, // Developer Tools
  violet:  { chipBg: "bg-accent-violet-light",    chipText: "text-accent-violet"    }, // Miscellaneous

  // Reserved for future categories — not yet assigned
  rose:    { chipBg: "bg-accent-rose-light",      chipText: "text-accent-rose"      },
  indigo:  { chipBg: "bg-accent-indigo-light",    chipText: "text-accent-indigo"    },
  orange:  { chipBg: "bg-accent-orange-light",    chipText: "text-accent-orange"    },
};
