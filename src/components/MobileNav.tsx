"use client";

import Link from "next/link";
import { useState } from "react";

export default function MobileNav({ links }: { links: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
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
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-stone-700 hover:text-moss"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
