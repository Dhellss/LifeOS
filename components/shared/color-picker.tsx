'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Fixed palette so colours stay harmonious with the chart tokens. */
export const COLOR_PALETTE = [
  '#6366f1',
  '#14b8a6',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#0ea5e9',
  '#22c55e',
  '#ef4444',
] as const;

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Colour">
      <button
        type="button"
        onClick={() => onChange('')}
        aria-pressed={value === ''}
        className={cn(
          'flex h-7 items-center rounded-md border px-2 text-xs transition-colors',
          value === '' ? 'border-primary text-primary' : 'border-border text-muted-foreground',
        )}
      >
        Default
      </button>
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={`Use colour ${color}`}
          aria-pressed={value === color}
          style={{ backgroundColor: color }}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md ring-offset-2 ring-offset-background transition',
            value === color ? 'ring-2 ring-foreground' : 'hover:scale-105',
          )}
        >
          {value === color ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
        </button>
      ))}
    </div>
  );
}
