"use client";

import { useState, useEffect, useRef } from "react";
import { Download } from "lucide-react";
import { generateQR } from "@/lib/qr";
import { saveActivity } from "@/lib/api";

// ─── ControlRow ───────────────────────────────────────────────────────────────
// Inline label + control row used in generate options. Named ControlRow (not
// OptionRow) to avoid confusion with the shared @/components/OptionRow, which
// is a checkbox/radio form-control component with a completely different shape.

export function ControlRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-slate shrink-0">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ─── QRCanvas ─────────────────────────────────────────────────────────────────
// Shared canvas display + download button used by both Generate and Wi-Fi tabs.

export function QRCanvas({ canvasRef, show, onDownload, filename = "sentinel-qr.png" }) {
  return (
    <>
      <div className={show ? "" : "hidden"}>
        <div className="flex justify-center bg-white rounded-xl p-4 shadow-card border border-slate/10">
          <canvas ref={canvasRef} />
        </div>
      </div>
      {show && (
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 bg-teal text-on-teal px-4 py-2 rounded-lg text-sm hover:bg-teal/90 active:scale-[0.98] transition"
        >
          <Download size={14} />
          Download PNG
        </button>
      )}
    </>
  );
}

// ─── EC_LEVELS ────────────────────────────────────────────────────────────────

export const EC_LEVELS = [
  { value: "L", label: "Low (L)", detail: "~7% damage recovery. Smallest, densest code." },
  { value: "M", label: "Medium (M)", detail: "~15% damage recovery. Good default." },
  { value: "Q", label: "Quartile (Q)", detail: "~25% damage recovery. Good for logos." },
  { value: "H", label: "High (H)", detail: "~30% damage recovery. Largest code." },
];

// ─── GenerateOptions ──────────────────────────────────────────────────────────
// Shared colour + error correction controls.

export function GenerateOptions({ darkColor, setDarkColor, lightColor, setLightColor, ecLevel, setEcLevel }) {
  return (
    <div className="rounded-xl bg-surface shadow-card px-4 py-2 divide-y divide-slate/10">
      <ControlRow label="Foreground colour">
        <input
          type="color"
          value={darkColor}
          onChange={(e) => setDarkColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-slate/20"
        />
        <span className="text-xs text-slate font-mono">{darkColor}</span>
      </ControlRow>
      <ControlRow label="Background colour">
        <input
          type="color"
          value={lightColor}
          onChange={(e) => setLightColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-slate/20"
        />
        <span className="text-xs text-slate font-mono">{lightColor}</span>
      </ControlRow>
      <ControlRow label="Error correction">
        <select
          value={ecLevel}
          onChange={(e) => setEcLevel(e.target.value)}
          className="text-sm text-ink bg-surface border border-slate/30 rounded-lg px-2 py-1.5 focus:outline-none focus:border-teal transition"
        >
          {EC_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </ControlRow>
      <div className="py-2">
        <p className="text-xs text-slate">
          {EC_LEVELS.find((l) => l.value === ecLevel)?.detail}
          {ecLevel === "H" && " Use H if you plan to overlay a logo on the code."}
        </p>
      </div>
    </div>
  );
}

// ─── useQRGenerator ───────────────────────────────────────────────────────────
// Shared hook: regenerates QR on canvas whenever inputs change (debounced).

export function useQRGenerator({ canvasRef, text, darkColor, lightColor, errorCorrectionLevel, subType, moduleId }) {
  const [state, setState] = useState("idle");
  const [errorMsg, setErrorMsg] = useState(null);
  const lastLogRef = useRef(null);

  useEffect(() => {
    if (!text.trim()) {
      const timer = setTimeout(() => setState("idle"), 0);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(async () => {
      if (!canvasRef.current) return;
      const result = await generateQR(canvasRef.current, text.trim(), {
        darkColor,
        lightColor,
        errorCorrectionLevel,
      });
      if (result.error) {
        setErrorMsg(result.error);
        setState("error");
      } else {
        setErrorMsg(null);
        setState("done");

        // QR regenerates continuously (debounced once per input pause), so
        // activity entries are coalesced — only log when the length bucket,
        // sub-type, or a 30s window changed. Otherwise tweaking colours or the
        // error-correction level spams the activity log with near-identical
        // rows. Content is deliberately never persisted (see AGENTS.md
        // invariant).
        const now = Date.now();
        const lengthBucket = Math.round(text.trim().length / 8) * 8;
        const lastLog = lastLogRef.current;
        const shouldLog =
          !lastLog ||
          lastLog.subType !== subType ||
          lastLog.lengthBucket !== lengthBucket ||
          now - lastLog.at > 30000;
        if (shouldLog) {
          lastLogRef.current = { subType, lengthBucket, at: now };
          saveActivity({
            moduleType: moduleId,
            summary: `QR code generated (${subType})`,
            details: { contentLength: text.trim().length },
          });
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [text, darkColor, lightColor, errorCorrectionLevel, canvasRef, moduleId, subType]);

  return { state, errorMsg };
}
