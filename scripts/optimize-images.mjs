// Build the committed gallery derivatives from full-resolution originals.
//
// Run by hand, never at build time and never imported from src/ — the output is
// checked in, so page weight is decided at commit time rather than per request.
//
//   node scripts/optimize-images.mjs          # write derivatives, print manifest stubs
//   node scripts/optimize-images.mjs --check  # verify only, write nothing (exit 1 on drift)
//
// Workflow for a new photo:
//   1. Put the original in Google Drive (that is the archive — this repo is not).
//   2. Copy it into images-src/ named exactly as you want it on the web:
//      lowercase, hyphenated, ASCII, e.g. front-porch-morning.jpg
//   3. Run this script. It prints a ready-to-paste entry for src/content/gallery.ts.
//   4. Paste it in, add `alt` and `caption`, commit the derivative and the manifest.
//
// The source basename IS the public slug, so the rename map is 1:1 by
// construction; anything that could collide is a hard error below.

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE_DIR = "images-src";
const OUT_DIR = path.join("public", "gallery");

/** Longest edge of a committed derivative. ~2x the widest slot the layout ever gives one. */
const MAX_WIDTH = 2400;
/** Visually indistinguishable from q90 on photographs at a fraction of the bytes. */
const QUALITY = 78;
/** Width of the inline blur preview. Kept tiny — it ships inside the HTML payload. */
const BLUR_WIDTH = 16;

const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The social card is composed by hand (it has title text baked in), so it is only checked. */
const FIXED_ASSETS = [{ file: path.join("public", "og-default.jpg"), width: 1200, height: 630 }];

const checkOnly = process.argv.includes("--check");
const problems = [];

function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function collectSources() {
  let entries;
  try {
    entries = readdirSync(SOURCE_DIR, { withFileTypes: true });
  } catch {
    console.error(
      `No ${SOURCE_DIR}/ directory. Copy the full-resolution originals there first ` +
        `(they live in Google Drive; this folder is gitignored).`
    );
    process.exit(1);
  }

  const bySlug = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;

    const base = path.basename(entry.name, path.extname(entry.name));
    if (!SLUG_PATTERN.test(base)) {
      problems.push(
        `${entry.name}: filename is not a usable public slug. Rename it to ` +
          `"${slugify(base) || "some-name"}${ext}" — lowercase, hyphenated, ASCII.`
      );
      continue;
    }
    // Two sources differing only by extension or case would fight over one output.
    const existing = bySlug.get(base);
    if (existing) {
      problems.push(`slug "${base}" is claimed by both ${existing.name} and ${entry.name}.`);
      continue;
    }
    bySlug.set(base, { slug: base, name: entry.name, source: path.join(SOURCE_DIR, entry.name) });
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function blurDataUrl(input) {
  const buf = await sharp(input)
    .rotate()
    .resize({ width: BLUR_WIDTH })
    .jpeg({ quality: 50 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function build(job) {
  const out = path.join(OUT_DIR, `${job.slug}.jpg`);

  // .rotate() with no argument applies the EXIF orientation and then drops it, so
  // portrait photos stay upright once the metadata is gone. It must come before
  // resize, or the resize constrains the pre-rotation edge.
  const pipeline = sharp(job.source)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    // sharp drops EXIF/ICC/XMP unless asked to keep them. These are photos of the
    // owner's home going into a public repo, so nothing rides along.
    .jpeg({ quality: QUALITY, mozjpeg: true });

  if (!checkOnly) {
    mkdirSync(OUT_DIR, { recursive: true });
    await pipeline.toFile(out);
  }

  let stat;
  try {
    stat = statSync(out);
  } catch {
    problems.push(`${out} is missing (run without --check to build it).`);
    return null;
  }

  const meta = await sharp(out).metadata();
  for (const [field, value] of [
    ["EXIF", meta.exif],
    ["ICC profile", meta.icc],
    ["XMP", meta.xmp],
    ["IPTC", meta.iptc],
  ]) {
    if (value) problems.push(`${out} still carries ${field} metadata (${value.length} bytes).`);
  }
  if (meta.orientation && meta.orientation !== 1) {
    problems.push(`${out} has EXIF orientation ${meta.orientation}; it should be baked in.`);
  }

  return {
    slug: job.slug,
    src: `/gallery/${job.slug}.jpg`,
    width: meta.width,
    height: meta.height,
    bytes: stat.size,
    blurDataURL: await blurDataUrl(out),
    sha: createHash("sha256").update(readFileSync(out)).digest("hex").slice(0, 12),
  };
}

async function checkFixedAssets() {
  for (const asset of FIXED_ASSETS) {
    let meta;
    try {
      meta = await sharp(asset.file).metadata();
    } catch {
      problems.push(`${asset.file} is missing.`);
      continue;
    }
    if (meta.width !== asset.width || meta.height !== asset.height) {
      problems.push(
        `${asset.file} is ${meta.width}x${meta.height}; it must stay ${asset.width}x${asset.height}.`
      );
    }
    if (meta.exif || meta.icc || meta.xmp) problems.push(`${asset.file} carries image metadata.`);
    console.log(
      `  ${asset.file.padEnd(34)} ${`${meta.width}x${meta.height}`.padEnd(11)} ` +
        `${(statSync(asset.file).size / 1024).toFixed(0).padStart(5)} KB  (hand-composed, checked only)`
    );
  }
}

const jobs = collectSources();
if (jobs.length === 0 && problems.length === 0) {
  console.error(`No usable images in ${SOURCE_DIR}/.`);
  process.exit(1);
}

console.log(`${checkOnly ? "Checking" : "Building"} ${jobs.length} gallery derivative(s)\n`);

const built = [];
for (const job of jobs) {
  const result = await build(job);
  if (!result) continue;
  built.push(result);
  const before = statSync(job.source).size;
  console.log(
    `  ${`${result.slug}.jpg`.padEnd(34)} ${`${result.width}x${result.height}`.padEnd(11)} ` +
      `${(result.bytes / 1024).toFixed(0).padStart(5)} KB  ` +
      `(from ${(before / 1024 / 1024).toFixed(1)} MB, -${(100 - (result.bytes / before) * 100).toFixed(1)}%)`
  );
}

console.log("");
await checkFixedAssets();

// Anything in public/gallery/ with no original behind it is unreachable from this
// script — either a leftover rename or an original that never made it into Drive.
const orphans = readdirSync(OUT_DIR, { withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => e.name)
  .filter((name) => !jobs.some((job) => `${job.slug}.jpg` === name));
if (orphans.length > 0) {
  console.log(`\nIn ${OUT_DIR}/ with no original in ${SOURCE_DIR}/: ${orphans.join(", ")}`);
}

const galleryBytes = built.reduce((sum, r) => sum + r.bytes, 0);
const fixedBytes = FIXED_ASSETS.reduce((sum, a) => {
  try {
    return sum + statSync(a.file).size;
  } catch {
    return sum;
  }
}, 0);
console.log(
  `\nCommitted image bytes: ${((galleryBytes + fixedBytes) / 1024 / 1024).toFixed(2)} MB ` +
    `(${built.length} gallery derivatives ${(galleryBytes / 1024 / 1024).toFixed(2)} MB ` +
    `+ ${(fixedBytes / 1024).toFixed(0)} KB fixed assets)`
);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// Written next to the manifest so a new photo can be pasted in without hand-measuring
// anything. src/content/gallery.ts stays the source of truth; this is only a crib
// sheet, and gallery.test.ts fails if the two ever disagree.
if (!checkOnly) {
  const stubs = built
    .map(
      (r) =>
        `  {\n` +
        `    id: ${JSON.stringify(r.slug)},\n` +
        `    src: ${JSON.stringify(r.src)},\n` +
        `    width: ${r.width},\n` +
        `    height: ${r.height},\n` +
        `    blurDataURL:\n      ${JSON.stringify(r.blurDataURL)},\n` +
        `    alt: "",\n` +
        `    caption: "",\n` +
        `    order: 0,\n` +
        `  },`
    )
    .join("\n");
  // Into the gitignored source folder, not public/ — it is scratch, not a served asset.
  const stubFile = path.join(SOURCE_DIR, "manifest-stubs.txt");
  writeFileSync(
    stubFile,
    `// Generated by scripts/optimize-images.mjs — paste the entry you need into\n` +
      `// src/content/gallery.ts and fill in alt, caption and order.\n${stubs}\n`
  );
  console.log(`\nManifest stubs for pasting: ${stubFile}`);
}
