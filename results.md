# Framework bench — results

_The same small blog, built 4 ways, measured by one harness ([`bench.ts`](bench.ts), which
reuses BATCH's framework-generic `audit()`). Re-run with `bun run bench`. Generated 2026-07-17._

**→ The [live results page](https://tjakoen.github.io/framework-bench/)** renders these numbers as
charts (and itself ships 0kb of JavaScript).

## How to read this (the honest frame)

- **Headline = network-independent, categorical metrics:** JS shipped, request count, wire bytes,
  build-step yes/no, runtime-dependency count. These are robust and honest — publish these.
- **TTFB / Load are LOCAL best-case corroboration, not proof.** No network hop; real-world latency adds
  to every stack equally. Median-of-5 with a warm run discarded, to cut local noise. Use them
  for direction, never as the headline.
- **The comparison is not rigged:** every target gets the same SEO/AEO head, so the parity columns below
  are ✓ across the board. If one stack had better SEO that would be a confound, not a win.
- **Where a stack ties or wins, it says so.** On a mostly static page Astro's no-runtime `<script>`
  island ships comparably little to native — that honest tie is the point, not a problem.

## Headline: the JS each stack ships for the same page

**Index (`/`) — the one measured interaction (text + tag filter):**

| Target | JS shipped | Wire | Requests | Render-blocking | TTFB (med) | Load (med) |
|--------|-----------:|-----:|:--------:|:---------------:|-----------:|-----------:|
| native / BATCH | **2kb** | 14kb | 3 | 1css/0js | 4ms | 12ms |
| native + DPU | **3kb** | 15kb | 3 | 1css/0js | 3ms | 10ms |
| Astro | **744b** (744b inline) | 5kb | 2 | 1css/0js | 11ms | 38ms |
| Next.js | **118kb** (16kb inline) | 109kb | 7 | 1css/1js | 9ms | 128ms |

**Detail (`/posts/the-browser-grew-up`) — a static article, no interaction:**

| Target | JS shipped | Wire | Requests | Render-blocking | TTFB (med) | Load (med) |
|--------|-----------:|-----:|:--------:|:---------------:|-----------:|-----------:|
| native / BATCH | **0** | 7kb | 2 | 1css/0js | 3ms | 9ms |
| native + DPU | **0** | 7kb | 2 | 1css/0js | 3ms | 9ms |
| Astro | **0** | 3kb | 2 | 1css/0js | 4ms | 12ms |
| Next.js | **109kb** (7kb inline) | 106kb | 6 | 1css/1js | 4ms | 66ms |

On the index, **native / BATCH, native + DPU and Astro** ship a kilobyte or two of JavaScript for the filter, while
**Next.js** ships 118kb — roughly **163× more** for the identical interaction.
That spread is the whole thesis: the interaction is the same; the runtime each stack makes you ship for it
is not. (Astro's figure is its filter script inlined into the HTML; native's is one small external module.
Both are essentially the filter logic and nothing else. Next's is React runtime + hydration.)

## The facts the auditor can't measure

| Target | Build step | Runtime deps (direct) | node_modules | Production mode measured |
|--------|:----------:|-----------------------|:------------:|--------------------------|
| native / BATCH | **No** | 1 (@tjakoen/batch) | 47M | bun server.ts — no build step (server IS the production artifact) |
| native + DPU | **No** | 1 (@tjakoen/batch) | 47M | bun server.ts — no build step; filter swaps a server fragment via native setHTMLUnsafe()/streamHTMLUnsafe() |
| Astro | Yes | 1 (astro) | 190M | astro build → astro preview (static output) |
| Next.js | Yes | 3 (next, react, react-dom) | 335M | next build && next start (client-component page is not pure SSG — see note) |

## Parity — proof the comparison is fair (same head on every target)

**Index (`/`):**

| Target | Title | Desc | Canonical | OG/Twitter | 1×H1 | JSON-LD | html lang | Semantics |
|--------|:-----:|:----:|:---------:|:----------:|:----:|:-------:|:---------:|:---------:|
| native / BATCH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| native + DPU | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Astro | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Next.js | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Detail (`/posts/the-browser-grew-up`):**

| Target | Title | Desc | Canonical | OG/Twitter | 1×H1 | JSON-LD | html lang | Semantics |
|--------|:-----:|:----:|:---------:|:----------:|:----:|:-------:|:---------:|:---------:|
| native / BATCH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| native + DPU | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Astro | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Next.js | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Honest notes

- **Next's asymmetry:** the index is a `"use client"` component, so it is not pure SSG — measured with
  `next build && next start`, stated openly rather than forced into an unfair static export. Its JS is
  React runtime + hydration: the honest cost of reaching for a framework to do the filter.
- **Astro's tie:** Astro's filter is an idiomatic `<script>` island (bundled, **no** UI-framework
  runtime). On this static-ish page it ships about what native ships — the honest-win/tie case.
- **native/BATCH:** server-rendered HTML plus one client-safe module transpiled on request. No build step,
  one direct runtime dependency (BATCH, which itself declares zero third-party runtime deps).
- **native + DPU:** same no-build server, but the filter is progressive enhancement over Declarative
  Partial Updates — it fetches a server-rendered fragment and swaps it with the browser's **native**
  `streamHTMLUnsafe()` (Chrome 148, flag) / `setHTMLUnsafe()` (Chrome + Firefox stable), no swap library,
  degrading to a client-side toggle where neither exists. Fewer bytes than a JS filter, but a server
  round-trip per change — the opposite trade from native/BATCH. Full DPU (out-of-order `<?marker>` +
  `<template for>` streaming, the `/stream` route) is a flagged experiment, not cross-browser-shippable
  before ~2027; see the DPU post + its support matrix.
- **CSS is identical bytes** across every target (`styles/app.css` copied verbatim), so wire differences are
  JS, not styling.

## Measurement caveats (so the numbers can't be read dishonestly)

- **Inline vs external JS.** `audit()` counts JS as separate `.js` resources. Astro inlines its small
  filter script into the HTML, so it would otherwise read as "0kb JS". The **JS shipped** column adds that
  inline script back in (shown as `(… inline)`), so no stack hides code in the document.
- **Compression asymmetry — conservative against native.** `wire` is transferSize as each server actually
  sends it. The Astro/Next preview servers gzip; native's `bun server.ts` does **not**. So native's byte
  numbers here are an **upper bound** — deployed behind any CDN it would gzip like the others, only widening
  the gap. We leave it uncompressed rather than flatter native.
- **Fresh context per page.** Each page is measured in its own browser (no shared cache), so a resource
  downloaded for the index can't make the detail page look lighter than it is.

_Perf is corroboration. The bytes, the request count, and the build-step column are the argument._
