const formatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** Units such as % and x attach to the number; words such as "ms" or "per day" are spaced. */
export function formatValue(value: number, unit: string): string {
  const number = formatter.format(value);
  if (!unit) return number;
  return /^[%x×°]$/.test(unit) ? `${number}${unit}` : `${number} ${unit}`;
}
