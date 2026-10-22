import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { urlsOf } from '../../test/admin';
import { attribute, contact, savedFilter } from '../../test/contacts';
import { content, placeholderView, template } from '../../test/templates';
import type { CsvPreview } from '@app/api/campaigns';

const B = '/api/workspaces/w1';
const C = `${B}/campaigns`;
const PREVIEW_CSV = `POST ${C}/csv/preview`;
const COUNT = `POST ${B}/contacts/count`;
const SEARCH = `POST ${B}/contacts/search`;
const TEMPLATES = `GET ${B}/templates`;
const NOTE =
  'Rows need a phone column; other columns can fill template placeholders. 10-digit numbers get the default country code.';
const FEW = "Fewer than three variants makes the fleet's messages look alike";

const CITY = attribute({ id: 'a1', name: 'City' });
const PUNE = savedFilter({ id: 'f1', name: 'Pune leads' });
const ASHA = contact({ id: 'c1', name: 'Asha', phone: '919900000001', attributes: { a1: 'Pune' } });

const WELCOME = template({
  id: 't1',
  name: 'Welcome',
  content: content({ body: 'Hello {{contact.name}}, your city is {{contact.attributes.city}}' }),
  placeholders: [
    placeholderView({ name: 'contact.name', kind: 'CONTACT_FIELD' }),
    placeholderView({
      name: 'contact.attributes.city',
      kind: 'CONTACT_ATTRIBUTE',
      attributeKey: 'city',
      attributeId: 'a1',
      attributeName: 'City',
    }),
  ],
});
const OFFER = template({
  id: 't2',
  name: 'Offer',
  content: content({ body: 'Get {{offer}} today' }),
  placeholders: [placeholderView({ name: 'offer' })],
});
const REMINDER = template({ id: 't3', name: 'Reminder', content: content({ body: 'See you soon' }) });
const PROMO = template({ id: 't4', name: 'Promo', content: content({ body: 'Visit https://x.in' }) });

function preview(over: Partial<CsvPreview> = {}): CsvPreview {
  return {
    headers: ['phone', 'name', 'City', 'Offer'],
    sample: [['919900000001', 'Asha', 'Pune', '10% off']],
    rows: 120,
    suggested: { phone: 'phone' },
    ...over,
  };
}

function routes(extra = {}, user = WORKSPACE_MANAGER) {
  return {
    ...meAs(user),
    [`GET ${B}/contact-filters`]: { status: 200, body: [PUNE] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [CITY] },
    [COUNT]: { status: 200, body: { count: 1204 } },
    [SEARCH]: { status: 200, body: { items: [ASHA], total: 1, page: 0 } },
    [TEMPLATES]: { status: 200, body: [WELCOME, OFFER, REMINDER, PROMO] },
    [PREVIEW_CSV]: { status: 200, body: preview() },
    ...extra,
  };
}

type User = ReturnType<typeof renderApp>['user'];

const next = () => screen.getByRole('button', { name: 'Next' });
const back = () => screen.getByRole('button', { name: 'Back' });
const csvFile = (name = 'people.csv') => new File(['phone,name\n919900000001,Asha\n'], name, { type: 'text/csv' });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

async function typeName(user: User, value = 'Diwali') {
  const input = await screen.findByRole('textbox', { name: 'Name' });
  await user.clear(input);
  await user.type(input, value);
}

async function chooseFilter(user: User) {
  const select = await screen.findByRole('combobox', { name: 'Saved contact filter' });
  await within(select).findByRole('option', { name: 'Pune leads' });
  await user.selectOptions(select, 'Pune leads');
}

async function chooseCsv(user: User) {
  await user.click(await screen.findByRole('radio', { name: 'CSV file' }));
}

const ROWS = /^[\d,]+ rows$/;

async function upload(user: User, file = csvFile()) {
  await user.upload(fileInput(), file);
  await screen.findByText(ROWS);
}

/** Through Audience with a saved filter, onto Message. */
async function filterToMessage(user: User) {
  await typeName(user);
  await chooseFilter(user);
  await screen.findByText('1,204 contacts');
  await user.click(next());
}

/** Through Audience with an uploaded CSV, onto Message. */
async function csvToMessage(user: User) {
  await typeName(user);
  await chooseCsv(user);
  await upload(user);
  await user.click(next());
}

async function pick(user: User, name: string) {
  await user.click(await screen.findByRole('menuitem', { name: new RegExp(`^${name}`) }));
}

const source = (name: string) => screen.getByRole('combobox', { name: `Source for ${name}` });

describe('new campaign wizard', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('newRouteIsNotFoundWithoutManage', async () => {
    const fetch = mockFetch(routes({}, AGENT_IN_BRAND));
    renderApp('/campaigns/new');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
    expect(callsTo(fetch, `GET ${C}/new`)).toBe(0);
    expect(callsTo(fetch, `GET ${B}/contact-filters`)).toBe(0);
    expect(callsTo(fetch, `GET ${B}/contact-attributes`)).toBe(0);
  });

  it('audienceNeedsANameAndAFilter', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    expect(await screen.findByRole('heading', { name: 'New campaign' })).toBeVisible();
    for (const step of ['Audience', 'Message', 'Senders', 'Review']) {
      expect(screen.getByRole('button', { name: step })).toBeInTheDocument();
    }
    expect(next()).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Saved contact filter' })).toBeChecked();
    expect(screen.getByRole('link', { name: 'Manage filters' })).toHaveAttribute('href', '/contacts');
    await typeName(user);
    expect(next()).toBeDisabled();
    await chooseFilter(user);
    expect(await screen.findByText('1,204 contacts')).toBeVisible();
    expect(requestTo(fetch, COUNT)?.body).toEqual({ selection: { filterId: 'f1' } });
    expect(next()).toBeEnabled();
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    expect(next()).toBeDisabled();
  });

  it('csvUploadShowsColumnsAndPresetsThem', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await typeName(user);
    await chooseCsv(user);
    expect(screen.getByText(NOTE)).toBeVisible();
    // Dropped rather than user.upload: user-event's patched input throws when FileUpload's Clear resets it to null.
    const dropzone = fileInput().parentElement as HTMLElement;
    fireEvent.drop(dropzone, { dataTransfer: { files: [csvFile()], types: ['Files'] } });
    expect(await screen.findByText('120 rows')).toBeVisible();
    expect(screen.getByText('Columns: phone, name, City, Offer')).toBeVisible();
    expect(callsTo(fetch, PREVIEW_CSV)).toBe(1);
    expect(screen.getByRole('combobox', { name: 'Phone column' })).toHaveValue('phone');
    expect(screen.getByRole('combobox', { name: 'Name column' })).toHaveValue('name');
    expect(screen.getByText(NOTE)).toBeVisible();
    expect(next()).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('120 rows')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Phone column' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Name column' })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('people.csv')).not.toBeInTheDocument();
  });

  it('csvPreviewErrorShowsUnderTheUpload', async () => {
    mockFetch(
      routes({
        [PREVIEW_CSV]: { status: 400, body: { code: 'VALIDATION', message: 'file has more than 20000 rows' } },
      }),
    );
    const { user } = renderApp('/campaigns/new');
    await typeName(user);
    await chooseCsv(user);
    await user.upload(fileInput(), csvFile('big.csv'));
    expect(await screen.findByText('file has more than 20000 rows')).toBeVisible();
    expect(screen.queryByDisplayValue('big.csv')).not.toBeInTheDocument();
    expect(screen.queryByText(ROWS)).not.toBeInTheDocument();
    expect(next()).toBeEnabled();
  });

  it('listsActiveTextTemplatesAndDisablesLinks', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await filterToMessage(user);
    const promo = await screen.findByRole('menuitem', { name: /^Promo \(Text\)/ });
    expect(promo).toBeDisabled();
    expect(screen.getByText('Contains a link')).toBeVisible();
    const url = urlsOf(fetch, TEMPLATES)[0];
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('type=TEXT');
    expect(next()).toBeDisabled();
  });

  it('warnsUnderThreeVariants', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await filterToMessage(user);
    expect(screen.queryByText(FEW)).not.toBeInTheDocument();
    await pick(user, 'Welcome');
    expect(screen.getByText(FEW)).toBeVisible();
    await pick(user, 'Offer');
    await pick(user, 'Reminder');
    expect(screen.queryByText(FEW)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Welcome' }));
    expect(screen.getByText(FEW)).toBeVisible();
  });

  it('filterPlaceholdersDefaultToTheContact', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await filterToMessage(user);
    await pick(user, 'Welcome');
    await pick(user, 'Offer');
    expect(source('contact.name')).toHaveValue('field:name');
    expect(source('contact.attributes.city')).toHaveValue('attr:a1');
    expect(source('offer')).toHaveValue('');
    expect(screen.getAllByText('Every placeholder needs a value.')).toHaveLength(1);
    expect(next()).toBeDisabled();
    await user.selectOptions(source('offer'), 'Fixed text');
    const fixed = screen.getByRole('textbox', { name: 'Fixed text for offer' });
    await user.type(fixed, '10% off');
    expect(screen.queryByText('Every placeholder needs a value.')).not.toBeInTheDocument();
    expect(next()).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Fallback for contact.name' })).toBeInTheDocument();
  });

  it('csvPlaceholdersOfferHeadersAndFixedText', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await csvToMessage(user);
    await pick(user, 'Offer');
    const options = within(source('offer'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['Choose a source', 'phone', 'name', 'City', 'Offer', 'Fixed text']);
    expect(source('offer')).toHaveValue('col:Offer');
  });

  it('aReusedColumnDisablesNext', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await csvToMessage(user);
    await pick(user, 'Welcome');
    await pick(user, 'Offer');
    expect(source('contact.attributes.city')).toHaveValue('col:City');
    expect(next()).toBeEnabled();
    await user.selectOptions(source('offer'), 'City');
    expect(screen.getByText('A CSV column can be used only once.')).toBeVisible();
    expect(next()).toBeDisabled();
  });

  it('previewUsesTheFirstContactOfTheFilter', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await filterToMessage(user);
    await pick(user, 'Welcome');
    expect(await screen.findByText('Hello Asha, your city is Pune')).toBeVisible();
    expect(requestTo(fetch, SEARCH)?.body).toEqual({ filterId: 'f1', page: 0 });
  });

  it('previewUsesTheFirstCsvRow', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await csvToMessage(user);
    await pick(user, 'Welcome');
    expect(await screen.findByText('Hello Asha, your city is Pune')).toBeVisible();
    expect(callsTo(fetch, SEARCH)).toBe(0);
  });

  it('sampleCsvDownloadsBeforeAFileIsChosen', async () => {
    const created = vi.fn(() => 'blob:csv');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    const SAMPLE = `GET ${C}/templates/t1/sample-csv`;
    const fetch = mockFetch(
      routes({ [SAMPLE]: { status: 200, text: 'phone,name,city\n', headers: { 'Content-Type': 'text/csv' } } }),
    );
    const { user } = renderApp('/campaigns/new');
    await typeName(user);
    await chooseCsv(user);
    expect(next()).toBeEnabled();
    await user.click(next());
    await pick(user, 'Welcome');
    expect(screen.getByText('Choose the CSV file in Audience to map its columns.')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Source for contact.name' })).not.toBeInTheDocument();
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Download sample CSV' }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].download).toBe('Welcome sample.csv');
    expect(callsTo(fetch, SAMPLE)).toBe(1);
    await user.click(back());
    expect(await screen.findByText(NOTE)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download sample CSV' })).toBeVisible();
  });

  it('reUploadDropsMappingsToMissingColumns', async () => {
    let n = 0;
    mockFetch(
      routes({
        [PREVIEW_CSV]: () => {
          n += 1;
          return {
            status: 200,
            body:
              n === 1
                ? preview()
                : preview({ headers: ['phone', 'name', 'City'], sample: [['919900000001', 'Asha', 'Pune']] }),
          };
        },
      }),
    );
    const { user } = renderApp('/campaigns/new');
    await csvToMessage(user);
    await pick(user, 'Welcome');
    await pick(user, 'Offer');
    await user.selectOptions(source('offer'), 'Offer');
    expect(source('offer')).toHaveValue('col:Offer');
    await user.click(back());
    await user.upload(fileInput(), csvFile('second.csv'));
    expect(await screen.findByText('Columns: phone, name, City')).toBeVisible();
    await user.click(next());
    expect(await screen.findByRole('combobox', { name: 'Source for offer' })).toHaveValue('');
    expect(source('contact.attributes.city')).toHaveValue('col:City');
    expect(next()).toBeDisabled();
  });
});
