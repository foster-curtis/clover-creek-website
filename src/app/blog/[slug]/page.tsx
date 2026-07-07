import { marked } from "marked";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/data";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  return { title: post.title, description: post.excerpt ?? undefined };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const html = await marked.parse(post.body);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/blog" className="text-sm text-moss underline">
        ← Area Guide
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-stone-800">{post.title}</h1>
      {post.publishedAt && (
        <time className="text-sm text-stone-400">
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
