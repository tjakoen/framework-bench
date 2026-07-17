// apps/native-dpu/tools/export.ts — static export as a projection of the running server (BATCH exportSite),
// same as apps/native: boot the app, crawl `/` + every post, freeze the one client module, write dist/.
//
// Note: `/fragment` and `/stream` are LIVE-SERVER routes (a server fragment and an out-of-order stream) —
// a static freeze can't reproduce a server round-trip or a delayed stream, so they're intentionally not
// exported. On a static host the filter degrades to its client-side toggle (the no-DPU floor), which is
// why `/` stays no-JS-safe. This asymmetry is stated honestly in the README, like Next's.
import { exportSite } from "@tjakoen/batch/export/export.ts";
import { join } from "node:path";
import { readPosts } from "../content.ts";

const PORT = Number(Bun.env.EXPORT_PORT ?? 3404);
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
    moduleEntries: ["/modules/app/dpu.js"],
    assets: [{ prefix: "/styles", dir: join(ROOT, "styles") }],
    log: (m) => console.log(m),
  });
} finally {
  server.kill();
}
