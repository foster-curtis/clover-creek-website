// The Area Guide. Each post is an .mdx file in this folder, compiled at build time
// by @next/mdx, with its metadata as a native `export const meta` (see ./types.ts).
//
// Static imports on purpose: a template-literal `import()` leans on bundler context
// modules, and an fs read needs outputFileTracingIncludes or it 404s in production
// while working locally. Adding a post means adding a file and a line here.

import type { MDXContent } from "mdx/types";
import type { PostMeta } from "./types";

import * as byuProvo from "./byu-provo-day-trip.mdx";
import * as royalCreek from "./royal-creek-ranches-rush-valley.mdx";
import * as rodeos from "./tooele-county-rodeos.mdx";
import * as hunting from "./hunting-near-rush-valley.mdx";
import * as ponyExpress from "./pony-express-trail-guide.mdx";
import * as grantsville from "./grantsville-utah-guide.mdx";
import * as wendover from "./wendover-utah-guide.mdx";
import * as saltFlats from "./bonneville-salt-flats-guide.mdx";
import * as onaqui from "./onaqui-wild-horses-rush-valley.mdx";
import * as saltLake from "./salt-lake-city-day-trip.mdx";
import * as templeSquare from "./temple-square-salt-lake-city.mdx";
import * as tooele from "./tooele-utah-guide.mdx";
import * as dugway from "./near-dugway-utah-west-desert.mdx";

export interface Post {
  meta: PostMeta;
  Content: MDXContent;
}

// Newest first. All thirteen original posts share a publish date, and the sort
// below is stable, so ties keep this order — the order the site showed them in
// before the move from the database.
const MODULES = [
  byuProvo,
  royalCreek,
  rodeos,
  hunting,
  ponyExpress,
  grantsville,
  wendover,
  saltFlats,
  onaqui,
  saltLake,
  templeSquare,
  tooele,
  dugway,
];

/** Every published post, newest first. Drafts are left out everywhere, sitemap included. */
export const ALL_POSTS: Post[] = MODULES.map((m) => ({ meta: m.meta, Content: m.default }))
  .filter((p) => !p.meta.draft)
  .sort((a, b) => b.meta.publishedAt.localeCompare(a.meta.publishedAt));
