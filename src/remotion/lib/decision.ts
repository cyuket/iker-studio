import type { Rect } from "../design/layout";
import { flowCurve, type PathSpec } from "./geometry";

export interface DecisionLayoutInput {
  body: Rect;
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  signals: number;
  outcomes: number;
  /** Any signal or outcome carries a second line. */
  hasDetails: boolean;
  hasScore: boolean;
}

export interface DecisionLayout {
  k: number;
  signals: Rect[];
  rule: Rect;
  outcomes: Rect[];
  /** From each signal into the rule. */
  inPaths: PathSpec[];
  /** From the rule to each outcome. */
  outPaths: PathSpec[];
}

function column(count: number, x: number, width: number, height: number, gap: number, body: Rect) {
  const total = count * height + (count - 1) * gap;
  const top = body.y + (body.height - total) / 2;
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: top + i * (height + gap),
    width,
    height,
  }));
}

/**
 * Signals on one side, the rule in the middle, outcomes on the other. Landscape reads left
 * to right. Portrait reads top to bottom: signals stack, their connectors join a rail down
 * the left that enters the rule, and the outcomes fan out below it, so no connector ever
 * crosses a card.
 */
export function layoutDecision(input: DecisionLayoutInput): DecisionLayout {
  const { body, portrait, unit } = input;
  if (!portrait) {
    const signalHeight = input.hasDetails ? 152 : 100;
    const outcomeHeight = input.hasDetails ? 168 : 108;
    const ruleHeight = input.hasScore ? 300 : 236;
    const tallest = Math.max(
      input.signals * signalHeight + (input.signals - 1) * 24,
      input.outcomes * outcomeHeight + (input.outcomes - 1) * 28,
      ruleHeight,
    );
    const k = unit * Math.min(1.45, (body.height * 0.94) / unit / tallest);
    const signalWidth = Math.min(body.width * 0.31, 560 * k);
    const ruleWidth = Math.min(body.width * 0.25, 440 * k);
    const outcomeWidth = Math.min(body.width * 0.28, 480 * k);
    const gap = (body.width - signalWidth - ruleWidth - outcomeWidth) / 2;
    const signals = column(input.signals, body.x, signalWidth, signalHeight * k, 24 * k, body);
    const rule: Rect = {
      x: body.x + signalWidth + gap,
      y: body.y + (body.height - ruleHeight * k) / 2,
      width: ruleWidth,
      height: ruleHeight * k,
    };
    const outcomes = column(
      input.outcomes,
      body.x + body.width - outcomeWidth,
      outcomeWidth,
      outcomeHeight * k,
      28 * k,
      body,
    );
    const clear = 10 * k;
    return {
      k,
      signals,
      rule,
      outcomes,
      inPaths: signals.map((signal, i) =>
        flowCurve(
          { x: signal.x + signal.width + clear, y: signal.y + signal.height / 2 },
          { x: rule.x - clear, y: rule.y + (rule.height * (i + 1)) / (signals.length + 1) },
        ),
      ),
      outPaths: outcomes.map((outcome, i) =>
        flowCurve(
          {
            x: rule.x + rule.width + clear,
            y: rule.y + (rule.height * (i + 1)) / (outcomes.length + 1),
          },
          { x: outcome.x - clear, y: outcome.y + outcome.height / 2 },
        ),
      ),
    };
  }

  const signalHeight = input.hasDetails ? 112 : 84;
  const ruleHeight = input.hasScore ? 240 : 176;
  const perRow = input.outcomes <= 3 ? input.outcomes : 2;
  const outcomeRows = Math.ceil(input.outcomes / perRow);
  const outcomeHeight = input.hasDetails ? 236 : 150;
  const fixed =
    input.signals * signalHeight +
    (input.signals - 1) * 16 +
    ruleHeight +
    outcomeRows * outcomeHeight +
    (outcomeRows - 1) * 18;
  const minBand = 84;
  const k = unit * Math.min(1.3, body.height / unit / (fixed + minBand * 2));
  const band = (body.height - fixed * k) / 2;
  const rail = 56 * k;
  const signals = Array.from({ length: input.signals }, (_, i) => ({
    x: body.x + rail,
    y: body.y + i * (signalHeight + 16) * k,
    width: body.width - rail,
    height: signalHeight * k,
  }));
  const lastSignal = signals.at(-1);
  const ruleTop = (lastSignal ? lastSignal.y + lastSignal.height : body.y) + band;
  const rule: Rect = {
    x: body.x + rail,
    y: ruleTop,
    width: body.width - rail,
    height: ruleHeight * k,
  };
  const gap = 18 * k;
  const outcomeWidth = (body.width - gap * (perRow - 1)) / perRow;
  const outcomeTop = rule.y + rule.height + band;
  const outcomes = Array.from({ length: input.outcomes }, (_, i) => ({
    x: body.x + (i % perRow) * (outcomeWidth + gap),
    y: outcomeTop + Math.floor(i / perRow) * (outcomeHeight * k + gap),
    width: outcomeWidth,
    height: outcomeHeight * k,
  }));
  const clear = 8 * k;
  const railX = body.x + rail * 0.4;
  const ruleEntry = rule.y + rule.height / 2;
  return {
    k,
    signals,
    rule,
    outcomes,
    inPaths: signals.map((signal) => ({
      kind: "poly",
      points: [
        { x: signal.x - clear, y: signal.y + signal.height / 2 },
        { x: railX, y: signal.y + signal.height / 2 },
        { x: railX, y: ruleEntry },
        { x: rule.x - clear, y: ruleEntry },
      ],
    })),
    outPaths: outcomes.map((outcome) =>
      flowCurve(
        { x: rule.x + rule.width / 2, y: rule.y + rule.height + clear },
        { x: outcome.x + outcome.width / 2, y: outcome.y - clear },
        true,
      ),
    ),
  };
}
