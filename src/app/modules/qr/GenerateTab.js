"use client";

import { useState, useRef } from "react";
import { QrCode } from "lucide-react";
import InlineError from "@/components/InlineError";
import { QRCanvas, GenerateOptions, useQRGenerator } from "./generateOptions";

export default function GenerateTab({ moduleId }) {
  const [text, setText] = useState("");
  const [darkColor, setDarkColor] = useState("#223142");
  const [lightColor, setLightColor] = useState("#ffffff");
  const [ecLevel, setEcLevel] = useState("M");
  const canvasRef = useRef(null);

  const tooLong = text.length > 2953;
  const { state, errorMsg } = useQRGenerator({
    canvasRef,
    text: tooLong ? "" : text,
    darkColor,
    lightColor,
    errorCorrectionLevel: ecLevel,
    subType: "text",
    moduleId,
  });

  function handleDownload() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "sentinel-qr.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Text or URL to encode
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter a URL, plain text, or anything you want to encode…"
          rows={4}
          className="w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:outline-none focus:border-teal transition resize-y"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-slate">{text.length} characters</p>
          {tooLong && (
            <p className="text-xs text-mismatch">Too long for a QR code (max ~2,953 chars)</p>
          )}
        </div>
      </div>

      <GenerateOptions
        darkColor={darkColor} setDarkColor={setDarkColor}
        lightColor={lightColor} setLightColor={setLightColor}
        ecLevel={ecLevel} setEcLevel={setEcLevel}
      />

      <QRCanvas
        canvasRef={canvasRef}
        show={state === "done" && !tooLong}
        onDownload={handleDownload}
      />

      {!text.trim() && (
        <div className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed border-slate/20 text-slate">
          <QrCode size={32} strokeWidth={1.25} />
          <p className="text-sm">Your QR code will appear here</p>
        </div>
      )}

      {state === "error" && errorMsg && (
        <InlineError>{errorMsg}</InlineError>
      )}
    </div>
  );
}
