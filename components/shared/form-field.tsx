import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Label + control + error wrapper.
 *
 * Two accessibility details are handled here so that no form has to remember
 * them:
 *
 * - The required marker is a decorative `*` rendered next to the label, not
 *   inside it, and requiredness is carried by `aria-required` on the control.
 *   That keeps the control's accessible name equal to the label text, which
 *   matters both for screen readers and for label-based test selectors.
 * - The error sits in an `aria-live` region, so a validation failure is
 *   announced without the user having to re-read the field.
 */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {/*
        The marker sits outside <label> rather than inside it, so the label's
        text - and therefore the control's accessible name - is exactly the
        label prop. Requiredness reaches assistive technology through
        `aria-required` on the control instead.
      */}
      <div className="flex items-baseline gap-0.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </div>
      {required ? withAriaRequired(children) : children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <p aria-live="polite" className="min-h-0 text-xs text-destructive empty:hidden">
        {error ?? ''}
      </p>
    </div>
  );
}

/**
 * Add `aria-required` to a single element child, leaving anything it already
 * sets untouched. Fields that render several nodes (an input plus a `datalist`,
 * for example) are passed through unchanged.
 */
function withAriaRequired(children: ReactNode): ReactNode {
  const only = Children.toArray(children);
  if (only.length !== 1) return children;

  const child = only[0];
  if (!isValidElement(child)) return children;

  const element = child as ReactElement<{ 'aria-required'?: boolean | 'true' | 'false' }>;
  if (element.props['aria-required'] !== undefined) return children;

  return cloneElement(element, { 'aria-required': true });
}
