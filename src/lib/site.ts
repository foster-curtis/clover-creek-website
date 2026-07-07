// Site-wide constants. Structural text (titles, buttons, nav) lives in code by
// design — only descriptive paragraphs are editable from the admin dashboard.

export const SITE = {
  name: "Clover Creek Guest House",
  tagline: "A quiet, serene farmhouse cottage in Rush Valley, Utah",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://clovercreekguesthouse.com",
  ownerEmail: process.env.OWNER_EMAIL ?? "clovercreek@gmail.com",
  phoneDisplay: process.env.NEXT_PUBLIC_PHONE ?? "", // optional, shown in footer if set
  checkInTime: "3:00 PM",
  checkOutTime: "11:00 AM",
  // TODO(owner): replace with the exact property coordinates & address line.
  location: {
    town: "Rush Valley",
    region: "Utah",
    postalCode: "84069",
    country: "US",
    lat: 40.3627,
    lng: -112.4544,
  },
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/gallery", label: "Gallery" },
  { href: "/book", label: "Book a Stay" },
  { href: "/reviews", label: "Reviews" },
  { href: "/blog", label: "Area Guide" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;
