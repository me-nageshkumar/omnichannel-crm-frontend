import { describe, expect, it } from 'vitest';
import { inr, inr4 } from './money';

describe('inr4', () => {
  it('shows a wallet amount with its paise and up to four decimals', () => {
    expect(inr4(1000)).toBe('₹1,000.00');
    expect(inr4(999.25)).toBe('₹999.25');
    expect(inr4(0.2575)).toBe('₹0.2575');
    expect(inr4(-0.25)).toBe('-₹0.25');
  });

  it('shows nothing for no amount', () => {
    expect(inr4(null)).toBe('');
    expect(inr4(undefined)).toBe('');
  });

  it('leaves bill amounts at two decimals', () => {
    expect(inr(1062)).toBe('₹1,062.00');
  });
});
