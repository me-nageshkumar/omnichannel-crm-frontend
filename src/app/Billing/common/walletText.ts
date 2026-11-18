import type { UsageSource, WalletEntryType } from '@app/api/billing';
import { inr4 } from '@app/Billing/common/money';

export const ENTRY_LABEL: Record<WalletEntryType, string> = {
  TOPUP: 'Top-up',
  USAGE: 'Message',
  REVERSAL: 'Returned',
  ADJUSTMENT: 'Adjustment',
  REFUND: 'Refund',
};

export const SOURCE_LABEL: Record<UsageSource, string> = {
  CONSOLE: 'Console',
  CAMPAIGN: 'Campaign',
  AUTOMATION: 'Automation',
  CHATBOT: 'Chatbot',
};

/** A ledger amount with its sign in front: "+₹1,000.00" came in, "-₹0.25" went out. */
export function signed4(amount: number): string {
  return amount > 0 ? `+${inr4(amount)}` : inr4(amount);
}
