/**
 * Auth request schemas — used by every app's login form and by the API (S04).
 *
 * Deliberately minimal: these validate *shape*, never credentials. Whether a
 * password is correct, an account is active or a dealer is approved is decided
 * server-side.
 */
import { z } from 'zod';
import { emailSchema, passwordSchema } from './primitives.js';

export const loginSchema = z.object({
  email: emailSchema,
  // Only a presence check — applying the strength rules here would leak the
  // policy to anyone probing the login form, and would reject users whose
  // password predates a policy change.
  password: z.string().min(1, { error: 'validation.password.required' }),
  rememberMe: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Refresh tokens travel in an HttpOnly cookie for browser apps (§12); the body
 * field exists for the driver PWA, which may hold the token itself when
 * working offline.
 */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, { error: 'validation.refreshToken.required' }).optional(),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'validation.password.required' }),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: 'validation.password.mismatch',
    path: ['confirmPassword'],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    error: 'validation.password.unchanged',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { error: 'validation.token.required' }),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: 'validation.password.mismatch',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
