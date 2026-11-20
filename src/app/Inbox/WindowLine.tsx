import * as React from 'react';
import { HelperText, HelperTextItem } from '@patternfly/react-core';
import type { ChatWindow } from '@app/api/inbox';

/** "3 hours", "45 minutes", "less than a minute". */
export function inWords(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/** Whether the window is open at {@code now}: the server's word, and its closing time not passed. */
export function windowOpen(window: ChatWindow | null | undefined, now: number): boolean {
  if (!window?.open || !window.closesAt) return false;
  return new Date(window.closesAt).getTime() > now;
}

/** The current time, moved on every minute, so a window that closes while the chat is open shows it. */
export function useMinuteClock(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Meta's 24-hour window above a Cloud chat's composer (spec 2026-11-20 §5.5). */
export const WindowLine: React.FunctionComponent<{ open: boolean; closesAt: string | null; now: number }> = ({
  open,
  closesAt,
  now,
}) => (
  <HelperText>
    {open && closesAt ? (
      <HelperTextItem>Replies close in {inWords(new Date(closesAt).getTime() - now)}</HelperTextItem>
    ) : (
      <HelperTextItem variant="warning">24-hour window closed — send a WhatsApp template</HelperTextItem>
    )}
  </HelperText>
);
