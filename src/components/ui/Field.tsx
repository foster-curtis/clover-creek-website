import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const fieldBase =
  "w-full rounded-md border bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle";

function borderClass(error?: boolean) {
  return error ? "border-clay focus-visible:border-clay" : "border-line-strong focus-visible:border-moss-dark";
}

interface FieldExtras {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldExtras>(
  function Input({ className, error, ...props }, ref) {
    return <input ref={ref} className={`${fieldBase} ${borderClass(error)} ${className ?? ""}`} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldExtras>(
  function Textarea({ className, error, ...props }, ref) {
    return <textarea ref={ref} className={`${fieldBase} ${borderClass(error)} ${className ?? ""}`} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldExtras>(
  function Select({ className, error, children, ...props }, ref) {
    return (
      <select ref={ref} className={`${fieldBase} ${borderClass(error)} ${className ?? ""}`} {...props}>
        {children}
      </select>
    );
  },
);

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, className, children }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-ink-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-clay">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
