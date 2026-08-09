"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Resets scroll position to the top on every route change.
// Next.js App Router preserves scroll position across navigations by default,
// which means scrolling down the home module grid and clicking a card lands
// you partway down the module page. This component fixes that globally.
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
