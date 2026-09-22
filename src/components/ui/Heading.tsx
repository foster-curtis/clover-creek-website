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
}

export function SectionTitle({ as: Tag = "h2", className, children, ...props }: SectionTitleProps) {
  return (
    <Tag className={`font-serif text-2xl tracking-tight text-moss-deep ${className ?? ""}`} {...props}>
      {children}
    </Tag>
  );
}
