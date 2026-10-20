import * as React from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  FormGroup,
  FormHelperText,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  TextInput,
} from '@patternfly/react-core';
import type { ContactAttribute } from '@app/api/contacts';
import type { PlaceholderRef } from '@app/Templates/placeholders';
import { Setting, Settings, settingFor } from '@app/Templates/editorModel';

/** What a contact placeholder reads from, in words. */
function describe(ref: PlaceholderRef, attributes: ContactAttribute[], known: Record<string, string>): string {
  if (ref.name === 'contact.name') return 'Contact name';
  if (ref.name === 'contact.phone') return 'Contact phone';
  const key = ref.attributeKey as string;
  const name = attributes.find((a) => a.key === key)?.name ?? known[ref.name];
  return `Contact attribute: ${name ?? key}`;
}

const FieldError: React.FunctionComponent<{ text?: string }> = ({ text }) =>
  text ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{text}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

/**
 * One row per placeholder now in the content, in field order. The settings live in the editor, keyed by
 * name and never pruned, so a placeholder typed away and back keeps what was entered.
 */
export const PlaceholdersPanel: React.FunctionComponent<{
  refs: PlaceholderRef[];
  settings: Settings;
  onChange(ref: PlaceholderRef, patch: Partial<Setting>): void;
  readOnly: boolean;
  /** Keyed `placeholders.<name>.<setting>`. */
  errors: Record<string, string>;
  attributes: ContactAttribute[];
  /** Attribute names the template already knew, by placeholder name (for attributes since deleted). */
  knownNames: Record<string, string>;
}> = ({ refs, settings, onChange, readOnly, errors, attributes, knownNames }) => (
  <Card isCompact>
    <CardTitle>Placeholders</CardTitle>
    <CardBody>
      {errors.placeholders && <FieldError text={errors.placeholders} />}
      {refs.length === 0 ? (
        <HelperText>
          <HelperTextItem>
            Use Insert placeholder to add the contact&apos;s name or phone, a contact attribute, or a field the agent
            fills in when sending.
          </HelperTextItem>
        </HelperText>
      ) : (
        refs.map((ref) => {
          const s = settingFor(settings, ref);
          const err = (setting: string) => errors[`placeholders.${ref.name}.${setting}`];
          const key = (setting: string) => `placeholder-${ref.name}-${setting}`;
          const agent = ref.kind === 'AGENT';
          return (
            <Grid hasGutter key={ref.name} style={{ marginBottom: 16 }}>
              <GridItem span={12}>
                <code>{`{{${ref.name}}}`}</code>{' '}
                {agent ? 'Filled in by the agent' : describe(ref, attributes, knownNames)}
                <FieldError text={errors[`placeholders.${ref.name}`]} />
              </GridItem>
              {agent && (
                <>
                  <GridItem md={6}>
                    <FormGroup label="Label" fieldId={key('label')}>
                      <TextInput
                        id={key('label')}
                        aria-label={`Label for ${ref.name}`}
                        value={s.label}
                        isDisabled={readOnly}
                        validated={err('label') ? 'error' : 'default'}
                        onChange={(_e, v) => onChange(ref, { label: v })}
                      />
                      <FieldError text={err('label')} />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Example" fieldId={key('example')}>
                      <TextInput
                        id={key('example')}
                        aria-label={`Example for ${ref.name}`}
                        value={s.example}
                        isDisabled={readOnly}
                        validated={err('example') ? 'error' : 'default'}
                        onChange={(_e, v) => onChange(ref, { example: v })}
                      />
                      <FieldError text={err('example')} />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <Checkbox
                      id={key('required')}
                      label="Required"
                      aria-label={`Required: ${ref.name}`}
                      isChecked={s.required}
                      isDisabled={readOnly}
                      onChange={(_e, checked) => onChange(ref, { required: checked })}
                    />
                  </GridItem>
                </>
              )}
              {(!agent || !s.required) && (
                <GridItem md={agent ? 6 : 12}>
                  <FormGroup label="Fallback" fieldId={key('fallback')}>
                    <TextInput
                      id={key('fallback')}
                      aria-label={`Fallback for ${ref.name}`}
                      value={s.fallback}
                      isDisabled={readOnly}
                      validated={err('fallback') ? 'error' : 'default'}
                      onChange={(_e, v) => onChange(ref, { fallback: v })}
                    />
                    <FieldError text={err('fallback')} />
                    {!err('fallback') && (
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem>
                            {agent ? 'Used when the field is left empty.' : 'Used when the contact has no value.'}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    )}
                  </FormGroup>
                </GridItem>
              )}
            </Grid>
          );
        })
      )}
    </CardBody>
  </Card>
);
