import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { gate } from '../../test/gate';
import { AGENT_IN_BRAND, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { urlsOf } from '../../test/admin';
import { attribute, contact, savedFilter } from '../../test/contacts';
import { content, placeholderView, template } from '../../test/templates';
import { campaign, campaignDetail, partJson, sender } from '../../test/campaigns';
import type { CsvPreview } from '@app/api/campaigns';

const B = '/api/workspaces/w1';
const C = `${B}/campaigns`;
const PREVIEW_CSV = `POST ${C}/csv/preview`;
const COUNT = `POST ${B}/contacts/count`;
const SEARCH = `POST ${B}/contacts/search`;
const TEMPLATES = `GET ${B}/templates`;
const SENDERS = `GET ${C}/senders`;
const CREATE = `POST ${C}`;
const START = `POST ${C}/c9/start`;
const NOTE =
  'Rows need a phone column; other columns can fill template placeholders. 10-digit numbers get the default country code.';
const UNFINISHED = 'Finish the earlier steps before saving.';
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

const P1 = sender({ phoneNumberId: 'p1', number: '919800000001', state: 'WARMING', capToday: 5 });
const P2 = sender({
  phoneNumberId: 'p2',
  number: '919800000002',
  state: 'ACTIVE',
  phoneStatus: 'DISCONNECTED',
  capToday: 10,
});
const P3 = sender({
  phoneNumberId: 'p3',
  number: '919800000003',
  state: 'RESTING',
  restUntil: '2026-10-28T06:00:00Z',
});
const P4 = sender({ phoneNumberId: 'p4', number: '919800000004', state: 'SUSPENDED' });
const CREATED = campaign({ id: 'c9', name: 'Diwali' });

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
    [SENDERS]: { status: 200, body: [P1, P2, P3, P4] },
    [CREATE]: { status: 201, body: CREATED },
    [START]: { status: 200, body: { ...CREATED, status: 'RUNNING' } },
    [`GET ${C}/c9`]: { status: 200, body: campaignDetail({ id: 'c9', name: 'Diwali' }) },
    [`GET ${C}/c9/recipients`]: { status: 200, body: { items: [], total: 0, page: 0 } },
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

/** Through Audience and Message with the Welcome template (a saved filter, or with {@code csv} leads.csv), onto Senders. */
async function toSenders(user: User, csv = false) {
  if (csv) {
    await typeName(user);
    await chooseCsv(user);
    await upload(user, csvFile('leads.csv'));
    await user.click(next());
    await pick(user, 'Welcome');
  } else {
    await filterToMessage(user);
    await pick(user, 'Welcome');
    await user.type(screen.getByRole('textbox', { name: 'Fallback for contact.name' }), 'there');
  }
  await user.click(next());
  await screen.findByRole('checkbox', { name: 'Select +919800000001' });
}

/** Onto Review with the given senders checked. */
async function toReview(user: User, numbers = ['+919800000001'], csv = false) {
  await toSenders(user, csv);
  for (const n of numbers) await user.click(screen.getByRole('checkbox', { name: `Select ${n}` }));
  await user.click(next());
  await screen.findByRole('button', { name: 'Start campaign' });
}

const saveDraft = () => screen.getByRole('button', { name: 'Save draft' });
const startCampaign = () => screen.getByRole('button', { name: 'Start campaign' });
const row = (number: string) => screen.getByRole('row', { name: new RegExp(number.replace('+', '\\+')) });

/** The path of the n-th request the mocked fetch received. */
const pathOf = (fetch: ReturnType<typeof mockFetch>, n: number) =>
  new URL(String(fetch.mock.calls[n][0]), 'http://localhost').pathname;

/** The indexes of the calls to "METHOD /path", in order. */
function indexesOf(fetch: ReturnType<typeof mockFetch>, key: string): number[] {
  const [method, path] = key.split(' ');
  return fetch.mock.calls.flatMap(([, init], i) =>
    (init?.method ?? 'GET').toUpperCase() === method && pathOf(fetch, i) === path ? [i] : [],
  );
}

async function dangerAlert(text: string): Promise<HTMLElement> {
  const alert = (await screen.findByText(text)).closest('.pf-v6-c-alert') as HTMLElement;
  expect(alert).toHaveClass('pf-m-danger');
  return alert;
}

/** The Review summary group whose term is {@code term}. */
const group = (term: string) =>
  screen
    .getAllByRole('term')
    .find((dt) => dt.textContent === term)
    ?.closest('.pf-v6-c-description-list__group') as HTMLElement;

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

  it('reUploadInFlightDisablesNext', async () => {
    let n = 0;
    const fetch = mockFetch(
      routes({
        [PREVIEW_CSV]: () => {
          n += 1;
          return {
            status: 200,
            body: n === 1 ? preview() : preview({ headers: ['mobile', 'name'], suggested: { phone: 'mobile' } }),
          };
        },
      }),
    );
    const held = gate(fetch, PREVIEW_CSV, 2);
    const { user } = renderApp('/campaigns/new');
    await typeName(user);
    await chooseCsv(user);
    await upload(user);
    expect(next()).toBeEnabled();
    await user.upload(fileInput(), csvFile('second.csv'));
    expect(await screen.findByRole('progressbar', { name: 'Reading the file' })).toBeInTheDocument();
    expect(screen.queryByText('Columns: phone, name, City, Offer')).not.toBeInTheDocument();
    expect(next()).toBeDisabled();
    held.release();
    expect(await screen.findByText('Columns: mobile, name')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Phone column' })).toHaveValue('mobile');
    expect(next()).toBeEnabled();
  });

  it('previewErrorSurvivesLeavingTheStep', async () => {
    let n = 0;
    const fetch = mockFetch(
      routes({
        [PREVIEW_CSV]: () =>
          ++n === 1
            ? { status: 400, body: { code: 'VALIDATION', message: 'file has more than 20000 rows' } }
            : { status: 200, body: preview() },
      }),
    );
    const held = gate(fetch, PREVIEW_CSV, 1);
    const { user } = renderApp('/campaigns/new');
    await typeName(user);
    await chooseCsv(user);
    await user.upload(fileInput(), csvFile('big.csv'));
    await screen.findByRole('progressbar', { name: 'Reading the file' });
    expect(next()).toBeDisabled();
    held.release();
    expect(await screen.findByText('file has more than 20000 rows')).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Saved contact filter' }));
    expect(screen.queryByText('file has more than 20000 rows')).not.toBeInTheDocument();
    await chooseCsv(user);
    expect(screen.getByText('file has more than 20000 rows')).toBeVisible();
    await upload(user, csvFile('small.csv'));
    expect(screen.queryByText('file has more than 20000 rows')).not.toBeInTheDocument();
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
    await user.type(screen.getByRole('textbox', { name: 'Fallback for contact.attributes.city' }), 'your city');
    await user.click(back());
    await user.upload(fileInput(), csvFile('second.csv'));
    expect(await screen.findByText('Columns: phone, name, City')).toBeVisible();
    await user.click(next());
    expect(await screen.findByRole('combobox', { name: 'Source for offer' })).toHaveValue('');
    expect(source('contact.attributes.city')).toHaveValue('col:City');
    // A column the new file still has keeps its mapping, fallback included.
    expect(screen.getByRole('textbox', { name: 'Fallback for contact.attributes.city' })).toHaveValue('your city');
    expect(next()).toBeDisabled();
  });

  it('sendersStepOffersWarmingAndActive', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await toSenders(user);
    const one = screen.getByRole('checkbox', { name: 'Select +919800000001' });
    const two = screen.getByRole('checkbox', { name: 'Select +919800000002' });
    expect(one).not.toBeChecked();
    expect(two).not.toBeChecked();
    expect(within(row('+919800000002')).getByText('not connected')).toBeVisible();
    expect(within(row('+919800000001')).queryByText('not connected')).not.toBeInTheDocument();
    expect(within(row('+919800000003')).getByText(/rests until/)).toBeVisible();
    expect(within(row('+919800000003')).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getAllByText(/rests until/)).toHaveLength(1);
    expect(screen.queryByText('+919800000004')).not.toBeInTheDocument();
    expect(next()).toBeDisabled();
    await user.click(one);
    expect(next()).toBeEnabled();
    await user.click(two);
    expect(screen.getByText('Selected senders can send about 15 messages a day')).toBeVisible();
    await user.click(one);
    await user.click(two);
    expect(next()).toBeDisabled();
  });

  it('reviewSummarisesTheCampaign', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await toReview(user, ['+919800000001', '+919800000002']);
    expect(within(group('Name')).getByText('Diwali')).toBeVisible();
    expect(await screen.findByText('Saved filter Pune leads · 1,204 contacts')).toBeVisible();
    expect(within(group('Templates')).getByText('Welcome')).toBeVisible();
    expect(within(group('Placeholders')).getByText('contact.name: Contact name (fallback “there”)')).toBeVisible();
    expect(within(group('Placeholders')).getByText('contact.attributes.city: City')).toBeVisible();
    expect(within(group('Senders')).getByText('+919800000001, +919800000002')).toBeVisible();
    expect(screen.getByText('About 81 working days')).toBeVisible();
    for (const name of ['Back', 'Save draft', 'Start campaign', 'Cancel']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(startCampaign()).toHaveClass('pf-m-primary');
  });

  it('saveDraftPostsTheCampaignAndOpensIt', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    await user.click(saveDraft());
    expect(await screen.findByRole('heading', { name: 'Diwali' })).toBeVisible();
    expect(requestTo(fetch, CREATE)?.body).toEqual({
      name: 'Diwali',
      audience: { kind: 'FILTER', filterId: 'f1' },
      templateIds: ['t1'],
      placeholders: [
        { name: 'contact.name', source: { kind: 'CONTACT_FIELD', field: 'name' }, fallback: 'there' },
        { name: 'contact.attributes.city', source: { kind: 'CONTACT_ATTRIBUTE', attributeId: 'a1' }, fallback: '' },
      ],
      senderIds: ['p1'],
    });
    expect(callsTo(fetch, CREATE)).toBe(1);
    expect(callsTo(fetch, START)).toBe(0);
  });

  it('startCampaignCreatesThenStarts', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    await user.click(startCampaign());
    expect(await screen.findByRole('heading', { name: 'Diwali' })).toBeVisible();
    const creates = indexesOf(fetch, CREATE);
    const starts = indexesOf(fetch, START);
    expect(creates).toHaveLength(1);
    expect(starts).toHaveLength(1);
    expect(starts[0]).toBeGreaterThan(creates[0]);
    expect(screen.queryByText('This campaign cannot be started now.')).not.toBeInTheDocument();
  });

  it('csvCampaignPostsMultipart', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await toReview(user, ['+919800000001'], true);
    expect(screen.getByText('CSV leads.csv · 120 rows · phone column phone · name column name')).toBeVisible();
    expect(within(group('Placeholders')).getByText('contact.name: name')).toBeVisible();
    await user.click(saveDraft());
    expect(await screen.findByRole('heading', { name: 'Diwali' })).toBeVisible();
    const form = fetch.mock.calls[indexesOf(fetch, CREATE)[0]][1]?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const req = (await partJson(form, 'campaign')) as Record<string, unknown>;
    expect(req.audience).toEqual({ kind: 'CSV', phoneColumn: 'phone', nameColumn: 'name' });
    expect(req.placeholders).toEqual([
      { name: 'contact.name', source: { kind: 'CSV_COLUMN', column: 'name' }, fallback: '' },
      { name: 'contact.attributes.city', source: { kind: 'CSV_COLUMN', column: 'City' }, fallback: '' },
    ]);
    expect(req.senderIds).toEqual(['p1']);
    expect((form.get('file') as File).name).toBe('leads.csv');
  });

  it('startFailureOpensTheDraftWithTheReason', async () => {
    const fetch = mockFetch(routes({ [START]: { status: 409, body: { code: 'CAMPAIGN_STATE' } } }));
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    await user.click(startCampaign());
    expect(await screen.findByRole('heading', { name: 'Diwali' })).toBeVisible();
    await dangerAlert('This campaign cannot be started now.');
    expect(callsTo(fetch, CREATE)).toBe(1);
  });

  it('createErrorsShowOnReview', async () => {
    let n = 0;
    const answers = [
      { status: 409, body: { code: 'DUPLICATE', field: 'name' } },
      { status: 400, body: { code: 'SENDER_NOT_AVAILABLE', number: '919800000002' } },
      { status: 400, body: { code: 'TEMPLATE_HAS_LINK', field: 'placeholders' } },
    ];
    mockFetch(routes({ [CREATE]: () => answers[n++] }));
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    await user.click(saveDraft());
    expect(group('Name')).toContainElement(await dangerAlert('Name is already in use.'));
    await user.click(startCampaign());
    await dangerAlert('+919800000002 cannot send campaigns right now.');
    expect(screen.queryByText('Name is already in use.')).not.toBeInTheDocument();
    await user.click(saveDraft());
    expect(group('Placeholders')).toContainElement(await dangerAlert('Campaign messages cannot contain links.'));
    expect(screen.queryByText('+919800000002 cannot send campaigns right now.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New campaign' })).toBeVisible();
    expect(saveDraft()).toBeEnabled();
  });

  it('navJumpToReviewWithAnInvalidDraftCannotSubmit', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    expect(screen.queryByText(UNFINISHED)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Senders' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Select +919800000001' }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await screen.findByRole('button', { name: 'Start campaign' });
    expect(saveDraft()).toBeDisabled();
    expect(startCampaign()).toBeDisabled();
    expect(screen.getByText(UNFINISHED)).toBeVisible();
    expect(screen.getByRole('button', { name: /Senders/ })).toHaveClass('pf-m-danger');
    expect(screen.getByRole('button', { name: 'Audience' })).not.toHaveClass('pf-m-danger');
    expect(screen.getByRole('button', { name: 'Message' })).not.toHaveClass('pf-m-danger');
    await user.click(saveDraft());
    await user.click(startCampaign());
    expect(callsTo(fetch, CREATE)).toBe(0);
  });

  it('submitsOnce', async () => {
    const fetch = mockFetch(routes());
    const held = gate(fetch, CREATE, 1);
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    await user.click(startCampaign());
    await waitFor(() => expect(startCampaign()).toBeDisabled());
    expect(saveDraft()).toBeDisabled();
    await user.click(startCampaign());
    await user.click(saveDraft());
    expect(callsTo(fetch, CREATE)).toBe(1);
    held.release();
    expect(await screen.findByRole('heading', { name: 'Diwali' })).toBeVisible();
    expect(callsTo(fetch, CREATE)).toBe(1);
    expect(callsTo(fetch, START)).toBe(1);
  });
});
