import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import Card from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/Heading";
import { ArrowRightIcon } from "@/components/ui/icons";
import { getPublishedPosts } from "@/lib/data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/blog",
  title: "Area Guide",
  description:
    "Things to do around Rush Valley, Utah — stargazing, trails, day trips and ideas for your stay at the Clover Creek Guest House.",
});

export default async function BlogPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "Area Guide" }]} />
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
          <Card key={post.slug} variant="flat" className="flex gap-5">
            {/* A fixed box shorter than the text beside it, so a card is the same
                height with or without a cover and the list never reflows on data. */}
            {post.cover && (
              // A duplicate of the title link, so it is hidden from keyboard and
              // screen readers rather than announced twice.
              <Link
                href={`/blog/${post.slug}`}
                className="hidden shrink-0 sm:block"
                tabIndex={-1}
                aria-hidden
              >
                <Image
                  src={post.cover.src}
                  alt=""
                  placeholder="blur"
                  sizes="128px"
                  className="h-24 w-32 rounded-lg object-cover"
                />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">
                <Link href={`/blog/${post.slug}`} className="text-stone-800 hover:text-moss">
                  {post.title}
                </Link>
              </h2>
              <time dateTime={post.publishedAt} className="text-xs text-ink-subtle">
                {/* publishedAt is a bare date; read it as UTC or it slips a day west of Greenwich. */}
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </time>
              <p className="mt-2 text-stone-600">{post.excerpt}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-moss underline"
              >
                Read more <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
