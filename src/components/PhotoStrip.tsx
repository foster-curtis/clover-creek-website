"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/icons";
import type { GalleryImage } from "@/lib/data";

/**
 * A row of photos that scrolls sideways when it doesn't fit — swipe on touch,
 * arrows everywhere else — and lays out as a plain grid once it does fit.
 *
 * The scrollbar is hidden because the arrows say the same thing more clearly.
 * Nothing here gates the scrolling itself: without JavaScript the row is still
 * a native scroller, just without the buttons.
 */
export default function PhotoStrip({ images, href }: { images: GalleryImage[]; href: string }) {
  const scroller = useRef<HTMLUListElement>(null);
  // Both true means there is nothing to scroll, which is how the arrows stay
  // hidden at lg (a grid) and on any screen wide enough to show every photo.
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // Sub-pixel widths are normal at fractional zoom, so leave a pixel of slack
    // rather than waiting for an exact landing on either end.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    // Rotating a phone or crossing the lg breakpoint changes whether this
    // scrolls at all, and neither fires a scroll event.
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [sync]);

  function step(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    // One card plus the gap, so a click lands on the next snap point rather
    // than part-way between two photos.
    const distance = card ? card.offsetWidth + gap : el.clientWidth;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * distance, behavior: reducedMotion ? "auto" : "smooth" });
  }

  const scrollable = !atStart || !atEnd;

  return (
    <div className="relative">
      <ul
        ref={scroller}
        // scroll-px-4 matches the px-4 that keeps the bleed off the screen edge.
        // Without it the first snap point sits inside the padding, so the strip
        // can never rest at scrollLeft 0 and the left arrow never settles.
        className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
        // A scrollable region has to be reachable by keyboard, and a focusable
        // region needs a name. Harmless once it becomes a grid at lg.
        tabIndex={0}
        aria-label="Photos of the house"
      >
        {images.map((img) => (
          <li key={img.id} className="w-64 shrink-0 snap-start sm:w-72 lg:w-auto">
            <Link href={href} className="group block">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-sunken">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  placeholder="blur"
                  blurDataURL={img.blurDataURL}
                  sizes="(min-width: 1024px) 25vw, 18rem"
                  className="object-cover transition group-hover:scale-105"
                />
              </div>
              <p className="mt-2 text-sm text-stone-600">{img.caption}</p>
            </Link>
          </li>
        ))}
      </ul>

      {scrollable && (
        <>
          {/* Sat on the photos rather than the captions: a 4:3 image on a w-64
              card is 12rem tall, and 13.5rem on the w-72 card at sm. */}
          <StripArrow side="left" disabled={atStart} onClick={() => step(-1)} />
          <StripArrow side="right" disabled={atEnd} onClick={() => step(1)} />
        </>
      )}
    </div>
  );
}

function StripArrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous photos" : "Next photos"}
      className={`absolute top-24 -translate-y-1/2 rounded-full bg-surface/90 p-2.5 text-moss-dark shadow-2 backdrop-blur transition hover:bg-surface disabled:pointer-events-none disabled:opacity-0 sm:top-[6.75rem] ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
