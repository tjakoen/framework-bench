// apps/next/app/layout.tsx — the shared document shell. Mirrors apps/native/views.ts `page()`: same
// <head> shape (Next injects charset + viewport automatically), same `.site-head` header on every page.
// Only the `.stack` label differs from native ("Next.js" vs "native / BATCH"). The stylesheet is a
// literal <link> to the raw public/ file (NOT a CSS Module / global import) so the bytes and request
// match native exactly — see apps/next/public/styles/app.css (copied verbatim from native).
import type { Metadata } from "next";
import { ORIGIN } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/styles/app.css" />
      </head>
      <body>
        <header className="site-head">
          <nav aria-label="Primary">
            <a className="brand" href="/">
              Framework Bench
            </a>
            <span className="stack">Next.js</span>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
