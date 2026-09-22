import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/Heading";
import { CONTENT_SLUGS, getSiteContent } from "@/lib/content";
import { saveContent } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const content = await getSiteContent();

  return (
    <div>
      <PageTitle>Site Content</PageTitle>
      <p className="mt-1 text-sm text-ink-muted">
        Edit the descriptive text shown on the website. Titles, buttons and navigation are fixed
        by design.
      </p>

      <div className="mt-6 space-y-6">
        {CONTENT_SLUGS.map(({ slug, label, hint }) => (
          <form key={slug} action={saveContent}>
            <Card variant="flat" className="p-5">
              <input type="hidden" name="slug" value={slug} />
              <h2 className="font-bold text-ink">{label}</h2>
              <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>
              <Textarea
                name="content"
                defaultValue={content[slug]}
                rows={slug === "amenities" ? 12 : 7}
                className="mt-3"
              />
              <div className="mt-3 text-right">
                <Button type="submit">Save</Button>
              </div>
            </Card>
          </form>
        ))}
      </div>
    </div>
  );
}
