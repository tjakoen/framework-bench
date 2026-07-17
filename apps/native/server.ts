// apps/native/server.ts — the native/BATCH reference app. No build step: Bun runs this TypeScript and
// the browser is handed server-rendered HTML plus ONE client-safe module (the filter), transpiled on
// request by BATCH's makeModuleServer. Two pages, measured by the bench: "/" (index + filter) and
// "/posts/:slug" (detail).
import { bunRuntime } from "@tjakoen/batch/platform/bun-runtime.ts";
import { makeStatic } from "@tjakoen/batch/http/static.ts";
import { makeModuleServer } from "@tjakoen/batch/http/modules.ts";
import { join } from "node:path";
import { readPosts, readTags, readBody } from "./content.ts";
import { renderIndex, renderPost } from "./views.ts";

const port = Number(Bun.env.PORT ?? 3401);

const styles = makeStatic(bunRuntime, join(import.meta.dir, "styles"));
// The one browser module: /modules/app/filter.js → client/filter.ts (a `.js` URL falls back to the
// `.ts` source; the graph is served as `.js` so a static freeze keeps the same URLs).
const modules = makeModuleServer(bunRuntime, { roots: { app: join(import.meta.dir, "client") } });

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/") return html(renderIndex(await readPosts(), await readTags(), url.origin));
    if (p.startsWith("/styles/")) return styles(p.slice("/styles".length));
    if (p.startsWith("/modules/")) return modules.serve(p);

    const m = p.match(/^\/posts\/([a-z0-9-]+)\/?$/);
    if (m) {
      const slug = m[1]!;
      const post = (await readPosts()).find((x) => x.slug === slug);
      if (post) return html(renderPost(post, await readBody(slug), url.origin));
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`native/BATCH reference app on http://localhost:${port}`);
