import { marked } from "marked";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/ui/Heading";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { getPost } from "@/lib/data";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  // A 404-shaped page should never be indexed.
  if (!post) return { title: "Post not found", robots: { index: false, follow: false } };
  return pageMetadata({
    path: `/blog/${slug}`,
    title: post.title,
    description: post.excerpt ?? undefined,
    type: "article",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const html = await marked.parse(post.body);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-moss underline">
        <ArrowLeftIcon className="h-3.5 w-3.5" /> Area Guide
      </Link>
      <PageTitle className="mt-4">{post.title}</PageTitle>
      {post.publishedAt && (
        <time className="text-sm text-ink-subtle">
          {new Date(post.publishedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      )}
      {/* Post bodies are authored only by the site admin */}
      <div className="prose-simple mt-6" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
