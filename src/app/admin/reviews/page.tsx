import Stars from "@/components/Stars";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { deleteReview, importReview, setReviewApproval } from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 block rounded border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-moss focus:outline-none";
const smallBtnCls =
  "rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:border-moss hover:text-moss";

export default async function AdminReviewsPage() {
  if (!hasServiceRole()) {
    return <p className="text-stone-600">Set SUPABASE_SERVICE_ROLE_KEY to manage reviews.</p>;
  }
  const db = supabaseAdmin();
  const { data: reviews } = await db
    .from("reviews")
    .select("id, author_name, rating, body, verified, approved, stayed_on, created_at")
    .order("approved")
    .order("created_at", { ascending: false });

  const pending = (reviews ?? []).filter((r) => !r.approved);
  const approved = (reviews ?? []).filter((r) => r.approved);

  function ReviewCard({ r }: { r: NonNullable<typeof reviews>[number] }) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-stone-800">
            {r.author_name}
            {r.verified && (
              <span className="ml-2 rounded-full bg-moss/10 px-2 py-0.5 text-xs font-normal text-moss-dark">
                ✓ Verified stay
              </span>
            )}
          </p>
          <Stars rating={r.rating} />
        </div>
        <p className="mt-2 text-sm text-stone-600">{r.body}</p>
        <div className="mt-3 flex gap-2">
          <form action={setReviewApproval}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="approved" value={r.approved ? "false" : "true"} />
            <button type="submit" className={smallBtnCls}>
              {r.approved ? "Hide from site" : "Approve & publish"}
            </button>
          </form>
          <form action={deleteReview}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className={smallBtnCls + " text-red-600"}>Delete</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800">Reviews</h1>

      <h2 className="mt-6 text-lg font-bold text-stone-800">
        Awaiting approval {pending.length > 0 && `(${pending.length})`}
      </h2>
      <div className="mt-3 space-y-3">
        {pending.length === 0 && <p className="text-sm text-stone-400">Nothing waiting — nice.</p>}
        {pending.map((r) => <ReviewCard key={r.id} r={r} />)}
      </div>

      <h2 className="mt-8 text-lg font-bold text-stone-800">Published ({approved.length})</h2>
      <div className="mt-3 space-y-3">
        {approved.map((r) => <ReviewCard key={r.id} r={r} />)}
      </div>

      <section className="mt-10 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-bold text-stone-800">Import a past review</h2>
        <p className="mt-1 text-xs text-stone-400">
          For reviews from DirectStay/Google Drive. They publish immediately.
        </p>
        <form action={importReview} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-stone-500">
              Guest name
              <input name="authorName" required className={inputCls} />
            </label>
            <label className="text-xs text-stone-500">
              Rating (1–5)
              <input type="number" name="rating" min={1} max={5} defaultValue={5} required className={inputCls + " w-20"} />
            </label>
            <label className="text-xs text-stone-500">
              Stay date (optional)
              <input type="date" name="stayedOn" className={inputCls} />
            </label>
          </div>
          <label className="block text-xs text-stone-500">
            Review text
            <textarea name="body" required rows={3} className={inputCls + " w-full"} />
          </label>
          <button
            type="submit"
            className="rounded-full bg-moss px-5 py-2 text-sm font-semibold text-white hover:bg-moss-dark"
          >
            Import review
          </button>
        </form>
      </section>
    </div>
  );
}
