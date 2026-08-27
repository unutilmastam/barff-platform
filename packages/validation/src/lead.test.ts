import { describe, expect, it } from 'vitest';
import { LeadStatus } from '@barff/types';
import { contactMessageSchema, leadCreateSchema, leadStatusUpdateSchema } from './lead.js';

const validLead = {
  companyName: 'MOCK Distribution LLC',
  contactName: 'MOCK Contact',
  phone: '901234567',
  region: 'Toshkent',
  businessType: 'Distributor',
};

describe('leadCreateSchema', () => {
  it('accepts the minimum required set and normalizes the phone', () => {
    const parsed = leadCreateSchema.parse(validLead);
    expect(parsed.phone).toBe('+998901234567');
    expect(parsed.desiredProducts).toEqual([]);
  });

  it('requires the commercial identity fields', () => {
    for (const field of ['companyName', 'contactName', 'phone', 'region', 'businessType']) {
      const { [field]: _removed, ...rest } = validLead as Record<string, unknown>;
      expect(leadCreateSchema.safeParse(rest).success).toBe(false);
    }
  });

  it('treats email and volume as optional', () => {
    expect(leadCreateSchema.safeParse({ ...validLead, email: undefined }).success).toBe(true);
    expect(leadCreateSchema.safeParse({ ...validLead, estimatedMonthlyVolume: 5000 }).success).toBe(
      true,
    );
  });

  it('rejects an implausible or fractional volume', () => {
    expect(
      leadCreateSchema.safeParse({ ...validLead, estimatedMonthlyVolume: 99_000_000 }).success,
    ).toBe(false);
    expect(leadCreateSchema.safeParse({ ...validLead, estimatedMonthlyVolume: 10.5 }).success).toBe(
      false,
    );
  });

  it('fails when the honeypot is filled', () => {
    expect(leadCreateSchema.safeParse({ ...validLead, website: 'spam' }).success).toBe(false);
  });

  it('bounds the free-text message', () => {
    expect(leadCreateSchema.safeParse({ ...validLead, message: 'x'.repeat(2001) }).success).toBe(
      false,
    );
  });
});

describe('leadStatusUpdateSchema', () => {
  it('accepts a plain status change', () => {
    expect(leadStatusUpdateSchema.safeParse({ status: LeadStatus.CONTACTED }).success).toBe(true);
  });

  it('requires a reason when rejecting', () => {
    expect(leadStatusUpdateSchema.safeParse({ status: LeadStatus.REJECTED }).success).toBe(false);
    expect(
      leadStatusUpdateSchema.safeParse({ status: LeadStatus.REJECTED, reason: 'No coverage' })
        .success,
    ).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(leadStatusUpdateSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
  });
});

describe('contactMessageSchema', () => {
  it('requires a message of reasonable length', () => {
    const base = { name: 'MOCK Contact', phone: '901234567' };
    expect(contactMessageSchema.safeParse({ ...base, message: 'too short' }).success).toBe(false);
    expect(
      contactMessageSchema.safeParse({ ...base, message: 'Please send a dealer price list.' })
        .success,
    ).toBe(true);
  });
});
