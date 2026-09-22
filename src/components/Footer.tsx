import Link from "next/link";
import { SITE } from "@/lib/site";
import { CloverMark } from "@/components/ui/Logo";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface-sunken">
      <div className="mx-auto grid max-w-[var(--w-wide)] gap-8 px-4 py-10 text-sm text-ink-muted sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 font-serif text-base font-bold text-moss-deep">
            <CloverMark className="h-6 w-6 shrink-0" />
            {SITE.name}
          </p>
          <p className="mt-2">
            {SITE.location.town}, {SITE.location.region}
          </p>
          <p className="mt-1">
            <a href={`mailto:${SITE.ownerEmail}`} className="hover:text-moss-dark">
              {SITE.ownerEmail}
            </a>
          </p>
        </div>
        <div>
          <p className="font-semibold text-ink">The house</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/gallery" className="hover:text-moss-dark">Photo gallery</Link></li>
            <li><Link href="/house-rules" className="hover:text-moss-dark">House rules &amp; pet policy</Link></li>
            <li><Link href="/faq" className="hover:text-moss-dark">FAQ</Link></li>
            <li><Link href="/blog" className="hover:text-moss-dark">Things to do nearby</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink">Booking</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/book" className="hover:text-moss-dark">Check availability</Link></li>
            <li><Link href="/reviews" className="hover:text-moss-dark">Guest reviews</Link></li>
            <li><Link href="/contact" className="hover:text-moss-dark">Contact us</Link></li>
            <li><Link href="/terms" className="hover:text-moss-dark">Terms</Link> · <Link href="/privacy" className="hover:text-moss-dark">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-ink-subtle">
        © {new Date().getFullYear()} {SITE.name}. Cleaning fee and taxes included in all rates.
      </div>
    </footer>
  );
}
