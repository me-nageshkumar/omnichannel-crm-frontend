import * as React from 'react';
import { Label } from '@patternfly/react-core';
import type { TemplateSnapshot } from '@app/api/inbox';

/** A sent WhatsApp template as the customer saw it: header, body, footer and buttons. */
export const TemplateBubble: React.FunctionComponent<{ template: TemplateSnapshot }> = ({ template }) => (
  <div className="omni-template-bubble" aria-label={`WhatsApp template ${template.name}`}>
    {template.header?.format === 'TEXT' && template.header.text && (
      <p>
        <strong>{template.header.text}</strong>
      </p>
    )}
    {template.header && template.header.format !== 'TEXT' && template.header.format !== 'NONE' && (
      <p>
        <Label isCompact>{`${template.header.format.toLowerCase()} header`}</Label>
      </p>
    )}
    {template.body && <p style={{ whiteSpace: 'pre-wrap' }}>{template.body}</p>}
    {template.footer && <p className="pf-v6-u-font-size-sm pf-v6-u-color-200">{template.footer}</p>}
    {template.buttons.length > 0 && (
      <ul aria-label="Template buttons" style={{ listStyle: 'none', padding: 0, display: 'flex', gap: 4 }}>
        {template.buttons.map((b, i) => (
          <li key={i}>
            <Label isCompact variant="outline">
              {b.text || b.type}
            </Label>
          </li>
        ))}
      </ul>
    )}
  </div>
);
