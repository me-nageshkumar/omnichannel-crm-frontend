import * as React from 'react';
import { Button, FormSelect, FormSelectOption, Switch, TextInput } from '@patternfly/react-core';
import { AngleDownIcon, AngleUpIcon, TimesIcon } from '@patternfly/react-icons';
import { LANE_COLOR_OPTIONS } from '@app/Crm/Settings/laneColors';

export interface OptionDraft {
  /** Stable row id for React; not sent. */
  uid: string;
  key: string;
  label: string;
  color: string | null;
  active: boolean;
  /** Saved on the server: the key is fixed and the option can only be switched off. */
  saved: boolean;
}

/** An option key from a label: lower case, a-z 0-9 and _, at most 40 characters. */
export function optionKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** The key a new option gets: from its label, made unique among the others. */
function uniqueKey(label: string, others: OptionDraft[]): string {
  const base = optionKey(label) || 'option';
  let key = base;
  for (let n = 2; others.some((o) => o.key === key); n++) key = `${base.slice(0, 37)}_${n}`;
  return key;
}

let uidSeq = 0;
export const newOptionDraft = (): OptionDraft => ({
  uid: `new-${++uidSeq}`,
  key: '',
  label: '',
  color: null,
  active: true,
  saved: false,
});

/** The options of a choice field: add, rename, colour, move up or down, switch off (saved) or remove (new). */
export const OptionsEditor: React.FunctionComponent<{
  options: OptionDraft[];
  onChange(next: OptionDraft[]): void;
  readOnly?: boolean;
}> = ({ options, onChange, readOnly }) => {
  const patch = (uid: string, p: Partial<OptionDraft>) =>
    onChange(options.map((o) => (o.uid === uid ? { ...o, ...p } : o)));
  const move = (i: number, by: number) => {
    const next = [...options];
    const [row] = next.splice(i, 1);
    next.splice(i + by, 0, row);
    onChange(next);
  };
  return (
    <div>
      <ol
        aria-label="Options"
        style={{ margin: 0, padding: 0, display: 'grid', gap: 'var(--pf-t--global--spacer--sm)' }}
      >
        {options.map((o, i) => {
          const name = o.label.trim() || `option ${i + 1}`;
          return (
            <li
              key={o.uid}
              style={{
                listStyle: 'none',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--pf-t--global--spacer--sm)',
                opacity: o.active ? 1 : 0.6,
              }}
            >
              <TextInput
                aria-label="Option label"
                value={o.label}
                isDisabled={readOnly}
                style={{ minWidth: '10rem', flex: '1 1 10rem' }}
                onChange={(_e, label) =>
                  patch(
                    o.uid,
                    o.saved
                      ? { label }
                      : {
                          label,
                          key: uniqueKey(
                            label,
                            options.filter((x) => x.uid !== o.uid),
                          ),
                        },
                  )
                }
              />
              <FormSelect
                aria-label={`Colour of ${name}`}
                value={o.color ?? ''}
                isDisabled={readOnly}
                onChange={(_e, v) => patch(o.uid, { color: v || null })}
                style={{ maxWidth: '8rem' }}
              >
                <FormSelectOption value="" label="No colour" />
                {LANE_COLOR_OPTIONS.map((c) => (
                  <FormSelectOption key={c.hex} value={c.hex} label={c.name} />
                ))}
              </FormSelect>
              <span className="pf-v6-u-font-size-sm pf-v6-u-color-200">{o.key ? `Key: ${o.key}` : ''}</span>
              {!readOnly && (
                <>
                  <Button
                    variant="plain"
                    aria-label={`Move ${name} up`}
                    isDisabled={i === 0}
                    icon={<AngleUpIcon />}
                    onClick={() => move(i, -1)}
                  />
                  <Button
                    variant="plain"
                    aria-label={`Move ${name} down`}
                    isDisabled={i === options.length - 1}
                    icon={<AngleDownIcon />}
                    onClick={() => move(i, 1)}
                  />
                  {o.saved ? (
                    <Switch
                      id={`option-active-${o.uid}`}
                      aria-label={`${name} active`}
                      isChecked={o.active}
                      onChange={(_e, active) => patch(o.uid, { active })}
                    />
                  ) : (
                    <Button
                      variant="plain"
                      aria-label={`Remove ${name}`}
                      icon={<TimesIcon />}
                      onClick={() => onChange(options.filter((x) => x.uid !== o.uid))}
                    />
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <Button
          variant="link"
          isInline
          className="pf-v6-u-mt-sm"
          onClick={() => onChange([...options, newOptionDraft()])}
        >
          Add option
        </Button>
      )}
    </div>
  );
};
