let formatter: Intl.NumberFormat | null = null;

/**
 * An amount of a bill in rupees, always with its paise: "₹1,062.00". Used where amounts stand under each other
 * (a price breakdown, an invoice), so they line up and none looks rounded.
 */
export function inr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '';
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return formatter.format(Number(amount));
}

let formatter4: Intl.NumberFormat | null = null;

/**
 * A wallet amount in rupees: its paise always, and up to four decimals when it has them ("₹999.25", "₹0.2575").
 * A message can cost a fraction of a paisa, so the wallet keeps four decimals where a bill keeps two.
 */
export function inr4(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '';
  if (!formatter4) {
    formatter4 = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return formatter4.format(Number(amount));
}
