import type { HTMLAttributes } from "react";

export type CardVariant = "flat" | "raised" | "interactive";

const variantClasses: Record<CardVariant, string> = {
  flat: "border border-line bg-surface-raised shadow-1",
  raised: "border border-line bg-surface-raised shadow-2",
  interactive: "border border-line bg-surface-raised shadow-2 transition-transform hover:-translate-y-0.5 hover:shadow-3",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export default function Card({ variant = "flat", className, children, ...props }: CardProps) {
  return (
    <div className={`rounded-xl p-6 ${variantClasses[variant]} ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}
