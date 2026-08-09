// Tests for the pure, privacy-critical helpers in src/lib/exif.js.
//
// What we're checking:
//   - privacySummary: the boolean flags the activity log uses must only be
//     true when the corresponding metadata is genuinely present — the log's
//     "has GPS / serial / timestamps" claims are derived from this.
//   - formatExposureTime / formatFocalLength / formatFNumber: the display
//     formatters used by the technical details table.

import { describe, it, expect } from "vitest";
import {
  privacySummary,
  formatExposureTime,
  formatFocalLength,
  formatFNumber,
} from "@/lib/exif";

describe("privacySummary", () => {
  it("reports nothing when there is no parsed metadata", () => {
    expect(privacySummary(null)).toEqual({
      hasGPS: false,
      hasDeviceSerial: false,
      hasTimestamps: false,
    });
  });

  it("reports all false when no metadata fields are present", () => {
    expect(
      privacySummary({
        location: { hasCoordinates: false },
        device: {},
        timestamps: {},
      })
    ).toEqual({ hasGPS: false, hasDeviceSerial: false, hasTimestamps: false });
  });

  it("flags GPS only when coordinates are present", () => {
    expect(
      privacySummary({
        location: { hasCoordinates: true },
        device: {},
        timestamps: {},
      }).hasGPS
    ).toBe(true);
  });

  it("flags a device serial for either body or lens serial", () => {
    const base = () => ({
      location: { hasCoordinates: false },
      device: { BodySerialNumber: null, LensSerialNumber: null },
      timestamps: {},
    });

    const bodySerial = base();
    bodySerial.device.BodySerialNumber = "ABC123";
    expect(privacySummary(bodySerial).hasDeviceSerial).toBe(true);

    const lensSerial = base();
    lensSerial.device.LensSerialNumber = "XYZ789";
    expect(privacySummary(lensSerial).hasDeviceSerial).toBe(true);

    const both = base();
    both.device.BodySerialNumber = "ABC123";
    both.device.LensSerialNumber = "XYZ789";
    expect(privacySummary(both).hasDeviceSerial).toBe(true);
  });

  it("flags timestamps only when DateTimeOriginal is present", () => {
    expect(
      privacySummary({
        location: { hasCoordinates: false },
        device: {},
        timestamps: { DateTimeOriginal: null },
      }).hasTimestamps
    ).toBe(false);

    expect(
      privacySummary({
        location: { hasCoordinates: false },
        device: {},
        timestamps: { DateTimeOriginal: "2024:01:01 12:00:00" },
      }).hasTimestamps
    ).toBe(true);
  });

  it("combines all three flags from one parsed object", () => {
    expect(
      privacySummary({
        location: { hasCoordinates: true },
        device: { BodySerialNumber: "ABC123", LensSerialNumber: null },
        timestamps: { DateTimeOriginal: "2024:01:01 12:00:00" },
      })
    ).toEqual({ hasGPS: true, hasDeviceSerial: true, hasTimestamps: true });
  });
});

describe("formatExposureTime", () => {
  it("returns null for missing values", () => {
    expect(formatExposureTime(null)).toBe(null);
  });

  it("renders sub-second exposures as a fraction", () => {
    expect(formatExposureTime(0.002)).toBe("1/500 s");
    expect(formatExposureTime(0.5)).toBe("1/2 s");
  });

  it("renders whole-second exposures as a decimal", () => {
    expect(formatExposureTime(1)).toBe("1 s");
    expect(formatExposureTime(2)).toBe("2 s");
  });
});

describe("formatFocalLength", () => {
  it("returns null for missing values", () => {
    expect(formatFocalLength(null)).toBe(null);
  });

  it("rounds to whole millimetres", () => {
    expect(formatFocalLength(50)).toBe("50 mm");
    expect(formatFocalLength(50.4)).toBe("50 mm");
  });
});

describe("formatFNumber", () => {
  it("returns null for missing values", () => {
    expect(formatFNumber(null)).toBe(null);
  });

  it("renders the aperture with one decimal place", () => {
    expect(formatFNumber(2.8)).toBe("f/2.8");
    expect(formatFNumber(1.8)).toBe("f/1.8");
    expect(formatFNumber(5.6)).toBe("f/5.6");
  });
});
