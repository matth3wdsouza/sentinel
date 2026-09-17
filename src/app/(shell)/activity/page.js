"use client";

import { useState, useEffect } from "react";
import { fetchActivity, removeActivity } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Tabs, { TabPanel } from "@/components/Tabs";
import { Activity as ActivityIcon } from "lucide-react";
import LogTab from "./LogTab";
import SummaryTab from "./SummaryTab";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "log", label: "Log" },
];

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState("summary");
  const [activity, setActivity] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [reloadAttempt, setReloadAttempt] = useState(0);

  // IndexedDB is a browser-only API — this can only ever run client-side,
  // so it's fetched in an effect rather than during render, the same
  // reasoning as the wordlist fetches elsewhere in the app. One fetch for
  // the whole page: the Summary tab derives its numbers from these same
  // records, so there is no separate stats fetch to drift out of sync.
  useEffect(() => {
    let cancelled = false;
    fetchActivity()
      .then((records) => {
        if (!cancelled) setActivity(records);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message || "Couldn't load your activity.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadAttempt]);

  function retryLoad() {
    setActivity(null);
    setLoadError(null);
    setReloadAttempt((n) => n + 1);
  }

  async function handleDelete(id) {
    setActionError(null);
    try {
      await removeActivity(id);
      // Update the in-memory array — the Summary tab recomputes from the
      // same records, so its counts follow automatically.
      setActivity((prev) => (prev ? prev.filter((entry) => entry.id !== id) : prev));
    } catch (err) {
      setActionError(err.message || "Couldn't delete that entry — try again.");
    }
  }

  return (
    <>
      <PageHeader
        icon={ActivityIcon}
        accent="teal"
        title="Activity"
        description="A local history of actions taken across Sentinel's tools. This never leaves your device — it lives only in this browser, and you can delete any of it at any time."
      />

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} ariaLabel="Activity view" />

      <TabPanel id="summary" activeTab={activeTab}>
        <SummaryTab activity={activity} loadError={loadError} onRetry={retryLoad} />
      </TabPanel>
      <TabPanel id="log" activeTab={activeTab}>
        <LogTab
          activity={activity}
          loadError={loadError}
          actionError={actionError}
          onRetry={retryLoad}
          onDelete={handleDelete}
        />
      </TabPanel>
    </>
  );
}
