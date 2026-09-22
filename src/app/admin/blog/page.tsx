import Link from "next/link";
import Button, { buttonClasses } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/Heading";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { deletePost } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  if (!hasServiceRole()) {
    return <p className="text-ink-muted">Set SUPABASE_SERVICE_ROLE_KEY to manage the blog.</p>;
  }
  const db = supabaseAdmin();
  const { data: posts } = await db
    .from("blog_posts")
    .select("id, slug, title, published, published_at, created_at")
    .order("created_at", { ascending: false });

  const drafts = (posts ?? []).filter((post) => !post.published);
  const published = (posts ?? []).filter((post) => post.published);

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageTitle>Blog / Area Guide</PageTitle>
        <Link href="/admin/blog/new" className={buttonClasses("primary", "md")}>
          New post
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Posts about the area help people find the site on Google — stargazing, trails, day
        trips, family reunion ideas.
      </p>

      {(posts ?? []).length === 0 && (
        <p className="mt-6 text-sm text-ink-subtle">No posts yet — write the first one!</p>
      )}

      {drafts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Drafts <span className="text-ink-subtle">({drafts.length})</span>
          </h2>
          <div className="mt-3 space-y-2">
            {drafts.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {published.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Published <span className="text-ink-subtle">({published.length})</span>
          </h2>
          <div className="mt-3 space-y-2">
            {published.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PostRow({
  post,
}: {
  post: { id: string; slug: string; title: string; published: boolean };
}) {
  return (
    <Card variant="flat" className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold " +
            (post.published ? "bg-moss/10 text-moss-dark" : "bg-hay/20 text-ink-muted")
          }
        >
          {post.published ? "Published" : "Draft"}
        </span>
        <div>
          <Link href={`/admin/blog/${post.id}`} className="font-semibold text-ink hover:text-moss">
            {post.title}
          </Link>
          {post.published && <p className="text-xs text-ink-subtle">/blog/{post.slug}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/admin/blog/${post.id}`} className={buttonClasses("secondary", "sm")}>
          Edit
        </Link>
        <form action={deletePost}>
          <input type="hidden" name="id" value={post.id} />
          <Button type="submit" variant="danger" size="sm">
            Delete
          </Button>
        </form>
      </div>
    </Card>
  );
}
