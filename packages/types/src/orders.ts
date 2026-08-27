/**
 * Order lifecycle — `CLAUDE.md` §5.
 *
 * The happy path is
 * `DRAFT → PENDING_REVIEW → CONFIRMED → RESERVED → PICKING → PACKED →
 *  READY_FOR_DELIVERY → DRIVER_ASSIGNED → IN_TRANSIT → DELIVERED`.
 *
 * `CANCELLED` is not in §5's arrow diagram but is required by the cancel path
 * that S26 has to implement; it is a terminal state reachable from several
 * points, not a step in the sequence.
 *
 * The table of *allowed* transitions deliberately does not live here. It is
 * business logic and belongs to the API's order state machine (S26) — the
 * frontend must never decide whether a transition is legal.
 */
export const OrderStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  CONFIRMED: 'CONFIRMED',
  RESERVED: 'RESERVED',
  PICKING: 'PICKING',
  PACKED: 'PACKED',
  READY_FOR_DELIVERY: 'READY_FOR_DELIVERY',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/**
 * The forward sequence, in order, for progress timelines in the dealer and
 * admin UIs (S27, S28). Excludes `CANCELLED`, which is off the happy path.
 */
export const ORDER_STATUS_SEQUENCE = [
  OrderStatus.DRAFT,
  OrderStatus.PENDING_REVIEW,
  OrderStatus.CONFIRMED,
  OrderStatus.RESERVED,
  OrderStatus.PICKING,
  OrderStatus.PACKED,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
] as const satisfies readonly OrderStatus[];

/** Terminal states — no further transition is possible. */
export const TERMINAL_ORDER_STATUSES = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
] as const satisfies readonly OrderStatus[];

export const ORDER_STATUSES = Object.values(OrderStatus);

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Position of a status in the happy path, for rendering a timeline.
 * Returns `-1` for statuses that are not part of the sequence (`CANCELLED`).
 */
export function orderStatusIndex(status: OrderStatus): number {
  return (ORDER_STATUS_SEQUENCE as readonly OrderStatus[]).indexOf(status);
}
