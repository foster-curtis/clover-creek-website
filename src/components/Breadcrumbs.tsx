import Link from "next/link";
import JsonLd from "./JsonLd";
import { breadcrumbListSchema, type Crumb } from "@/lib/schema";

/**
 * Visible breadcrumb trail plus its BreadcrumbList markup, rendered together so the
 * two can never disagree. "Home" is added automatically; pass only the trail below
 * it, ending with the current page (no `path` on the last crumb). Crumb names match
 * each page's <h1>, not its <title>.
 */
export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const all: Crumb[] = [{ name: "Home", path: "/" }, ...crumbs];
  return (
    <>
      <JsonLd data={breadcrumbListSchema(crumbs)} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-stone-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((c, i) => (
            <li key={c.name} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true" className="text-stone-300">/</span>}
              {c.path ? (
                <Link href={c.path} className="hover:text-moss hover:underline">
                  {c.name}
                </Link>
              ) : (
                <span className="text-stone-600" aria-current="page">{c.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
