"use client";

import { useState } from "react";
import { useModuleId } from "@/lib/useModuleId";
import GenerateHashTab from "./GenerateHashTab";
import CompareHashTab from "./CompareHashTab";
import CompareFilesTab from "./CompareFilesTab";
import ModulePage from "@/components/ModulePage";
import Tabs from "@/components/Tabs";
import { FileCheck2 } from "lucide-react";

const TABS = [
  { id: "generate", label: "Generate Hash" },
  { id: "compare-hash", label: "Compare to Known Hash" },
  { id: "compare-files", label: "Compare Two Files" },
];

export default function FileIntegrityPage() {
  const moduleId = useModuleId();
  const [activeTab, setActiveTab] = useState("generate");

  return (
    <ModulePage
      icon={FileCheck2}
      title="File Integrity Verification"
      description="Generate and compare file hashes to verify downloads and detect tampering."
    >
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div id="panel-generate" role="tabpanel" className={activeTab === "generate" ? "" : "hidden"}>
        <GenerateHashTab moduleId={moduleId} />
      </div>
      <div id="panel-compare-hash" role="tabpanel" className={activeTab === "compare-hash" ? "" : "hidden"}>
        <CompareHashTab moduleId={moduleId} />
      </div>
      <div id="panel-compare-files" role="tabpanel" className={activeTab === "compare-files" ? "" : "hidden"}>
        <CompareFilesTab moduleId={moduleId} />
      </div>
    </ModulePage>
  );
}
