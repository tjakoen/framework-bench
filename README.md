# ⚖️ framework-bench — the receipt

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

**The same small blog, built four ways, measured by one harness.** For two notes I claimed my
no-build, server-rendered stack ships less JavaScript than a framework, and both times I refused to
print a number I had not run. This repo is me running it. Same content, same page, same SEO head on
every target — the only thing that varies is the framework you reach for, and that is exactly what
gets weighed.

→ **The numbers:** [`results.md`](results.md). The story behind them:
[native-partial-updates](https://tjakoen.github.io/notes/native-partial-updates).

## The headline

For the one measured interaction (a text + tag filter on the index), the JavaScript each stack makes
you ship for the **identical** behavior:

| Target | JS shipped | Build step | Runtime deps |
|--------|-----------:|:----------:|:------------:|
| native + DPU | **3kb** | No | 1 |
| native / BATCH | **2kb** | No | 1 |
| Astro | **744b** (inlined) | Yes | 1 |
| Next.js | **118kb** | Yes | 3 |

Next.js ships roughly **160× more** JavaScript than native for the same filter. Astro's idiomatic
`<script>` island honestly ties native on this static-ish page — where a stack wins or ties, the
results say so. Full tables, the static-article page, and every parity column live in
[`results.md`](results.md).

## Run it yourself

```bash
bun install
bun run bench        # build + boot each target in production mode, audit, write results.{json,md}
RUNS=3 bun run bench # fewer perf samples (default: 5 measured + 1 warm run discarded)
```

`bench.ts` does not measure anything itself — it orchestrates (build → serve → audit ×N → aggregate →
render) and points BATCH's framework-generic `audit()` at each target. The measurement engine is
BATCH's, reused unchanged, so the four stacks are judged by one instrument.

## The honest frame (this is the point, not the fine print)

- **The headline is network-independent, categorical facts:** JS shipped, request count, wire bytes,
  build-step yes/no, runtime-dependency count. Publish these.
- **TTFB / Load are local best-case corroboration, not proof.** No network hop, so real latency adds
  to every stack equally. Median-of-5, warm run discarded. Direction, never headline.
- **The comparison is not rigged:** every target gets the same SEO/AEO head, so the parity columns
  are ✓ across the board. Better SEO on one stack would be a confound, not a win.
- **Byte counts are conservative against native:** native's `bun server.ts` does not gzip in this
  test while the Astro/Next preview servers do, so native's numbers are an upper bound — behind any
  CDN the gap only widens.

## Layout

- [`apps/native`](apps/native) — server-rendered HTML + one client-safe module, no build step (BATCH).
- [`apps/native-dpu`](apps/native-dpu) — same server, but the filter is progressive enhancement over
  Declarative Partial Updates: it swaps a server-rendered fragment with the browser's native
  `setHTMLUnsafe()` / `streamHTMLUnsafe()`, degrading to a client toggle where neither ships.
- [`apps/astro`](apps/astro) — Astro static output with a `<script>` island for the filter.
- [`apps/next`](apps/next) — Next.js App Router, `next build && next start`.
- [`content/`](content) — the shared source of truth (11 posts, 5 tags). **Identical bytes** read by
  every app; see [`content/README.md`](content/README.md) for the contract that keeps it fair.
- [`bench.ts`](bench.ts) — the cross-target runner. [`results.md`](results.md) — the rendered output.

---
🤖 **Built with Claude. I don't prompt and pray, I prompt and prove.** Every commit here is co-authored with an AI, on purpose. [How I actually work with AI, receipts and all →](https://tjakoen.github.io/notes/ten-times-zero)
