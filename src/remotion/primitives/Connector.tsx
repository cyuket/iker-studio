import { useId, type ReactNode } from "react";
import { pathData, pointAt, type PathSpec } from "../lib/geometry";

export interface ConnectorProps {
  path: PathSpec;
  /** 0 is not drawn, 1 is drawn end to end. */
  progress: number;
  colour: string;
  /** Stroke width in output pixels. */
  width: number;
  dashed?: boolean;
  opacity?: number;
  /** Position (0-1) of a pulse travelling along the path; null for none. */
  signal?: number | null;
  signalColour?: string;
  /** Radius of the pulse in output pixels. */
  signalRadius?: number;
}

/**
 * A relationship between two things, drawn from one to the other so its direction is read
 * as it appears. Must be rendered inside an `<svg>`. An optional pulse travels along it
 * once: something being sent, compared or passed on.
 */
export function Connector({
  path,
  progress,
  colour,
  width,
  dashed = false,
  opacity = 1,
  signal = null,
  signalColour,
  signalRadius,
}: ConnectorProps): ReactNode {
  const id = useId();
  const drawn = Math.min(1, Math.max(0, progress));
  if (drawn <= 0) return null;
  const d = pathData(path);
  const pulse = signal === null || signal <= 0 || signal >= 1 ? null : pointAt(path, signal);
  return (
    <g opacity={opacity}>
      {dashed ? (
        <>
          <mask id={id} maskUnits="userSpaceOnUse">
            <path
              d={d}
              stroke="white"
              strokeWidth={width * 3}
              fill="none"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - drawn}
            />
          </mask>
          <path
            d={d}
            stroke={colour}
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray={`${width * 0.1} ${width * 3.2}`}
            fill="none"
            mask={`url(#${id})`}
          />
        </>
      ) : (
        <path
          d={d}
          stroke={colour}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - drawn}
        />
      )}
      {pulse ? (
        <circle
          cx={pulse.x}
          cy={pulse.y}
          r={signalRadius ?? width * 2.4}
          fill={signalColour ?? colour}
        />
      ) : null}
    </g>
  );
}

export interface ConnectorLayerProps {
  width: number;
  height: number;
  children: ReactNode;
}

/** The SVG surface connectors are drawn on, laid over a graphic's body. */
export function ConnectorLayer({ width, height, children }: ConnectorLayerProps): ReactNode {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
    >
      {children}
    </svg>
  );
}
