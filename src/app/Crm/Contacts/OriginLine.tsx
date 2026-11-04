import * as React from 'react';
import type { CrmContact } from '@app/api/crm';
import { adLink } from '@app/Inbox/chatDisplay';
import { formatDate, originLine } from '@app/Crm/Contacts/contactColumns';

/** The origin sentence, with a click-to-WhatsApp ad's headline linked to the ad when it has a web address. */
export function originNode(c: CrmContact): React.ReactNode {
  const headline = c.origin?.ad?.headline;
  const href = adLink(c.origin?.ad?.sourceUrl ?? null);
  if (c.origin?.kind !== 'CTWA_AD' || !headline || !href) return originLine(c);
  return (
    <>
      Came from a click-to-WhatsApp ad {'“'}
      <a href={href} target="_blank" rel="noopener noreferrer">
        {headline}
      </a>
      {'”'} on {formatDate(c.creationTime)}
    </>
  );
}
