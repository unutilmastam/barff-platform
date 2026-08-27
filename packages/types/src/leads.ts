/**
 * B2B lead pipeline — `CLAUDE.md` §9.
 *
 * `NEW → CONTACTED → QUALIFIED → NEGOTIATION → CONVERTED`, or `REJECTED`.
 * Illegal transitions are rejected server-side (S20).
 */
export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  NEGOTIATION: 'NEGOTIATION',
  CONVERTED: 'CONVERTED',
  REJECTED: 'REJECTED',
} as const;

export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LEAD_STATUS_SEQUENCE = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.NEGOTIATION,
  LeadStatus.CONVERTED,
] as const satisfies readonly LeadStatus[];

export const TERMINAL_LEAD_STATUSES = [
  LeadStatus.CONVERTED,
  LeadStatus.REJECTED,
] as const satisfies readonly LeadStatus[];

export const LEAD_STATUSES = Object.values(LeadStatus);

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && (LEAD_STATUSES as readonly string[]).includes(value);
}
