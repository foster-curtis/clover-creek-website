"use client";

import { useEffect, useState } from "react";

// Adds elevation to the sticky header once the page has scrolled, per
// DESIGN_AUDIT.md's elevation ladder (shadow-2 on scroll only).
export default function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur transition-shadow ${
        scrolled ? "shadow-2" : ""
      }`}
    >
      {children}
    </header>
  );
}
