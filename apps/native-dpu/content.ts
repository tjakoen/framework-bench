// apps/native/content.ts — read the ONE shared content/ dir (../../content). Same bytes every target
// reads; nothing here is app-specific but the reading. No markdown parser: bodies are already HTML.
import { join } from "node:path";

const CONTENT = join(import.meta.dir, "..", "..", "content");

export interface Post { slug: string; title: string; date: string; tag: string; excerpt: string; }
export interface Tag { id: string; label: string; }

/** Metadata for every post, newest-first (the file is authored in that order). */
export const readPosts = (): Promise<Post[]> => Bun.file(join(CONTENT, "posts.json")).json();
/** The fixed tag set that drives the filter chips — same order on every target. */
export const readTags = (): Promise<Tag[]> => Bun.file(join(CONTENT, "tags.json")).json();
/** A post's body fragment: semantic HTML only, no <h1> (the page renders that from `title`). */
export const readBody = (slug: string): Promise<string> => Bun.file(join(CONTENT, "posts", `${slug}.html`)).text();
