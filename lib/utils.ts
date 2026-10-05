import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names and de-duplicate conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** `1234` -> `"1,234"` */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/** `95` -> `"1h 35m"`, `45` -> `"45m"`, `0` -> `"0m"` */
export function formatMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Round to a whole percentage, guarding against a zero denominator. */
export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Deterministic colour pick from a fixed palette, keyed by a string. */
export function colorFromString(value: string, palette: readonly string[]): string {
  if (palette.length === 0) throw new Error('palette must not be empty');
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1_000_003;
  }
  return palette[hash % palette.length]!;
}

/** Initials for an avatar fallback: "Ada Lovelace" -> "AL". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Trim a string to `max` characters, appending an ellipsis when truncated. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Group an array into a Map keyed by the result of `keyFn`, preserving order. */
export function groupBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = result.get(key);
    if (bucket) bucket.push(item);
    else result.set(key, [item]);
  }
  return result;
}

/** Sum a numeric projection of an array. */
export function sumBy<T>(items: readonly T[], valueFn: (item: T) => number): number {
  return items.reduce((total, item) => total + valueFn(item), 0);
}
