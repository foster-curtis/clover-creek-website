import type { MDXComponents } from "mdx/types";
import Image, { type ImageProps } from "next/image";
import Link from "next/link";

// How MDX elements render in the Area Guide posts. Headings, lists, paragraphs and
// blockquotes are left as plain elements on purpose: the post page wraps them in
// .prose-simple (globals.css), which styles them exactly as it styled the old
// marked output. Only links and images need components.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Internal links get client-side navigation and prefetching.
    a: ({ href = "", ...props }) =>
      href.startsWith("/") ? <Link href={href} {...props} /> : <a href={href} rel="noopener" {...props} />,
    // Inline photos: `import herd from "./images/herd.jpg"` at the top of the post,
    // then <Image src={herd} alt="…" />. The static import supplies width, height and
    // the blur placeholder. Markdown's ![alt](src) can't carry a size, and a literal
    // <img> tag bypasses this map entirely, so blog.test.ts rejects both.
    Image: ({ alt, ...props }: ImageProps) => (
      <Image
        alt={alt}
        placeholder={typeof props.src === "object" ? "blur" : "empty"}
        sizes="(min-width: 768px) 720px, 100vw"
        {...props}
      />
    ),
    ...components,
  };
}
