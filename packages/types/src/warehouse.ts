/**
 * Stock movement types — `CLAUDE.md` §7.
 *
 * Every stock change must be auditable: stock never moves without a movement
 * row (S30). The movement log is append-only.
 */
export const StockMovementType = {
  IN: 'IN',
  OUT: 'OUT',
  RESERVED: 'RESERVED',
  RELEASED: 'RELEASED',
  TRANSFER: 'TRANSFER',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN',
} as const;

export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const STOCK_MOVEMENT_TYPES = Object.values(StockMovementType);

export function isStockMovementType(value: unknown): value is StockMovementType {
  return typeof value === 'string' && (STOCK_MOVEMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Direction a movement type has on *available* (unreserved) stock.
 *
 * `TRANSFER` is `'neutral'` at company level — it decreases one warehouse and
 * increases another, so the net effect depends on which side is being looked
 * at. The warehouse service (S30) resolves that per row; this map only
 * describes the type's general shape for UI badges and reports.
 */
export const STOCK_MOVEMENT_DIRECTION = {
  IN: 'increase',
  OUT: 'decrease',
  RESERVED: 'decrease',
  RELEASED: 'increase',
  TRANSFER: 'neutral',
  ADJUSTMENT: 'neutral',
  RETURN: 'increase',
} as const satisfies Record<StockMovementType, 'increase' | 'decrease' | 'neutral'>;

export type StockMovementDirection =
  (typeof STOCK_MOVEMENT_DIRECTION)[keyof typeof STOCK_MOVEMENT_DIRECTION];
