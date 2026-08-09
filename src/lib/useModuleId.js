import { usePathname } from "next/navigation";
import { ALL_MODULES } from "@/lib/modules";

/**
 * Returns the canonical module id (from modules.js) for the currently
 * active module page. Derived from the router pathname at runtime — no
 * hardcoded strings needed at the call site.
 *
 * Returns undefined if the current path doesn't match any registered module
 * (e.g. during a transition, or on a non-module page).
 */
export function useModuleId() {
  const pathname = usePathname();
  return ALL_MODULES.find((m) => m.path === pathname)?.id;
}
