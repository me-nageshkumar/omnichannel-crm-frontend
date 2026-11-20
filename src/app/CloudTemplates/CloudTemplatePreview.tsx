import * as React from 'react';
import { Label } from '@patternfly/react-core';
import type { CloudTemplate } from '@app/api/cloudTemplates';

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*}}/g;

/** The text with each {{…}} as its value when one is given, else as a chip naming the blank. */
function filled(text: string, part: string, values?: Record<string, string>): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  const re = new RegExp(PLACEHOLDER.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    const value = values?.[`${part}:${m[1]}`];
    out.push(
      value?.trim() ? (
        <strong key={at}>{value}</strong>
      ) : (
        <Label key={at} isCompact color="blue">{`{{${m[1]}}}`}</Label>
      ),
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A WhatsApp template drawn from Meta's components: header, body, footer and buttons. */
export const CloudTemplatePreview: React.FunctionComponent<{
  template: CloudTemplate;
  values?: Record<string, string>;
}> = ({ template, values }) => {
  const parts = template.components ?? [];
  const header = parts.find((c) => c.type?.toUpperCase() === 'HEADER');
  const body = parts.find((c) => c.type?.toUpperCase() === 'BODY');
  const footer = parts.find((c) => c.type?.toUpperCase() === 'FOOTER');
  const buttons = parts.find((c) => c.type?.toUpperCase() === 'BUTTONS')?.buttons ?? [];
  return (
    <div className="omni-template-preview" aria-label={`Preview of ${template.name}`}>
      {header &&
        (header.format?.toUpperCase() === 'TEXT' || !header.format ? (
          <p>
            <strong>{filled(header.text ?? '', 'header', values)}</strong>
          </p>
        ) : (
          <p>
            <Label isCompact>{`${header.format.toLowerCase()} header`}</Label>
          </p>
        ))}
      {body && <p className="omni-template-preview__body">{filled(body.text ?? '', 'body', values)}</p>}
      {footer?.text && <p className="pf-v6-u-font-size-sm pf-v6-u-color-200">{footer.text}</p>}
      {buttons.length > 0 && (
        <ul aria-label="Buttons" className="omni-template-preview__buttons">
          {buttons.map((b, i) => (
            <li key={i}>
              <Label isCompact variant="outline">
                {b.text ?? b.type}
              </Label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
