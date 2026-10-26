// @types/mdx types an .mdx module's default export but knows nothing of the `meta`
// each post exports; this merges it in. MDX isn't type-checked, so this is a
// promise rather than a check — blog.test.ts holds every file to it.
declare module "*.mdx" {
  import type { PostMeta } from "@/content/blog/types";

  export const meta: PostMeta;
}
