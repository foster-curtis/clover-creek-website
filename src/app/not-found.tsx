import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { CloverMark } from "@/components/ui/Logo";
import { SITE } from "@/lib/site";

// Next already sends a noindex robots tag with every 404, so only the title is set.
export const metadata: Metadata = {
  title: "Page not found",
};

// The places a lost visitor most likely meant to go. Home and booking are the
// buttons above, so they're left out here.
const SUGGESTIONS = [
  { href: "/gallery", label: "Gallery", blurb: "Walk through the house, room by room" },
  { href: "/blog", label: "Area Guide", blurb: "Things to do around Rush Valley" },
  { href: "/faq", label: "FAQ", blurb: "Check-in, pets, parking and more" },
  { href: "/contact", label: "Contact", blurb: "Ask us anything about your stay" },
] as const;

// A dusk view of the valley: hills, a fence line wandering off, and a few
// early stars. Decorative only.
function LostFenceScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 160" aria-hidden="true" className={className}>
      {/* Fade both sides so the field melts into the page instead of ending in a box */}
      <defs>
        <linearGradient id="nf-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".15" stopColor="#fff" />
          <stop offset=".85" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="nf-mask">
          <rect width="480" height="160" fill="url(#nf-fade)" />
        </mask>
      </defs>
      <g mask="url(#nf-mask)">
        <g fill="var(--color-hay)">
          <circle cx="70" cy="28" r="2" />
          <circle cx="138" cy="14" r="1.5" />
          <circle cx="330" cy="22" r="2" />
          <circle cx="402" cy="40" r="1.5" />
          <circle cx="250" cy="10" r="1.5" />
        </g>
        <path d="M0 96 C80 62 150 70 230 88 S390 58 480 78 V160 H0Z" fill="var(--color-parchment)" />
        <path d="M0 122 C110 96 200 112 300 116 S430 98 480 108 V160 H0Z" fill="var(--color-hay)" opacity=".45" />
        <path d="M0 140 C120 128 260 146 480 134 V160 H0Z" fill="var(--color-moss)" opacity=".18" />
        {/* Fence: posts stepping across the field, the last one leaning off on its own */}
        <g stroke="var(--color-clay)" strokeWidth="3" strokeLinecap="round">
          <line x1="40" y1="112" x2="40" y2="140" />
          <line x1="110" y1="108" x2="110" y2="134" />
          <line x1="180" y1="110" x2="180" y2="134" />
          <line x1="250" y1="114" x2="250" y2="136" />
          <line x1="330" y1="112" x2="337" y2="132" />
        </g>
        <g stroke="var(--color-clay)" strokeWidth="1.5" opacity=".7">
          <path d="M40 118 Q75 116 110 114 T180 116 T250 120" fill="none" />
          <path d="M40 128 Q75 126 110 124 T180 126 T250 129" fill="none" />
        </g>
      </g>
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <CloverMark className="mx-auto h-14 w-14 shadow-2 rounded-[22%]" />
        <p className="mt-6 text-sm font-semibold tracking-[0.18em] text-hay-ink uppercase">
          Error 404
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-moss-deep sm:text-5xl">
          Looks like this road ends in a field
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-muted">
          The page you&apos;re looking for has moved, or never existed. Out here, that happens
          with dirt roads too. Let&apos;s get you back to the farmhouse.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/" className={buttonClasses("primary", "lg")}>
            Back to the home page
          </Link>
          <Link href="/book" className={buttonClasses("secondary", "lg")}>
            Check available dates
          </Link>
        </div>
      </div>

      <LostFenceScene className="mt-12 h-auto w-full" />

      <nav aria-label="Popular pages" className="mt-8">
        <h2 className="text-center font-serif text-xl text-moss-deep">
          Or pick up the trail here
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-surface-raised px-5 py-4 shadow-1 hover:border-line-strong hover:shadow-2"
              >
                <span>
                  <span className="block font-semibold text-ink">{s.label}</span>
                  <span className="block text-sm text-ink-muted">{s.blurb}</span>
                </span>
                <ArrowRightIcon className="h-5 w-5 shrink-0 text-moss transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="mt-10 text-center text-sm text-ink-muted">
        Followed a broken link from somewhere on {SITE.name}? Let us know at{" "}
        <a href={`mailto:${SITE.ownerEmail}`} className="text-moss underline">
          {SITE.ownerEmail}
        </a>{" "}
        and we&apos;ll fix it.
      </p>
    </div>
  );
}
