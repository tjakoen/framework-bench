// apps/next/app/page.tsx — index: the post list + the one measured interaction (text filter + tag
// chips). Mirrors apps/native/views.ts `renderIndex` markup exactly. Cards are fully server-rendered
// here; <Filter/> (a client component) only toggles their visibility after hydration.
import type { Metadata } from "next";
import { readPosts, readTags } from "../lib/content";
import { SITE, DESC, ORIGIN, fmtDate } from "../lib/site";
import Filter from "./Filter";

const TITLE = `${SITE} · Framework Bench`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESC,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESC,
  },
};

export default async function IndexPage() {
  const [posts, tags] = await Promise.all([readPosts(), readTags()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: SITE,
    description: DESC,
    url: `${ORIGIN}/`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="wrap">
        <h1 className="page-title">{SITE}</h1>
        <p className="lede">{DESC}</p>
        <form className="filter" role="search">
          <label className="search">
            <span className="visually-hidden">Filter posts by title or excerpt</span>
            <input id="q" type="search" placeholder="Filter posts…" autoComplete="off" />
          </label>
          <div className="chips" role="group" aria-label="Filter by tag">
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                className="chip"
                data-tag={t.id}
                aria-pressed="false"
              >
                {t.label}
              </button>
            ))}
          </div>
        </form>
        <p id="count" className="count" aria-live="polite">
          {posts.length} of {posts.length} posts
        </p>
        <ul className="cards">
          {posts.map((p) => (
            <li
              key={p.slug}
              className="card"
              data-tag={p.tag}
              data-title={p.title}
              data-excerpt={p.excerpt}
            >
              <a className="card-link" href={`/posts/${p.slug}`}>
                <h2 className="card-title">{p.title}</h2>
              </a>
              <p className="excerpt">{p.excerpt}</p>
              <div className="meta">
                <span className={`tag tag--${p.tag}`}>{p.tag}</span>
                <time dateTime={p.date}>{fmtDate(p.date)}</time>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <Filter />
    </>
  );
}
