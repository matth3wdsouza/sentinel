// Thin wrapper around exifr that pulls only the ~25 fields we care about and
// returns them in the four privacy-focused groups the UI works with.
//
// exifr.parse() accepts a File/Blob directly — no FileReader needed. We pass
// an explicit tag list so we never load the full EXIF tag set (which runs to
// hundreds of fields for RAW camera files). Missing fields come back as
// undefined; we normalise those to null so callers can do a simple null check.

// ─── Tag lists per group ─────────────────────────────────────────────────────

const LOCATION_TAGS = [
  "GPSLatitude",
  "GPSLongitude",
  "GPSLatitudeRef",
  "GPSLongitudeRef",
  "GPSAltitude",
  "GPSAltitudeRef",
  "GPSSpeed",
  "GPSImgDirection",
  "GPSDateStamp",
  "GPSTimeStamp",
];

const DEVICE_TAGS = [
  "Make",
  "Model",
  "Software",
  "BodySerialNumber",
  "LensModel",
  "LensMake",
  "LensSerialNumber",
];

const TIMESTAMP_TAGS = [
  "DateTimeOriginal",
  "DateTimeDigitized",
  "DateTime",
];

const TECHNICAL_TAGS = [
  "ImageWidth",
  "ImageHeight",
  "Orientation",
  "ExposureTime",
  "FNumber",
  "ISO",
  "FocalLength",
];

const ALL_TAGS = [
  ...LOCATION_TAGS,
  ...DEVICE_TAGS,
  ...TIMESTAMP_TAGS,
  ...TECHNICAL_TAGS,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(raw, tags) {
  const out = {};
  for (const tag of tags) {
    out[tag] = raw[tag] ?? null;
  }
  return out;
}

// GPS values from exifr usually come back as signed decimal degrees, but some
// encoders write raw DMS arrays ([degrees, minutes, seconds]). We handle both.
// We also guard against NaN, which exifr can produce when the GPS sub-IFD
// exists but contains zeroed-out or malformed values.
function dmsToDecimal(value) {
  if (!Array.isArray(value)) return value;
  const [d, m, s] = value;
  return d + m / 60 + s / 3600;
}

function formatCoord(value) {
  if (value === null || value === undefined) return null;
  const decimal = dmsToDecimal(value);
  if (typeof decimal !== "number" || isNaN(decimal)) return null;
  // Treat 0,0 as "no real GPS fix" — some encoders write GPS IFD with all
  // zeroes when location was unavailable rather than omitting the IFD entirely.
  if (decimal === 0) return null;
  return Math.round(decimal * 1_000_000) / 1_000_000;
}

// Normalise values that are present but meaninglessly empty — exifr returns
// empty strings, whitespace-only strings, or strings of dashes for some tag
// fields when the encoder wrote the tag with no real content.
function normEmpty(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().replace(/-/g, "") === "") return null;
  return value;
}

// Normalise numeric fields that are zero due to a zeroed-out IFD rather than
// a real zero measurement. Zero is a legitimate value for e.g. GPSAltitude
// (sea level) but not for FNumber, ISO, or ExposureTime on a real image.
function normZero(value) {
  if (value === null || value === undefined) return null;
  if (value === 0) return null;
  return value;
}

// ExposureTime comes back as a decimal (e.g. 0.002). For display we render
// it as a fraction when < 1s (e.g. "1/500 s"), or as a decimal string when
// >= 1s (e.g. "2 s").
export function formatExposureTime(value) {
  if (value === null) return null;
  if (value >= 1) return `${value} s`;
  const denom = Math.round(1 / value);
  return `1/${denom} s`;
}

// FocalLength comes back as a number in mm.
export function formatFocalLength(value) {
  if (value === null) return null;
  return `${Math.round(value)} mm`;
}

// FNumber (aperture) — round to one decimal place.
export function formatFNumber(value) {
  if (value === null) return null;
  return `f/${value.toFixed(1)}`;
}

// Orientation codes → human-readable
const ORIENTATION_LABELS = {
  1: "Normal",
  2: "Mirrored horizontally",
  3: "Rotated 180°",
  4: "Mirrored vertically",
  5: "Mirrored + rotated 90° CCW",
  6: "Rotated 90° CW",
  7: "Mirrored + rotated 90° CW",
  8: "Rotated 90° CCW",
};

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * parseExif(file) → { location, device, timestamps, technical, raw }
 *
 * Each group is an object keyed by tag name, with null for absent fields.
 * `raw` is the full exifr output for debugging — never shown to the user.
 *
 * Returns null if exifr finds no metadata at all (e.g. a PNG with no EXIF
 * chunk). Throws on parse errors so callers can show a meaningful error state.
 */
export async function parseExif(file) {
  // Dynamic import keeps exifr out of the initial bundle — it's only loaded
  // when the user actually opens this module.
  const exifr = await import("exifr");

  const raw = await exifr.parse(file, {
    // Restrict to exactly the tags we need
    pick: ALL_TAGS,
    // GPS sub-IFD (where GPSLatitude etc. live) must be enabled explicitly
    gps: true,
    // Return numeric values for GPS (decimal degrees) rather than arrays
    translateValues: true,
    reviveValues: true,
    sanitize: true,
  });

  // exifr returns undefined (not null) when no metadata is found
  if (!raw) return null;

  const locationRaw = pick(raw, LOCATION_TAGS);

  // Apply N/S and E/W ref to get correct signed decimal degrees.
  // exifr normally handles this when both the value and ref tag are present,
  // but only if it can see the ref tags — which requires them to be in the
  // pick list. We apply the sign ourselves as a reliable fallback.
  let lat = formatCoord(locationRaw.GPSLatitude);
  let lng = formatCoord(locationRaw.GPSLongitude);
  if (lat !== null && locationRaw.GPSLatitudeRef === "S") lat = -Math.abs(lat);
  if (lng !== null && locationRaw.GPSLongitudeRef === "W") lng = -Math.abs(lng);

  // GPSAltitudeRef: 0 = above sea level, 1 = below. Apply sign accordingly.
  let alt = locationRaw.GPSAltitude ?? null;
  if (alt !== null && locationRaw.GPSAltitudeRef === 1) alt = -Math.abs(alt);

  // Normalise device and timestamp fields — empty strings, dash strings → null
  const deviceRaw = pick(raw, DEVICE_TAGS);
  const timestampRaw = pick(raw, TIMESTAMP_TAGS);
  const device = Object.fromEntries(
    Object.entries(deviceRaw).map(([k, v]) => [k, normEmpty(v)])
  );
  const timestamps = Object.fromEntries(
    Object.entries(timestampRaw).map(([k, v]) => [k, normEmpty(v)])
  );

  // Normalise technical numeric fields — zero values from a zeroed-out IFD
  // are meaningless and should show as "Not found" rather than 0 or f/0.0.
  const exposureTime = normZero(raw.ExposureTime ?? null);
  const fNumber = normZero(raw.FNumber ?? null);
  const iso = normZero(raw.ISO ?? null);
  const focalLength = normZero(raw.FocalLength ?? null);

  return {
    location: {
      ...locationRaw,
      GPSLatitude: lat,
      GPSLongitude: lng,
      GPSAltitude: alt,
      hasCoordinates: lat !== null && lng !== null,
    },
    device,
    timestamps,
    technical: {
      ImageWidth: raw.ImageWidth ?? null,
      ImageHeight: raw.ImageHeight ?? null,
      Orientation: raw.Orientation ?? null,
      ExposureTime: exposureTime,
      FNumber: fNumber,
      ISO: iso,
      FocalLength: focalLength,
      ExposureTimeFormatted: formatExposureTime(exposureTime),
      FNumberFormatted: formatFNumber(fNumber),
      FocalLengthFormatted: formatFocalLength(focalLength),
      OrientationLabel: ORIENTATION_LABELS[raw.Orientation] ?? null,
    },
    raw,
  };
}

// ─── Privacy summary helpers (used for activity logging) ─────────────────────

export function privacySummary(parsed) {
  if (!parsed) return { hasGPS: false, hasDeviceSerial: false, hasTimestamps: false };
  return {
    hasGPS: parsed.location.hasCoordinates,
    hasDeviceSerial:
      parsed.device.BodySerialNumber != null ||
      parsed.device.LensSerialNumber != null,
    hasTimestamps: parsed.timestamps.DateTimeOriginal != null,
  };
}
