import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import Script from "next/script";
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

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${inter.variable} antialiased`}>
        <Header />
        <main className="min-h-[70vh]">{children}</main>
        <Footer />
        {POSTHOG_KEY && (
          <Script id="posthog" strategy="afterInteractive">
            {`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init("${POSTHOG_KEY}",{api_host:"${POSTHOG_HOST}",person_profiles:"identified_only"});`}
          </Script>
        )}
      </body>
    </html>
  );
}
