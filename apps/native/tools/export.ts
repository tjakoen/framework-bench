// apps/native/tools/export.ts — static export as a PROJECTION of the running server (BATCH's exportSite,
// ARCHITECTURE §18): boot the app, crawl its final HTML + freeze the one client module, write dist/. No
// second renderer, no bundler. Gives the bench a static "production mode" for native comparable to
// `astro build` / `next build`.
import { exportSite } from "@tjakoen/batch/export/export.ts";
import { join } from "node:path";
import { readPosts } from "../content.ts";

const PORT = Number(Bun.env.EXPORT_PORT ?? 3402);
const BASE = `http://localhost:${PORT}`;
const ROOT = join(import.meta.dir, "..");

async function waitForServer(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/`)).ok) return; } catch { /* not up yet */ }
    await Bun.sleep(150);
  }
  throw new Error(`server didn't come up on ${BASE}`);
}

const server = Bun.spawn(["bun", join(ROOT, "server.ts")], {
  env: { ...process.env, PORT: String(PORT) }, stdout: "ignore", stderr: "ignore",
});
try {
  await waitForServer();
  const posts = await readPosts();
  const pages = ["/", ...posts.map((p) => `/posts/${p.slug}`)];
  await exportSite({
    baseURL: BASE,
    distDir: join(ROOT, "dist"),
    pages,
    moduleEntries: ["/modules/app/filter.js"],
    assets: [{ prefix: "/styles", dir: join(ROOT, "styles") }],
    log: (m) => console.log(m),
  });
} finally {
  server.kill();
}
