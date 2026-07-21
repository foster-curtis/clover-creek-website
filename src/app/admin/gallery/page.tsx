import Image from "next/image";
import { galleryPublicUrl } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";
import { deleteGalleryImage, updateGalleryImage } from "../actions";
import GalleryUploader from "./GalleryUploader";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded border border-stone-300 bg-white px-2 py-1 text-xs focus:border-moss focus:outline-none";

export default async function AdminGalleryPage() {
  const supabase = await supabaseServer();
  const { data: images } = await supabase
    .from("gallery_images")
    .select("id, storage_path, caption, alt, sort_order")
    .order("sort_order");

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800">Gallery</h1>
      <p className="mt-1 text-sm text-stone-500">
        Photos appear on the home page and gallery in the order below (lowest number first). Tip:
        resize photos to ~2000px wide before uploading for faster pages.
      </p>

      <div className="mt-6">
        <GalleryUploader />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(images ?? []).map((img) => (
          <div key={img.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded bg-stone-100">
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
              <input
                name="caption"
                defaultValue={img.caption ?? ""}
                placeholder="Caption"
                className={inputCls + " w-full"}
              />
              <input
                name="alt"
                defaultValue={img.alt ?? ""}
                placeholder="Alt text (describe the photo)"
                className={inputCls + " w-full"}
              />
              <div className="flex items-center justify-between">
                <label className="text-xs text-stone-500">
                  Order{" "}
                  <input
                    type="number"
                    name="sortOrder"
                    defaultValue={img.sort_order}
                    className={inputCls + " w-16"}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-moss px-3 py-1 text-xs font-semibold text-white hover:bg-moss-dark"
                >
                  Save
                </button>
              </div>
            </form>
            <form action={deleteGalleryImage} className="mt-2 text-right">
              <input type="hidden" name="id" value={img.id} />
              <input type="hidden" name="storagePath" value={img.storage_path} />
              <button type="submit" className="text-xs text-red-600 underline">
                Delete photo
              </button>
            </form>
          </div>
        ))}
        {(images ?? []).length === 0 && (
          <p className="text-sm text-stone-500 sm:col-span-2 lg:col-span-3">
            No photos yet. The site shows placeholder art until photos are added.
          </p>
        )}
      </div>
    </div>
  );
}
