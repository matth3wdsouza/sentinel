"use client";

import KeyValueRow from "@/components/KeyValueRow";

const URL_PARTS = [
  { key: "protocol", label: "Scheme" },
  { key: "username", label: "Username" },
  { key: "password", label: "Password" },
  { key: "hostname", label: "Hostname" },
  { key: "port", label: "Port" },
  { key: "pathname", label: "Path" },
  { key: "search", label: "Query" },
  { key: "hash", label: "Fragment" },
];

// Label + value + copy rows for the individual components of a parsed URL.
// Shared by the URL Inspector ("Decomposed URL") and the QR decoder's URL
// preview so both read and copy the same way. `parts` is keyed to the URL
// object's own properties (protocol, username, password, hostname, port,
// pathname, search, hash); empty components are omitted.
export default function URLPartsTable({ parts = {} }) {
  return (
    <div className="space-y-1.5">
      {URL_PARTS.map(({ key, label }) => {
        const value = parts[key];
        if (!value) return null;
        return (
          <KeyValueRow
            key={key}
            label={label}
            value={value}
            mono
            copyable
            copyLabel={label}
            className="py-1"
          />
        );
      })}
    </div>
  );
}