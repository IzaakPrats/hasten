"use client";

import { useEffect, useState } from "react";

const LG_QUERY = "(min-width: 1024px)";

/** Tailwind `lg` breakpoint (1024px). Starts false for SSR/hydration match, then syncs. */
export function useIsLg() {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY);
    setIsLg(mq.matches);
    const onChange = () => setIsLg(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isLg;
}
