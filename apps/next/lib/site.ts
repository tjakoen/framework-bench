// apps/next/lib/site.ts — constants shared by index + detail pages, mirroring apps/native/views.ts
// exactly so the two targets tie on title/description/date-formatting parity.
export const SITE = "Notes on the native web";
export const DESC =
  "A tiny reference blog — the same content built three ways for the framework bench.";

// Fixed origin for this bench target: canonical/OG/JSON-LD urls are absolute against it (matches
// next.config's implicit `next start` port and the metadataBase set in app/layout.tsx).
export const ORIGIN = "http://localhost:3000";

export const fmtDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
