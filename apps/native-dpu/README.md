# apps/native-dpu — the native + Declarative Partial Updates target

The native-first entry, extended with **Declarative Partial Updates (DPU)** — a Chrome-led WICG proposal
that makes server-driven partial rendering and HTML streaming a **browser primitive** instead of a
framework feature. Same no-build BATCH server as [`apps/native`](../native), same content, same
`styles/app.css` (byte-identical), same SEO head — so the bench's parity and CSS columns tie. The one
difference is how the filter updates the page, and it is the whole point of this variant.

## Run

```sh
bun install
bun run start          # http://localhost:3403
bun run export         # freeze a static dist/ (the / and /posts/* pages)
```

## What it ships

- `/` — the post list + the measured filter. The full list is **server-rendered** (renders everywhere,
  no-JS-safe). One small module, `client/dpu.ts`, wires the filter.
- `/posts/:slug` — a single post; identical to native (one `<h1>` from the title, `<time>`, `<article>`).
- `/fragment?q=&tag=` — a **server-rendered fragment**: just the filtered `<li>` cards, byte-identical to
  the page's own list markup. This is what the browser swaps in. (Live-server only.)
- `/stream` — the out-of-order streaming demo (see below). (Live-server only.)

## The filter: DPU with no swap library

`client/dpu.ts` is the JS the bench measures (~3kb transpiled, uncompressed). On a filter change it fetches
`/fragment` and swaps it into the list using a **native** HTML setter — no htmx, no framework runtime.
Three tiers, feature-detected:

| Browser | Path | JS to swap |
|---------|------|-----------|
| Chrome 148 (experimental flag) | `response.body.pipeThrough(new TextDecoderStream()).pipeTo(el.streamHTMLUnsafe())` | native, streaming |
| Chrome / Firefox stable | `el.setHTMLUnsafe(await res.text())` | native, buffered |
| Safari / older | client-side visibility toggle (apps/native's behavior) | ~0, no round-trip |

The trade vs [`apps/native`](../native) is honest and explicit: **fewer bytes, but a server round-trip per
filter change** (native/BATCH filters entirely in the client with zero round-trips). DPU buys you htmx-style
swaps without htmx's ~14kb runtime; it costs you the network.

## The headline: out-of-order streaming (`/stream`)

`/stream` streams the shell first with a `<?start name="feed">Loading…<?end>` placeholder, then — after the
data is "ready" — streams a `<template for="feed">` that fills the slot **later in the same response**. On a
DPU-capable browser the parser patches it in with **zero JavaScript**. A tiny inline fallback (behavior-
detected, like the DPU polyfills) applies the template on browsers without native `<template for>`.

## Support matrix (verified 2026-07-17 against this app)

| Capability | Chrome 148 + flag | Chrome / Firefox stable | Safari |
|-----------|:-----------------:|:-----------------------:|:------:|
| `setHTMLUnsafe()` (buffered swap) | ✓ | ✓ | ✗ |
| `streamHTMLUnsafe()` (streaming swap) | ✓ | ✗ | ✗ |
| `<?marker>` + `<template for>` (out-of-order) | ✓ | ✗ | ✗ |

Full DPU is **Chrome 148 only, behind `chrome://flags/#enable-experimental-web-platform-features`** — a
flagged experiment, **not shippable cross-browser before ~2027**. That is why the core pages here degrade
gracefully and `/stream` is a separate, clearly-labeled demo rather than how essential content is delivered.

## Asymmetry note (measured honestly)

`bun run export` freezes `/` + `/posts/*` (no-JS-safe, static). `/fragment` and `/stream` are **live-server
routes** — a static freeze can't reproduce a server round-trip or a delayed stream — so on a static host the
filter falls back to its client-side toggle. Stated openly, the same way the bench states Next's
`next build && next start` asymmetry.

## Contract

Reads the shared `../../content/` verbatim (metadata JSON + HTML body fragments, no markdown parser). The
single `<h1>` is rendered from `title`. SEO head (title/description/canonical/OG/Twitter/JSON-LD) is emitted
on every page so parity ties across all targets.
