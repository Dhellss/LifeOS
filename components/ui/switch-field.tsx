'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Accessible toggle built on a native checkbox so it works inside plain forms
 * and with React Hook Form's `register` without a controller.
 */
export interface SwitchFieldProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  label: string;
  hint?: string;
}

const SwitchField = React.forwardRef<HTMLInputElement, SwitchFieldProps>(
  ({ className, label, hint, ...props }, ref) => (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-checked:[&>span]:translate-x-4"
      >
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  ),
);
SwitchField.displayName = 'SwitchField';

export { SwitchField };
