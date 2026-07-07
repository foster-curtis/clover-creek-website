import Link from "next/link";
import { SITE } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-stone-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-stone-600 sm:grid-cols-3">
        <div>
          <p className="font-serif text-base font-bold text-moss">{SITE.name}</p>
          <p className="mt-2">
            {SITE.location.town}, {SITE.location.region}
          </p>
          <p className="mt-1">
            <a href={`mailto:${SITE.ownerEmail}`} className="hover:text-moss">
              {SITE.ownerEmail}
            </a>
          </p>
        </div>
        <div>
          <p className="font-semibold text-stone-700">The house</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/gallery" className="hover:text-moss">Photo gallery</Link></li>
            <li><Link href="/house-rules" className="hover:text-moss">House rules &amp; pet policy</Link></li>
            <li><Link href="/faq" className="hover:text-moss">FAQ</Link></li>
            <li><Link href="/blog" className="hover:text-moss">Things to do nearby</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-stone-700">Booking</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/book" className="hover:text-moss">Check availability</Link></li>
            <li><Link href="/reviews" className="hover:text-moss">Guest reviews</Link></li>
            <li><Link href="/contact" className="hover:text-moss">Contact us</Link></li>
            <li><Link href="/terms" className="hover:text-moss">Terms</Link> · <Link href="/privacy" className="hover:text-moss">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-200 py-4 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} {SITE.name}. Cleaning fee and taxes included in all rates.
      </div>
    </footer>
  );
}
