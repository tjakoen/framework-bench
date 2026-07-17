// apps/native-dpu/server.ts — the native + Declarative Partial Updates (DPU) reference app. Same BATCH
// server as apps/native (no build step; SSR HTML + one client-safe module transpiled on request), plus
// two DPU-specific routes:
//   • GET /fragment?q=&tag=  — a server-rendered <li> fragment for the current filter. The client swaps it
//                              in with the browser's native streamHTMLUnsafe()/setHTMLUnsafe() — no swap lib.
//   • GET /stream            — out-of-order streaming demo: the shell flushes first with a <?start> marker,
//                              then a later <template for> fills it. Zero JS to patch on a DPU browser.
import { bunRuntime } from "@tjakoen/batch/platform/bun-runtime.ts";
import { makeStatic } from "@tjakoen/batch/http/static.ts";
import { makeModuleServer } from "@tjakoen/batch/http/modules.ts";
import { join } from "node:path";
import { readPosts, readTags, readBody, type Post } from "./content.ts";
import { renderIndex, renderPost, renderCards, renderStreamHead, renderStreamFill } from "./views.ts";

const port = Number(Bun.env.PORT ?? 3403);

const styles = makeStatic(bunRuntime, join(import.meta.dir, "styles"));
const modules = makeModuleServer(bunRuntime, { roots: { app: join(import.meta.dir, "client") } });

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

/** Same AND-combined filter semantics as the client toggle and apps/native: (q empty OR title/excerpt
 *  contains q) AND (no tag OR post.tag === tag). Case-insensitive. */
function filterPosts(posts: Post[], q: string, tag: string | null): Post[] {
  const needle = q.trim().toLowerCase();
  return posts.filter((p) => {
    const hay = `${p.title} ${p.excerpt}`.toLowerCase();
    return (needle === "" || hay.includes(needle)) && (tag === null || p.tag === tag);
  });
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/") return html(renderIndex(await readPosts(), await readTags(), url.origin));
    if (p.startsWith("/styles/")) return styles(p.slice("/styles".length));
    if (p.startsWith("/modules/")) return modules.serve(p);

    // The DPU fragment: just the filtered cards, no shell. Byte-identical markup to the page's own list.
    if (p === "/fragment") {
      const q = url.searchParams.get("q") ?? "";
      const tag = url.searchParams.get("tag");
      const filtered = filterPosts(await readPosts(), q, tag);
      return html(renderCards(filtered) || `<li class="card"><p class="excerpt">No posts match.</p></li>`);
    }

    // Out-of-order streaming: flush the shell + placeholder, then the fill after the data is "ready".
    if (p === "/stream") {
      const posts = await readPosts();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(renderStreamHead(url.origin)));
          await Bun.sleep(250); // simulate a slow data source so the out-of-order fill is observable
          controller.enqueue(enc.encode(renderStreamFill(posts)));
          controller.close();
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const m = p.match(/^\/posts\/([a-z0-9-]+)\/?$/);
    if (m) {
      const slug = m[1]!;
      const post = (await readPosts()).find((x) => x.slug === slug);
      if (post) return html(renderPost(post, await readBody(slug), url.origin));
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`native + DPU reference app on http://localhost:${port}`);
