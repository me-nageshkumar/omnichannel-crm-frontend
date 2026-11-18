import type { OrderKind, OrderStatus, PaymentMethod } from '@app/api/billing';

export const KIND_LABEL: Record<OrderKind, string> = {
  NEW: 'New plan',
  RENEWAL: 'Renewal',
  UPGRADE: 'Upgrade',
  CHANGE: 'Plan change',
  ADDON: 'Add-on',
  ADJUST: 'Adjustment',
  CANCEL_ADDON: 'Add-on cancelled',
  CANCEL_PLAN: 'Plan cancelled',
  TOPUP: 'Wallet top-up',
  WALLET_REFUND: 'Wallet refund',
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  REQUESTED: 'Waiting for payment',
  ACTIVATING: 'Being activated',
  ACTIVATED: 'Activated',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  SUPERSEDED: 'Out of date',
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  OTHER: 'Other',
  NONE: 'Nothing to pay',
};

/** The ways money can be received or paid back, in the order they are offered. */
export const METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'OTHER'];

/** Today as an ISO local date where the person sits: the default of a "received on" or "paid on" field. */
export function todayHere(now: Date = new Date()): string {
  const two = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}
