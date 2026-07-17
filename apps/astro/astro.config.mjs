// apps/astro/astro.config.mjs — static output; `site` is set so canonical/og:url are absolute (the
// auditor only checks canonical exists + has an href, but absolute URLs tie native's `url.origin`
// behavior as closely as a static build can).
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "http://localhost:4321",
  output: "static",
});
