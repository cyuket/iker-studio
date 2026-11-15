import type { CSSProperties, ReactNode } from "react";
import { useReveal } from "../design/useReveal";

export interface RevealProps {
  /** Scene frame at which the element starts to enter; defaults to the scene lead-in. */
  at?: number | undefined;
  /** Rise distance in design pixels. */
  distance?: number;
  style?: CSSProperties;
  children: ReactNode;
}

/** The one entrance used across the studio: a fade with a short, decelerating rise. */
export function Reveal({ at, distance, style, children }: RevealProps): ReactNode {
  const reveal = useReveal(at, distance);
  return <div style={{ ...style, ...reveal }}>{children}</div>;
}
