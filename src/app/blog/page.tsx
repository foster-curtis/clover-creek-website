import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/Heading";
import { ArrowRightIcon } from "@/components/ui/icons";
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
      <PageTitle>Area Guide</PageTitle>
      <p className="mt-2 text-stone-600">
        Ideas for your stay — from stargazing to day trips around Rush Valley.
      </p>
      <div className="mt-8 space-y-4">
        {posts.length === 0 && (
          <Card variant="flat">
            <p className="text-ink-muted">Posts are coming soon — check back for local tips and trip ideas.</p>
          </Card>
        )}
        {posts.map((post) => (
          <Card key={post.id} variant="flat">
            <h2 className="text-xl font-bold">
              <Link href={`/blog/${post.slug}`} className="text-stone-800 hover:text-moss">
                {post.title}
              </Link>
            </h2>
            {post.publishedAt && (
              <time className="text-xs text-ink-subtle">
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            )}
            {post.excerpt && <p className="mt-2 text-stone-600">{post.excerpt}</p>}
            <Link
              href={`/blog/${post.slug}`}
              className="mt-3 inline-flex items-center gap-1 text-sm text-moss underline"
            >
              Read more <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
