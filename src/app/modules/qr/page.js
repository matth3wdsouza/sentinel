"use client";

import { useState } from "react";

import ModulePage from "@/components/ModulePage";
import Tabs, { TabPanel } from "@/components/Tabs";
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
    <ModulePage>
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} ariaLabel="QR mode" />

      <TabPanel id="decode" activeTab={activeTab}>
        <DecodeTab moduleId={moduleId} />
      </TabPanel>
      <TabPanel id="generate" activeTab={activeTab}>
        <GenerateTab moduleId={moduleId} />
      </TabPanel>
      <TabPanel id="wifi" activeTab={activeTab}>
        <WiFiTab moduleId={moduleId} />
      </TabPanel>
    </ModulePage>
  );
}
