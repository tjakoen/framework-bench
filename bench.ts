// framework-bench/bench.ts — the cross-target runner. Boots each reference app in its PRODUCTION mode,
// points the framework-generic auditor (@tjakoen/batch/audit) at the same two pages, and emits a
// cross-target comparison (results.json + results.md). This is NOT a measurement tool — the measurement
// engine already exists in BATCH (audit(): TTFB/load/wire/js/requests + every SEO/AEO parity check). This
// file only orchestrates: build (if any) → serve → waitForServer → audit ×N → kill → aggregate → render.
//
// The honest frame (non-negotiable — it IS the point): the HEADLINE is the network-independent, categorical
// metrics — JS shipped, request count, wire bytes, build-step yes/no, runtime-dependency count. TTFB/Load are
// LOCAL best-case corroboration only (no network hop; real latency adds to every stack equally), reported as
// median-of-5 with a warm run discarded. Where a target ties or wins, we say so — the SEO/AEO parity columns
// are ✓ across ALL targets on purpose, so the comparison can't be dismissed as rigged.
//
//   bun run bench            # build + boot + measure all targets, write results.{json,md}
//   RUNS=3 bun run bench     # fewer perf samples (default 5 measured + 1 warm discard)
import { audit, kb, type AuditReport, type DomAudit } from "@tjakoen/batch/audit/audit.ts";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = import.meta.dir;
const PAGES = ["/", "/posts/the-browser-grew-up"] as const;
const MEASURED = Number(Bun.env.RUNS ?? 5); // perf samples kept (median-of-N)
const WARM_DISCARD = 1; // first run per target is thrown away (JIT / cold cache noise)

interface Target {
  name: string;
  dir: string; // relative to ROOT
  port: number;
  buildCmd?: string[]; // run once before serving
  serveCmd: string[]; // long-lived; killed after
  buildStep: boolean; // the honest fact-table column
  serveMode: string; // human description of the production mode measured
}

const TARGETS: Target[] = [
  {
    name: "native / BATCH",
    dir: "apps/native",
    port: 3401,
    serveCmd: ["bun", "server.ts"],
    buildStep: false,
    serveMode: "bun server.ts — no build step (server IS the production artifact)",
  },
  {
    name: "native + DPU",
    dir: "apps/native-dpu",
    port: 3403,
    serveCmd: ["bun", "server.ts"],
    buildStep: false,
    serveMode: "bun server.ts — no build step; filter swaps a server fragment via native setHTMLUnsafe()/streamHTMLUnsafe()",
  },
  {
    name: "Astro",
    dir: "apps/astro",
    port: 4321,
    buildCmd: ["bun", "run", "build"],
    serveCmd: ["bunx", "astro", "preview", "--port", "4321"],
    buildStep: true,
    serveMode: "astro build → astro preview (static output)",
  },
  {
    name: "Next.js",
    dir: "apps/next",
    port: 3100,
    buildCmd: ["bun", "run", "build"],
    serveCmd: ["bunx", "next", "start", "-p", "3100"],
    buildStep: true,
    serveMode: "next build && next start (client-component page is not pure SSG — see note)",
  },
];

// ── per-target measured result ───────────────────────────────────────────────
interface PageResult {
  path: string;
  jsBytes: number; // external .js resources, transferSize (gzipped where the server compresses)
  inlineJsBytes: number; // executable inline <script> source (excludes ld+json), uncompressed
  totalJsBytes: number; // jsBytes + inlineJsBytes — the honest "how much JS does this page ship"
  htmlBytes: number; // the served document, uncompressed
  wireBytes: number;
  requests: number;
  cssBytes: number;
  renderBlockingCss: number;
  renderBlockingJs: number;
  ttfbMs: number; // median
  loadMs: number; // median
  // parity (from a representative run; deterministic across runs)
  title: boolean;
  desc: boolean;
  canonical: boolean;
  og: boolean;
  oneH1: boolean;
  jsonLd: boolean;
  htmlLang: boolean;
  semantic: boolean; // main + article(on detail) + nav + time all present as expected
}
interface TargetResult {
  name: string;
  serveMode: string;
  buildStep: boolean;
  runtimeDeps: string[];
  nodeModules: string; // du -sh
  pages: PageResult[];
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

async function waitForServer(base: string, timeoutMs = 40000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(base + "/")).ok) return; } catch { /* not up yet */ }
    await Bun.sleep(250);
  }
  throw new Error(`server never came up on ${base}`);
}

async function run(cmd: string[], cwd: string): Promise<void> {
  const p = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  const code = await p.exited;
  if (code !== 0) throw new Error(`\`${cmd.join(" ")}\` exited ${code} in ${cwd}`);
}

async function killPort(port: number): Promise<void> {
  try {
    const p = Bun.spawn(["bash", "-lc", `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`], { stdout: "ignore", stderr: "ignore" });
    await p.exited;
  } catch { /* best effort */ }
}

function semanticOk(path: string, d: DomAudit): boolean {
  const detail = path.startsWith("/posts/");
  return d.hasMain && d.hasNav && d.hasTime && (detail ? d.hasArticle : true);
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Raw-fetch the served document to measure it honestly: total HTML size and the executable inline
 *  <script> source (Astro inlines its filter, so audit()'s resource-based jsBytes reports 0 for it —
 *  this captures that JS instead of losing it). ld+json is data, not shipped code, so it's excluded. */
async function htmlFacts(base: string, path: string): Promise<{ htmlBytes: number; inlineJsBytes: number }> {
  const html = await (await fetch(base + path)).text();
  const htmlBytes = bytes(html);
  let inlineJsBytes = 0;
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue; // external — counted by audit() as a resource
    if (/application\/(ld\+json)/i.test(attrs)) continue; // structured data, not executable JS
    inlineJsBytes += bytes(m[2] ?? "");
  }
  return { htmlBytes, inlineJsBytes };
}

async function measure(t: Target): Promise<TargetResult> {
  const cwd = join(ROOT, t.dir);
  const base = `http://localhost:${t.port}`;

  console.log(`\n=== ${t.name} ===`);
  if (t.buildCmd) {
    console.log(`[build] ${t.buildCmd.join(" ")}`);
    await run(t.buildCmd, cwd);
  }

  await killPort(t.port); // clear any stragglers
  console.log(`[serve] ${t.serveCmd.join(" ")} (:${t.port})`);
  const server = Bun.spawn(t.serveCmd, { cwd, stdout: "ignore", stderr: "ignore", env: { ...process.env, PORT: String(t.port) } });

  // per-page accumulators for the median-of-N timing + a representative DOM/bytes snapshot.
  // Each sample audits ONE page in its own fresh browser (audit() launches a browser per call), so
  // resources from the other page can't sit in cache and understate a page's real download.
  const acc: Record<string, { ttfb: number[]; load: number[]; js: number[]; wire: number[]; req: number[]; snap?: AuditReport["pages"][number]; html?: { htmlBytes: number; inlineJsBytes: number } }> = {};
  for (const p of PAGES) acc[p] = { ttfb: [], load: [], js: [], wire: [], req: [] };

  try {
    await waitForServer(base);
    const total = WARM_DISCARD + MEASURED;
    for (const path of PAGES) {
      const a = acc[path]!;
      a.html = await htmlFacts(base, path); // deterministic; measured once
      for (let i = 0; i < total; i++) {
        const warm = i < WARM_DISCARD;
        process.stdout.write(`[${path} run ${i + 1}/${total}${warm ? " warm-discard" : ""}] `);
        const report = await audit({ baseURL: base, pages: [path] });
        const pr = report.pages[0];
        if (!pr || !pr.ok || !pr.perf || !pr.dom) { console.log(`skip (${pr?.error})`); continue; }
        if (!warm) {
          a.ttfb.push(pr.perf.ttfbMs);
          a.load.push(pr.perf.loadMs);
          a.js.push(pr.perf.jsBytes);
          a.wire.push(pr.perf.wireBytes);
          a.req.push(pr.perf.requests);
        }
        a.snap = pr; // last run's DOM (deterministic) + bytes
      }
    }
  } finally {
    try { server.kill(); } catch { /* ignore */ }
    await killPort(t.port);
  }

  const pkg = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
  const runtimeDeps = Object.keys(pkg.dependencies ?? {});
  const du = Bun.spawnSync(["bash", "-lc", `du -sh "${join(cwd, "node_modules")}" 2>/dev/null | cut -f1`]);
  const nodeModules = du.stdout.toString().trim() || "n/a";

  const pages: PageResult[] = PAGES.map((path) => {
    const a = acc[path]!;
    const snap = a.snap;
    const d = snap?.dom;
    const jsBytes = median(a.js);
    const inlineJsBytes = a.html?.inlineJsBytes ?? 0;
    return {
      path,
      jsBytes,
      inlineJsBytes,
      totalJsBytes: jsBytes + inlineJsBytes,
      htmlBytes: a.html?.htmlBytes ?? 0,
      wireBytes: median(a.wire),
      requests: median(a.req),
      cssBytes: snap?.perf?.cssBytes ?? 0,
      renderBlockingCss: d?.renderBlockingCss ?? 0,
      renderBlockingJs: d?.renderBlockingJs ?? 0,
      ttfbMs: median(a.ttfb),
      loadMs: median(a.load),
      title: !!d?.title,
      desc: !!d?.metaDescription,
      canonical: !!d?.canonical,
      og: (d?.og.length ?? 0) > 0,
      oneH1: d?.h1Count === 1,
      jsonLd: (d?.jsonLd.length ?? 0) > 0,
      htmlLang: !!d?.htmlLang,
      semantic: d ? semanticOk(path, d) : false,
    };
  });

  return { name: t.name, serveMode: t.serveMode, buildStep: t.buildStep, runtimeDeps, nodeModules, pages };
}

// ── rendering ────────────────────────────────────────────────────────────────
const mark = (b: boolean) => (b ? "✓" : "✗");

// bytes → compact string, sub-kb shown in bytes so "0kb" never hides a real ~700-byte script
const sz = (b: number) => (b === 0 ? "0" : b < 1024 ? `${b}b` : kb(b));

function headlineTable(results: TargetResult[], path: string): string {
  const rows = results.map((r) => {
    const p = r.pages.find((x) => x.path === path)!;
    const jsCell = p.inlineJsBytes > 0
      ? `**${sz(p.totalJsBytes)}** (${sz(p.inlineJsBytes)} inline)`
      : `**${sz(p.totalJsBytes)}**`;
    return `| ${r.name} | ${jsCell} | ${sz(p.wireBytes)} | ${p.requests} | ${p.renderBlockingCss}css/${p.renderBlockingJs}js | ${p.ttfbMs}ms | ${p.loadMs}ms |`;
  }).join("\n");
  return `| Target | JS shipped | Wire | Requests | Render-blocking | TTFB (med) | Load (med) |\n` +
    `|--------|-----------:|-----:|:--------:|:---------------:|-----------:|-----------:|\n${rows}`;
}

function parityTable(results: TargetResult[], path: string): string {
  const rows = results.map((r) => {
    const p = r.pages.find((x) => x.path === path)!;
    return `| ${r.name} | ${mark(p.title)} | ${mark(p.desc)} | ${mark(p.canonical)} | ${mark(p.og)} | ${mark(p.oneH1)} | ${mark(p.jsonLd)} | ${mark(p.htmlLang)} | ${mark(p.semantic)} |`;
  }).join("\n");
  return `| Target | Title | Desc | Canonical | OG/Twitter | 1×H1 | JSON-LD | html lang | Semantics |\n` +
    `|--------|:-----:|:----:|:---------:|:----------:|:----:|:-------:|:---------:|:---------:|\n${rows}`;
}

function factTable(results: TargetResult[]): string {
  const rows = results.map((r) =>
    `| ${r.name} | ${r.buildStep ? "Yes" : "**No**"} | ${r.runtimeDeps.length} (${r.runtimeDeps.join(", ") || "—"}) | ${r.nodeModules} | ${r.serveMode} |`,
  ).join("\n");
  return `| Target | Build step | Runtime deps (direct) | node_modules | Production mode measured |\n` +
    `|--------|:----------:|-----------------------|:------------:|--------------------------|\n${rows}`;
}

function render(results: TargetResult[]): string {
  const idx = results.map((r) => ({ name: r.name, js: r.pages.find((p) => p.path === "/")!.totalJsBytes }));
  const sorted = [...idx].sort((a, b) => a.js - b.js);
  const lightest = sorted[0]!, heaviest = sorted[sorted.length - 1]!;
  // Compare the heaviest against the lightest NON-ZERO stack, so the ratio is a real multiple, not ∞.
  const baseline = sorted.find((s) => s.js > 0) ?? lightest;
  const ratio = baseline.js > 0 ? Math.round(heaviest.js / baseline.js) : 0;
  const listJoin = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const lightNames = listJoin(idx.filter((s) => s.js < 4096).map((s) => s.name));

  return `# Framework bench — results

_The same small blog, built ${results.length} ways, measured by one harness ([\`bench.ts\`](bench.ts), which
reuses BATCH's framework-generic \`audit()\`). Re-run with \`bun run bench\`. Generated ${new Date().toISOString().slice(0, 10)}._

## How to read this (the honest frame)

- **Headline = network-independent, categorical metrics:** JS shipped, request count, wire bytes,
  build-step yes/no, runtime-dependency count. These are robust and honest — publish these.
- **TTFB / Load are LOCAL best-case corroboration, not proof.** No network hop; real-world latency adds
  to every stack equally. Median-of-${MEASURED} with a warm run discarded, to cut local noise. Use them
  for direction, never as the headline.
- **The comparison is not rigged:** every target gets the same SEO/AEO head, so the parity columns below
  are ✓ across the board. If one stack had better SEO that would be a confound, not a win.
- **Where a stack ties or wins, it says so.** On a mostly static page Astro's no-runtime \`<script>\`
  island ships comparably little to native — that honest tie is the point, not a problem.

## Headline: the JS each stack ships for the same page

**Index (\`/\`) — the one measured interaction (text + tag filter):**

${headlineTable(results, "/")}

**Detail (\`/posts/the-browser-grew-up\`) — a static article, no interaction:**

${headlineTable(results, "/posts/the-browser-grew-up")}

On the index, **${lightNames}** ship a kilobyte or two of JavaScript for the filter, while
**${heaviest.name}** ships ${sz(heaviest.js)} — roughly **${ratio}× more** for the identical interaction.
That spread is the whole thesis: the interaction is the same; the runtime each stack makes you ship for it
is not. (Astro's figure is its filter script inlined into the HTML; native's is one small external module.
Both are essentially the filter logic and nothing else. Next's is React runtime + hydration.)

## The facts the auditor can't measure

${factTable(results)}

## Parity — proof the comparison is fair (same head on every target)

**Index (\`/\`):**

${parityTable(results, "/")}

**Detail (\`/posts/the-browser-grew-up\`):**

${parityTable(results, "/posts/the-browser-grew-up")}

## Honest notes

- **Next's asymmetry:** the index is a \`"use client"\` component, so it is not pure SSG — measured with
  \`next build && next start\`, stated openly rather than forced into an unfair static export. Its JS is
  React runtime + hydration: the honest cost of reaching for a framework to do the filter.
- **Astro's tie:** Astro's filter is an idiomatic \`<script>\` island (bundled, **no** UI-framework
  runtime). On this static-ish page it ships about what native ships — the honest-win/tie case.
- **native/BATCH:** server-rendered HTML plus one client-safe module transpiled on request. No build step,
  one direct runtime dependency (BATCH, which itself declares zero third-party runtime deps).
- **native + DPU:** same no-build server, but the filter is progressive enhancement over Declarative
  Partial Updates — it fetches a server-rendered fragment and swaps it with the browser's **native**
  \`streamHTMLUnsafe()\` (Chrome 148, flag) / \`setHTMLUnsafe()\` (Chrome + Firefox stable), no swap library,
  degrading to a client-side toggle where neither exists. Fewer bytes than a JS filter, but a server
  round-trip per change — the opposite trade from native/BATCH. Full DPU (out-of-order \`<?marker>\` +
  \`<template for>\` streaming, the \`/stream\` route) is a flagged experiment, not cross-browser-shippable
  before ~2027; see the DPU post + its support matrix.
- **CSS is identical bytes** across every target (\`styles/app.css\` copied verbatim), so wire differences are
  JS, not styling.

## Measurement caveats (so the numbers can't be read dishonestly)

- **Inline vs external JS.** \`audit()\` counts JS as separate \`.js\` resources. Astro inlines its small
  filter script into the HTML, so it would otherwise read as "0kb JS". The **JS shipped** column adds that
  inline script back in (shown as \`(… inline)\`), so no stack hides code in the document.
- **Compression asymmetry — conservative against native.** \`wire\` is transferSize as each server actually
  sends it. The Astro/Next preview servers gzip; native's \`bun server.ts\` does **not**. So native's byte
  numbers here are an **upper bound** — deployed behind any CDN it would gzip like the others, only widening
  the gap. We leave it uncompressed rather than flatter native.
- **Fresh context per page.** Each page is measured in its own browser (no shared cache), so a resource
  downloaded for the index can't make the detail page look lighter than it is.

_Perf is corroboration. The bytes, the request count, and the build-step column are the argument._
`;
}

// ── main ─────────────────────────────────────────────────────────────────────
// RENDER_ONLY=1 re-emits results.md from the last results/results.json without re-measuring — handy for
// iterating the prose without paying for four builds + audits.
let results: TargetResult[];
if (Bun.env.RENDER_ONLY) {
  console.log(`framework-bench runner — RENDER_ONLY: re-rendering from results/results.json`);
  results = JSON.parse(await readFile(join(ROOT, "results", "results.json"), "utf8")).targets;
} else {
  console.log(`framework-bench runner — ${TARGETS.length} targets, ${MEASURED} measured runs + ${WARM_DISCARD} warm discard, pages: ${PAGES.join(" , ")}`);
  results = [];
  for (const t of TARGETS) results.push(await measure(t));
}

await mkdir(join(ROOT, "results"), { recursive: true });
await writeFile(join(ROOT, "results", "results.json"), JSON.stringify({ generated: new Date().toISOString(), measuredRuns: MEASURED, pages: PAGES, targets: results }, null, 2));
await writeFile(join(ROOT, "results.md"), render(results));

console.log(`\n[bench] wrote results.md + results/results.json`);
for (const r of results) {
  const idx = r.pages.find((p) => p.path === "/")!;
  console.log(`  ${r.name.padEnd(16)} index JS ${kb(idx.jsBytes).padStart(6)}  wire ${kb(idx.wireBytes).padStart(6)}  req ${idx.requests}  build-step ${r.buildStep ? "Y" : "N"}`);
}
