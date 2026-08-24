import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SITE } from "@/lib/site";
import "./globals.css";

const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Farm Stay Vacation Rental in Rush Valley, Utah`,
    template: `%s — ${SITE.name}`,
  },
  description:
    "A quiet, serene farmhouse cottage in Rush Valley, Utah. Sleeps 6, dog friendly, fire pit under dark skies. Book direct — cleaning fee and taxes included in every rate.",
  openGraph: {
    siteName: SITE.name,
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${inter.variable} antialiased`}>
        <Header />
        <main className="min-h-[70vh]">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
