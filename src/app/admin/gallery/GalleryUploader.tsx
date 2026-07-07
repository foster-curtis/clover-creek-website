"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function GalleryUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    const supabase = supabaseBrowser();
    let uploaded = 0;

    for (const file of files) {
      setStatus(`Uploading ${uploaded + 1} of ${files.length}…`);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("gallery").upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
      });
      if (uploadError) {
        setStatus(`Failed to upload ${file.name}: ${uploadError.message}`);
        setBusy(false);
        return;
      }
      const { error: insertError } = await supabase.from("gallery_images").insert({
        storage_path: path,
        sort_order: 100 + uploaded,
      });
      if (insertError) {
        setStatus(`Uploaded ${file.name} but failed to register it: ${insertError.message}`);
        setBusy(false);
        return;
      }
      uploaded++;
    }

    setStatus(`Uploaded ${uploaded} photo${uploaded === 1 ? "" : "s"}.`);
    setBusy(false);
    e.target.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-stone-300 bg-white p-6 text-center">
      <label className="cursor-pointer">
        <span className="rounded-full bg-moss px-5 py-2.5 font-semibold text-white hover:bg-moss-dark">
          {busy ? "Uploading…" : "Choose photos to upload"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={onFiles}
          className="hidden"
        />
      </label>
      <p className="mt-3 text-xs text-stone-500">JPEG, PNG or WebP. You can select several at once.</p>
      {status && <p className="mt-2 text-sm text-stone-600">{status}</p>}
    </div>
  );
}
