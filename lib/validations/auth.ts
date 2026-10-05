import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password must be 128 characters or fewer.');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name.').max(80, 'Name is too long.'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80, 'Name is too long.'),
  image: z
    .string()
    .trim()
    .url('Enter a valid image URL.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
