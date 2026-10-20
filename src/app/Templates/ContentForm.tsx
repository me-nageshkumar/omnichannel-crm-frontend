import * as React from 'react';
import {
  Button,
  Flex,
  FlexItem,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Switch,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { PlusCircleIcon, TimesIcon } from '@patternfly/react-icons';
import type { ContactAttribute } from '@app/api/contacts';
import type { MediaView, TemplateContent, TemplateType } from '@app/api/templates';
import { InsertPlaceholderMenu } from '@app/Templates/InsertPlaceholderMenu';
import { MediaField } from '@app/Templates/MediaField';
import { LIMITS, MAX_OPTIONS, MIN_OPTIONS, isMediaType } from '@app/Templates/editorModel';
import { PLACEHOLDER_FIELDS } from '@app/Templates/placeholders';

type Control = HTMLInputElement | HTMLTextAreaElement;

const FORMATS = [
  { label: 'Bold', mark: '*', face: <strong>B</strong> },
  { label: 'Italic', mark: '_', face: <em>I</em> },
  { label: 'Strikethrough', mark: '~', face: <s>S</s> },
  { label: 'Monospace', mark: '```', face: <code>M</code> },
];

export interface ContentFormProps {
  type: TemplateType;
  content: TemplateContent;
  onChange(patch: Partial<TemplateContent>): void;
  /** No input may be changed; Insert, Upload and the formatting toolbar are hidden. */
  readOnly: boolean;
  /** Keyed by control (`content.body`, `content.options.1`, `mediaId`). */
  errors: Record<string, string>;
  attributes: ContactAttribute[];
  media: MediaView | null;
  upload(file: File): Promise<MediaView>;
  onMedia(media: MediaView): void;
}

/** The fields of one template type. Text fields remember their caret, so Insert and the toolbar act where the user was. */
export const ContentForm: React.FunctionComponent<ContentFormProps> = ({
  type,
  content,
  onChange,
  readOnly,
  errors,
  attributes,
  media,
  upload,
  onMedia,
}) => {
  const nodes = React.useRef<Record<string, React.RefObject<Control | null>>>({});
  const carets = React.useRef<Record<string, [number, number]>>({});
  const pending = React.useRef<{ key: string; pos: number } | null>(null);

  const nodeFor = (key: string) => (nodes.current[key] ??= { current: null });
  const remember = (key: string) => () => {
    const el = nodes.current[key]?.current;
    if (el && el.selectionStart !== null)
      carets.current[key] = [el.selectionStart, el.selectionEnd ?? el.selectionStart];
  };

  const read = (key: string): string => {
    const rest = key.slice('content.'.length);
    if (rest.startsWith('options.')) return content.options?.[Number(rest.slice('options.'.length))] ?? '';
    return (content[rest as keyof TemplateContent] as string | null) ?? '';
  };
  const write = (key: string, value: string) => {
    const rest = key.slice('content.'.length);
    if (rest.startsWith('options.')) {
      const i = Number(rest.slice('options.'.length));
      onChange({ options: (content.options ?? []).map((o, j) => (j === i ? value : o)) });
    } else {
      onChange({ [rest]: value } as Partial<TemplateContent>);
    }
  };

  const edit = (key: string, make: (v: string, start: number, end: number) => { value: string; caret: number }) => {
    const v = read(key);
    const [s0, e0] = carets.current[key] ?? [v.length, v.length];
    const start = Math.min(s0, v.length);
    const end = Math.min(Math.max(e0, start), v.length);
    const next = make(v, start, end);
    pending.current = { key, pos: next.caret };
    write(key, next.value);
  };
  const insertAt = (key: string, text: string) =>
    edit(key, (v, s, e) => ({ value: v.slice(0, s) + text + v.slice(e), caret: s + text.length }));
  const wrap = (key: string, mark: string) =>
    edit(key, (v, s, e) => ({
      value: v.slice(0, s) + mark + v.slice(s, e) + mark + v.slice(e),
      caret: s === e ? s + mark.length : e + 2 * mark.length,
    }));

  React.useLayoutEffect(() => {
    const p = pending.current;
    pending.current = null;
    const el = p && nodes.current[p.key]?.current;
    if (p && el) {
      el.focus();
      el.setSelectionRange(p.pos, p.pos);
      carets.current[p.key] = [p.pos, p.pos];
    }
  });

  const canInsert = !readOnly;
  const hasPlaceholders = (field: keyof TemplateContent) => PLACEHOLDER_FIELDS[type].includes(field);
  const helper = (key: string, max?: number, extra?: string) => {
    const error = errors[key];
    if (!error && !max && !extra) return null;
    return (
      <FormHelperText>
        <HelperText>
          {error && <HelperTextItem variant="error">{error}</HelperTextItem>}
          {extra && !error && <HelperTextItem>{extra}</HelperTextItem>}
          {max && <HelperTextItem>{`${read(key).length} / ${max}`}</HelperTextItem>}
        </HelperText>
      </FormHelperText>
    );
  };

  const input = (key: string, label: string, area = false, aria = false) => {
    const common = {
      id: key,
      value: read(key),
      isDisabled: readOnly,
      validated: errors[key] ? ('error' as const) : ('default' as const),
      onBlur: remember(key),
      onSelect: remember(key),
      onKeyUp: remember(key),
      onClick: remember(key),
      ...(aria ? { 'aria-label': label } : {}),
    };
    return area ? (
      <TextArea
        {...common}
        ref={nodeFor(key) as React.RefObject<HTMLTextAreaElement>}
        rows={6}
        resizeOrientation="vertical"
        onChange={(_e, v) => write(key, v)}
      />
    ) : (
      <TextInput
        {...common}
        ref={nodeFor(key) as React.RefObject<HTMLInputElement>}
        onChange={(_e, v) => write(key, v)}
      />
    );
  };

  const insertMenu = (field: keyof TemplateContent, key: string, label: string) =>
    canInsert &&
    hasPlaceholders(field) && (
      <InsertPlaceholderMenu fieldLabel={label} attributes={attributes} onInsert={(text) => insertAt(key, text)} />
    );

  const text = (
    field: keyof TemplateContent,
    label: string,
    opts: { area?: boolean; max?: number; toolbar?: boolean } = {},
  ) => {
    const key = `content.${field}`;
    return (
      <FormGroup label={label} fieldId={key} key={key}>
        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
          {opts.toolbar &&
            !readOnly &&
            FORMATS.map((f) => (
              <FlexItem key={f.label}>
                <Button variant="control" size="sm" aria-label={f.label} onClick={() => wrap(key, f.mark)}>
                  {f.face}
                </Button>
              </FlexItem>
            ))}
          <FlexItem align={{ default: 'alignRight' }}>{insertMenu(field, key, label)}</FlexItem>
        </Flex>
        {input(key, label, opts.area)}
        {helper(key, opts.max)}
      </FormGroup>
    );
  };

  const number = (field: 'latitude' | 'longitude', label: string, hint: string) => {
    const key = `content.${field}`;
    return (
      <FormGroup label={label} fieldId={key}>
        <TextInput
          id={key}
          type="number"
          step="any"
          value={content[field] ?? ''}
          isDisabled={readOnly}
          validated={errors[key] ? 'error' : 'default'}
          onChange={(_e, v) => onChange({ [field]: v === '' ? null : Number(v) })}
        />
        {helper(key, undefined, hint)}
      </FormGroup>
    );
  };

  const toggle = (
    field: 'linkPreview' | 'voiceNote' | 'allowMultiple',
    label: string,
    fallback: boolean,
    off = false,
  ) => (
    <FormGroup fieldId={`content.${field}`}>
      <Switch
        id={`content.${field}`}
        label={label}
        aria-label={label}
        isChecked={content[field] ?? fallback}
        isDisabled={readOnly || off}
        onChange={(_e, checked) => onChange({ [field]: checked })}
      />
    </FormGroup>
  );

  const mediaField = (
    <FormGroup label="File" fieldId={`media-${type}`}>
      <MediaField
        type={type}
        media={media}
        readOnly={readOnly}
        upload={upload}
        onUploaded={onMedia}
        error={errors.mediaId}
      />
    </FormGroup>
  );

  if (type === 'TEXT') {
    return (
      <>
        {text('body', 'Message', { area: true, max: LIMITS.body, toolbar: true })}
        {toggle('linkPreview', 'Show link preview', true)}
      </>
    );
  }
  if (type === 'AUDIO') {
    const ogg = media?.mimeType.startsWith('audio/ogg') ?? false;
    return (
      <>
        {mediaField}
        {toggle('voiceNote', 'Send as voice note', false, !ogg)}
        <HelperText>
          <HelperTextItem>Only OGG audio can be sent as a voice note.</HelperTextItem>
        </HelperText>
      </>
    );
  }
  if (isMediaType(type)) {
    return (
      <>
        {mediaField}
        {text('caption', 'Caption', { area: true, max: LIMITS.caption })}
      </>
    );
  }
  if (type === 'LOCATION') {
    return (
      <>
        {number('latitude', 'Latitude', 'Between -90 and 90')}
        {number('longitude', 'Longitude', 'Between -180 and 180')}
        {text('name', 'Location name')}
        {text('address', 'Address')}
      </>
    );
  }
  if (type === 'CONTACT_CARD') {
    return (
      <>
        {text('fullName', 'Full name')}
        {text('phone', 'Phone')}
        {text('organization', 'Organization')}
        {text('email', 'Email')}
      </>
    );
  }

  const options = content.options ?? [];
  return (
    <>
      {text('question', 'Question')}
      <FormGroup label="Options" role="group" fieldId="content.options">
        {options.map((_o, i) => {
          const key = `content.options.${i}`;
          const label = `Option ${i + 1}`;
          return (
            <FormGroup key={i} fieldId={key}>
              <Flex alignItems={{ default: 'alignItemsCenter' }} flexWrap={{ default: 'nowrap' }}>
                <FlexItem grow={{ default: 'grow' }}>{input(key, label, false, true)}</FlexItem>
                <FlexItem>{insertMenu('options', key, label)}</FlexItem>
                {!readOnly && (
                  <FlexItem>
                    <Button
                      variant="plain"
                      aria-label={`Remove option ${i + 1}`}
                      icon={<TimesIcon />}
                      isDisabled={options.length <= MIN_OPTIONS}
                      onClick={() => onChange({ options: options.filter((_x, j) => j !== i) })}
                    />
                  </FlexItem>
                )}
              </Flex>
              {helper(key)}
            </FormGroup>
          );
        })}
        {!readOnly && (
          <Button
            variant="link"
            icon={<PlusCircleIcon />}
            isDisabled={options.length >= MAX_OPTIONS}
            onClick={() => onChange({ options: [...options, ''] })}
          >
            Add option
          </Button>
        )}
        {helper('content.options', undefined, `${MIN_OPTIONS} to ${MAX_OPTIONS} different options`)}
      </FormGroup>
      {toggle('allowMultiple', 'Allow multiple answers', false)}
    </>
  );
};
