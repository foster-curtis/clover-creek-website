import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { PageTitle } from "@/components/ui/Heading";
import { getPost, getPublishedPosts } from "@/lib/data";
import { blogPostingSchema } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ slug: string }>;
}

// Posts are MDX compiled into the build, so every slug is known up front.
export async function generateStaticParams() {
  return (await getPublishedPosts()).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  // A 404-shaped page should never be indexed.
  if (!post) return { title: "Post not found", robots: { index: false, follow: false } };
  return pageMetadata({
    path: `/blog/${slug}`,
    title: post.title,
    description: post.excerpt,
    // A shared post uses its own photo when it has one.
    image: post.cover?.src.src,
    type: "article",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const { Content } = post;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={blogPostingSchema(post)} />
      <Breadcrumbs crumbs={[{ name: "Area Guide", path: "/blog" }, { name: post.title }]} />
      {post.cover && (
        // The LCP element whenever it's present.
        <Image
          src={post.cover.src}
          alt={post.cover.alt}
          priority
          placeholder="blur"
          sizes="(min-width: 768px) 720px, 100vw"
          className="mb-6 w-full rounded-xl"
        />
      )}
      <PageTitle>{post.title}</PageTitle>
      <p className="text-sm text-ink-subtle">
        <time dateTime={post.publishedAt}>
          {/* publishedAt is a bare date; read it as UTC or it slips a day west of Greenwich. */}
          {new Date(post.publishedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
        </time>
        {/* Only ever a real byline from the post's meta (§12.4). Stage 08 links the
            owner's name to /about once SITE.owner exists. */}
        {post.author && <> · By {post.author}</>}
      </p>
      <div className="prose-simple mt-6">
        <Content />
      </div>
    </article>
  );
}
