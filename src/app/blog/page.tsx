import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Area Guide",
  description:
    "Things to do around Rush Valley, Utah — stargazing, trails, day trips and ideas for your stay at the Clover Creek Guest House.",
};

export const revalidate = 300;

export default async function BlogPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-800">Area Guide</h1>
      <p className="mt-2 text-stone-600">
        Ideas for your stay — from stargazing to day trips around Rush Valley.
      </p>
      <div className="mt-8 space-y-4">
        {posts.length === 0 && (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-500">
            Posts are coming soon — check back for local tips and trip ideas.
          </p>
        )}
        {posts.map((post) => (
          <article key={post.id} className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="text-xl font-bold">
              <Link href={`/blog/${post.slug}`} className="text-stone-800 hover:text-moss">
                {post.title}
              </Link>
            </h2>
            {post.publishedAt && (
              <time className="text-xs text-stone-400">
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            )}
            {post.excerpt && <p className="mt-2 text-stone-600">{post.excerpt}</p>}
            <Link href={`/blog/${post.slug}`} className="mt-3 inline-block text-sm text-moss underline">
              Read more →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
