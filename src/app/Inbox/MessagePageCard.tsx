import * as React from 'react';
import { Label, LabelGroup } from '@patternfly/react-core';
import { CheckIcon } from '@patternfly/react-icons';
import type { MessagePageCount, MessagePageView } from '@app/api/inbox';

const MUTED = 'var(--pf-t--global--text--color--subtle)';

function CountLabel({ count, replied }: { count: MessagePageCount; replied: boolean }) {
  const text = `${count.title} · ${count.count}`;
  return (
    <Label
      color={count.count > 0 ? 'blue' : 'grey'}
      icon={replied ? <CheckIcon /> : undefined}
      aria-label={replied ? `${count.title}: replied` : undefined}
    >
      {text}
    </Label>
  );
}

/** What the customer did on the page an interactive message was sent as; shown under the message's link. */
export const MessagePageCard: React.FunctionComponent<{ page: MessagePageView }> = ({ page }) => {
  const expired = new Date(page.expiresAt).getTime() < Date.now();
  const opened = page.openedAt !== null ? `Opened · ${page.openCount}` : 'Not opened';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pf-t--global--spacer--xs)',
        marginBottom: 'var(--pf-t--global--spacer--xs)',
        fontSize: 'var(--pf-t--global--font--size--sm)',
      }}
    >
      <div
        style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', alignItems: 'baseline', flexWrap: 'wrap' }}
      >
        <strong>Interactive message</strong>
        <a href={page.url} target="_blank" rel="noreferrer">
          Open page
        </a>
        <span style={{ color: MUTED }}>{opened}</span>
        {expired && <span style={{ color: MUTED }}>Expired</span>}
      </div>
      {(page.buttons.length > 0 || page.rows.length > 0 || page.cta) && (
        <LabelGroup numLabels={12}>
          {page.buttons.map((b) => (
            <CountLabel key={b.id} count={b} replied={b.replied} />
          ))}
          {page.rows.map((r) => (
            <CountLabel key={r.id} count={r} replied={r.replied} />
          ))}
          {page.cta && <Label color={page.cta.count > 0 ? 'blue' : 'grey'}>{`Link opened · ${page.cta.count}`}</Label>}
        </LabelGroup>
      )}
      {page.location && (
        <a
          href={`https://maps.google.com/?q=${page.location.latitude},${page.location.longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          Shared location
        </a>
      )}
    </div>
  );
};
