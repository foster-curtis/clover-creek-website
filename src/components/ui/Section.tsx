import type { HTMLAttributes } from "react";

export type SectionWidth = "prose" | "wide";
export type SectionTone = "surface" | "sunken";

const widthClasses: Record<SectionWidth, string> = {
  prose: "max-w-[var(--w-prose)]",
  wide: "max-w-[var(--w-wide)]",
};

const toneClasses: Record<SectionTone, string> = {
  surface: "bg-surface",
  sunken: "bg-surface-sunken",
};

interface SectionProps extends HTMLAttributes<HTMLElement> {
  width?: SectionWidth;
  tone?: SectionTone;
  containerClassName?: string;
}

export default function Section({
  width = "wide",
  tone = "surface",
  className,
  containerClassName,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={`${toneClasses[tone]} py-[var(--space-section)] ${className ?? ""}`} {...props}>
      <div className={`mx-auto px-4 sm:px-6 ${widthClasses[width]} ${containerClassName ?? ""}`}>{children}</div>
    </section>
  );
}
