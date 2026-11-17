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
