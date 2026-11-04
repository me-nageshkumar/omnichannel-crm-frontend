import * as React from 'react';
import type { CrmContact } from '@app/api/crm';
import { adLink } from '@app/Inbox/chatDisplay';
import { adOriginParts, originLine } from '@app/Crm/Contacts/contactColumns';

/** The origin sentence, with a click-to-WhatsApp ad's headline linked to the ad when it has a web address. */
export function originNode(c: CrmContact): React.ReactNode {
  const ad = adOriginParts(c);
  const href = adLink(c.origin?.ad?.sourceUrl ?? null);
  if (!ad?.headline || !href) return originLine(c);
  return (
    <>
      {ad.before} {'“'}
      <a href={href} target="_blank" rel="noopener noreferrer">
        {ad.headline}
      </a>
      {'”'} {ad.after}
    </>
  );
}
