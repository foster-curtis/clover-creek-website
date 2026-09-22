"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { activeNavHref, type NavLink } from "@/lib/nav";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

export default function MobileNav({ links }: { links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);
  const active = activeNavHref(usePathname(), links.map((l) => l.href));

  return (
    <div className="lg:hidden">
      <button
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-md p-2 text-ink-muted hover:bg-surface-sunken"
      >
        {open ? <CloseIcon className="h-[22px] w-[22px]" /> : <MenuIcon className="h-[22px] w-[22px]" />}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full border-b border-line bg-cream shadow-3">
          <ul className="mx-auto max-w-[var(--w-wide)] px-4 py-2">
            {links.map((link) => {
              const isActive = link.href === active;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`block py-2.5 ${
                      isActive ? "font-semibold text-moss-dark" : "text-ink-muted hover:text-moss-dark"
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
