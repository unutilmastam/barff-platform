/**
 * Delivery lifecycle — `CLAUDE.md` §6.
 *
 * `CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → ARRIVED → DELIVERED`,
 * plus `FAILED` and `CANCELLED`.
 *
 * As with orders, the allowed-transition table lives in the API (S32).
 */
export const DeliveryStatus = {
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVED: 'ARRIVED',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const DELIVERY_STATUS_SEQUENCE = [
  DeliveryStatus.CREATED,
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.IN_TRANSIT,
  DeliveryStatus.ARRIVED,
  DeliveryStatus.DELIVERED,
] as const satisfies readonly DeliveryStatus[];

export const TERMINAL_DELIVERY_STATUSES = [
  DeliveryStatus.DELIVERED,
  DeliveryStatus.FAILED,
  DeliveryStatus.CANCELLED,
] as const satisfies readonly DeliveryStatus[];

export const DELIVERY_STATUSES = Object.values(DeliveryStatus);

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === 'string' && (DELIVERY_STATUSES as readonly string[]).includes(value);
}

/**
 * Proof-of-delivery kinds the driver PWA can capture (§6, S33).
 * Whether a signature is mandatory is a per-order policy decision made by the
 * API, not by the app.
 */
export const ProofOfDeliveryType = {
  PHOTO: 'PHOTO',
  SIGNATURE: 'SIGNATURE',
  NOTE: 'NOTE',
} as const;

export type ProofOfDeliveryType = (typeof ProofOfDeliveryType)[keyof typeof ProofOfDeliveryType];
