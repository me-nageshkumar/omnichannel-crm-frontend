import { describe, expect, it } from 'vitest';
import {
  Mapping,
  MappingContext,
  decodeSource,
  defaultMapping,
  distinctPlaceholders,
  encodeSource,
  mappingProblems,
  mergeMappings,
  previewValues,
  sourceOptions,
  toPlaceholders,
} from '@app/Campaigns/mapping';
import { attribute, contact } from '../../test/contacts';
import { placeholderView, template } from '../../test/templates';

const city = attribute({ id: 'a1', name: 'City' });
const filterCtx: MappingContext = {
  kind: 'FILTER',
  headers: [],
  phoneColumn: null,
  nameColumn: null,
  attributes: [city],
};
const csvCtx: MappingContext = {
  kind: 'CSV',
  headers: ['Phone', 'First_Name', 'City', 'name'],
  phoneColumn: 'Phone',
  nameColumn: null,
  attributes: [city],
};
const cityPh = placeholderView({
  name: 'contact.attributes.city',
  kind: 'CONTACT_ATTRIBUTE',
  attributeKey: 'city',
  attributeId: 'a1',
  attributeName: 'City',
});
const namePh = placeholderView({ name: 'contact.name', kind: 'CONTACT_FIELD', fallback: 'there' });
const phonePh = placeholderView({ name: 'contact.phone', kind: 'CONTACT_FIELD' });
const offerPh = placeholderView({ name: 'offer' });

describe('mapping', () => {
  it('distinctPlaceholdersKeepFirstOccurrence', () => {
    const a = template({ id: 't1', placeholders: [namePh, offerPh] });
    const b = template({ id: 't2', placeholders: [placeholderView({ name: 'first_name' }), namePh] });
    expect(distinctPlaceholders([a, b]).map((p) => p.name)).toEqual(['contact.name', 'offer', 'first_name']);
    expect(distinctPlaceholders([a, b])[0]).toBe(namePh);
  });

  it('filterDefaultsUseTheContact', () => {
    expect(defaultMapping(namePh, filterCtx)).toEqual({
      source: { kind: 'CONTACT_FIELD', field: 'name' },
      fallback: 'there',
    });
    expect(defaultMapping(phonePh, filterCtx).source).toEqual({ kind: 'CONTACT_FIELD', field: 'phone' });
    expect(defaultMapping(cityPh, filterCtx).source).toEqual({ kind: 'CONTACT_ATTRIBUTE', attributeId: 'a1' });
    expect(defaultMapping(offerPh, filterCtx)).toEqual({ source: null, fallback: '' });
  });

  it('csvDefaultsMatchHeaders', () => {
    expect(defaultMapping(placeholderView({ name: 'first_name' }), csvCtx).source).toEqual({
      kind: 'CSV_COLUMN',
      column: 'First_Name',
    });
    expect(defaultMapping(phonePh, csvCtx).source).toEqual({ kind: 'CSV_COLUMN', column: 'Phone' });
    expect(defaultMapping(namePh, csvCtx).source).toEqual({ kind: 'CSV_COLUMN', column: 'name' });
    expect(defaultMapping(namePh, { ...csvCtx, nameColumn: 'First_Name' }).source).toEqual({
      kind: 'CSV_COLUMN',
      column: 'First_Name',
    });
    expect(defaultMapping(cityPh, csvCtx).source).toEqual({ kind: 'CSV_COLUMN', column: 'City' });
    expect(defaultMapping(offerPh, csvCtx).source).toBeNull();
  });

  it('mergeDropsStaleSources', () => {
    const fixed: Mapping = { source: { kind: 'FIXED', text: 'hi' }, fallback: '' };
    const prev: Record<string, Mapping> = {
      'contact.attributes.city': { source: { kind: 'CSV_COLUMN', column: 'City' }, fallback: 'x' },
      'contact.name': { source: { kind: 'CONTACT_FIELD', field: 'name' }, fallback: 'there' },
      offer: fixed,
      gone: fixed,
    };
    const noCity: MappingContext = { ...csvCtx, headers: ['Phone'] };
    const merged = mergeMappings(prev, [cityPh, namePh, offerPh], noCity);
    expect(merged['contact.attributes.city'].source).toBeNull();
    expect(merged['contact.name'].source).toBeNull();
    expect(merged.offer).toBe(fixed);
    expect(merged).not.toHaveProperty('gone');
    const kept = mergeMappings(prev, [cityPh, namePh], csvCtx);
    expect(kept['contact.attributes.city'].source).toEqual({ kind: 'CSV_COLUMN', column: 'City' });
    const filterKept = mergeMappings(prev, [namePh], filterCtx);
    expect(filterKept['contact.name']).toBe(prev['contact.name']);
    const attrGone = mergeMappings(
      { 'contact.attributes.city': { source: { kind: 'CONTACT_ATTRIBUTE', attributeId: 'a1' }, fallback: '' } },
      [cityPh],
      { ...filterCtx, attributes: [] },
    );
    expect(attrGone['contact.attributes.city'].source).toBeNull();
  });

  it('problemsListUnmappedAndReusedColumns', () => {
    const col = (column: string): Mapping => ({ source: { kind: 'CSV_COLUMN', column }, fallback: '' });
    const ps = [namePh, cityPh, offerPh, phonePh, placeholderView({ name: 'z' })];
    const problems = mappingProblems(ps, {
      'contact.name': { source: null, fallback: '' },
      'contact.attributes.city': col('City'),
      offer: { source: { kind: 'FIXED', text: ' ' }, fallback: '' },
      'contact.phone': col('Phone'),
      z: col('City'),
    });
    expect(problems.unmapped).toEqual(['contact.name', 'offer']);
    expect(problems.reused).toEqual(['z']);
    expect(
      mappingProblems([phonePh, namePh], { 'contact.phone': col('Phone'), 'contact.name': col('Name') }).reused,
    ).toEqual([]);
  });

  it('previewValuesFillFromContactRowOrFallback', () => {
    const ps = [namePh, phonePh, cityPh, offerPh];
    const maps: Record<string, Mapping> = {
      'contact.name': { source: { kind: 'CONTACT_FIELD', field: 'name' }, fallback: 'there' },
      'contact.phone': { source: { kind: 'CONTACT_FIELD', field: 'phone' }, fallback: '' },
      'contact.attributes.city': { source: { kind: 'CONTACT_ATTRIBUTE', attributeId: 'a1' }, fallback: 'town' },
      offer: { source: { kind: 'FIXED', text: '10% off' }, fallback: '' },
    };
    const c = contact({ id: 'c1', name: 'Asha', phone: '919800000001', attributes: { a1: 'Pune' } });
    expect(previewValues(ps, maps, { contact: c })).toEqual({
      'contact.name': 'Asha',
      'contact.phone': '+919800000001',
      'contact.attributes.city': 'Pune',
      offer: '10% off',
    });
    expect(previewValues(ps, maps, {})['contact.name']).toBe('there');
    const rowMaps: Record<string, Mapping> = {
      'contact.attributes.city': { source: { kind: 'CSV_COLUMN', column: 'City' }, fallback: 'town' },
    };
    expect(previewValues([cityPh], rowMaps, { row: { City: '' } })).toEqual({ 'contact.attributes.city': 'town' });
    expect(previewValues([cityPh], rowMaps, { row: { City: 'Goa' } })).toEqual({ 'contact.attributes.city': 'Goa' });
  });

  it('encodeAndDecodeRoundTrip', () => {
    const none: Mapping = { source: null, fallback: '' };
    const sources = [
      null,
      { kind: 'CONTACT_FIELD', field: 'name' },
      { kind: 'CONTACT_FIELD', field: 'phone' },
      { kind: 'CONTACT_ATTRIBUTE', attributeId: 'a1' },
      { kind: 'CSV_COLUMN', column: 'First_Name' },
    ] as const;
    sources.forEach((s) => expect(decodeSource(encodeSource(s), none)).toEqual(s));
    expect(encodeSource({ kind: 'FIXED', text: 'x' })).toBe('fixed');
    expect(encodeSource(null)).toBe('');
    expect(decodeSource('fixed', { source: { kind: 'FIXED', text: 'typed' }, fallback: '' })).toEqual({
      kind: 'FIXED',
      text: 'typed',
    });
    expect(decodeSource('fixed', none)).toEqual({ kind: 'FIXED', text: '' });
  });

  it('sourceOptionsListTheChoices', () => {
    expect(sourceOptions(filterCtx).map((o) => o.label)).toEqual([
      'Contact name',
      'Contact phone',
      'City',
      'Fixed text',
    ]);
    expect(sourceOptions(csvCtx).map((o) => o.value)).toEqual([
      'col:Phone',
      'col:First_Name',
      'col:City',
      'col:name',
      'fixed',
    ]);
  });

  it('toPlaceholdersBuildsTheRequest', () => {
    expect(
      toPlaceholders([namePh, offerPh], {
        'contact.name': { source: { kind: 'CONTACT_FIELD', field: 'name' }, fallback: 'there' },
        offer: { source: { kind: 'FIXED', text: '10% off' }, fallback: 'ignored' },
      }),
    ).toEqual([
      { name: 'contact.name', source: { kind: 'CONTACT_FIELD', field: 'name' }, fallback: 'there' },
      { name: 'offer', source: { kind: 'FIXED', text: '10% off' }, fallback: '' },
    ]);
  });
});
