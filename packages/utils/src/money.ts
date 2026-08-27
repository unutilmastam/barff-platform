/**
 * Money arithmetic in integer minor units.
 *
 * `ROADMAP.md` S36 requires that money math never uses floating point. Every
 * amount in this module is an integer count of the currency's smallest unit
 * (tiyin for UZS, cents for USD); a `Money` value with a fractional `amount` is
 * a bug and is rejected.
 */

/**
 * Number of decimal places each supported currency has.
 *
 * ⚠ UZS is recorded here with 2 decimals (tiyin) because that is the ISO 4217
 * definition, even though tiyin are no longer in circulation. Whether BARFF's
 * invoices should store and display whole so'm only is an open commercial
 * decision — see docs/OPEN-QUESTIONS.md → Q-024. Storing the finer unit is the
 * reversible choice: rounding up to whole so'm later is safe, recovering lost
 * precision is not.
 */
export const CURRENCY_EXPONENT = {
  UZS: 2,
  USD: 2,
  EUR: 2,
} as const;

export type CurrencyCode = keyof typeof CURRENCY_EXPONENT;

export interface Money {
  /** Integer amount in minor units. May be negative (credits, adjustments). */
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function money(amount: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amount)) {
    throw new MoneyError(
      `Money amount must be an integer number of minor units, received ${amount}.`,
    );
  }
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError(`Money amount ${amount} exceeds the safe integer range.`);
  }
  return { amount, currency };
}

export function zeroMoney(currency: CurrencyCode): Money {
  return { amount: 0, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Cannot combine ${a.currency} with ${b.currency}.`);
  }
}

/** Converts a major-unit value (e.g. `12.50`) into `Money`. Rounds half away from zero. */
export function toMinorUnits(major: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(major)) {
    throw new MoneyError(`Cannot convert non-finite value ${major} to ${currency}.`);
  }
  const factor = 10 ** CURRENCY_EXPONENT[currency];
  const scaled = major * factor;
  // Round half away from zero so -0.005 and 0.005 behave symmetrically;
  // Math.round() biases toward +Infinity and would break credit notes.
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  return money(rounded, currency);
}

/** Converts `Money` back to a major-unit number. For display and export only. */
export function fromMinorUnits(value: Money): number {
  return value.amount / 10 ** CURRENCY_EXPONENT[value.currency];
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function sumMoney(values: readonly Money[], currency: CurrencyCode): Money {
  return values.reduce<Money>((total, value) => addMoney(total, value), zeroMoney(currency));
}

/** Multiplies by an integer quantity — the order-line case. */
export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new MoneyError(`Quantity must be an integer, received ${quantity}.`);
  }
  return money(value.amount * quantity, value.currency);
}

/**
 * Applies a percentage (e.g. `12.5` for 12.5%) and rounds half away from zero.
 * Used for volume discounts and tax lines.
 */
export function percentageOfMoney(value: Money, percent: number): Money {
  if (!Number.isFinite(percent)) {
    throw new MoneyError(`Percentage must be finite, received ${percent}.`);
  }
  const scaled = (value.amount * percent) / 100;
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  return money(rounded, value.currency);
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amount === b.amount ? 0 : a.amount < b.amount ? -1 : 1;
}

export function isZeroMoney(value: Money): boolean {
  return value.amount === 0;
}

export function isNegativeMoney(value: Money): boolean {
  return value.amount < 0;
}

/**
 * Splits an amount across `parts` without losing or inventing minor units.
 *
 * The remainder is handed out one unit at a time to the earliest parts, so the
 * result always sums back to the input exactly. This is what invoice line
 * splitting and order-level discount distribution need — dividing and rounding
 * each share independently silently loses money.
 */
export function allocateMoney(value: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new MoneyError(`Allocation requires a positive integer part count, received ${parts}.`);
  }
  const sign = value.amount < 0 ? -1 : 1;
  const magnitude = Math.abs(value.amount);
  const base = Math.floor(magnitude / parts);
  const remainder = magnitude - base * parts;

  return Array.from({ length: parts }, (_unused, index) =>
    money(sign * (base + (index < remainder ? 1 : 0)), value.currency),
  );
}

/**
 * Splits an amount by weights (e.g. line totals) keeping the sum exact.
 * Weights must be non-negative; a zero total falls back to an even split.
 */
export function allocateMoneyByWeights(value: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) {
    throw new MoneyError('Allocation requires at least one weight.');
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new MoneyError('Allocation weights must be finite and non-negative.');
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight === 0) {
    return allocateMoney(value, weights.length);
  }

  const sign = value.amount < 0 ? -1 : 1;
  const magnitude = Math.abs(value.amount);

  const shares = weights.map((weight) => Math.floor((magnitude * weight) / totalWeight));
  let remainder = magnitude - shares.reduce((sum, share) => sum + share, 0);

  // Hand the remainder to the largest fractional parts first, so the biggest
  // lines absorb the rounding rather than always the first one.
  const order = weights
    .map((weight, index) => ({
      index,
      fraction: (magnitude * weight) / totalWeight - Math.floor((magnitude * weight) / totalWeight),
    }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const entry of order) {
    if (remainder <= 0) break;
    shares[entry.index] = (shares[entry.index] ?? 0) + 1;
    remainder -= 1;
  }

  return shares.map((share) => money(sign * share, value.currency));
}

/**
 * Formats money for display.
 *
 * Locale codes map to BCP 47 tags; `uz` renders as `uz-UZ`. Currency display
 * defaults to the code rather than a symbol because so'm has no widely
 * recognised symbol.
 */
export function formatMoney(
  value: Money,
  locale = 'uz-UZ',
  options: Intl.NumberFormatOptions = {},
): string {
  const exponent = CURRENCY_EXPONENT[value.currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    currencyDisplay: 'code',
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
    ...options,
  }).format(fromMinorUnits(value));
}
