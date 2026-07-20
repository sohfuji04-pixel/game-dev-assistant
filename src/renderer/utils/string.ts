/**
 * ユーティリティ置き場
 */
export function truncateMiddle(text: string, max = 48): string {
  if (text.length <= max) return text;
  const keep = Math.floor((max - 1) / 2);
  return `${text.slice(0, keep)}…${text.slice(-keep)}`;
}
