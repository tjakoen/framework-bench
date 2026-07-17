# content/ — the shared source of truth

All three reference apps (`apps/native`, `apps/astro`, `apps/next`) read **these exact files**. Nothing
here may be duplicated or reformatted per-app — identical bytes are what make the benchmark fair.

## Contract

- **`posts.json`** — array of post metadata, ordered **newest-first**:
  `{ slug, title, date (ISO 8601), tag, excerpt }`. `tag` is one id from `tags.json`.
- **`tags.json`** — the fixed tag set (`{ id, label }`), in display order. Drives the filter chips;
  same order on every target.
- **`posts/<slug>.html`** — the post **body fragment**: semantic HTML only
  (`<p> <h2> <ul> <blockquote> <code>`). **No** `<html>`/`<head>` and **no `<h1>`** — the page's single
  `<h1>` is rendered by each app from `title`, so one-h1 parity holds and titles can't drift.

## Rules for app authors

- **No markdown parser anywhere.** Bodies are already HTML → inject directly
  (`set:html` in Astro, `dangerouslySetInnerHTML` in Next, string-inject in native). This keeps
  native/BATCH honestly buildless and removes a parser confound from the measurement.
- Detail page: render `<h1>` from `title`, `<time datetime>` from `date`, and wrap the fragment in
  `<article>`.
- **Bodies are STUBS right now** (2–3 sentences). Real ~300–500-word prose is a later fill-in; the stub
  bytes are identical across targets, so the measurement is already valid.

## The one measured interaction — index filter

`/` lists post cards (title, date, tag, excerpt) with a client-side filter:

- a text input (case-insensitive match against **title + excerpt**), AND-combined with
- the 5 tag chips (one active at a time; clicking the active chip clears it).

A post shows iff `(input empty OR title/excerpt contains input) AND (no chip active OR post.tag === active)`.
No debounce, no route change, no refetch — visibility only. **How each stack ships the JS for this is the
headline the bench measures.**
