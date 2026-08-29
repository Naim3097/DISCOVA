"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Quietly re-fetches the server data on an interval — no full reload,
// no flicker, scroll position kept. Rendered only while a run is live.
export function AutoRefresh({ every = 4000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
