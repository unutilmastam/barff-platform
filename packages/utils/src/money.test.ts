import { describe, expect, it } from 'vitest';
import {
  addMoney,
  allocateMoney,
  allocateMoneyByWeights,
  compareMoney,
  formatMoney,
  fromMinorUnits,
  money,
  MoneyError,
  multiplyMoney,
  percentageOfMoney,
  subtractMoney,
  sumMoney,
  toMinorUnits,
  zeroMoney,
} from './money.js';

describe('money construction', () => {
  it('rejects fractional minor units', () => {
    expect(() => money(10.5, 'UZS')).toThrow(MoneyError);
  });

  it('rejects amounts beyond the safe integer range', () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 2, 'UZS')).toThrow(MoneyError);
  });

  it('accepts negative amounts for credits', () => {
    expect(money(-500, 'UZS').amount).toBe(-500);
  });
});

describe('major/minor conversion', () => {
  it('round-trips a value', () => {
    expect(fromMinorUnits(toMinorUnits(1234.56, 'UZS'))).toBe(1234.56);
  });

  it('rounds half away from zero symmetrically', () => {
    expect(toMinorUnits(0.005, 'UZS').amount).toBe(1);
    expect(toMinorUnits(-0.005, 'UZS').amount).toBe(-1);
  });

  it('avoids float drift that plain multiplication would introduce', () => {
    // 8.29 * 100 is 828.9999... in IEEE 754.
    expect(toMinorUnits(8.29, 'USD').amount).toBe(829);
  });

  it('rejects non-finite input', () => {
    expect(() => toMinorUnits(Number.NaN, 'UZS')).toThrow(MoneyError);
  });
});

describe('arithmetic', () => {
  it('adds and subtracts', () => {
    expect(addMoney(money(100, 'UZS'), money(250, 'UZS')).amount).toBe(350);
    expect(subtractMoney(money(100, 'UZS'), money(250, 'UZS')).amount).toBe(-150);
  });

  it('refuses to mix currencies', () => {
    expect(() => addMoney(money(100, 'UZS'), money(100, 'USD'))).toThrow(MoneyError);
  });

  it('sums an empty list to zero', () => {
    expect(sumMoney([], 'UZS')).toEqual(zeroMoney('UZS'));
  });

  it('multiplies by an integer quantity only', () => {
    expect(multiplyMoney(money(1250, 'UZS'), 12).amount).toBe(15_000);
    expect(() => multiplyMoney(money(1250, 'UZS'), 1.5)).toThrow(MoneyError);
  });

  it('applies a percentage with half-away-from-zero rounding', () => {
    expect(percentageOfMoney(money(1000, 'UZS'), 12.5).amount).toBe(125);
    expect(percentageOfMoney(money(101, 'UZS'), 50).amount).toBe(51);
    expect(percentageOfMoney(money(-101, 'UZS'), 50).amount).toBe(-51);
  });

  it('compares within a currency', () => {
    expect(compareMoney(money(100, 'UZS'), money(200, 'UZS'))).toBe(-1);
    expect(compareMoney(money(200, 'UZS'), money(200, 'UZS'))).toBe(0);
    expect(() => compareMoney(money(1, 'UZS'), money(1, 'USD'))).toThrow(MoneyError);
  });
});

describe('allocateMoney', () => {
  it('never loses or invents minor units', () => {
    const parts = allocateMoney(money(100, 'UZS'), 3);
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33]);
    expect(parts.reduce((sum, p) => sum + p.amount, 0)).toBe(100);
  });

  it('handles an exact division', () => {
    expect(allocateMoney(money(90, 'UZS'), 3).map((p) => p.amount)).toEqual([30, 30, 30]);
  });

  it('preserves the sign of a negative amount', () => {
    const parts = allocateMoney(money(-100, 'UZS'), 3);
    expect(parts.map((p) => p.amount)).toEqual([-34, -33, -33]);
    expect(parts.reduce((sum, p) => sum + p.amount, 0)).toBe(-100);
  });

  it('rejects a non-positive part count', () => {
    expect(() => allocateMoney(money(100, 'UZS'), 0)).toThrow(MoneyError);
  });
});

describe('allocateMoneyByWeights', () => {
  it('distributes proportionally and sums back exactly', () => {
    const parts = allocateMoneyByWeights(money(1000, 'UZS'), [1, 1, 1]);
    expect(parts.reduce((sum, p) => sum + p.amount, 0)).toBe(1000);
    expect(parts.map((p) => p.amount)).toEqual([334, 333, 333]);
  });

  it('gives the remainder to the largest fractional share', () => {
    const parts = allocateMoneyByWeights(money(100, 'UZS'), [70, 20, 10]);
    expect(parts.map((p) => p.amount)).toEqual([70, 20, 10]);
  });

  it('falls back to an even split when all weights are zero', () => {
    const parts = allocateMoneyByWeights(money(10, 'UZS'), [0, 0, 0]);
    expect(parts.reduce((sum, p) => sum + p.amount, 0)).toBe(10);
  });

  it('rejects negative weights', () => {
    expect(() => allocateMoneyByWeights(money(10, 'UZS'), [1, -1])).toThrow(MoneyError);
  });

  it('rejects an empty weight list', () => {
    expect(() => allocateMoneyByWeights(money(10, 'UZS'), [])).toThrow(MoneyError);
  });
});

describe('formatMoney', () => {
  it('renders the currency code rather than a symbol', () => {
    expect(formatMoney(money(123_456, 'UZS'), 'en-US')).toContain('UZS');
  });
});
