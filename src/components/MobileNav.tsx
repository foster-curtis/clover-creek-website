"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { activeNavHref, type NavLink } from "@/lib/nav";

export default function MobileNav({ links }: { links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);
  const active = activeNavHref(usePathname(), links.map((l) => l.href));

  return (
    <div className="lg:hidden">
      <button
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded p-2 text-stone-700 hover:bg-stone-100"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full border-b border-stone-200 bg-cream shadow-lg">
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {links.map((link) => {
              const isActive = link.href === active;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`block py-2.5 ${
                      isActive ? "font-semibold text-moss" : "text-stone-700 hover:text-moss"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
