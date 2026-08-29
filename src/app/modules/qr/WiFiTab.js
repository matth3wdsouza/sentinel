"use client";

import { useState, useRef } from "react";
import InlineError from "@/components/InlineError";
import { ControlRow, QRCanvas, GenerateOptions, useQRGenerator } from "./generateOptions";

const WIFI_SECURITY = ["WPA/WPA2", "WEP", "None"];

export default function WiFiTab({ moduleId }) {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState("WPA/WPA2");
  const [hidden, setHidden] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [darkColor, setDarkColor] = useState("#223142");
  const [lightColor, setLightColor] = useState("#ffffff");
  const [ecLevel, setEcLevel] = useState("M");
  const canvasRef = useRef(null);

  function buildWifiString() {
    if (!ssid.trim()) return "";
    const t = security === "WPA/WPA2" ? "WPA" : security === "WEP" ? "WEP" : "nopass";
    const escape = (s) => s.replace(/([\\;,":])/g, "\\$1");
    const p = password ? `P:${escape(password)};` : "";
    const h = hidden ? "H:true;" : "";
    return `WIFI:T:${t};S:${escape(ssid)};${p}${h};`;
  }

  const wifiString = buildWifiString();
  const { state, errorMsg } = useQRGenerator({
    canvasRef,
    text: wifiString,
    darkColor,
    lightColor,
    errorCorrectionLevel: ecLevel,
    subType: "wifi",
    moduleId,
  });

  function handleDownload() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "sentinel-wifi-qr.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="rounded-xl bg-accent-orange-light border border-accent-orange/20 px-4 py-3">
        <p className="text-xs text-slate leading-relaxed">
          <span className="font-semibold text-accent-orange">Wi-Fi passwords are embedded in plain text.</span>{" "}
          Anyone who photographs or scans this QR code will have your Wi-Fi password. Only share it in person with people you trust, and don&apos;t post it publicly.
        </p>
      </div>

      {/* Fields */}
      <div className="rounded-xl bg-surface shadow-card px-4 py-2 divide-y divide-slate/10">
        <ControlRow label="Security">
          <select
            value={security}
            onChange={(e) => setSecurity(e.target.value)}
            aria-label="Security"
            className="text-sm text-ink bg-surface border border-slate/30 rounded-lg px-2 py-1.5 focus:border-teal transition"
          >
            {WIFI_SECURITY.map((s) => <option key={s}>{s}</option>)}
          </select>
        </ControlRow>
        <ControlRow label="Network name (SSID)">
          <input
            type="text"
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            placeholder="Your network name"
            aria-label="Network name (SSID)"
            className="text-sm text-ink bg-surface border border-slate/30 rounded-lg px-3 py-1.5 focus:border-teal transition w-48"
          />
        </ControlRow>
        {security !== "None" && (
          <ControlRow label="Password">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wi-Fi password"
                aria-label="Wi-Fi password"
                className="text-sm text-ink bg-surface border border-slate/30 rounded-lg pl-3 pr-10 py-1.5 focus:border-teal transition w-48"
              />
              <button
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide Wi-Fi password" : "Show Wi-Fi password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-teal transition text-xs"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </ControlRow>
        )}
        <ControlRow label="Hidden network">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
            aria-label="Hidden network"
            className="accent-teal"
          />
          <span className="text-xs text-slate">SSID not broadcast</span>
        </ControlRow>
      </div>

      <GenerateOptions
        darkColor={darkColor} setDarkColor={setDarkColor}
        lightColor={lightColor} setLightColor={setLightColor}
        ecLevel={ecLevel} setEcLevel={setEcLevel}
      />

      <QRCanvas
        canvasRef={canvasRef}
        show={state === "done"}
        onDownload={handleDownload}
        filename="sentinel-wifi-qr.png"
      />

      {state === "error" && errorMsg && (
        <InlineError>{errorMsg}</InlineError>
      )}
    </div>
  );
}
