"use client";

// HERE Maps when NEXT_PUBLIC_HERE_API_KEY is set; otherwise an OpenStreetMap
// embed so the page works before any API keys exist.

import { useEffect, useRef } from "react";
import { SITE } from "@/lib/site";

const HERE_KEY = process.env.NEXT_PUBLIC_HERE_API_KEY;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { H?: any }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export default function LocationMap() {
  const ref = useRef<HTMLDivElement>(null);
  const { lat, lng } = SITE.location;

  useEffect(() => {
    if (!HERE_KEY || !ref.current) return;
    let map: { dispose?: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://js.api.here.com/v3/3.1/mapsjs-ui.css";
        document.head.appendChild(css);
        await loadScript("https://js.api.here.com/v3/3.1/mapsjs-core.js");
        await loadScript("https://js.api.here.com/v3/3.1/mapsjs-service.js");
        await loadScript("https://js.api.here.com/v3/3.1/mapsjs-mapevents.js");
        await loadScript("https://js.api.here.com/v3/3.1/mapsjs-ui.js");
        if (cancelled || !window.H || !ref.current) return;
        const H = window.H;
        const platform = new H.service.Platform({ apikey: HERE_KEY });
        const layers = platform.createDefaultLayers();
        map = new H.Map(ref.current, layers.vector.normal.map, {
          center: { lat, lng },
          zoom: 11,
          pixelRatio: window.devicePixelRatio || 1,
        });
        new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
        H.ui.UI.createDefault(map, layers);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).addObject(new H.map.Marker({ lat, lng }));
      } catch (err) {
        console.error("HERE map failed to load:", err);
      }
    })();

    return () => {
      cancelled = true;
      map?.dispose?.();
    };
  }, [lat, lng]);

  if (!HERE_KEY) {
    const bbox = `${lng - 0.25},${lat - 0.15},${lng + 0.25},${lat + 0.15}`;
    return (
      <iframe
        title={`Map of ${SITE.location.town}, ${SITE.location.region}`}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
        className="h-80 w-full rounded-xl border border-stone-200"
        loading="lazy"
      />
    );
  }

  return <div ref={ref} className="h-80 w-full rounded-xl border border-stone-200" />;
}
