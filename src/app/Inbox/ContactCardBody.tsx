import * as React from 'react';

export interface ContactCard {
  name: string | null;
  phones: string[];
  emails: string[];
}

/** vCard escapes: "\n" is a line break, "\," "\;" "\\" the character itself. */
const unescape = (value: string) =>
  value.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** From N (family;given;middle;prefix;suffix), for a card without FN: "given middle family". */
const nameFromParts = (value: string) => {
  const [family = '', given = '', middle = ''] = value.split(';').map((part) => unescape(part).trim());
  return [given, middle, family].filter(Boolean).join(' ') || null;
};

/** The cards in the vCard text a vcard or multi_vcard message carries; WhatsApp writes version 3.0. */
export function parseContactCards(body: string | null): ContactCard[] {
  if (!body) return [];
  // a line that starts with a space or tab continues the one before it
  const lines = body
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
  const cards: ContactCard[] = [];
  let card: (ContactCard & { parts: string | null }) | null = null;
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line
      .slice(0, colon)
      .split(';')[0]
      .replace(/^item\d+\./i, '')
      .toUpperCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'BEGIN' && value.toUpperCase() === 'VCARD') {
      card = { name: null, phones: [], emails: [], parts: null };
    } else if (card && key === 'END') {
      cards.push({
        name: card.name ?? (card.parts ? nameFromParts(card.parts) : null),
        phones: card.phones,
        emails: card.emails,
      });
      card = null;
    } else if (card && value) {
      if (key === 'FN') card.name = unescape(value) || null;
      else if (key === 'N') card.parts = value;
      else if (key === 'TEL') card.phones.push(unescape(value));
      else if (key === 'EMAIL') card.emails.push(unescape(value));
    }
  }
  return cards;
}

export const ContactCardBody: React.FunctionComponent<{ body: string | null }> = ({ body }) => {
  const cards = parseContactCards(body);
  if (cards.length === 0) return <em>Contact card</em>;
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pf-t--global--spacer--sm)', whiteSpace: 'normal' }}
    >
      {cards.map((card, i) => (
        <div key={i} role="group" aria-label={`Contact card: ${card.name ?? 'no name'}`}>
          <div>
            <span aria-hidden="true">👤 </span>
            <strong>{card.name ?? 'Contact'}</strong>
          </div>
          {card.phones.map((phone) => (
            <div key={phone}>{phone}</div>
          ))}
          {card.emails.map((email) => (
            <div key={email}>{email}</div>
          ))}
        </div>
      ))}
    </div>
  );
};
