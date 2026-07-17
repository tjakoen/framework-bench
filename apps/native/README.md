# apps/native — the native/BATCH target

The native-first entry in the framework bench: **server-rendered HTML plus one client-safe module** (the
list filter), with **no build step**. Bun runs the TypeScript directly; the browser is handed finished
HTML and a single small script that BATCH transpiles on request.

## Run

```sh
bun install
bun run start          # http://localhost:3401
bun run export         # freeze a static dist/ (projection of the running server)
```

## What it ships

- `/` — the post list + the one measured interaction: a text filter AND-combined with five tag chips.
- `/posts/:slug` — a single post; `<h1>` from the title, `<time>` from the date, `<article>` body.
- One browser module — `client/filter.ts`, served at `/modules/app/filter.js` (transpiled on request,
  frozen into the export). This is the JS the bench measures.

## Contract

Reads the shared `../../content/` verbatim (metadata JSON + HTML body fragments — no markdown parser, so
native stays honestly buildless). The single `<h1>` is rendered from `title`, never baked into a body
fragment. SEO head (title/description/canonical/OG/Twitter/JSON-LD) is emitted on every page so the
bench's parity columns tie across all three targets.

## Dependency note

Depends on the real `@tjakoen/batch` (git-pinned, same as the portfolio) — so this target genuinely *is*
BATCH, not hand-rolled vanilla. BATCH declares **zero third-party runtime dependencies**; its browser
contribution here is the transpile-on-request mechanism, not shipped framework code.
