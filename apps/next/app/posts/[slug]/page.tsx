// apps/next/app/posts/[slug]/page.tsx — detail: one post, mirroring apps/native/views.ts `renderPost`
// exactly (and apps/astro/src/pages/posts/[slug].astro). All 10 slugs are enumerated via
// generateStaticParams so every post prerenders at build time. This route ships NO client JS of its own
// — only the index page's <Filter/> component does, so /posts/:slug is the "pure SSG" half of this target.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPosts, readBody } from "../../../lib/content";
import { ORIGIN, fmtDate } from "../../../lib/site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** All 10 slugs, so `next build` prerenders every post (incl. the-browser-grew-up). */
export async function generateStaticParams() {
  const posts = await readPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const posts = await readPosts();
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};

  const title = `${post.title} · Framework Bench`;
  const canonicalPath = `/posts/${post.slug}`;

  return {
    title,
    description: post.excerpt,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      title,
      description: post.excerpt,
      url: canonicalPath,
    },
    twitter: {
      card: "summary",
      title,
      description: post.excerpt,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const posts = await readPosts();
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const bodyHtml = await readBody(post.slug);
  const canonicalPath = `/posts/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    keywords: post.tag,
    url: `${ORIGIN}${canonicalPath}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="wrap">
        <a className="back" href="/">
          ← all posts
        </a>
        <article className="post">
          <span className={`tag tag--${post.tag}`}>{post.tag}</span>
          <h1 className="post-title">{post.title}</h1>
          <time dateTime={post.date}>{fmtDate(post.date)}</time>
          {/* eslint-disable-next-line react/no-danger */}
          <div className="post-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>
      </main>
    </>
  );
}
