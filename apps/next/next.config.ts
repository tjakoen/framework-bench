// apps/next/next.config.ts — no config overrides. Deliberately NOT `output: "export"`: the index page
// ships a "use client" filter component, so this target is not pure SSG. Served via `next build && next
// start` (see README for the honest asymmetry note vs. the buildless native target).
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
