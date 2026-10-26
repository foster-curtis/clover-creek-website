// Guardrails for the Area Guide posts.
//
// The posts are MDX, which vitest can't import and tsc doesn't check, so these
// tests read the files as text. What they protect is the URL set: every slug is
// a live, indexed page, and a renamed file or a typo in `meta.slug` is a dead URL
// and a lost ranking with nothing else to flag it.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "src", "content", "blog");

// The thirteen posts that moved here from the database, byte for byte the slugs in
// the deployed sitemap at the time. Never remove one — redirect it instead.
const INDEXED_SLUGS = [
  "bonneville-salt-flats-guide",
  "byu-provo-day-trip",
  "grantsville-utah-guide",
  "hunting-near-rush-valley",
  "near-dugway-utah-west-desert",
  "onaqui-wild-horses-rush-valley",
  "pony-express-trail-guide",
  "royal-creek-ranches-rush-valley",
  "salt-lake-city-day-trip",
  "temple-square-salt-lake-city",
  "tooele-county-rodeos",
  "tooele-utah-guide",
  "wendover-utah-guide",
];

const files = readdirSync(DIR).filter((f) => f.endsWith(".mdx"));
const registry = readFileSync(path.join(DIR, "index.ts"), "utf8");

function metaField(source: string, field: string): string | undefined {
  const block = /export const meta = \{([\s\S]*?)\n\};/.exec(source)?.[1] ?? "";
  return new RegExp(`^\\s*${field}: "((?:[^"\\\\]|\\\\.)*)",?$`, "m").exec(block)?.[1];
}

describe("Area Guide posts", () => {
  it("still has a file for every slug that was indexed before the move to MDX", () => {
    const slugs = files.map((f) => f.replace(/\.mdx$/, ""));
    for (const slug of INDEXED_SLUGS) expect(slugs).toContain(slug);
  });

  it.each(files)("%s declares a meta whose slug matches its filename", (file) => {
    const source = readFileSync(path.join(DIR, file), "utf8");
    expect(metaField(source, "slug")).toBe(file.replace(/\.mdx$/, ""));
    expect(metaField(source, "title")).toBeTruthy();
    expect(metaField(source, "excerpt")).toBeTruthy();
    expect(metaField(source, "publishedAt")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(files)("%s puts photos through <Image>, never ![…] or a raw <img>", (file) => {
    // Neither reaches next/image: markdown images have no size, and literal JSX
    // tags skip the component map — an <img src={photo}> renders "[object Object]".
    const source = readFileSync(path.join(DIR, file), "utf8");
    expect(source).not.toMatch(/!\[[^\]]*\]\(/);
    expect(source).not.toMatch(/<img\b/);
  });

  it.each(files)("%s is registered in index.ts", (file) => {
    expect(registry).toContain(`from "./${file}";`);
  });

  it("registers each post exactly once", () => {
    const imports = [...registry.matchAll(/from "\.\/([^"]+\.mdx)";/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual([...files].sort());
  });
});
