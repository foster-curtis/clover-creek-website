import Image from "next/image";
import { galleryPublicUrl } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/Heading";
import { deleteGalleryImage, updateGalleryImage } from "../actions";
import GalleryUploader from "./GalleryUploader";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const supabase = await supabaseServer();
  const { data: images } = await supabase
    .from("gallery_images")
    .select("id, storage_path, caption, alt, sort_order")
    .order("sort_order");

  return (
    <div>
      <PageTitle>Gallery</PageTitle>
      <p className="mt-1 text-sm text-ink-muted">
        Photos appear on the home page and gallery in the order below (lowest number first). Tip:
        resize photos to ~2000px wide before uploading for faster pages.
      </p>

      <div className="mt-6">
        <GalleryUploader />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(images ?? []).map((img) => (
          <Card key={img.id} variant="flat" className="p-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-sunken">
              <Image
                src={galleryPublicUrl(img.storage_path)}
                alt={img.alt ?? ""}
                fill
                sizes="33vw"
                className="object-cover"
              />
            </div>
            <form action={updateGalleryImage} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={img.id} />
              <Input
                name="caption"
                defaultValue={img.caption ?? ""}
                placeholder="Caption"
                className="w-full"
              />
              <Input
                name="alt"
                defaultValue={img.alt ?? ""}
                placeholder="Alt text (describe the photo)"
                className="w-full"
              />
              <div className="flex items-end justify-between gap-2">
                <Field label="Order" htmlFor={`sort-${img.id}`} className="w-20">
                  <Input
                    id={`sort-${img.id}`}
                    type="number"
                    name="sortOrder"
                    defaultValue={img.sort_order}
                  />
                </Field>
                <Button type="submit" size="sm">
                  Save
                </Button>
              </div>
            </form>
            <form action={deleteGalleryImage} className="mt-2 text-right">
              <input type="hidden" name="id" value={img.id} />
              <input type="hidden" name="storagePath" value={img.storage_path} />
              <Button type="submit" variant="danger" size="sm">
                Delete photo
              </Button>
            </form>
          </Card>
        ))}
        {(images ?? []).length === 0 && (
          <p className="text-sm text-ink-muted sm:col-span-2 lg:col-span-3">
            No photos yet. The site shows placeholder art until photos are added.
          </p>
        )}
      </div>
    </div>
  );
}
