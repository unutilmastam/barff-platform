/**
 * B2B lead schemas — `CLAUDE.md` §9, consumed by `/become-partner` and
 * `/contact` (S14) and by the admin pipeline (S20).
 *
 * ⚠ `region` and `businessType` are free text on purpose. BARFF has not
 * supplied the list of delivery regions or the business-type taxonomy
 * (docs/OPEN-QUESTIONS.md → Q-007, Q-025), and inventing enum values here would
 * bake fictional company facts into the schema and the database. Both become
 * enums once the real lists arrive.
 */
import { z } from 'zod';
import { LeadStatus } from '@barff/types';
import { boundedTextSchema, emailSchema, honeypotSchema, phoneSchema } from './primitives.js';

export const LEAD_MESSAGE_MAX_LENGTH = 2000;

export const leadCreateSchema = z.object({
  companyName: boundedTextSchema(2, 200, 'companyName'),
  contactName: boundedTextSchema(2, 120, 'contactName'),
  phone: phoneSchema,
  // Optional: some walk-in partners have a phone but no company email.
  email: emailSchema.optional(),
  region: boundedTextSchema(2, 120, 'region'),
  businessType: boundedTextSchema(2, 120, 'businessType'),
  /** Product slugs the partner is interested in. Empty means "not specified". */
  desiredProducts: z.array(z.string().trim().min(1)).max(50).default([]),
  /** Units per month. Not money — see `moneyMinorUnitsSchema` for amounts. */
  estimatedMonthlyVolume: z
    .number()
    .int({ error: 'validation.volume.notInteger' })
    .nonnegative({ error: 'validation.volume.negative' })
    .max(10_000_000, { error: 'validation.volume.implausible' })
    .optional(),
  message: z.string().trim().max(LEAD_MESSAGE_MAX_LENGTH).optional(),
  /** Hidden anti-spam field (S14). Never rendered to a real user. */
  website: honeypotSchema,
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

export const leadStatusSchema = z.enum(
  [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFIED,
    LeadStatus.NEGOTIATION,
    LeadStatus.CONVERTED,
    LeadStatus.REJECTED,
  ],
  { error: 'validation.leadStatus.invalid' },
);

/**
 * Admin-side status change (S20).
 *
 * Whether the transition is *allowed* is decided by the API's state machine —
 * this only checks that the target status exists and that a rejection carries a
 * reason.
 */
export const leadStatusUpdateSchema = z
  .object({
    status: leadStatusSchema,
    reason: z.string().trim().max(500).optional(),
    assignedUserId: z.uuid().optional(),
  })
  .refine((value) => value.status !== LeadStatus.REJECTED || (value.reason?.length ?? 0) > 0, {
    error: 'validation.leadStatus.rejectionNeedsReason',
    path: ['reason'],
  });

export type LeadStatusUpdateInput = z.infer<typeof leadStatusUpdateSchema>;

/** Public contact form — a lead without the commercial fields. */
export const contactMessageSchema = z.object({
  name: boundedTextSchema(2, 120, 'contactName'),
  phone: phoneSchema,
  email: emailSchema.optional(),
  message: boundedTextSchema(10, LEAD_MESSAGE_MAX_LENGTH, 'message'),
  website: honeypotSchema,
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
