// apps/next/lib/content.ts — read the ONE shared content/ dir (../../content), mirroring
// apps/native/content.ts. Same bytes every target reads; nothing here is app-specific but the reading.
// No markdown parser: bodies are already HTML. Read via node:fs at request/build time — cwd during
// `next build` / `next start` / `next dev` is apps/next.
import { readFile } from "node:fs/promises";
import path from "node:path";

const CONTENT = path.join(process.cwd(), "../../content");

export interface Post {
  slug: string;
  title: string;
  date: string;
  tag: string;
  excerpt: string;
}
export interface Tag {
  id: string;
  label: string;
}

/** Metadata for every post, newest-first (the file is authored in that order). */
export async function readPosts(): Promise<Post[]> {
  const raw = await readFile(path.join(CONTENT, "posts.json"), "utf8");
  return JSON.parse(raw) as Post[];
}

/** The fixed tag set that drives the filter chips — same order on every target. */
export async function readTags(): Promise<Tag[]> {
  const raw = await readFile(path.join(CONTENT, "tags.json"), "utf8");
  return JSON.parse(raw) as Tag[];
}

/** A post's body fragment: semantic HTML only, no <h1> (the page renders that from `title`). */
export async function readBody(slug: string): Promise<string> {
  return readFile(path.join(CONTENT, "posts", `${slug}.html`), "utf8");
}
