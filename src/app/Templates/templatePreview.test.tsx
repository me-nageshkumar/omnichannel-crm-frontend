import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { contact } from '../../test/contacts';
import { content, placeholderView, template } from '../../test/templates';
import type { CurrentUser } from '@app/api/users';

const B = '/api/workspaces/w1';

function routes(extra = {}, user: CurrentUser = WORKSPACE_MANAGER) {
  return {
    ...meAs(user),
    [`GET ${B}/templates/categories`]: { status: 200, body: [] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [] },
    ...extra,
  };
}

/** Sets a controlled field's whole value in one change, so `{{` needs no escaping. */
async function setValue(label: string | RegExp, value: string) {
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });
}

const bubble = async () => screen.findByRole('region', { name: 'Message preview' });

const order = template({
  id: 't1',
  name: 'Order update',
  content: content({ body: 'Hi {{contact.name}}, order {{order_id}}' }),
  placeholders: [
    placeholderView({ name: 'contact.name', kind: 'CONTACT_FIELD', fallback: 'there' }),
    placeholderView({ name: 'order_id', label: 'Order ID', example: 'A-1', required: true }),
  ],
});
const serve = (t = order, extra = {}, user: CurrentUser = WORKSPACE_MANAGER) =>
  mockFetch(routes({ [`GET ${B}/templates/${t.id}`]: { status: 200, body: t }, ...extra }, user));

describe('template preview', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('previewFillsExamplesAndFallbacks', async () => {
    mockFetch(routes());
    const { user } = renderApp('/templates/new?type=TEXT');
    await setValue('Message', 'Hi {{contact.name}}, {{order_id}} / {{size}} / {{delivery}}');
    expect(await bubble()).toHaveTextContent('Hi [contact.name], [order_id] / [size] / [delivery]');
    await user.type(await screen.findByLabelText('Fallback for contact.name'), 'there');
    await user.type(await screen.findByLabelText('Label for order_id'), 'Order ID');
    await user.type(await screen.findByLabelText('Label for size'), 'Size');
    await user.type(await screen.findByLabelText('Example for size'), 'L');
    expect(await bubble()).toHaveTextContent('Hi there, [Order ID] / L / [delivery]');
  });

  it('formattingRendered', async () => {
    mockFetch(routes());
    renderApp('/templates/new?type=TEXT');
    await setValue('Message', '*bold* _lean_ ~gone~ ```code```\nsecond line');
    const region = await bubble();
    expect(region.querySelector('strong')).toHaveTextContent('bold');
    expect(region.querySelector('em')).toHaveTextContent('lean');
    expect(region.querySelector('s')).toHaveTextContent('gone');
    expect(region.querySelector('code')).toHaveTextContent('code');
    const text = within(region).getByText(/second line/);
    expect(text.textContent).toContain('\nsecond line');
    expect(text).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('scriptTextNotExecuted', async () => {
    mockFetch(routes());
    renderApp('/templates/new?type=TEXT');
    await setValue('Message', '<script>window.ran = 1</script><img src=x onerror="window.ran = 2">');
    const region = await bubble();
    expect(region).toHaveTextContent('<script>window.ran = 1</script>');
    expect(region.querySelector('script, img')).toBeNull();
    expect((window as unknown as { ran?: number }).ran).toBeUndefined();
  });

  it('pollPreview', async () => {
    const poll = template({
      id: 't2',
      type: 'POLL',
      content: content({ question: 'Pick for {{contact.name}}', options: ['Red', 'Blue', ''], allowMultiple: false }),
      placeholders: [placeholderView({ name: 'contact.name', kind: 'CONTACT_FIELD', fallback: 'you' })],
    });
    serve(poll);
    renderApp('/templates/t2');
    const region = await bubble();
    expect(region).toHaveTextContent('Pick for you');
    expect(within(region).getAllByRole('radio')).toHaveLength(2);
    expect(within(region).getByText('Blue')).toBeVisible();
  });

  it('multipleChoicePollUsesCheckboxes', async () => {
    const multi = template({
      id: 't3',
      type: 'POLL',
      content: content({ question: 'Q', options: ['A', 'B'], allowMultiple: true }),
    });
    serve(multi);
    renderApp('/templates/t3');
    const region = await bubble();
    expect(within(region).getAllByRole('checkbox')).toHaveLength(2);
  });

  it('imagePreviewUsesBlob', async () => {
    const create = vi.fn(() => 'blob:thumb');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const image = template({
      id: 't4',
      type: 'IMAGE',
      content: content({ caption: 'Our catalogue' }),
      media: { mediaId: 'm1', fileName: 'cat.png', mimeType: 'image/png', size: 2048 },
    });
    const fetch = serve(image, {
      [`GET ${B}/template-media/m1`]: { status: 200, text: 'png-bytes', headers: { 'Content-Type': 'image/png' } },
    });
    const { unmount } = renderApp('/templates/t4');
    const region = await bubble();
    const img = await within(region).findByRole('img', { name: 'cat.png' });
    expect(img).toHaveAttribute('src', 'blob:thumb');
    expect(within(region).getByText('Our catalogue')).toBeVisible();
    expect(requestTo(fetch, `GET ${B}/template-media/m1`)?.headers.get('Authorization')).toBe('Bearer stored-token');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:thumb');
  });

  it('documentShowsFileCardWithoutFetch', async () => {
    const doc = template({
      id: 't5',
      type: 'DOCUMENT',
      content: content({ caption: 'Terms' }),
      media: { mediaId: 'm2', fileName: 'terms.pdf', mimeType: 'application/pdf', size: 12 * 1024 },
    });
    const fetch = serve(doc);
    renderApp('/templates/t5');
    const region = await bubble();
    expect(within(region).getByText('terms.pdf')).toBeVisible();
    expect(within(region).getByText('12 KB')).toBeVisible();
    expect(within(region).getByText('Terms')).toBeVisible();
    expect(callsTo(fetch, `GET ${B}/template-media/m2`)).toBe(0);
  });

  it('locationShowsPinCard', async () => {
    const place = template({
      id: 't6',
      type: 'LOCATION',
      content: content({ latitude: 12.9, longitude: 77.6, name: 'Head office', address: '1 MG Road' }),
    });
    serve(place);
    renderApp('/templates/t6');
    const region = await bubble();
    expect(region).toHaveTextContent('Head office');
    expect(region).toHaveTextContent('1 MG Road');
  });

  it('contactCardShowsNameAndPhone', async () => {
    const card = template({
      id: 't7',
      type: 'CONTACT_CARD',
      content: content({ fullName: 'Asha Rao', phone: '919876543210' }),
    });
    serve(card);
    renderApp('/templates/t7');
    const region = await bubble();
    expect(region).toHaveTextContent('Asha Rao');
    expect(region).toHaveTextContent('+919876543210');
  });

  const contacts = () =>
    Array.from({ length: 12 }, (_v, i) =>
      i === 1
        ? contact({ id: 'c2', name: null, numberHidden: true })
        : contact({ id: `c${i + 1}`, name: i === 0 ? 'Ana Iyer' : `Person ${i + 1}`, phone: `9198765432${10 + i}` }),
    );

  it('previewWithContactCallsRender', async () => {
    const fetch = serve(order, {
      [`POST ${B}/contacts/search`]: { status: 200, body: { items: contacts(), total: 12, page: 0 } },
      [`POST ${B}/templates/t1/render`]: {
        status: 200,
        body: {
          type: 'TEXT',
          content: content({ body: 'Hi Ana Iyer, order B-2' }),
          media: null,
          vcard: null,
          missing: [],
          warnings: [],
        },
      },
    });
    const { user } = renderApp('/templates/t1');
    await screen.findByRole('region', { name: 'Message preview' });
    await user.click(screen.getByRole('button', { name: 'Preview with a contact' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Search contacts'), 'ana');
    expect(await within(dialog).findByText('Ana Iyer')).toBeVisible();
    expect(callsTo(fetch, `POST ${B}/contacts/search`)).toBe(1);
    expect(requestTo(fetch, `POST ${B}/contacts/search`)?.body).toEqual({ filter: { q: 'ana' } });
    expect(within(dialog).getByText('+919876543210')).toBeVisible();
    expect(within(dialog).getByText('Number hidden')).toBeVisible();
    expect(within(dialog).getAllByRole('button', { name: /^(Ana Iyer|Number hidden|Person)/ })).toHaveLength(10);

    await user.click(within(dialog).getByRole('button', { name: /Ana Iyer/ }));
    const input = within(dialog).getByLabelText('Order ID');
    expect(input).toHaveValue('A-1');
    await user.clear(input);
    await user.type(input, 'B-2');
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }));

    await waitFor(() => expect(callsTo(fetch, `POST ${B}/templates/t1/render`)).toBe(1));
    expect(requestTo(fetch, `POST ${B}/templates/t1/render`)?.body).toEqual({
      contactId: 'c1',
      values: { order_id: 'B-2' },
    });
    expect(await within(dialog).findByRole('region', { name: 'Rendered message' })).toHaveTextContent(
      'Hi Ana Iyer, order B-2',
    );
  });

  it('missingAndWarningsShown', async () => {
    serve(order, {
      [`POST ${B}/templates/t1/render`]: {
        status: 200,
        body: {
          type: 'TEXT',
          content: content({ body: 'Hi there, order ' }),
          media: null,
          vcard: null,
          missing: ['order_id'],
          warnings: ['Attribute "city" was deleted — fallback will be used'],
        },
      },
    });
    const { user } = renderApp('/templates/t1');
    await screen.findByRole('region', { name: 'Message preview' });
    await user.click(screen.getByRole('button', { name: 'Preview with a contact' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(await within(dialog).findByText('Fill in: Order ID')).toBeVisible();
    expect(within(dialog).getByText('Attribute "city" was deleted — fallback will be used')).toBeVisible();
  });

  it('disabledWhileDirty', async () => {
    serve();
    const { user } = renderApp('/templates/t1');
    const button = await screen.findByRole('button', { name: 'Preview with a contact' });
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Changed {{order_id}}' } });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.hover(button);
    expect(await screen.findByText('Save first to preview with a contact')).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Hi {{contact.name}}, order {{order_id}}' },
    });
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('disabledForUnsavedTemplate', async () => {
    mockFetch(routes());
    renderApp('/templates/new?type=TEXT');
    expect(await screen.findByRole('button', { name: 'Preview with a contact' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('hiddenWithoutContactView', async () => {
    const noContacts: CurrentUser = {
      ...WORKSPACE_MANAGER,
      workspaces: [
        {
          ...BRAND_A,
          role: { id: 'r-wm', name: 'WORKSPACE_MANAGER' },
          authorities: BRAND_A.authorities.filter((a) => a !== 'contact:view'),
        },
      ],
    };
    serve(order, {}, noContacts);
    renderApp('/templates/t1');
    await screen.findByRole('region', { name: 'Message preview' });
    expect(screen.queryByRole('button', { name: 'Preview with a contact' })).toBeNull();
  });

  it('agentCanPreviewWithContact', async () => {
    const fetch = serve(
      order,
      {
        [`POST ${B}/templates/t1/render`]: {
          status: 200,
          body: {
            type: 'TEXT',
            content: content({ body: 'Hi there, order A-1' }),
            media: null,
            vcard: null,
            missing: [],
            warnings: [],
          },
        },
      },
      AGENT_IN_BRAND,
    );
    const { user } = renderApp('/templates/t1');
    const button = await screen.findByRole('button', { name: 'Preview with a contact' });
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(await within(dialog).findByRole('region', { name: 'Rendered message' })).toHaveTextContent(
      'Hi there, order A-1',
    );
    expect(requestTo(fetch, `POST ${B}/templates/t1/render`)?.body).toEqual({ values: { order_id: 'A-1' } });
  });
});
