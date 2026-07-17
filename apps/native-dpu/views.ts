// apps/native-dpu/views.ts — server-side rendering for the native + Declarative Partial Updates target.
// Same shell, head, styles and semantics as apps/native (so the bench's parity + CSS columns tie), with
// two differences that ARE the point of this variant:
//   1. The measured filter is progressive enhancement over a SERVER fragment: client/dpu.ts fetches
//      `/fragment?q=&tag=` and swaps it into the list with the browser's NATIVE streamHTMLUnsafe() /
//      setHTMLUnsafe() — no framework, no swap library. It degrades to a pure client-side visibility
//      toggle where DPU isn't available, so `/` stays no-JS-safe and renders everywhere.
//   2. `/stream` demonstrates the headline DPU primitive: out-of-order streaming with `<?start>` markers
//      filled later in the same response by `<template for="…">`. Zero JS on a DPU browser.
import type { Post, Tag } from "./content.ts";

const SITE = "Notes on the native web";
const DESC = "A tiny reference blog — the same content built three ways for the framework bench.";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(iso + "T00:00:00Z"));

/** Shared document shell — identical to apps/native except the `.stack` label. Full SEO head on every
 *  page so the bench's parity columns tie across all targets. */
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
<nav aria-label="Primary"><a class="brand" href="/">Framework Bench</a><span class="stack">native + DPU</span></nav>
</header>
${opts.body}
${opts.scripts ?? ""}
</body>
</html>`;
}

/** The `<li>` cards — the ONE piece both the full index and the `/fragment` response render, so a filtered
 *  fragment is byte-for-byte the same markup the page shipped, just fewer of them. */
export function renderCards(posts: Post[]): string {
  return posts.map((p) => `<li class="card" data-tag="${esc(p.tag)}" data-title="${esc(p.title)}" data-excerpt="${esc(p.excerpt)}">
<a class="card-link" href="/posts/${esc(p.slug)}"><h2 class="card-title">${esc(p.title)}</h2></a>
<p class="excerpt">${esc(p.excerpt)}</p>
<div class="meta"><span class="tag tag--${esc(p.tag)}">${esc(p.tag)}</span><time datetime="${esc(p.date)}">${fmtDate(p.date)}</time></div>
</li>`).join("\n");
}

/** Index: full SSR list (renders everywhere, no-JS-safe) + the filter. The list is server-rendered in
 *  full; the DPU module only swaps it in place, or falls back to toggling card visibility. */
export function renderIndex(posts: Post[], tags: Tag[], origin: string): string {
  const chips = tags.map((t) =>
    `<button type="button" class="chip" data-tag="${esc(t.id)}" aria-pressed="false">${esc(t.label)}</button>`,
  ).join("");

  const body = `<main class="wrap">
<h1 class="page-title">${SITE}</h1>
<p class="lede">${DESC}</p>
<form class="filter" role="search" onsubmit="return false">
<label class="search"><span class="visually-hidden">Filter posts by title or excerpt</span>
<input id="q" type="search" placeholder="Filter posts…" autocomplete="off"></label>
<div class="chips" role="group" aria-label="Filter by tag">${chips}</div>
</form>
<p id="count" class="count" aria-live="polite">${posts.length} of ${posts.length} posts</p>
<ul id="cards" class="cards">
${renderCards(posts)}
</ul>
</main>`;

  return page({
    title: `${SITE} · Framework Bench`,
    description: DESC,
    canonicalPath: "/",
    origin,
    jsonLd: { "@context": "https://schema.org", "@type": "Blog", name: SITE, description: DESC, url: origin + "/" },
    body,
    scripts: `<script type="module" src="/modules/app/dpu.js"></script>`,
  });
}

/** Detail: identical to apps/native — <h1> from title, <time> from date, <article> body. */
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

// ── /stream — the out-of-order streaming headline demo ────────────────────────
// The response flushes the shell first with a `<?start name="feed">` placeholder, then (after the data is
// "ready") streams a `<template for="feed">` that fills the slot. On a DPU-capable browser the patch is
// applied by the parser with ZERO JavaScript. A tiny inline fallback covers browsers without native
// `<template for>` support. This is deliberately its own route (not `/`) so the no-JS/no-DPU floor loses
// nothing essential — the honest reality that out-of-order streaming of *content* isn't cross-browser-safe.

/** Part 1: everything up to and including the placeholder marker. Flushed immediately. */
export function renderStreamHead(origin: string): string {
  const canonical = origin + "/stream";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Out-of-order streaming (DPU demo) · Framework Bench</title>
<meta name="description" content="A live demonstration of Declarative Partial Updates: a placeholder streamed first, filled out of order by a later template — zero JavaScript on a DPU browser.">
<link rel="canonical" href="${canonical}">
<link rel="stylesheet" href="/styles/app.css">
<style>
.dpu-note{color:var(--ink-soft);font-size:14.5px;margin:0 0 20px}
.dpu-slot{min-height:44px;padding:14px 16px;border:1px dashed var(--line-strong);border-radius:10px;background:var(--raised)}
.dpu-loading{font-family:var(--mono);font-size:13px;color:var(--ink-faint)}
.dpu-feed{list-style:none;margin:0;padding:0}
.dpu-feed li{padding:8px 0;border-bottom:1px solid var(--line)}
.dpu-feed li:last-child{border-bottom:0}
</style>
</head>
<body>
<header class="site-head">
<nav aria-label="Primary"><a class="brand" href="/">Framework Bench</a><span class="stack">native + DPU</span></nav>
</header>
<main class="wrap">
<a class="back" href="/">← all posts</a>
<h1 class="page-title">Out-of-order streaming</h1>
<p class="dpu-note">The panel below is streamed first as a placeholder, then filled out of order by a
<code>&lt;template for="feed"&gt;</code> sent later in the same response. On a browser with Declarative
Partial Updates enabled, the parser patches it in with no JavaScript. Everywhere else, a small inline
fallback applies the template once it arrives.</p>
<div class="dpu-slot"><?start name="feed"><span class="dpu-loading">Loading feed…</span><?end></div>
</main>
`;
}

/** Part 2: the fill, streamed after a delay. The `<template for="feed">` patches the marker; the inline
 *  script is the graceful fallback for browsers without native `<template for>`. */
export function renderStreamFill(posts: Post[]): string {
  const items = posts.slice(0, 5).map((p) =>
    `<li><a href="/posts/${esc(p.slug)}">${esc(p.title)}</a></li>`,
  ).join("");
  return `<template for="feed" id="feed-data"><ul class="dpu-feed">${items}</ul></template>
<script>
// Fallback for browsers without declarative <template for> patching. NOTE: a browser can ship
// setHTMLUnsafe() (Chrome/FF stable) yet NOT the declarative out-of-order patcher (Chrome-148 flag only),
// so we can't feature-detect off a setter — we detect the BEHAVIOR: after a frame, did the feed actually
// land in the slot? If not, apply the template by hand (this is what the DPU polyfills do).
(function(){
  requestAnimationFrame(function(){
    var slot = document.querySelector('.dpu-slot');
    if (!slot || slot.querySelector('.dpu-feed')) return; // native DPU already patched it in
    var t = document.getElementById('feed-data');
    if (t && 'content' in t) slot.replaceChildren(t.content.cloneNode(true));
  });
})();
</script>
</body>
</html>`;
}
