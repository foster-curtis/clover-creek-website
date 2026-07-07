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

      <div className="mt-6 space-y-2">
        {(posts ?? []).length === 0 && (
          <p className="text-sm text-stone-400">No posts yet — write the first one!</p>
        )}
        {(posts ?? []).map((post) => (
          <div
            key={post.id}
            className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4"
          >
            <div>
              <Link href={`/admin/blog/${post.id}`} className="font-semibold text-stone-800 hover:text-moss">
                {post.title}
              </Link>
              <p className="text-xs text-stone-400">
                {post.published ? `Published · /blog/${post.slug}` : "Draft"}
              </p>
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
        ))}
      </div>
    </div>
  );
}
