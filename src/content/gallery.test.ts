// Guardrails for the committed photo set.
//
// The gallery used to live in Supabase, where a bad row was a runtime problem.
// Now it is files plus a manifest, so the same mistakes are catchable here: a
// photo whose file never got committed, a width copied from the wrong entry,
// alt text quietly dropped, or copy that drifted from what the live site showed
// before the migration.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { GALLERY, type GalleryRole, HOME_STRIP_IDS, homeStripPhotos } from "./gallery";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const GALLERY_DIR = path.join(PUBLIC_DIR, "gallery");

interface ExportRow {
  storage_path: string;
  caption: string;
  alt: string;
  sort_order: number;
}

const exported: ExportRow[] = JSON.parse(
  readFileSync(path.join(process.cwd(), "docs", "gallery-export.json"), "utf8")
).rows;

const renameMap: Record<string, string> = JSON.parse(
  readFileSync(path.join(process.cwd(), "docs", "gallery-rename-map.json"), "utf8")
).map;

/** Manifest order is what the pages render in, so assert against that, not source order. */
const ordered = [...GALLERY].sort((a, b) => a.order - b.order);

const fileFor = (src: string) => path.join(PUBLIC_DIR, src.replace(/^\//, ""));

describe("gallery manifest", () => {
  it("has a file on disk for every entry", () => {
    const missing = GALLERY.filter((p) => !existsSync(fileFor(p.src))).map((p) => p.src);
    expect(missing).toEqual([]);
  });

  it("names each file after its id", () => {
    for (const photo of GALLERY) {
      expect(photo.src).toBe(`/gallery/${photo.id}.jpg`);
    }
  });

  it("uses ids that are unique and URL-safe", () => {
    const ids = GALLERY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("gives every photo a distinct order", () => {
    const orders = GALLERY.map((p) => p.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("declares the true intrinsic size of each file", async () => {
    const wrong: string[] = [];
    for (const photo of GALLERY) {
      const meta = await sharp(fileFor(photo.src)).metadata();
      if (meta.width !== photo.width || meta.height !== photo.height) {
        wrong.push(
          `${photo.id}: manifest says ${photo.width}x${photo.height}, file is ${meta.width}x${meta.height}`
        );
      }
    }
    expect(wrong).toEqual([]);
  });

  it("has alt text on every photo, empty only when deliberately decorative", () => {
    for (const photo of GALLERY) {
      if (photo.decorative) {
        // A decorative photo says nothing to a screen reader on purpose.
        expect(photo.alt, `${photo.id} is decorative so alt must be empty`).toBe("");
      } else {
        expect(photo.alt.trim(), `${photo.id} has no alt text`).not.toBe("");
      }
    }
  });

  it("keeps captions distinct from alt text", () => {
    for (const photo of GALLERY) {
      expect(photo.caption.trim(), `${photo.id} has no caption`).not.toBe("");
      // Alt describes the picture for someone who cannot see it; the caption is
      // read by everyone. Making one a copy of the other wastes both.
      expect(photo.caption, `${photo.id} caption duplicates its alt text`).not.toBe(photo.alt);
    }
  });

  it("ships a blur placeholder for every photo", () => {
    for (const photo of GALLERY) {
      expect(photo.blurDataURL, `${photo.id}`).toMatch(/^data:image\/jpeg;base64,/);
      // These are inlined into the HTML — a big one is a page-weight regression.
      expect(photo.blurDataURL.length, `${photo.id} blurDataURL is oversized`).toBeLessThan(2000);
    }
  });

  it("fills each home page role exactly once", () => {
    for (const role of ["hero", "amenities"] satisfies GalleryRole[]) {
      expect(GALLERY.filter((p) => p.role === role), `role "${role}"`).toHaveLength(1);
    }
  });

  it("resolves every photo in the home page strip", () => {
    expect(homeStripPhotos().map((p) => p.id)).toEqual([...HOME_STRIP_IDS]);
  });

  it("keeps the home page strip free of repeats", () => {
    // The strip sits on the same page as the hero and the amenities photo, so a
    // repeat there would show the same picture twice within one scroll.
    const onPage = [
      ...HOME_STRIP_IDS,
      ...GALLERY.filter((p) => p.role).map((p) => p.id),
    ];
    expect(new Set(onPage).size, onPage.join(", ")).toBe(onPage.length);
  });

  it("leaves no unreferenced files in public/gallery", () => {
    const referenced = new Set(GALLERY.map((p) => `${p.id}.jpg`));
    const orphans = readdirSync(GALLERY_DIR).filter((name) => !referenced.has(name));
    expect(orphans).toEqual([]);
  });

  it("carries no EXIF, ICC or XMP metadata", async () => {
    // These are photos of the owner's home in a public repo. Nothing rides along.
    const leaking: string[] = [];
    for (const photo of GALLERY) {
      const meta = await sharp(fileFor(photo.src)).metadata();
      if (meta.exif) leaking.push(`${photo.id}: EXIF`);
      if (meta.icc) leaking.push(`${photo.id}: ICC`);
      if (meta.xmp) leaking.push(`${photo.id}: XMP`);
      if (meta.iptc) leaking.push(`${photo.id}: IPTC`);
    }
    expect(leaking).toEqual([]);
  });
});

describe("parity with the retired Supabase gallery", () => {
  it("carries the same number of photos", () => {
    expect(ordered).toHaveLength(exported.length);
    expect(ordered).toHaveLength(15);
  });

  it("keeps the same photos in the same order, with copy transferred byte for byte", () => {
    const expectedRows = [...exported].sort((a, b) => a.sort_order - b.sort_order);
    const diffs: string[] = [];

    expectedRows.forEach((row, i) => {
      const photo = ordered[i];
      const slug = renameMap[row.storage_path];
      if (!slug) {
        diffs.push(`position ${i}: ${row.storage_path} is missing from docs/gallery-rename-map.json`);
        return;
      }
      if (!photo) {
        diffs.push(`position ${i}: expected "${slug}", manifest has nothing`);
        return;
      }
      if (photo.id !== slug) diffs.push(`position ${i}: expected "${slug}", got "${photo.id}"`);
      if (photo.order !== row.sort_order) {
        diffs.push(`${photo.id}: order ${photo.order} != exported sort_order ${row.sort_order}`);
      }
      if (photo.alt !== row.alt) {
        diffs.push(`${photo.id} alt:\n    export:   ${JSON.stringify(row.alt)}\n    manifest: ${JSON.stringify(photo.alt)}`);
      }
      if (photo.caption !== row.caption) {
        diffs.push(`${photo.id} caption:\n    export:   ${JSON.stringify(row.caption)}\n    manifest: ${JSON.stringify(photo.caption)}`);
      }
    });

    if (diffs.length > 0) console.error(`Gallery parity diff:\n  ${diffs.join("\n  ")}`);
    expect(diffs).toEqual([]);
  });

  it("maps every retired bucket object to exactly one repo file", () => {
    const slugs = Object.values(renameMap);
    expect(new Set(slugs).size, "rename map is not 1:1").toBe(slugs.length);
    expect(new Set(slugs)).toEqual(new Set(GALLERY.map((p) => p.id)));
  });
});

describe("fixed public images", () => {
  it("keeps the social card at exactly 1200x630 with no metadata", async () => {
    // src/lib/seo.ts advertises these dimensions in Open Graph tags, so the file
    // has to actually have them.
    const meta = await sharp(path.join(PUBLIC_DIR, "og-default.jpg")).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });

  it("uses only lowercase ASCII names for served images", () => {
    // Windows and macOS are case-insensitive; Vercel's Linux build is not. A file
    // named .JPG that something references as .jpg 404s in production only.
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(dir, entry.name))
          : [path.relative(PUBLIC_DIR, path.join(dir, entry.name))]
      );
    const bad = walk(PUBLIC_DIR).filter((rel) => rel !== rel.toLowerCase());
    expect(bad).toEqual([]);
  });
});
