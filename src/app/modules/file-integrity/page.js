"use client";

import { useState } from "react";
import { useModuleId } from "@/lib/useModuleId";
import GenerateHashTab from "./GenerateHashTab";
import CompareHashTab from "./CompareHashTab";
import CompareFilesTab from "./CompareFilesTab";
import ModulePage from "@/components/ModulePage";
import Tabs, { TabPanel } from "@/components/Tabs";

const TABS = [
  { id: "generate", label: "Generate Hash" },
  { id: "compare-hash", label: "Compare to Known Hash" },
  { id: "compare-files", label: "Compare Two Files" },
];

export default function FileIntegrityPage() {
  const moduleId = useModuleId();
  const [activeTab, setActiveTab] = useState("generate");

  return (
    <ModulePage>
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} ariaLabel="File integrity tools" />

      <TabPanel id="generate" activeTab={activeTab}>
        <GenerateHashTab moduleId={moduleId} />
      </TabPanel>
      <TabPanel id="compare-hash" activeTab={activeTab}>
        <CompareHashTab moduleId={moduleId} />
      </TabPanel>
      <TabPanel id="compare-files" activeTab={activeTab}>
        <CompareFilesTab moduleId={moduleId} />
      </TabPanel>
    </ModulePage>
  );
}
