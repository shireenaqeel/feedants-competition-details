import { describe, expect, it } from '@jest/globals';
import { countdownParts, formatCountdown, formatMoney, formatShortDuration, ordinal } from '../format';

describe('formatMoney', () => {
  it('formats paise as rupees with Indian grouping', () => {
    expect(formatMoney(150000)).toBe('₹ 1,500');
    expect(formatMoney(9900)).toBe('₹ 99');
    expect(formatMoney(1500000000)).toBe('₹ 1,50,00,000');
    expect(formatMoney(9950)).toBe('₹ 99.50');
    expect(formatMoney(0)).toBe('₹ 0');
  });
});

describe('countdown', () => {
  it('formats the design countdown', () => {
    const ms = ((1 * 24 + 6) * 3600 + 28 * 60 + 32) * 1000;
    expect(formatCountdown(countdownParts(ms))).toBe('01d : 06h : 28m : 32s');
  });

  it('never goes negative and reports done', () => {
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });

  it('short durations for buttons', () => {
    expect(formatShortDuration(countdownParts(9 * 60_000 + 41_000))).toBe('09:41');
    expect(formatShortDuration(countdownParts(26 * 3600_000))).toBe('1d 2h');
  });
});

describe('ordinal', () => {
  it('English and Hindi positions', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map((n) => ordinal(n, 'en'))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
    expect(ordinal(1, 'hi')).toBe('प्रथम');
  });
});
