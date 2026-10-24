const formatters = new Map<string, Intl.NumberFormat | null>();

function formatterFor(currency: string, whole: boolean): Intl.NumberFormat | null {
  const key = `${currency}|${whole}`;
  if (!formatters.has(key)) {
    let formatter: Intl.NumberFormat | null = null;
    try {
      const digits = whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {};
      formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency, ...digits });
    } catch {
      // Not an ISO 4217 code: the number with the code in front.
      formatter = null;
    }
    formatters.set(key, formatter);
  }
  return formatters.get(key) ?? null;
}

/**
 * An amount in its currency, e.g. "₹1,500" (whole amounts) or "$12.50"; "" when there is no amount.
 * {@code fallbackCurrency} is used when the amount carries none.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency?: string | null,
  fallbackCurrency?: string | null,
): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '';
  const n = Number(amount);
  const code = currency || fallbackCurrency || '';
  const formatter = code ? formatterFor(code, Number.isInteger(n)) : null;
  if (formatter) return formatter.format(n);
  return `${code ? `${code} ` : ''}${n.toLocaleString()}`;
}
