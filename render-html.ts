// framework-bench/render-html.ts — renders results into docs/index.html, the GitHub Pages site
// (https://tjakoen.github.io/framework-bench/). Same data, same honest frame as results.md — the
// prose here mirrors bench.ts render(); if you edit the frame in one, edit it in the other.
//
// The page practices what the bench preaches: a single static HTML file, no build step beyond the
// bench run itself, ZERO JavaScript, theme-aware via prefers-color-scheme, and it carries the same
// SEO/AEO head (title/desc/canonical/OG/JSON-LD/1×H1/lang/semantics) it audits every target for.

interface PageResult {
  path: string;
  jsBytes: number;
  inlineJsBytes: number;
  totalJsBytes: number;
  htmlBytes: number;
  wireBytes: number;
  requests: number;
  cssBytes: number;
  renderBlockingCss: number;
  renderBlockingJs: number;
  ttfbMs: number;
  loadMs: number;
  title: boolean;
  desc: boolean;
  canonical: boolean;
  og: boolean;
  oneH1: boolean;
  jsonLd: boolean;
  htmlLang: boolean;
  semantic: boolean;
}
interface TargetResult {
  name: string;
  serveMode: string;
  buildStep: boolean;
  runtimeDeps: string[];
  nodeModules: string;
  pages: PageResult[];
}

const REPO = "https://github.com/tjakoen/framework-bench";
const SITE = "https://tjakoen.github.io/framework-bench/";
const STORY = "https://tjakoen.github.io/notes/native-partial-updates";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// bytes → compact string; sub-kb shown in bytes so "0kb" never hides a real ~700-byte script
const sz = (b: number) => (b === 0 ? "0" : b < 1024 ? `${b}b` : `${Math.round(b / 1024)}kb`);
const yes = `<span class="ok" aria-label="pass">✓</span>`;
const no = `<span class="bad" aria-label="fail">✗</span>`;
const mark = (b: boolean) => (b ? yes : no);

function page(r: TargetResult, path: string): PageResult {
  return r.pages.find((p) => p.path === path)!;
}

/** One horizontal-bar panel: JS shipped per target for one page, linear scale, value at every tip.
 *  Bars are capped at 86% of the track so the biggest bar still leaves room for its outside label. */
function barPanel(results: TargetResult[], path: string, subtitle: string): string {
  const max = Math.max(...results.map((r) => page(r, path).totalJsBytes));
  const rows = results.map((r) => {
    const p = page(r, path);
    const pct = max > 0 ? (p.totalJsBytes / max) * 86 : 0;
    const label = p.inlineJsBytes > 0 && p.totalJsBytes > 0
      ? `${sz(p.totalJsBytes)} <span class="muted">(inline)</span>`
      : sz(p.totalJsBytes);
    const bar = p.totalJsBytes === 0
      ? ""
      : `<div class="bar" style="width:${pct < 0.4 ? 0.4 : pct.toFixed(2)}%"></div>`;
    return `      <div class="row">
        <span class="tname">${esc(r.name)}</span>
        <div class="track">${bar}<span class="val">${label}</span></div>
      </div>`;
  }).join("\n");
  return `    <figure class="chart">
      <figcaption>${subtitle}</figcaption>
${rows}
    </figure>`;
}

function headlineTable(results: TargetResult[], path: string): string {
  const rows = results.map((r) => {
    const p = page(r, path);
    const jsCell = p.inlineJsBytes > 0
      ? `<strong>${sz(p.totalJsBytes)}</strong> <span class="muted">(${sz(p.inlineJsBytes)} inline)</span>`
      : `<strong>${sz(p.totalJsBytes)}</strong>`;
    return `        <tr><th scope="row">${esc(r.name)}</th><td>${jsCell}</td><td>${sz(p.wireBytes)}</td><td class="c">${p.requests}</td><td class="c">${p.renderBlockingCss}css/${p.renderBlockingJs}js</td><td>${p.ttfbMs}ms</td><td>${p.loadMs}ms</td></tr>`;
  }).join("\n");
  return `      <table>
        <thead><tr><th>Target</th><th class="n">JS shipped</th><th class="n">Wire</th><th>Requests</th><th>Render-blocking</th><th class="n">TTFB (med)</th><th class="n">Load (med)</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>`;
}

function factTable(results: TargetResult[]): string {
  const rows = results.map((r) =>
    `        <tr><th scope="row">${esc(r.name)}</th><td class="c">${r.buildStep ? "Yes" : "<strong>No</strong>"}</td><td>${r.runtimeDeps.length} (${esc(r.runtimeDeps.join(", ") || "—")})</td><td class="c">${esc(r.nodeModules)}</td><td class="wrap">${esc(r.serveMode)}</td></tr>`,
  ).join("\n");
  return `      <table>
        <thead><tr><th>Target</th><th>Build step</th><th>Runtime deps (direct)</th><th>node_modules</th><th>Production mode measured</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>`;
}

function parityTable(results: TargetResult[], path: string): string {
  const rows = results.map((r) => {
    const p = page(r, path);
    return `        <tr><th scope="row">${esc(r.name)}</th><td class="c">${mark(p.title)}</td><td class="c">${mark(p.desc)}</td><td class="c">${mark(p.canonical)}</td><td class="c">${mark(p.og)}</td><td class="c">${mark(p.oneH1)}</td><td class="c">${mark(p.jsonLd)}</td><td class="c">${mark(p.htmlLang)}</td><td class="c">${mark(p.semantic)}</td></tr>`;
  }).join("\n");
  return `      <table>
        <thead><tr><th>Target</th><th>Title</th><th>Desc</th><th>Canonical</th><th>OG/Twitter</th><th>1×H1</th><th>JSON-LD</th><th>html lang</th><th>Semantics</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>`;
}

export function renderHtml(results: TargetResult[], meta: { generated: string; measuredRuns: number }): string {
  const idx = results.map((r) => ({ name: r.name, js: page(r, "/").totalJsBytes }));
  const sorted = [...idx].sort((a, b) => a.js - b.js);
  const heaviest = sorted[sorted.length - 1]!;
  // Same ratio as results.md: heaviest vs the lightest NON-ZERO stack, so it's a real multiple, not ∞.
  const baseline = sorted.find((s) => s.js > 0) ?? sorted[0]!;
  const ratio = baseline.js > 0 ? Math.round(heaviest.js / baseline.js) : 0;
  const date = meta.generated.slice(0, 10);

  const desc = `The same small blog, built ${results.length} ways — ${results.map((r) => r.name).join(", ")} — measured by one harness. JS shipped, wire bytes, requests, and SEO parity, honestly framed.`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "framework-bench results",
    description: desc,
    url: SITE,
    isBasedOn: REPO,
    dateModified: date,
    creator: { "@type": "Person", name: "TJ Akoen Stolk", url: "https://tjakoen.github.io/" },
    license: "https://www.apache.org/licenses/LICENSE-2.0",
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>framework-bench — the same blog, built ${results.length} ways</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${SITE}">
  <meta name="color-scheme" content="light dark">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE}">
  <meta property="og:title" content="framework-bench — the same blog, built ${results.length} ways">
  <meta property="og:description" content="${esc(desc)}">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    :root {
      color-scheme: light;
      --plane: #f9f9f7; --surface: #fcfcfb;
      --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
      --hairline: #e1e0d9; --baseline: #c3c2b7; --ring: rgba(11,11,11,.10);
      --series: #2a78d6; --good: #006300;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        color-scheme: dark;
        --plane: #0d0d0d; --surface: #1a1a19;
        --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
        --hairline: #2c2c2a; --baseline: #383835; --ring: rgba(255,255,255,.10);
        --series: #3987e5; --good: #0ca30c;
      }
    }
    * { box-sizing: border-box; margin: 0; }
    body {
      background: var(--plane); color: var(--ink);
      font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
      padding: 2rem 1rem 4rem;
    }
    .wrap-col { max-width: 60rem; margin: 0 auto; }
    header .eyebrow { color: var(--muted); font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; }
    h1 { font-size: 1.8rem; line-height: 1.2; margin: .3rem 0 .6rem; }
    h2 { font-size: 1.15rem; margin: 2.6rem 0 .8rem; }
    p, li { color: var(--ink-2); max-width: 46rem; }
    p strong, li strong { color: var(--ink); }
    a { color: var(--series); }
    nav { display: flex; gap: 1rem; flex-wrap: wrap; margin: .8rem 0 0; font-size: .9rem; }
    .meta { color: var(--muted); font-size: .85rem; margin-top: .6rem; }
    .hero {
      background: var(--surface); border: 1px solid var(--ring); border-radius: 10px;
      padding: 1.4rem 1.6rem; margin: 1.8rem 0; display: flex; gap: 1.4rem; align-items: baseline; flex-wrap: wrap;
    }
    .hero .fig { font-size: 3.4rem; font-weight: 650; line-height: 1; }
    .hero .cap { color: var(--ink-2); max-width: 28rem; }
    .chart {
      background: var(--surface); border: 1px solid var(--ring); border-radius: 10px;
      padding: 1.1rem 1.3rem 1.2rem; margin: 1rem 0;
    }
    .chart figcaption { color: var(--ink-2); font-size: .9rem; margin-bottom: .9rem; }
    .row { display: grid; grid-template-columns: 9.5rem 1fr; align-items: center; gap: .7rem; }
    .row + .row { margin-top: .55rem; }
    .tname { font-size: .85rem; color: var(--ink-2); text-align: right; }
    .track { display: flex; align-items: center; border-left: 1px solid var(--baseline); min-height: 20px; }
    .bar { height: 20px; background: var(--series); border-radius: 0 4px 4px 0; }
    .val { font-size: .85rem; color: var(--ink); margin-left: .45rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .muted { color: var(--muted); font-weight: 400; }
    .table-scroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; margin: 1rem 0; }
    table { border-collapse: collapse; width: 100%; font-size: .88rem; }
    th, td { padding: .55rem .9rem; text-align: left; border-top: 1px solid var(--hairline); white-space: nowrap; }
    thead th { border-top: 0; color: var(--muted); font-weight: 500; font-size: .8rem; }
    tbody th { color: var(--ink); font-weight: 550; }
    td { color: var(--ink-2); font-variant-numeric: tabular-nums; }
    td strong { color: var(--ink); }
    th.n, td.n { text-align: right; }
    td.c, th.c { text-align: center; }
    td.wrap { white-space: normal; min-width: 18rem; }
    .ok { color: var(--good); }
    .bad { color: #d03b3b; }
    ul { padding-left: 1.2rem; }
    li + li { margin-top: .45rem; }
    code { font: .85em/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--surface); border: 1px solid var(--ring); border-radius: 4px; padding: .08em .35em; }
    pre { background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; padding: 1rem 1.2rem; overflow-x: auto; margin: 1rem 0; }
    pre code { background: none; border: 0; padding: 0; }
    footer { margin-top: 3rem; padding-top: 1.2rem; border-top: 1px solid var(--hairline); color: var(--muted); font-size: .85rem; }
  </style>
</head>
<body>
  <div class="wrap-col">
  <header>
    <p class="eyebrow">framework-bench</p>
    <h1>The same small blog, built ${results.length} ways, measured by one harness</h1>
    <p>Same content, same page, same SEO head on every target — the only thing that varies is the
    framework you reach for, and that is exactly what gets weighed.</p>
    <nav>
      <a href="${REPO}">Repo &amp; harness</a>
      <a href="${STORY}">The story behind it</a>
      <a href="${REPO}/blob/main/results.md">results.md</a>
      <a href="${REPO}/blob/main/results/results.json">results.json</a>
    </nav>
    <p class="meta">Generated <time datetime="${date}">${date}</time> · median of ${meta.measuredRuns} runs, one warm run discarded · re-run with <code>bun run bench</code></p>
  </header>
  <main>
    <div class="hero">
      <span class="fig">${ratio}×</span>
      <span class="cap">the JavaScript <strong>${esc(heaviest.name)}</strong> ships versus the lightest
      non-zero stack (${esc(baseline.name)}) — for the <em>identical</em> interaction: a text + tag
      filter on the index page.</span>
    </div>

    <h2>JS shipped for the same page</h2>
${barPanel(results, "/", "Index (/) — the one measured interaction (text + tag filter)")}
${barPanel(results, "/posts/the-browser-grew-up", "Article (/posts/the-browser-grew-up) — static page, no interaction")}
    <p>That spread is the whole thesis: the interaction is the same; the runtime each stack makes you
    ship for it is not. Astro's figure is its filter script inlined into the HTML; native's is one
    small external module — both are essentially the filter logic and nothing else. Next's is React
    runtime + hydration.</p>

    <h2>How to read this (the honest frame)</h2>
    <ul>
      <li><strong>Headline = network-independent, categorical metrics:</strong> JS shipped, request
      count, wire bytes, build-step yes/no, runtime-dependency count. These are robust and honest.</li>
      <li><strong>TTFB / Load are local best-case corroboration, not proof.</strong> No network hop;
      real-world latency adds to every stack equally. Direction, never the headline.</li>
      <li><strong>The comparison is not rigged:</strong> every target gets the same SEO/AEO head, so
      the parity columns below are ✓ across the board. Better SEO on one stack would be a confound,
      not a win.</li>
      <li><strong>Where a stack ties or wins, it says so.</strong> On a mostly static page Astro's
      no-runtime <code>&lt;script&gt;</code> island ships comparably little to native — that honest
      tie is the point, not a problem.</li>
    </ul>

    <h2>Full numbers — index (/)</h2>
    <div class="table-scroll">
${headlineTable(results, "/")}
    </div>
    <h2>Full numbers — article</h2>
    <div class="table-scroll">
${headlineTable(results, "/posts/the-browser-grew-up")}
    </div>

    <h2>The facts the auditor can't measure</h2>
    <div class="table-scroll">
${factTable(results)}
    </div>

    <h2>Parity — proof the comparison is fair</h2>
    <p>The same head on every target: index first, article second.</p>
    <div class="table-scroll">
${parityTable(results, "/")}
    </div>
    <div class="table-scroll">
${parityTable(results, "/posts/the-browser-grew-up")}
    </div>

    <h2>Honest notes</h2>
    <ul>
      <li><strong>Next's asymmetry:</strong> the index is a <code>"use client"</code> component, so it
      is not pure SSG — measured with <code>next build &amp;&amp; next start</code>, stated openly
      rather than forced into an unfair static export. Its JS is React runtime + hydration: the honest
      cost of reaching for a framework to do the filter.</li>
      <li><strong>Astro's tie:</strong> Astro's filter is an idiomatic <code>&lt;script&gt;</code>
      island (bundled, <strong>no</strong> UI-framework runtime). On this static-ish page it ships
      about what native ships — the honest-win/tie case.</li>
      <li><strong>Compression asymmetry — conservative against native.</strong> The Astro/Next preview
      servers gzip; native's <code>bun server.ts</code> does not, so native's byte numbers are an
      upper bound — behind any CDN the gap only widens.</li>
      <li><strong>Inline vs external JS:</strong> the JS-shipped column adds inline
      <code>&lt;script&gt;</code> source back in, so no stack hides code in the document.</li>
      <li><strong>Fresh context per page:</strong> each page is measured in its own browser (no shared
      cache), so a resource downloaded for the index can't make the article look lighter than it is.</li>
    </ul>

    <h2>Run it yourself</h2>
    <pre><code>git clone ${REPO}.git
cd framework-bench &amp;&amp; bun install
bun run bench</code></pre>
    <p><em>Perf is corroboration. The bytes, the request count, and the build-step column are the
    argument.</em></p>
  </main>
  <footer>
    <p>This page is a single static HTML file that ships <strong>0kb of JavaScript</strong> and
    carries the same SEO head it audits every target for — regenerated by
    <a href="${REPO}/blob/main/bench.ts">bench.ts</a> alongside results.md.
    Apache-2.0 · <a href="https://tjakoen.github.io/">tjakoen.github.io</a></p>
  </footer>
  </div>
</body>
</html>
`;
}
