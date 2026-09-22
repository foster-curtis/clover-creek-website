const CLOVER_LEAF =
  "M0 0C-3-11-24-15-24-28C-24-39-12-44 0-35C12-44 24-39 24-28C24-15 3-11 0 0Z";

export function CloverMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="cc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c9113" />
          <stop offset="1" stopColor="#3f6212" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#cc-bg)" />
      <g fill="#faf7f0">
        <path d={CLOVER_LEAF} transform="translate(50 50) rotate(45) translate(0 -8) scale(0.8)" />
        <path d={CLOVER_LEAF} transform="translate(50 50) rotate(135) translate(0 -8) scale(0.8)" />
        <path d={CLOVER_LEAF} transform="translate(50 50) rotate(225) translate(0 -8) scale(0.8)" />
        <path d={CLOVER_LEAF} transform="translate(50 50) rotate(315) translate(0 -8) scale(0.8)" />
      </g>
    </svg>
  );
}

export function Logo({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <CloverMark className="h-9 w-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-lg font-bold text-moss-deep sm:text-xl">{title}</span>
        {subtitle && (
          <span className="text-[0.6rem] font-semibold tracking-[0.18em] text-ink-muted uppercase">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
