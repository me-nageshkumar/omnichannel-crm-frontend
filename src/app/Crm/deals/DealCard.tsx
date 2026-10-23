import * as React from 'react';
import { Button, Label } from '@patternfly/react-core';
import type { CrmPhone, Deal } from '@app/api/crm';
import { ChannelChip } from '@app/Crm/common/ChannelChip';
import { formatMoney } from '@app/Crm/common/money';

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

/** The content of a deal's card: title, contact, amount, owner initials, state labels and the channel chip. */
export const DealCard: React.FunctionComponent<{
  deal: Deal;
  defaultCurrency?: string | null;
  /** The brand's numbers; the channel chip shows only when there is more than one. */
  phones?: CrmPhone[];
  onOpen(deal: Deal): void;
}> = ({ deal, defaultCurrency, phones = [], onOpen }) => {
  const amount = formatMoney(deal.amount, deal.currency, defaultCurrency);
  const contact = deal.primaryContact?.name || deal.primaryContact?.phone || '';
  const channelLabel = phones.find((p) => p.phoneNumberId === deal.channel?.phoneNumberId)?.label ?? null;
  return (
    // The whole card opens the deal; the title button is the keyboard way in.
    <div
      onClick={() => onOpen(deal)}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--pf-t--global--spacer--xs)' }}
    >
      <Button variant="link" isInline style={{ textAlign: 'start', overflowWrap: 'anywhere' }}>
        {deal.title || 'Untitled deal'}
      </Button>
      {contact && <span style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>{contact}</span>}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--pf-t--global--spacer--sm)',
        }}
      >
        <strong>{amount || '—'}</strong>
        {deal.owner && (
          <Label isCompact variant="outline" title={`Owner: ${deal.owner.name}`}>
            <span aria-label={`Owner ${deal.owner.name}`}>{initialsOf(deal.owner.name)}</span>
          </Label>
        )}
      </div>
      {(deal.rotting || deal.overdue || (phones.length > 1 && deal.channel)) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--pf-t--global--spacer--xs)' }}>
          {deal.rotting && (
            <Label isCompact color="orange">
              Rotting
            </Label>
          )}
          {deal.overdue && (
            <Label isCompact color="red">
              Overdue
            </Label>
          )}
          {phones.length > 1 && deal.channel && <ChannelChip number={deal.channel.number} label={channelLabel} />}
        </div>
      )}
    </div>
  );
};
