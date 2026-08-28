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
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} ariaLabel="File integrity tools" />

      <div id="panel-generate" role="tabpanel" aria-labelledby="tab-generate" tabIndex={-1} className={activeTab === "generate" ? "" : "hidden"}>
        <GenerateHashTab moduleId={moduleId} />
      </div>
      <div id="panel-compare-hash" role="tabpanel" aria-labelledby="tab-compare-hash" tabIndex={-1} className={activeTab === "compare-hash" ? "" : "hidden"}>
        <CompareHashTab moduleId={moduleId} />
      </div>
      <div id="panel-compare-files" role="tabpanel" aria-labelledby="tab-compare-files" tabIndex={-1} className={activeTab === "compare-files" ? "" : "hidden"}>
        <CompareFilesTab moduleId={moduleId} />
      </div>
    </ModulePage>
  );
}
