"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { trackFunnel, trackLoginSuccess, type ResultAccess } from "@/lib/analytics";

/** Invisible marker; observe the existing section without changing its layout. */
export function GrowthView({ name, access }: { name: "pricing_view" | "paywall_view"; access?: ResultAccess }) {
  const marker = useRef<HTMLSpanElement>(null);
  const sent = useRef(false);
  useEffect(() => {
    const target = marker.current?.parentElement;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (!sent.current && entries.some(entry => entry.isIntersecting)) {
        sent.current = true;
        trackFunnel(name, { result_access: access });
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [name, access]);
  return <span ref={marker} hidden aria-hidden="true" />;
}

export function GrowthSession() {
  const { status } = useSession();
  useEffect(() => { if (status === "authenticated") trackLoginSuccess(); }, [status]);
  return null;
}
