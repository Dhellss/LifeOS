import { z } from 'zod';

/** A trimmed, non-empty string with an upper bound. */
export function requiredText(label: string, max = 200) {
  return z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

/** An optional free-text field. Empty strings normalise to `undefined`. */
export function optionalText(max = 2000) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));
}

/**
 * Accepts an ISO string, a `yyyy-MM-dd` string, a timestamp, or a `Date`, and
 * yields a valid `Date`. Rejects anything that parses to `Invalid Date`.
 */
export const dateInput = z.union([z.string(), z.number(), z.date()]).transform((value, ctx) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date.' });
    return z.NEVER;
  }
  return parsed;
});

/** Same as `dateInput` but blank/absent values become `undefined`. */
export const optionalDateInput = z
  .union([z.string(), z.number(), z.date(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date.' });
      return z.NEVER;
    }
    return parsed;
  });

/** A `yyyy-MM-dd` calendar day. */
export const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in yyyy-MM-dd format.');

export const cuidSchema = z.string().min(1, 'An id is required.').max(64);

/** A positive whole number of minutes, capped at 24 hours. */
export const durationMinutesSchema = z.coerce
  .number({ invalid_type_error: 'Duration must be a number.' })
  .int('Duration must be a whole number of minutes.')
  .positive('Duration must be greater than zero.')
  .max(1440, 'Duration cannot exceed 24 hours.');

/** `#rrggbb`, matching the colour pickers used across the UI. */
export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Pick a colour in #rrggbb format.');

export const optionalHexColorSchema = hexColorSchema
  .optional()
  .or(z.literal('').transform(() => undefined));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;
