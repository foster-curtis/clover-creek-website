import type { HTMLAttributes, ElementType } from "react";

export function PageTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={`font-serif text-4xl tracking-tight text-moss-deep ${className ?? ""}`} {...props}>
      {children}
    </h1>
  );
}

interface SectionTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: ElementType;
  /** Adds a short hairline rule beneath the title — for editorial/marketing
   * section headers, not dense admin panels. */
  rule?: boolean;
}

export function SectionTitle({ as: Tag = "h2", rule = false, className, children, ...props }: SectionTitleProps) {
  return (
    <>
      <Tag className={`font-serif text-2xl tracking-tight text-moss-deep ${className ?? ""}`} {...props}>
        {children}
      </Tag>
      {rule && <span aria-hidden="true" className="mt-3 block h-0.5 w-12 bg-hay" />}
    </>
  );
}
