import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function base(children: React.ReactNode, props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return base(<path d="M19 12H5m0 0l6-6m-6 6l6 6" />, props);
}

export function ArrowRightIcon(props: IconProps) {
  return base(<path d="M5 12h14m0 0l-6-6m6 6l-6 6" />, props);
}

export function CloseIcon(props: IconProps) {
  return base(<path d="M18 6L6 18M6 6l12 12" />, props);
}

export function CheckIcon(props: IconProps) {
  return base(<path d="M20 6L9 17l-5-5" />, props);
}

export function StarIcon(props: IconProps) {
  return base(
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9L12 3.5z"
      strokeLinejoin="round"
    />,
    { fill: "currentColor", stroke: "none", ...props },
  );
}

export function WifiIcon(props: IconProps) {
  return base(
    <>
      <path d="M2 8.5a15.5 15.5 0 0120 0" />
      <path d="M5.5 12.3a10.7 10.7 0 0113 0" />
      <path d="M9 16.1a5.9 5.9 0 016 0" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
    </>,
    props,
  );
}

export function PetIcon(props: IconProps) {
  return base(
    <>
      <circle cx="7" cy="7.5" r="1.6" />
      <circle cx="12" cy="5.5" r="1.6" />
      <circle cx="17" cy="7.5" r="1.6" />
      <circle cx="19" cy="12.5" r="1.6" />
      <path d="M6.5 13.5c-1.8 0-3 1.6-2.3 3.3.9 2.3 3.6 3.9 7.8 3.9s6.9-1.6 7.8-3.9c.7-1.7-.5-3.3-2.3-3.3-1.1 0-1.7.5-2.6 1.1a5.9 5.9 0 01-5.8 0c-.9-.6-1.5-1.1-2.6-1.1z" />
    </>,
    props,
  );
}

export function BedIcon(props: IconProps) {
  return base(
    <>
      <path d="M3 18v-7a2 2 0 012-2h14a2 2 0 012 2v7" />
      <path d="M3 18v2m18-2v2" />
      <path d="M3 13V9a1 1 0 011-1h6a1 1 0 011 1v2" />
      <path d="M13 12h7" />
    </>,
    props,
  );
}

export function BathIcon(props: IconProps) {
  return base(
    <>
      <path d="M4 12h16v2a5 5 0 01-5 5H9a5 5 0 01-5-5v-2z" />
      <path d="M4 12V6a2 2 0 012-2c1 0 1.6.5 2 1" />
      <path d="M3 21h18" />
    </>,
    props,
  );
}

export function KitchenIcon(props: IconProps) {
  return base(
    <>
      <path d="M6 3v8a2.5 2.5 0 005 0V3M8.5 8V3" />
      <path d="M16 3v18M16 3c2 0 3 1.5 3 4.5S18 12 16 12" />
    </>,
    props,
  );
}

export function MapPinIcon(props: IconProps) {
  return base(
    <>
      <path d="M20 10.5c0 5.5-8 11-8 11s-8-5.5-8-11a8 8 0 1116 0z" />
      <circle cx="12" cy="10.5" r="2.5" />
    </>,
    props,
  );
}

export function CalendarIcon(props: IconProps) {
  return base(
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>,
    props,
  );
}

export function ClockIcon(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>,
    props,
  );
}

export function FireIcon(props: IconProps) {
  return base(
    <path d="M12 2.5c1 3 4 4.5 4 8.5a4 4 0 11-8 0c0-1 .3-1.8.8-2.5.4 1 1.2 1.5 1.7 1 .6-.6.2-1.7-.3-2.7-.7-1.5-.7-3.2 1.8-4.3z" />,
    props,
  );
}

export function MenuIcon(props: IconProps) {
  return base(<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />, props);
}

export function SpinnerIcon(props: IconProps) {
  return base(<path d="M12 3a9 9 0 109 9" />, props);
}

export function CloverIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g fill="currentColor">
        <path d="M12 12c0-2.8-2.2-5-5-5S2 9.2 2 12s2.2 5 5 5c1.1 0 2.4-.5 3.3-1.4A6.9 6.9 0 0112 12z" />
        <path d="M12 12c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5c-1.1 0-2.4-.5-3.3-1.4A6.9 6.9 0 0112 12z" />
        <path d="M12 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5c0 1.1-.5 2.4-1.4 3.3A6.9 6.9 0 0112 12z" />
        <path d="M12 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5c0-1.1-.5-2.4-1.4-3.3A6.9 6.9 0 0012 12z" />
      </g>
      <path d="M12 12v7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </svg>
  );
}
