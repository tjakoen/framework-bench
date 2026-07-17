# apps/next — the Next.js (App Router) target

The Next.js entry in the framework bench: **server-rendered HTML at request/build time, plus one
`"use client"` React component** for the list filter — Next's idiomatic answer to a small DOM
interaction, shipped honestly (React + hydration runtime included, not stripped).

## Run

```sh
bun install
bun run build            # next build
bun run start             # next start → http://localhost:3000
bun run check              # tsc --noEmit
```

Routes prerender at build time (see below), but the app is served via `next build && next start`, not
`next export` — see **Build asymmetry** below for why.

## What it ships

- `/` — the post list + the one measured interaction: a text filter AND-combined with five tag chips.
- `/posts/:slug` — a single post; `<h1>` from the title, `<time>` from the date, `<article>` body.
  All 10 slugs are enumerated via `generateStaticParams` in `app/posts/[slug]/page.tsx`.
- One `"use client"` component, `app/Filter.tsx`. This is the JS the bench measures for this target:
  the React runtime + hydration cost of shipping one small DOM interaction the idiomatic Next way.

## Build output (from `next build`)

```
Route (app)                                 Size  First Load JS
┌ ○ /                                      756 B         103 kB
├ ○ /_not-found                            995 B         103 kB
└ ● /posts/[slug]                          122 B         102 kB
    ├ /posts/the-browser-grew-up
    ├ /posts/measuring-downloads
    ├ /posts/build-step-cost
    └ [+7 more paths]
+ First Load JS shared by all             102 kB
  ├ chunks/255-3981a3d1f3561bd8.js       46.3 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.87 kB

○  (Static)  prerendered as static content
●  (SSG)     prerendered as static HTML (uses generateStaticParams)
```

Both `/` and all 10 `/posts/:slug` routes prerender to static HTML at build time (○ / ●) — the
`"use client"` filter component adds hydration JS to the index page's client bundle but does not make
the route itself dynamic; the server-rendered card list is present in the initial HTML exactly like
native/Astro.

**Measured index JS** (real network trace, `next start`, gzip on the wire): **103,833 bytes
(~103.8 KB) transferred**, decoding to 351,684 bytes — this matches Next's own build-reported "103 kB
First Load JS" for `/`. This is the honest headline number for this target: React + Next runtime +
hydration plumbing to run one small DOM-filter component, versus native's hand-written buildless
module and Astro's bundled-but-frameworkless island.

## Contract

Reads the shared `../../content/` at request/build time (`lib/content.ts`, plain `node:fs/promises`, no
markdown parser — bodies are already HTML fragments, same as native and Astro). `process.cwd()` during
`next build` / `next start` / `next dev` is `apps/next`, so content resolves via
`path.join(process.cwd(), "../../content")`.

The single `<h1>` is rendered from `post.title` / the `SITE` constant inside the page components, never
baked into a body fragment. SEO head (title/description/canonical/OG/Twitter/JSON-LD) is emitted on
every page via the Next Metadata API (`metadata` export on the index page, `generateMetadata` on the
detail page) plus an inline `<script type="application/ld+json">` with `dangerouslySetInnerHTML`, so the
bench's parity columns tie across native/Astro/Next. `lib/site.ts` fixes `ORIGIN =
"http://localhost:3000"` (via `metadataBase` in `app/layout.tsx`) so canonical/og:url are absolute,
matching native's `origin` param and Astro's `site` config.

`apps/native/styles/app.css` is copied **verbatim** to `public/styles/app.css` and referenced as a
literal `<link rel="stylesheet" href="/styles/app.css">` in the root layout's `<head>` — not a CSS
Module or global import, which Next would hash/bundle and rename. This keeps the stylesheet request and
bytes identical to native and Astro.

## The filter — Next's idiomatic answer, shipped honestly

`app/Filter.tsx` is a `"use client"` component that reproduces `apps/native/client/filter.ts` /
`apps/astro/src/pages/index.astro`'s inline script 1:1: same `#q`/`.chip`/`.card`/`#count` selectors,
same AND-combine rule (query AND active tag), same `card.hidden` visibility toggle, same "click the
active chip to clear it" behavior, same `#count` text format (`"N of M posts"`, then `· tag: X` if a
tag is active, then `· "query"` with curly quotes if the query is non-empty), and the same
`apply()`-once-on-mount call (via `useEffect`, native's/Astro's module-load-time call).

Deliberately **DOM manipulation, not React state**: `app/page.tsx` (a Server Component) renders the
full static card list server-side — byte-identical markup to native/Astro, including all 10
`<li class="card">` entries in the initial HTML — and `Filter.tsx` only queries that DOM by id/class
after hydration and toggles visibility, exactly like the other two targets. This keeps the
server-rendered HTML identical across all three targets; only the *delivery mechanism* (React +
hydration runtime, shipped as `app/Filter.tsx`'s client bundle) differs, which is the one deliberate,
honestly-measured difference this target exists to show.

One small addition Filter.tsx has that native/Astro don't need: it attaches a `submit` listener on
`.filter` that calls `preventDefault()`. Native/Astro inline `onsubmit="return false"` directly in the
static HTML (the `#q` input has no `name`, so a real submit would reload `/` and drop the typed query);
a React Server Component can't hold a raw event-handler prop, so the client component does the
equivalent job after hydration instead. Before hydration completes, submitting the form would reload
the page — an infinitesimal, honestly-disclosed window unique to this target's architecture.

## Build asymmetry (disclosed)

A page that ships a `"use client"` component is not pure SSG in the "no server needed at all" sense —
Next still needs `next start` (or an equivalent Node server) to serve the prerendered HTML and the
client JS correctly, so this target is run via **`next build && next start`**, not
`output: "export"` / `next export`. The bench states this openly: native has zero build step, Astro
statically exports to plain files servable by anything, and Next needs its own runtime process even
though every route is fully prerendered — that's part of the honest cost profile this target
represents, not a workaround.

## Known, harmless deviation from native

Next's Metadata API normalizes away the trailing slash on the root canonical/`og:url` — it renders
`<link rel="canonical" href="http://localhost:3000">` where native/Astro render
`href="http://localhost:3000/"` (both resolve `canonicalPath: "/"` against the same origin). This holds
regardless of whether `alternates.canonical` is passed as `"/"` (relative) or the fully-qualified
`"http://localhost:3000/"` (absolute) — Next's own URL resolution strips it either way. Both URLs
identify the same resource and the auditor only checks that canonical exists and has an `href`, so this
does not affect parity at the level this bench checks; it is disclosed here rather than worked around,
in the same spirit as Astro's documented apostrophe-escaping deviation.
