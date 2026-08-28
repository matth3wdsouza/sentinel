"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import Tabs from "@/components/Tabs";
import { useModuleId } from "@/lib/useModuleId";
import DecodeTab from "./DecodeTab";
import GenerateTab from "./GenerateTab";
import WiFiTab from "./WiFiTab";

const TABS = [
  { id: "decode", label: "Decode" },
  { id: "generate", label: "Generate" },
  { id: "wifi", label: "Wi-Fi" },
];

export default function QRPage() {
  const moduleId = useModuleId();
  const [activeTab, setActiveTab] = useState("decode");

  return (
    <ModulePage
      icon={QrCode}
      title="QR Code"
      description="Decode a QR code and see exactly where it leads before you open it — or generate your own."
    >
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} ariaLabel="QR mode" />

      <div id="panel-decode" role="tabpanel" aria-labelledby="tab-decode" tabIndex={-1} className={activeTab === "decode" ? "" : "hidden"}>
        <DecodeTab moduleId={moduleId} />
      </div>
      <div id="panel-generate" role="tabpanel" aria-labelledby="tab-generate" tabIndex={-1} className={activeTab === "generate" ? "" : "hidden"}>
        <GenerateTab moduleId={moduleId} />
      </div>
      <div id="panel-wifi" role="tabpanel" aria-labelledby="tab-wifi" tabIndex={-1} className={activeTab === "wifi" ? "" : "hidden"}>
        <WiFiTab moduleId={moduleId} />
      </div>
    </ModulePage>
  );
}
