// apps/native/views.ts — server-side rendering. Plain template literals, no build step: Bun runs this
// TypeScript directly and the browser is handed finished HTML. The one <h1> per page is rendered HERE
// from the post `title` (never baked into the body fragment), so one-h1 parity holds and titles can't
// drift between targets. SEO head (title/description/canonical/OG/Twitter/JSON-LD) is emitted on every
// page so the bench's parity columns tie across native/Astro/Next — an unrigged comparison.
import type { Post, Tag } from "./content.ts";

const SITE = "Notes on the native web";
const DESC = "A tiny reference blog — the same content built three ways for the framework bench.";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(iso + "T00:00:00Z"));

/** The shared document shell: <head> carries the full SEO set so every target measures the same head. */
function page(opts: {
  title: string; description: string; canonicalPath: string; origin: string;
  jsonLd: object; body: string; scripts?: string;
}): string {
  const canonical = opts.origin + opts.canonicalPath;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(opts.title)}">
<meta name="twitter:description" content="${esc(opts.description)}">
<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>
<link rel="stylesheet" href="/styles/app.css">
</head>
<body>
<header class="site-head">
<nav aria-label="Primary"><a class="brand" href="/">Framework Bench</a><span class="stack">native / BATCH</span></nav>
</header>
${opts.body}
${opts.scripts ?? ""}
</body>
</html>`;
}

/** Index: the post list + the one measured interaction (text filter + tag chips). Cards are fully
 *  server-rendered; the client module only toggles their visibility. */
export function renderIndex(posts: Post[], tags: Tag[], origin: string): string {
  const chips = tags.map((t) =>
    `<button type="button" class="chip" data-tag="${esc(t.id)}" aria-pressed="false">${esc(t.label)}</button>`,
  ).join("");
  const cards = posts.map((p) => `<li class="card" data-tag="${esc(p.tag)}" data-title="${esc(p.title)}" data-excerpt="${esc(p.excerpt)}">
<a class="card-link" href="/posts/${esc(p.slug)}"><h2 class="card-title">${esc(p.title)}</h2></a>
<p class="excerpt">${esc(p.excerpt)}</p>
<div class="meta"><span class="tag tag--${esc(p.tag)}">${esc(p.tag)}</span><time datetime="${esc(p.date)}">${fmtDate(p.date)}</time></div>
</li>`).join("\n");

  const body = `<main class="wrap">
<h1 class="page-title">${SITE}</h1>
<p class="lede">${DESC}</p>
<form class="filter" role="search" onsubmit="return false">
<label class="search"><span class="visually-hidden">Filter posts by title or excerpt</span>
<input id="q" type="search" placeholder="Filter posts…" autocomplete="off"></label>
<div class="chips" role="group" aria-label="Filter by tag">${chips}</div>
</form>
<p id="count" class="count" aria-live="polite">${posts.length} of ${posts.length} posts</p>
<ul class="cards">
${cards}
</ul>
</main>`;

  return page({
    title: `${SITE} · Framework Bench`,
    description: DESC,
    canonicalPath: "/",
    origin,
    jsonLd: { "@context": "https://schema.org", "@type": "Blog", name: SITE, description: DESC, url: origin + "/" },
    body,
    scripts: `<script type="module" src="/modules/app/filter.js"></script>`,
  });
}

/** Detail: one post. <h1> from title, <time> from date, <article> wraps the injected body fragment. */
export function renderPost(post: Post, bodyHtml: string, origin: string): string {
  const canonicalPath = `/posts/${post.slug}`;
  const body = `<main class="wrap">
<a class="back" href="/">← all posts</a>
<article class="post">
<span class="tag tag--${esc(post.tag)}">${esc(post.tag)}</span>
<h1 class="post-title">${esc(post.title)}</h1>
<time datetime="${esc(post.date)}">${fmtDate(post.date)}</time>
<div class="post-body">${bodyHtml}</div>
</article>
</main>`;

  return page({
    title: `${post.title} · Framework Bench`,
    description: post.excerpt,
    canonicalPath,
    origin,
    jsonLd: {
      "@context": "https://schema.org", "@type": "BlogPosting",
      headline: post.title, description: post.excerpt, datePublished: post.date,
      keywords: post.tag, url: origin + canonicalPath,
    },
    body,
  });
}
