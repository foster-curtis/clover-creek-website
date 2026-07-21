"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function GalleryUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function uploadFiles(fileList: File[]) {
    const files = fileList.filter((f) => ACCEPTED_TYPES.includes(f.type));
    const skipped = fileList.length - files.length;
    if (files.length === 0) {
      setStatus(
        skipped > 0 ? "Those files aren't JPEG, PNG or WebP images." : null
      );
      return;
    }

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

    const skippedNote = skipped > 0 ? ` (${skipped} non-image file${skipped === 1 ? "" : "s"} skipped)` : "";
    setStatus(`Uploaded ${uploaded} photo${uploaded === 1 ? "" : "s"}.${skippedNote}`);
    setBusy(false);
    router.refresh();
  }

  async function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    await uploadFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!busy) setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    // Ignore leaves into child elements; only reset when leaving the zone itself.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragging(false);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    await uploadFiles(Array.from(e.dataTransfer.files ?? []));
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !busy) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        dragging ? "border-moss bg-moss/10" : "border-stone-300 bg-white hover:border-moss/60"
      } ${busy ? "cursor-wait opacity-80" : ""}`}
    >
      <span className="inline-block rounded-full bg-moss px-5 py-2.5 font-semibold text-white hover:bg-moss-dark">
        {busy ? "Uploading…" : "Choose photos to upload"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        disabled={busy}
        onChange={onInputChange}
        className="hidden"
      />
      <p className="mt-3 text-xs text-stone-500">
        {dragging
          ? "Drop your photos to upload"
          : "Drag photos here, or click to choose. JPEG, PNG or WebP — several at once is fine."}
      </p>
      {status && <p className="mt-2 text-sm text-stone-600">{status}</p>}
    </div>
  );
}
