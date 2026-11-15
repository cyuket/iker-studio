import type { ReactNode } from "react";

/** Line icons on a 24-unit grid. Each is a few strokes: a signifier, not an illustration. */
const ICONS = {
  name: ["M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"],
  person: [
    "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    "M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5",
  ],
  account: [
    "M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z",
    "M12 12.4a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z",
    "M7.5 17.2c.7-2 2.4-3 4.5-3s3.8 1 4.5 3",
  ],
  face: [
    "M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2",
    "M12 12.8a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z",
    "M7.8 17.4c.6-1.7 2.2-2.6 4.2-2.6s3.6.9 4.2 2.6",
  ],
  selfie: [
    "M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2",
    "M12 12.8a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z",
    "M7.8 17.4c.6-1.7 2.2-2.6 4.2-2.6s3.6.9 4.2 2.6",
  ],
  email: [
    "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M3.6 7.2l8.4 6 8.4-6",
  ],
  phone: [
    "M9.5 2.5h5A2.5 2.5 0 0 1 17 5v14a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19V5a2.5 2.5 0 0 1 2.5-2.5z",
    "M11 18.2h2",
  ],
  document: [
    "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M8.5 12.2a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z",
    "M5.9 16c.4-1.4 1.4-2 2.6-2s2.2.6 2.6 2",
    "M14 10h4M14 13.5h4",
  ],
  date: [
    "M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M4 10h16M8 3v4M16 3v4",
  ],
  address: [
    "M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z",
    "M12 12.7a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z",
  ],
  device: [
    "M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 16H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5z",
    "M2 19.5h20",
  ],
  wallet: [
    "M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3",
    "M6 8h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
    "M16.4 13.5h.2",
  ],
  business: [
    "M5 21V6l7-3v18",
    "M12 9l7 2.5V21",
    "M3 21h18",
    "M8.5 9v.2M8.5 13v.2M8.5 17v.2M15.5 14v.2M15.5 17.5v.2",
  ],
  list: ["M8.5 7H19M8.5 12H19M8.5 17H19", "M4.6 7h.2M4.6 12h.2M4.6 17h.2"],
  signal: ["M3 12h3.5l2.5-6 4 12 2.5-6H21"],
  transaction: ["M4 9h14l-3.5-3.5", "M20 15H6l3.5 3.5"],
  data: [
    "M12 9.5c3.9 0 7-1.3 7-3s-3.1-3-7-3-7 1.3-7 3 3.1 3 7 3z",
    "M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11",
    "M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3",
  ],
  link: [
    "M10.4 13.6a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2",
    "M13.6 10.4a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2",
  ],
  rule: ["M12 3.5l8.5 8.5-8.5 8.5L3.5 12z", "M12 8.5v4M12 15.4v.2"],
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  /** Edge length in output pixels. */
  size: number;
  colour: string;
  /** Stroke weight on the 24-unit grid. */
  weight?: number;
}

export function Icon({ name, size, colour, weight = 1.7 }: IconProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "block", flexShrink: 0 }}
    >
      {ICONS[name].map((d) => (
        <path
          key={d}
          d={d}
          stroke={colour}
          strokeWidth={weight}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
