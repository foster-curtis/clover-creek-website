import { CONTENT_SLUGS, getSiteContent } from "@/lib/content";
import { saveContent } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const content = await getSiteContent();

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800">Site Content</h1>
      <p className="mt-1 text-sm text-stone-500">
        Edit the descriptive text shown on the website. Titles, buttons and navigation are fixed
        by design.
      </p>

      <div className="mt-6 space-y-6">
        {CONTENT_SLUGS.map(({ slug, label, hint }) => (
          <form key={slug} action={saveContent} className="rounded-xl border border-stone-200 bg-white p-5">
            <input type="hidden" name="slug" value={slug} />
            <h2 className="font-bold text-stone-800">{label}</h2>
            <p className="mt-0.5 text-xs text-stone-400">{hint}</p>
            <textarea
              name="content"
              defaultValue={content[slug]}
              rows={slug === "amenities" ? 12 : 7}
              className="mt-3 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none"
            />
            <div className="mt-3 text-right">
              <button
                type="submit"
                className="rounded-full bg-moss px-5 py-2 text-sm font-semibold text-white hover:bg-moss-dark"
              >
                Save
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
