import Stars from "@/components/Stars";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { StarIcon } from "@/components/ui/icons";
import { deleteReview, importReview, setReviewApproval, setReviewFeatured } from "../actions";
import EditReviewForm from "./EditReviewForm";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  if (!hasServiceRole()) {
    return <p className="text-stone-600">Set SUPABASE_SERVICE_ROLE_KEY to manage reviews.</p>;
  }
  const db = supabaseAdmin();
  const { data: reviews } = await db
    .from("reviews")
    .select("id, author_name, rating, body, verified, approved, featured, stayed_on, created_at, user_id")
    .order("approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  const pending = (reviews ?? []).filter((r) => !r.approved);
  const approved = (reviews ?? []).filter((r) => r.approved);

  function ReviewCard({ r }: { r: NonNullable<typeof reviews>[number] }) {
    // Reviews submitted through the site always carry the reviewer's user_id;
    // only owner-imported reviews (no account behind them) can be edited.
    const imported = r.user_id === null;
    return (
      <Card variant="flat" className="p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-stone-800">
            {r.author_name}
            {r.verified && (
              <span className="ml-2 rounded-full bg-moss/10 px-2 py-0.5 text-xs font-normal text-moss-dark">
                ✓ Verified stay
              </span>
            )}
            {imported && (
              <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-ink-muted">
                Imported
              </span>
            )}
            {r.featured && (
              <span className="ml-2 rounded-full bg-hay/20 px-2 py-0.5 text-xs font-normal text-stone-600">
                ★ Featured
              </span>
            )}
          </p>
          <Stars rating={r.rating} />
        </div>
        <p className="mt-2 text-sm text-stone-600">{r.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={setReviewApproval}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="approved" value={r.approved ? "false" : "true"} />
            <Button type="submit" variant={r.approved ? "secondary" : "primary"} size="sm">
              {r.approved ? "Hide from site" : "Approve & publish"}
            </Button>
          </form>
          <form action={setReviewFeatured}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="featured" value={r.featured ? "false" : "true"} />
            <Button type="submit" variant="secondary" size="sm">
              {r.featured ? (
                "Unfeature"
              ) : (
                <>
                  <StarIcon className="h-3 w-3" /> Feature
                </>
              )}
            </Button>
          </form>
          {imported && (
            <EditReviewForm
              review={{
                id: r.id,
                author_name: r.author_name,
                rating: r.rating,
                stayed_on: r.stayed_on,
                body: r.body,
              }}
            />
          )}
          <form action={deleteReview}>
            <input type="hidden" name="id" value={r.id} />
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <PageTitle>Reviews</PageTitle>

      <SectionTitle as="h2" className="mt-6 text-lg">
        Awaiting approval {pending.length > 0 && `(${pending.length})`}
      </SectionTitle>
      <div className="mt-3 space-y-3">
        {pending.length === 0 && <p className="text-sm text-ink-subtle">Nothing waiting — nice.</p>}
        {pending.map((r) => <ReviewCard key={r.id} r={r} />)}
      </div>

      <SectionTitle as="h2" className="mt-8 text-lg">
        Published ({approved.length})
      </SectionTitle>
      <div className="mt-3 space-y-3">
        {approved.map((r) => <ReviewCard key={r.id} r={r} />)}
      </div>

      <Card variant="flat" className="mt-10 p-5">
        <SectionTitle as="h2" className="text-lg">
          Import a past review
        </SectionTitle>
        <p className="mt-1 text-xs text-ink-subtle">
          For reviews from DirectStay/Google Drive. They publish immediately.
        </p>
        <form action={importReview} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <Field label="Guest name" htmlFor="authorName">
              <Input id="authorName" name="authorName" required />
            </Field>
            <Field label="Rating (1–5)" htmlFor="rating">
              <Input id="rating" type="number" name="rating" min={1} max={5} defaultValue={5} required className="w-20" />
            </Field>
            <Field label="Stay date (optional)" htmlFor="stayedOn">
              <Input id="stayedOn" type="date" name="stayedOn" />
            </Field>
          </div>
          <Field label="Review text" htmlFor="body">
            <Textarea id="body" name="body" required rows={3} className="w-full" />
          </Field>
          <Button type="submit">Import review</Button>
        </form>
      </Card>
    </div>
  );
}

