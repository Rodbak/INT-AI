/** Format a number as Ghana cedis, e.g. 2760 → "GH₵ 2,760". */
export function cedis(n: number): string {
  return `GH₵ ${Math.round(n).toLocaleString()}`;
}
