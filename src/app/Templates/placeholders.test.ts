import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { render } from '@testing-library/react';
import { PLACEHOLDER_FIELDS, fillPreview, formatWhatsApp, parsePlaceholders } from '@app/Templates/placeholders';

const errorOf = (text: string) => parsePlaceholders(text).error;

function html(text: string): string {
  const { container } = render(React.createElement('div', null, formatWhatsApp(text)));
  return container.innerHTML;
}

describe('parsePlaceholders', () => {
  it('parsesAllKinds', () => {
    const { refs, error } = parsePlaceholders(
      'Hi {{contact.name}} {{contact.phone}} {{contact.attributes.city}} {{order_id}}',
    );
    expect(error).toBeNull();
    expect(refs).toEqual([
      { name: 'contact.name', kind: 'CONTACT_FIELD', attributeKey: null },
      { name: 'contact.phone', kind: 'CONTACT_FIELD', attributeKey: null },
      { name: 'contact.attributes.city', kind: 'CONTACT_ATTRIBUTE', attributeKey: 'city' },
      { name: 'order_id', kind: 'AGENT', attributeKey: null },
    ]);
  });

  it('normalisesWhitespace', () => {
    expect(parsePlaceholders('{{  x  }} and {{ contact.name}}').refs.map((r) => r.name)).toEqual(['x', 'contact.name']);
  });

  it('distinctInOrder', () => {
    expect(parsePlaceholders('{{b}} {{a}} {{ b }} {{a}} {{c}}').refs.map((r) => r.name)).toEqual(['b', 'a', 'c']);
  });

  it.each([
    ['rejectsSection', '{{#x}}a{{/x}}', '{{#'],
    ['rejectsInverted', '{{^x}}a{{/x}}', '{{^'],
    ['rejectsPartial', '{{>x}}', '{{>'],
    ['rejectsComment', '{{!x}}', '{{!'],
    ['rejectsTripleBrace', '{{{x}}}', '{{{'],
    ['rejectsAmpersand', '{{&x}}', '{{&'],
    ['rejectsDelimiterChange', '{{=<% %>=}}', '{{='],
    ['rejectsClosingSection', '{{/x}}', '{{/'],
  ])('%s', (_n, text, seq) => {
    expect(errorOf(text)).toBe(`"${seq}" is not allowed — only {{name}} placeholders are supported`);
  });

  it('rejectsUnclosed', () => {
    expect(errorOf('Hello {{name')).toBe('unclosed "{{"');
    expect(errorOf('Hello {{')).toBe('unclosed "{{"');
  });

  it('rejectsUppercaseName', () => {
    expect(errorOf('{{Order}}')).toBe('invalid placeholder "{{Order}}"');
  });

  it('rejectsDashName', () => {
    expect(errorOf('{{order-id}}')).toBe('invalid placeholder "{{order-id}}"');
  });

  it('rejectsEmptyAndSpacedNames', () => {
    expect(errorOf('{{}}')).toBe('invalid placeholder "{{}}"');
    expect(errorOf('{{a b}}')).toBe('invalid placeholder "{{a b}}"');
    expect(errorOf('{{a.b}}')).toBe('invalid placeholder "{{a.b}}"');
    expect(errorOf('{{1a}}')).toBe('invalid placeholder "{{1a}}"');
  });

  it('rejectsReservedContact', () => {
    expect(errorOf('{{contact}}')).toBe('"{{contact}}" is not a contact field');
    expect(errorOf('{{contact.x}}')).toBe('"{{contact.x}}" is not a contact field');
    expect(errorOf('{{contact.attributes}}')).toBe('"{{contact.attributes}}" is not a contact field');
    expect(errorOf('{{contact.name.x}}')).toBe('"{{contact.name.x}}" is not a contact field');
  });

  it('rejectsLongName', () => {
    const forty = 'a' + 'b'.repeat(39);
    expect(errorOf(`{{${forty}}}`)).toBeNull();
    const long = forty + 'c';
    expect(long).toHaveLength(41);
    expect(errorOf(`{{${long}}}`)).toBe(`invalid placeholder "{{${long}}}"`);
    expect(errorOf(`{{contact.attributes.${long}}}`)).toBe(`invalid placeholder "{{contact.attributes.${long}}}"`);
  });

  it('plainTextHasNoRefs', () => {
    expect(parsePlaceholders('Just text, no braces.')).toEqual({ refs: [], error: null });
    expect(parsePlaceholders('')).toEqual({ refs: [], error: null });
  });

  it('singleBraceIsText', () => {
    expect(parsePlaceholders('{x} and {name}')).toEqual({ refs: [], error: null });
  });

  it('parseDoesNotLimitCount', () => {
    const text = Array.from({ length: 25 }, (_, i) => `{{p${i}}}`).join(' ');
    const { refs, error } = parsePlaceholders(text);
    expect(error).toBeNull();
    expect(refs).toHaveLength(25);
  });
});

describe('fillPreview', () => {
  it('replacesKnownAndBracketsUnknown', () => {
    expect(
      fillPreview('Hi {{ contact.name }}, order {{order_id}}, {{other}}', { 'contact.name': 'Asha', order_id: '42' }),
    ).toBe('Hi Asha, order 42, [other]');
  });

  it('keepsAnEmptyValueEmpty', () => {
    expect(fillPreview('a{{x}}b', { x: '' })).toBe('ab');
  });

  it('leavesMalformedBracesAlone', () => {
    expect(fillPreview('{x} {{Bad}} {{', {})).toBe('{x} {{Bad}} {{');
  });

  it('doesNotReadInheritedProperties', () => {
    expect(fillPreview('{{constructor}}', {})).toBe('[constructor]');
  });
});

describe('formatWhatsApp', () => {
  it('rendersBold', () => expect(html('a *b* c')).toBe('<div>a <strong>b</strong> c</div>'));
  it('rendersItalic', () => expect(html('a _b_ c')).toBe('<div>a <em>b</em> c</div>'));
  it('rendersStrike', () => expect(html('a ~b~ c')).toBe('<div>a <s>b</s> c</div>'));
  it('rendersMono', () => expect(html('a ```b``` c')).toBe('<div>a <code>b</code> c</div>'));

  it('keepsNestedTextLiteral', () => {
    expect(html('*a _b_ c*')).toBe('<div><strong>a _b_ c</strong></div>');
    expect(html('```*a*```')).toBe('<div><code>*a*</code></div>');
  });

  it('keepsNewlines', () => {
    const { container } = render(React.createElement('div', null, formatWhatsApp('one\n*two*\nthree')));
    expect(container.textContent).toBe('one\ntwo\nthree');
    expect(container.querySelector('strong')?.textContent).toBe('two');
  });

  it('doesNotSpanLines', () => {
    expect(html('*a\nb*')).toBe('<div>*a\nb*</div>');
  });

  it('needsNonSpaceEdges', () => {
    expect(html('2 * 3 * 4')).toBe('<div>2 * 3 * 4</div>');
    expect(html('a ** b')).toBe('<div>a ** b</div>');
  });

  it('showsScriptAsText', () => {
    const { container } = render(
      React.createElement('div', null, formatWhatsApp('<script>alert(1)</script> *<b>x</b>*')),
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toBe('<script>alert(1)</script> <b>x</b>');
  });
});

describe('PLACEHOLDER_FIELDS', () => {
  it('listsTheFieldsThatAllowPlaceholders', () => {
    expect(PLACEHOLDER_FIELDS).toEqual({
      TEXT: ['body'],
      IMAGE: ['caption'],
      VIDEO: ['caption'],
      DOCUMENT: ['caption'],
      AUDIO: [],
      LOCATION: ['name', 'address'],
      CONTACT_CARD: ['fullName', 'organization'],
      POLL: ['question', 'options'],
    });
  });
});
