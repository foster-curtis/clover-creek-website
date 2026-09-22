import { notFound } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/Heading";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { savePost } from "../../actions";

export const dynamic = "force-dynamic";

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
      <PageTitle>{post ? "Edit post" : "New post"}</PageTitle>
      <form action={savePost}>
        <Card variant="flat" className="mt-6 space-y-4 p-5">
          {post && <input type="hidden" name="id" value={post.id} />}
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" required defaultValue={post?.title ?? ""} />
          </Field>
          <Field label="URL slug" hint="leave blank to generate from the title" htmlFor="slug">
            <Input id="slug" name="slug" defaultValue={post?.slug ?? ""} />
          </Field>
          <Field
            label="Excerpt"
            hint="one or two sentences for the list page and Google"
            htmlFor="excerpt"
          >
            <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} />
          </Field>
          <Field
            label="Body"
            hint="Markdown: ## headings, **bold**, - lists, [links](https://…)"
            htmlFor="body"
          >
            <Textarea
              id="body"
              name="body"
              required
              rows={18}
              defaultValue={post?.body ?? ""}
              className="font-mono"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="published" defaultChecked={post?.published ?? false} />
            Published (visible on the site)
          </label>
          <div className="text-right">
            <Button type="submit">Save post</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
