import type { ButtonHTMLAttributes } from "react";
import { SpinnerIcon } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-moss text-white shadow-1 hover:bg-moss-dark hover:shadow-2 disabled:bg-line-strong disabled:text-ink-subtle disabled:shadow-none",
  secondary: "border border-moss-dark text-moss-dark bg-transparent hover:bg-moss/10 disabled:border-line-strong disabled:text-ink-subtle disabled:hover:bg-transparent",
  ghost: "text-moss-dark bg-transparent hover:bg-moss/10 disabled:text-ink-subtle disabled:hover:bg-transparent",
  danger: "bg-clay text-white shadow-1 hover:bg-clay/90 disabled:bg-line-strong disabled:text-ink-subtle disabled:shadow-none",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[32px] px-4 py-1.5 text-sm",
  md: "min-h-[40px] px-6 py-2.5 text-sm",
  lg: "min-h-[48px] px-8 py-3 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return [base, variantClasses[variant], sizeClasses[size], className].filter(Boolean).join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <SpinnerIcon className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
