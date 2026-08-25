import Link from "next/link";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { deletePost } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  if (!hasServiceRole()) {
    return <p className="text-stone-600">Set SUPABASE_SERVICE_ROLE_KEY to manage the blog.</p>;
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
        <h1 className="text-2xl font-bold text-stone-800">Blog / Area Guide</h1>
        <Link
          href="/admin/blog/new"
          className="rounded-full bg-moss px-5 py-2 text-sm font-semibold text-white hover:bg-moss-dark"
        >
          New post
        </Link>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Posts about the area help people find the site on Google — stargazing, trails, day
        trips, family reunion ideas.
      </p>

      {(posts ?? []).length === 0 && (
        <p className="mt-6 text-sm text-stone-400">No posts yet — write the first one!</p>
      )}

      {drafts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Drafts <span className="text-stone-400">({drafts.length})</span>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Published <span className="text-stone-400">({published.length})</span>
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
    <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold " +
            (post.published ? "bg-moss/10 text-moss-dark" : "bg-hay/20 text-stone-600")
          }
        >
          {post.published ? "Published" : "Draft"}
        </span>
        <div>
          <Link href={`/admin/blog/${post.id}`} className="font-semibold text-stone-800 hover:text-moss">
            {post.title}
          </Link>
          {post.published && <p className="text-xs text-stone-400">/blog/{post.slug}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/blog/${post.id}`}
          className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:border-moss hover:text-moss"
        >
          Edit
        </Link>
        <form action={deletePost}>
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs text-red-600">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
