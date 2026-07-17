# apps/astro — the Astro target

The Astro entry in the framework bench: **static-rendered HTML at build time, plus one plain
`<script>` island** for the list filter — Astro's default, zero-UI-framework-runtime idiom for a small
DOM interaction. No React/Preact/Vue/Svelte is pulled in; this is what Astro ships when you reach for
nothing beyond its own compiler.

## Run

```sh
bun install
bun run dev             # http://localhost:4321 (astro dev)
bun run build            # → dist/ (static export, 11 pages)
bun run preview          # serve dist/ at http://localhost:4321
bun run check             # astro check (type-checks .astro + .ts files)
```

## What it ships

- `/` — the post list + the one measured interaction: a text filter AND-combined with five tag chips.
- `/posts/:slug` — a single post; `<h1>` from the title, `<time>` from the date, `<article>` body.
  All 10 slugs are enumerated via `getStaticPaths` in `src/pages/posts/[slug].astro`.
- One `<script>` island, written inline in `src/pages/index.astro`. Astro compiles/minifies it at build
  time; for this page's traffic pattern (used once, on one route) Astro inlines the bundled output
  directly into `index.html` rather than emitting a separate `_astro/*.js` chunk — **744 bytes** of
  minified module JS, measured straight out of `dist/index.html`.

## Contract

Reads the shared `../../content/` at build time (`src/content.ts`, plain `node:fs`, no markdown
parser — bodies are already HTML fragments, same as native). The single `<h1>` is rendered from
`title` inside `.astro` templates, never baked into a body fragment. SEO head
(title/description/canonical/OG/Twitter/JSON-LD) is emitted on every page via `src/layouts/Base.astro`
so the bench's parity columns tie across native/Astro/Next. `astro.config.mjs` sets
`site: "http://localhost:4321"` so canonical/og:url are absolute.

`apps/native/styles/app.css` is copied **verbatim** to `public/styles/app.css` and linked as a single
render-blocking `<link rel="stylesheet">`, exactly like native — Astro is not asked to inline or
otherwise process it.

## The filter island — Astro's honest default

`src/pages/index.astro` contains a plain `<script>` tag (no `is:inline`, so Astro processes/bundles it
normally) with a 1:1 TypeScript port of `apps/native/client/filter.ts`: same `#q`/`.chip`/`.card`
selectors, same AND-combine rule (query AND active tag), same `card.hidden` visibility toggle, same
`#count` text format (`"N of M posts"`, then `· tag: X` if a tag is active, then `· "query"` with curly
quotes if the query is non-empty), same "click the active chip to clear it" behavior, and the same
`apply()`-once-on-load call. No route change, no refetch — visibility only.

This is expected to **tie or beat native** on JS bytes for this one interaction, and that tie is the
honest result: Astro's default posture for an island with no interactive-framework needs is to ship
plain compiled/minified JS and nothing else, so a fair bench should show it converging with a
hand-written buildless script rather than "losing" to it.

## One known, harmless HTML-source deviation from native

Astro's built-in template escaping entity-encodes apostrophes in text/attribute output (e.g. `isn't` →
`isn&#39;t`), where native's minimal `esc()` helper only escapes `& < > "` and leaves apostrophes
literal. Both resolve to the identical DOM `textContent`/attribute value in a browser (Playwright's
`textContent()`/`getAttribute()` see `isn't` either way), so this does not affect a DOM-level parity
check — only a raw-HTML-source byte diff would surface it. Routing this through `set:html` everywhere
to avoid it would mean bypassing Astro's default escaping across the board, which is neither idiomatic
nor safe, so it was left as-is.
