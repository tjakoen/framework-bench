// apps/astro/src/content.ts — read the ONE shared content/ dir (../../content, two up from the astro
// app root). Astro frontmatter runs in Node at build time, so this is plain node:fs — no markdown
// parser, bodies are already HTML fragments, same contract as native/content.ts.
//
// NOTE: this is anchored on process.cwd() rather than import.meta.url. Vite bundles/relocates this
// module's compiled output under dist/ during `astro build`, so a path built from import.meta.url would
// resolve relative to the emitted file's location, not the source — it 404s at build time. cwd is
// stable (apps/astro) across `astro dev` / `astro build` / `astro preview` run via the package scripts.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT = join(process.cwd(), "..", "..", "content");

export interface Post { slug: string; title: string; date: string; tag: string; excerpt: string; }
export interface Tag { id: string; label: string; }

/** Metadata for every post, newest-first (the file is authored in that order). */
export const readPosts = (): Post[] => JSON.parse(readFileSync(join(CONTENT, "posts.json"), "utf-8"));
/** The fixed tag set that drives the filter chips — same order on every target. */
export const readTags = (): Tag[] => JSON.parse(readFileSync(join(CONTENT, "tags.json"), "utf-8"));
/** A post's body fragment: semantic HTML only, no <h1> (the page renders that from `title`). */
export const readBody = (slug: string): string => readFileSync(join(CONTENT, "posts", `${slug}.html`), "utf-8");
