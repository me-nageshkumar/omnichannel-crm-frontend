/** Who switched something off, by scope; platform staff outrank a Customer Admin, who outranks a brand manager. */
export type EnableLevel = 'PLATFORM' | 'COMPANY' | 'BRAND';

/** Why a thing is disabled; null on the thing means enabled. */
export interface Disabled {
  by: string;
  level: EnableLevel;
  at: string;
}

const LEVEL_TEXT: Record<EnableLevel, string> = {
  PLATFORM: 'platform staff',
  COMPANY: 'Customer Admin',
  BRAND: 'brand manager',
};

export const levelText = (level: EnableLevel): string => LEVEL_TEXT[level];

/** "Disabled by boss (Customer Admin) on 20 Oct 2026". */
export function disabledText(d: Disabled): string {
  const date = new Date(d.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `Disabled by ${d.by} (${levelText(d.level)}) on ${date}`;
}
