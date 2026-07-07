import { notFound } from "next/navigation";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { savePost } from "../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 block w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none";

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!hasServiceRole()) notFound();

  let post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body: string;
    published: boolean;
  } | null = null;

  if (id !== "new") {
    const { data } = await supabaseAdmin()
      .from("blog_posts")
      .select("id, title, slug, excerpt, body, published")
      .eq("id", id)
      .single();
    if (!data) notFound();
    post = data;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800">{post ? "Edit post" : "New post"}</h1>
      <form action={savePost} className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        {post && <input type="hidden" name="id" value={post.id} />}
        <label className="block text-sm text-stone-700">
          Title
          <input name="title" required defaultValue={post?.title ?? ""} className={inputCls} />
        </label>
        <label className="block text-sm text-stone-700">
          URL slug <span className="text-xs text-stone-400">(leave blank to generate from the title)</span>
          <input name="slug" defaultValue={post?.slug ?? ""} className={inputCls} />
        </label>
        <label className="block text-sm text-stone-700">
          Excerpt <span className="text-xs text-stone-400">(one or two sentences for the list page and Google)</span>
          <textarea name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} className={inputCls} />
        </label>
        <label className="block text-sm text-stone-700">
          Body <span className="text-xs text-stone-400">(Markdown: ## headings, **bold**, - lists, [links](https://…))</span>
          <textarea name="body" required rows={18} defaultValue={post?.body ?? ""} className={inputCls + " font-mono"} />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="published" defaultChecked={post?.published ?? false} />
          Published (visible on the site)
        </label>
        <div className="text-right">
          <button
            type="submit"
            className="rounded-full bg-moss px-6 py-2.5 text-sm font-semibold text-white hover:bg-moss-dark"
          >
            Save post
          </button>
        </div>
      </form>
    </div>
  );
}
