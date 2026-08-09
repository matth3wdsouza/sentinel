import PageShell from "@/components/PageShell";

// Shared layout for non-module app pages (Activity, Settings).
export default function ShellLayout({ children }) {
  return <PageShell>{children}</PageShell>;
}
