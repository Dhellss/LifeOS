import { describe, expect, it } from 'vitest';

import {
  cn,
  colorFromString,
  formatMinutes,
  formatNumber,
  groupBy,
  initials,
  percentage,
  sumBy,
  truncate,
} from '@/lib/utils';

describe('cn', () => {
  it('joins class names and drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets the last conflicting Tailwind utility win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm text-muted-foreground', 'text-destructive')).toBe(
      'text-sm text-destructive',
    );
  });
});

describe('formatMinutes', () => {
  it('formats sub-hour durations as minutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
  });

  it('formats whole hours without a minute part', () => {
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(180)).toBe('3h');
  });

  it('formats mixed durations', () => {
    expect(formatMinutes(95)).toBe('1h 35m');
    expect(formatMinutes(1_441)).toBe('24h 1m');
  });

  it('clamps negatives and rounds fractions', () => {
    expect(formatMinutes(-30)).toBe('0m');
    expect(formatMinutes(44.6)).toBe('45m');
  });
});

describe('percentage', () => {
  it('rounds to a whole percent', () => {
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(2, 3)).toBe(67);
    expect(percentage(3, 3)).toBe(100);
  });

  it('guards against a zero or negative denominator', () => {
    expect(percentage(5, 0)).toBe(0);
    expect(percentage(5, -2)).toBe(0);
  });
});

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1_234)).toBe('1,234');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('initials', () => {
  it('takes the first and last initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Grace Brewster Hopper')).toBe('GH');
  });

  it('falls back to the first two characters of a single name', () => {
    expect(initials('Ada')).toBe('AD');
  });

  it('handles blank input', () => {
    expect(initials('   ')).toBe('?');
    expect(initials('')).toBe('?');
  });
});

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('exactly10!', 10)).toBe('exactly10!');
  });

  it('appends an ellipsis when cutting', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });

  it('trims trailing whitespace before the ellipsis', () => {
    expect(truncate('ab    cdef', 7)).toBe('ab…');
  });
});

describe('colorFromString', () => {
  it('is deterministic for the same input', () => {
    const palette = ['#a', '#b', '#c'] as const;
    expect(colorFromString('Maths', palette)).toBe(colorFromString('Maths', palette));
  });

  it('always returns a value from the palette', () => {
    const palette = ['#a', '#b', '#c'] as const;
    for (const value of ['Maths', 'German', 'Compilers', '', 'x']) {
      expect(palette).toContain(colorFromString(value, palette));
    }
  });

  it('rejects an empty palette', () => {
    expect(() => colorFromString('x', [])).toThrow(/palette must not be empty/);
  });
});

describe('groupBy', () => {
  it('groups while preserving insertion order', () => {
    const grouped = groupBy(
      [
        { subject: 'Maths', minutes: 30 },
        { subject: 'German', minutes: 20 },
        { subject: 'Maths', minutes: 45 },
      ],
      (item) => item.subject,
    );
    expect([...grouped.keys()]).toEqual(['Maths', 'German']);
    expect(grouped.get('Maths')).toHaveLength(2);
  });

  it('returns an empty map for an empty input', () => {
    expect(groupBy([], (item) => item).size).toBe(0);
  });
});

describe('sumBy', () => {
  it('sums a numeric projection', () => {
    expect(sumBy([{ n: 1 }, { n: 2 }, { n: 3 }], (item) => item.n)).toBe(6);
  });

  it('is zero for an empty list', () => {
    expect(sumBy([], () => 1)).toBe(0);
  });
});
