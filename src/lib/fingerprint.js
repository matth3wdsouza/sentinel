// fingerprint.js — Browser data collection for the Fingerprint module.
//
// Two exported functions:
//   collectPassive()  — async, no permissions, runs on user action.
//   collectGeo()      — async, triggers a geolocation permission prompt.
//   collectMedia()    — async, triggers a camera/microphone permission prompt.
//
// Nothing collected here is sent anywhere. All processing is local.

// ─── Canvas fingerprint ───────────────────────────────────────────────────────
// Renders a short string on a hidden <canvas> using multiple fonts, then hashes
// the raw pixel data with SHA-256. Different GPUs, drivers, and OS font
// renderers produce subtly different pixel values for the same drawing
// instructions, so the hash acts as a near-unique device signature — without
// the user ever noticing a canvas element exists.

async function canvasFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");

    // Background fill
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // First text pass — serif, coloured
    ctx.fillStyle = "#223142";
    ctx.font = "14px 'Times New Roman', Times, serif";
    ctx.fillText("Sentinel \u2022 \u00e9\u00e0\u00fc \u2665 \ud83d\udd12", 10, 22);

    // Second pass — sans-serif, different colour + blend
    ctx.fillStyle = "#2c7a7b";
    ctx.font = "bold 13px Arial, Helvetica, sans-serif";
    ctx.fillText("0123456789 !@#$%^&*()", 10, 44);

    // Third pass — monospace
    ctx.fillStyle = "#6b4fa0";
    ctx.font = "12px 'Courier New', Courier, monospace";
    ctx.fillText("the quick brown fox", 10, 58);

    const dataUrl = canvas.toDataURL();
    // Hash the data URL (which encodes every rendered pixel)
    const encoded = new TextEncoder().encode(dataUrl);
    const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const hashHex = hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
    return { value: hashHex, error: null };
  } catch (err) {
    return { value: null, error: err.message };
  }
}

// ─── WebGL info ───────────────────────────────────────────────────────────────
// The WEBGL_debug_renderer_info extension exposes the real GPU vendor and
// renderer strings — not the generic "WebKit WebGL" string, but the actual
// hardware model (e.g. "NVIDIA GeForce RTX 3080"). Available in all major
// browsers without any permission prompt.

function webglInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return { vendor: null, renderer: null, error: "WebGL not supported" };

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) {
      // Extension blocked (e.g. Firefox with privacy.resistFingerprinting = true)
      return { vendor: "Blocked by browser", renderer: "Blocked by browser", error: null };
    }

    const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "Unknown";
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "Unknown";
    return { vendor, renderer, error: null };
  } catch (err) {
    return { vendor: null, renderer: null, error: err.message };
  }
}

// ─── Navigator / screen helpers ───────────────────────────────────────────────

function connectionInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return { effectiveType: null, downlink: null, saveData: null };
  return {
    effectiveType: conn.effectiveType ?? null,
    downlink: conn.downlink ?? null,
    saveData: conn.saveData ?? null,
  };
}

function parseUserAgent(ua) {
  // Minimal UA parse — enough for a human-readable "Chrome 124 on macOS" line
  // without pulling in a library. Order matters: Edge must come before Chrome.
  let browser = "Unknown browser";
  let os = "Unknown OS";

  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\/|Opera\//.test(ua)) browser = "Opera";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";

  // Version extraction
  const verMatch =
    ua.match(/(?:Chrome|Firefox|Safari|Edg|OPR|SamsungBrowser)\/(\d+)/) ||
    ua.match(/Version\/(\d+)/);
  if (verMatch) browser += ` ${verMatch[1]}`;

  if (/Windows NT/.test(ua)) {
    const ntMatch = ua.match(/Windows NT ([\d.]+)/);
    const ntMap = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" };
    os = "Windows " + (ntMap[ntMatch?.[1]] ?? ntMatch?.[1] ?? "");
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = "iOS";
  } else if (/Android/.test(ua)) {
    const v = ua.match(/Android ([\d.]+)/);
    os = "Android" + (v ? ` ${v[1]}` : "");
  } else if (/Mac OS X/.test(ua)) {
    os = "macOS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  } else if (/CrOS/.test(ua)) {
    os = "ChromeOS";
  }

  return { browser, os };
}

// ─── collectPassive ───────────────────────────────────────────────────────────

export async function collectPassive() {
  const { browser, os } = parseUserAgent(navigator.userAgent);
  const conn = connectionInfo();
  const gl = webglInfo();
  const canvas = await canvasFingerprint();

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = Intl.NumberFormat().resolvedOptions().locale;

  const dnt = navigator.doNotTrack;
  let dntLabel;
  if (dnt === "1") dntLabel = "Enabled (1)";
  else if (dnt === "0") dntLabel = "Disabled (0)";
  else dntLabel = "Not set";

  return {
    // ── Identity ──────────────────────────────────────────────────────────────
    identity: {
      userAgent: navigator.userAgent,
      browser,
      os,
      platform: navigator.platform || null,
      vendor: navigator.vendor || null,
    },

    // ── Location & locale ─────────────────────────────────────────────────────
    locale: {
      timezone,
      locale,
      language: navigator.language,
      languages: (navigator.languages ?? []).join(", "),
    },

    // ── Display ───────────────────────────────────────────────────────────────
    display: {
      screenResolution: `${screen.width} × ${screen.height}`,
      availableResolution: `${screen.availWidth} × ${screen.availHeight}`,
      colorDepth: `${screen.colorDepth}-bit`,
      devicePixelRatio: window.devicePixelRatio,
    },

    // ── Hardware ──────────────────────────────────────────────────────────────
    hardware: {
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemory: navigator.deviceMemory
        ? `${navigator.deviceMemory} GB (approx)`
        : null,
      connectionType: conn.effectiveType,
      connectionDownlink: conn.downlink != null ? `${conn.downlink} Mbps` : null,
      dataSaver: conn.saveData != null ? (conn.saveData ? "On" : "Off") : null,
    },

    // ── Tracking signals ──────────────────────────────────────────────────────
    tracking: {
      doNotTrack: dntLabel,
      cookiesEnabled: navigator.cookieEnabled ? "Yes" : "No",
      pdfViewerEnabled:
        navigator.pdfViewerEnabled != null
          ? navigator.pdfViewerEnabled
            ? "Yes"
            : "No"
          : null,
    },

    // ── Graphics (WebGL + canvas) ─────────────────────────────────────────────
    graphics: {
      webglVendor: gl.vendor,
      webglRenderer: gl.renderer,
      webglError: gl.error,
      canvasHash: canvas.value
        ? canvas.value.slice(0, 16) + "…"  // Truncated for display; full hash kept for logging
        : null,
      canvasHashFull: canvas.value,
      canvasError: canvas.error,
    },
  };
}

// ─── collectGeo ───────────────────────────────────────────────────────────────

export function collectGeo(highAccuracy = false) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ error: "NOT_SUPPORTED" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
          accuracy: pos.coords.accuracy != null
            ? `±${Math.round(pos.coords.accuracy)} m`
            : null,
          altitude: pos.coords.altitude != null
            ? `${pos.coords.altitude.toFixed(1)} m`
            : null,
          error: null,
        });
      },
      (err) => {
        const code =
          err.code === 1 ? "DENIED"
          : err.code === 2 ? "UNAVAILABLE"
          : "TIMEOUT";
        resolve({ error: code });
      },
      { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15000 : 10000, maximumAge: 0 }
    );
  });
}

// ─── collectMedia ─────────────────────────────────────────────────────────────
// Requests camera + microphone access. If granted, enumerates devices and
// returns their labels (which include manufacturer/model info). Immediately
// stops all tracks — we only needed the permission to enumerate labels.

export async function collectMedia() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { error: "NOT_SUPPORTED", devices: [] };
    }

    // Request access to get label strings (labels are empty without a live stream)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    // Stop all tracks immediately — we only needed permission, not the stream
    stream.getTracks().forEach((t) => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const formatted = devices.map((d) => ({
      kind:
        d.kind === "audioinput" ? "Microphone"
        : d.kind === "audiooutput" ? "Speaker"
        : d.kind === "videoinput" ? "Camera"
        : d.kind,
      label: d.label || "(no label)",
    }));

    return { error: null, devices: formatted };
  } catch (err) {
    const code =
      err.name === "NotAllowedError" ? "DENIED"
      : err.name === "NotFoundError" ? "NOT_FOUND"
      : "ERROR";
    return { error: code, devices: [] };
  }
}
