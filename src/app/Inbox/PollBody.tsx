import * as React from 'react';
import type { MessageView } from '@app/api/inbox';
import { votesText } from '@app/Inbox/chatDisplay';
import { formatWhatsApp } from '@app/Templates/placeholders';

const SUBTLE = 'var(--pf-t--global--text--color--subtle)';

/** A poll: the question, each option with its share of the voters and who chose it, and how many have voted. */
export const PollBody: React.FunctionComponent<{
  message: MessageView;
  /** Who a vote not from this number came from: a person chat has only the one contact. */
  contact: string;
}> = ({ message, contact }) => {
  const { body, pollOptions } = message;
  const votes = message.pollVotes ?? [];
  return (
    <div style={{ minWidth: 'min(240px, 100%)', whiteSpace: 'normal' }}>
      <small style={{ display: 'block', color: SUBTLE }}>Poll</small>
      {body && <strong style={{ display: 'block', marginBlockEnd: 6 }}>{formatWhatsApp(body)}</strong>}
      {pollOptions && pollOptions.length > 0 && (
        <ul aria-label="Poll options" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {pollOptions.map((option, index) => {
            const voters = votes.filter((vote) => vote.options.includes(index));
            const share = votes.length > 0 ? Math.round((voters.length * 100) / votes.length) : 0;
            return (
              <li key={index} aria-label={`${option}: ${votesText(voters.length)}`} style={{ marginBlockEnd: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{option}</span>
                  <span aria-hidden="true" style={{ color: SUBTLE }}>
                    {voters.length}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  style={{
                    height: 6,
                    borderRadius: 3,
                    overflow: 'hidden',
                    background: 'var(--pf-t--global--background--color--secondary--hover)',
                  }}
                >
                  <div
                    data-poll-bar
                    style={{
                      width: `${share}%`,
                      height: '100%',
                      background: 'var(--pf-t--global--color--brand--default)',
                    }}
                  />
                </div>
                {voters.length > 0 && (
                  <small style={{ display: 'block', color: SUBTLE }}>
                    {voters.map((vote, i) => (
                      <React.Fragment key={vote.voter}>
                        {i > 0 && ', '}
                        <span>{vote.fromMe ? 'You' : contact}</span>
                      </React.Fragment>
                    ))}
                  </small>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <small style={{ color: SUBTLE }}>{votes.length > 0 ? votesText(votes.length) : 'No votes yet'}</small>
    </div>
  );
};
