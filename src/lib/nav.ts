// Which navigation link counts as "you are here". Shared by the site header,
// the mobile menu and the admin sidebar so every nav highlights a tab by the
// same rule.
//
// A link matches when the current path is the link itself or a page nested
// under it — /blog stays highlighted while reading /blog/some-post. When more
// than one link matches, the most specific wins: otherwise "Dashboard"
// (/admin) would light up next to "Blog" on every /admin/blog page.

export interface NavLink {
  href: string;
  label: string;
}

/** Drops the query/hash and any trailing slash, so "/faq/" and "/faq?x=1" both compare as "/faq". */
function normalize(path: string): string {
  const base = path.split(/[?#]/, 1)[0];
  return base.length > 1 ? base.replace(/\/+$/, "") : base;
}

/** True when `href` is the current page or an ancestor of it. */
export function isActivePath(pathname: string, href: string): boolean {
  const path = normalize(pathname);
  const link = normalize(href);
  // Every path is nested under "/", so the home link only ever matches itself.
  if (link === "/") return path === "/";
  return path === link || path.startsWith(link + "/");
}

/**
 * The single href out of `hrefs` to highlight for `pathname`, or null when the
 * current page isn't in this nav at all. Longest match wins.
 */
export function activeNavHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (!isActivePath(pathname, href)) continue;
    if (best === null || normalize(href).length > normalize(best).length) best = href;
  }
  return best;
}
