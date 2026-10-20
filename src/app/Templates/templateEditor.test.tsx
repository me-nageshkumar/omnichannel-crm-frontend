import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill } from '../../test/admin';
import { attribute } from '../../test/contacts';
import { content, placeholderView, template } from '../../test/templates';

const B = '/api/workspaces/w1';
const CONFLICT_COPY = 'This template was changed by someone else. Reload to see the latest version.';

const Where: React.FunctionComponent = () => {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
};

function routes(extra = {}, user = WORKSPACE_MANAGER) {
  return {
    ...meAs(user),
    [`GET ${B}/templates/categories`]: { status: 200, body: ['Promo', 'Support'] },
    [`GET ${B}/contact-attributes`]: {
      status: 200,
      body: [attribute({ id: 'a1', name: 'City' }), attribute({ id: 'a2', name: 'Preferred size' })],
    },
    ...extra,
  };
}

const open = (path: string) => renderApp(path, <Where />);

/** Sets a controlled field's whole value in one change, so `{{` needs no escaping. */
async function setValue(label: string | RegExp, value: string) {
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });
}

const save = (user: ReturnType<typeof open>['user']) => user.click(screen.getByRole('button', { name: 'Save' }));
const posts = (fetch: ReturnType<typeof mockFetch>, key: string) => callsTo(fetch, key);

async function pick(user: ReturnType<typeof open>['user'], field: string, item: RegExp) {
  await user.click(await screen.findByRole('button', { name: `Insert placeholder in ${field}` }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

describe('template editor', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('createTextTemplate', async () => {
    const saved = template({ id: 't9', name: 'Welcome' });
    const fetch = mockFetch(
      routes({
        [`POST ${B}/templates`]: { status: 201, body: saved },
        [`GET ${B}/templates/t9`]: { status: 200, body: saved },
      }),
    );
    const { user } = open('/templates/new?type=TEXT');
    await fill(user, 'Name', 'Welcome');
    await user.type(await screen.findByRole('combobox', { name: 'Category' }), 'Promo');
    await setValue('Message', 'Hi {{contact.name}}, order {{order_id}}');
    await user.type(await screen.findByLabelText('Fallback for contact.name'), 'there');
    await user.type(await screen.findByLabelText('Label for order_id'), 'Order ID');
    await save(user);

    await waitFor(() => expect(posts(fetch, `POST ${B}/templates`)).toBe(1));
    expect(requestTo(fetch, `POST ${B}/templates`)?.body).toEqual({
      name: 'Welcome',
      category: 'Promo',
      type: 'TEXT',
      content: content({ body: 'Hi {{contact.name}}, order {{order_id}}', linkPreview: true }),
      mediaId: null,
      placeholders: [
        { name: 'contact.name', fallback: 'there', label: null, example: null, required: false },
        { name: 'order_id', fallback: null, label: 'Order ID', example: null, required: true },
      ],
    });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/templates/t9'));
  });

  it('settingsKeptWhileTyping', async () => {
    mockFetch(routes());
    const { user } = open('/templates/new?type=TEXT');
    await setValue('Message', '{{order_id}}');
    await user.type(await screen.findByLabelText('Label for order_id'), 'Order ID');
    await setValue('Message', '{{order_i');
    expect(screen.queryByLabelText('Label for order_id')).toBeNull();
    await setValue('Message', '{{order_id}}');
    expect(await screen.findByLabelText('Label for order_id')).toHaveValue('Order ID');
  });

  it('insertAtCursor', async () => {
    mockFetch(routes());
    const { user } = open('/templates/new?type=TEXT');
    await setValue('Message', 'Hello world');
    const box = screen.getByLabelText('Message') as HTMLTextAreaElement;
    box.focus();
    box.setSelectionRange(5, 5);
    await pick(user, 'Message', /^Name/);
    expect(box).toHaveValue('Hello{{contact.name}} world');
  });

  it('insertContactAttribute', async () => {
    mockFetch(routes());
    const { user } = open('/templates/new?type=TEXT');
    await setValue('Message', 'Hi ');
    await user.click(await screen.findByRole('button', { name: 'Insert placeholder in Message' }));
    expect(await screen.findByRole('menuitem', { name: /Preferred size/ })).toBeVisible();
    await user.click(screen.getByRole('menuitem', { name: /^City/ }));
    expect(screen.getByLabelText('Message')).toHaveValue('Hi {{contact.attributes.city}}');
    expect(await screen.findByLabelText('Fallback for contact.attributes.city')).toBeVisible();
  });

  it('newFieldValidatesName', async () => {
    mockFetch(routes());
    const { user } = open('/templates/new?type=TEXT');
    await setValue('Message', 'Order: ');
    await pick(user, 'Message', /New field/);
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText(/^Field name/);
    await user.type(input, 'Order ID');
    expect(await within(dialog).findByText('invalid placeholder "{{Order ID}}"')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Insert' })).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'order_id');
    await user.click(within(dialog).getByRole('button', { name: 'Insert' }));
    await waitFor(() => expect(screen.getByLabelText('Message')).toHaveValue('Order: {{order_id}}'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('requiredHidesFallback', async () => {
    mockFetch(routes());
    const { user } = open('/templates/new?type=TEXT');
    await setValue('Message', '{{order_id}}');
    const required = await screen.findByRole('checkbox', { name: 'Required: order_id' });
    expect(required).toBeChecked();
    expect(screen.queryByLabelText('Fallback for order_id')).toBeNull();
    await user.click(required);
    expect(await screen.findByLabelText('Fallback for order_id')).toBeVisible();
    await user.click(required);
    expect(screen.queryByLabelText('Fallback for order_id')).toBeNull();
  });

  it('grammarErrorShownBeforeSave', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/templates/new?type=TEXT');
    await setValue('Message', '{{#each}}');
    expect(await screen.findByText('"{{#" is not allowed — only {{name}} placeholders are supported')).toBeVisible();
    await save(user);
    expect(await screen.findByText('Enter a name')).toBeVisible();
    expect(posts(fetch, `POST ${B}/templates`)).toBe(0);
  });

  it('requiredSettingsBlockSave', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/templates/new?type=TEXT');
    await fill(user, 'Name', 'Welcome');
    await setValue('Message', '{{contact.name}} {{order_id}}');
    await save(user);
    expect(await screen.findByText('Enter a fallback')).toBeVisible();
    expect(await screen.findByText('Enter a label')).toBeVisible();
    expect(posts(fetch, `POST ${B}/templates`)).toBe(0);
  });

  it('serverFieldErrorsShownInline', async () => {
    mockFetch(
      routes({
        [`POST ${B}/templates`]: {
          status: 400,
          body: {
            code: 'VALIDATION',
            fields: {
              name: 'is already taken',
              category: 'is too long',
              'content.body': 'is longer than 4096 characters after filling placeholders',
              'placeholders.order_id.label': 'is longer than 60 characters',
              type: 'not supported yet',
            },
          },
        },
      }),
    );
    const { user } = open('/templates/new?type=TEXT');
    await fill(user, 'Name', 'Welcome');
    await setValue('Message', 'Order {{order_id}}');
    await user.type(await screen.findByLabelText('Label for order_id'), 'Order ID');
    await save(user);
    expect(await screen.findByText('is already taken')).toBeVisible();
    expect(screen.getByText('is too long')).toBeVisible();
    expect(screen.getByText('is longer than 4096 characters after filling placeholders')).toBeVisible();
    expect(screen.getByText('is longer than 60 characters')).toBeVisible();
    // A key that matches no control is not lost.
    expect(screen.getByText(/type: not supported yet/)).toBeVisible();
  });

  it('duplicateNameShownOnName', async () => {
    mockFetch(
      routes({
        [`POST ${B}/templates`]: {
          status: 409,
          body: { code: 'DUPLICATE', field: 'name', message: '"Welcome" already exists in this brand' },
        },
      }),
    );
    const { user } = open('/templates/new?type=TEXT');
    await fill(user, 'Name', 'Welcome');
    await setValue('Message', 'Hi');
    await save(user);
    expect(await screen.findByText('"Welcome" already exists in this brand')).toBeVisible();
  });

  it('conflictKeepsEdits', async () => {
    const existing = template({ id: 't1', name: 'Welcome', version: 3, content: content({ body: 'Hi' }) });
    const fetch = mockFetch(
      routes({
        [`GET ${B}/templates/t1`]: { status: 200, body: existing },
        [`PUT ${B}/templates/t1`]: { status: 409, body: { code: 'CONFLICT' } },
      }),
    );
    const { user } = open('/templates/t1');
    await fill(user, 'Name', 'Renamed');
    await setValue('Message', 'Edited body');
    await save(user);
    expect(await screen.findByText(CONFLICT_COPY)).toBeVisible();
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Renamed');
    expect(screen.getByLabelText('Message')).toHaveValue('Edited body');
    expect(requestTo(fetch, `PUT ${B}/templates/t1`)?.body).toMatchObject({ name: 'Renamed', version: 3 });
  });

  it('imageUploadSetsMedia', async () => {
    const saved = template({ id: 't8', type: 'IMAGE' });
    const fetch = mockFetch(
      routes({
        [`POST ${B}/template-media`]: {
          status: 201,
          body: { mediaId: 'm1', fileName: 'menu.png', mimeType: 'image/png', size: 2048 },
        },
        [`POST ${B}/templates`]: { status: 201, body: saved },
        [`GET ${B}/templates/t8`]: { status: 200, body: saved },
      }),
    );
    const { user } = open('/templates/new?type=IMAGE');
    await fill(user, 'Name', 'Menu');
    const file = new File(['png'], 'menu.png', { type: 'image/png' });
    const input = await waitFor(() => {
      const el = document.querySelector('input[type=file]');
      if (!el) throw new Error('no file input');
      return el as HTMLInputElement;
    });
    await user.upload(input, file);

    expect(await screen.findByText(/menu\.png/)).toBeVisible();
    expect(screen.getByText(/2 KB/)).toBeVisible();
    const upload = fetch.mock.calls.find(([u]) => String(u).endsWith('/template-media'));
    const form = (upload?.[1] as RequestInit).body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('file') as File).name).toBe('menu.png');

    await setValue('Caption', 'Today');
    expect(screen.getByText('5 / 1024')).toBeVisible();
    await save(user);
    await waitFor(() => expect(posts(fetch, `POST ${B}/templates`)).toBe(1));
    expect(requestTo(fetch, `POST ${B}/templates`)?.body).toMatchObject({
      type: 'IMAGE',
      mediaId: 'm1',
      content: content({ caption: 'Today' }),
    });
  });

  it('largeFileRejected', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/templates/new?type=VIDEO');
    const file = new File(['v'], 'big.mp4', { type: 'video/mp4' });
    Object.defineProperty(file, 'size', { value: 16 * 1024 * 1024 + 1 });
    const input = await waitFor(() => {
      const el = document.querySelector('input[type=file]');
      if (!el) throw new Error('no file input');
      return el as HTMLInputElement;
    });
    await user.upload(input, file);
    expect(await screen.findByText('That file is larger than 16 MB.')).toBeVisible();
    expect(posts(fetch, `POST ${B}/template-media`)).toBe(0);
  });

  it('voiceNoteOnlyForOgg', async () => {
    let n = 0;
    const saved = template({ id: 't7', type: 'AUDIO' });
    const fetch = mockFetch(
      routes({
        [`POST ${B}/template-media`]: () => {
          n += 1;
          return n === 1
            ? { status: 201, body: { mediaId: 'm1', fileName: 'a.mp3', mimeType: 'audio/mpeg', size: 10 } }
            : { status: 201, body: { mediaId: 'm2', fileName: 'a.ogg', mimeType: 'audio/ogg', size: 10 } };
        },
        [`POST ${B}/templates`]: { status: 201, body: saved },
        [`GET ${B}/templates/t7`]: { status: 200, body: saved },
      }),
    );
    const { user } = open('/templates/new?type=AUDIO');
    await fill(user, 'Name', 'Voice');
    const fileInput = () => document.querySelector('input[type=file]') as HTMLInputElement;
    await waitFor(() => expect(fileInput()).not.toBeNull());
    await user.upload(fileInput(), new File(['x'], 'a.mp3', { type: 'audio/mpeg' }));
    expect(await screen.findByText(/a\.mp3/)).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Send as voice note' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(fileInput()).not.toBeNull());
    await user.upload(fileInput(), new File(['x'], 'a.ogg', { type: 'audio/ogg' }));
    expect(await screen.findByText(/a\.ogg/)).toBeVisible();
    const voice = screen.getByRole('switch', { name: 'Send as voice note' });
    expect(voice).toBeEnabled();
    await user.click(voice);
    await save(user);
    await waitFor(() => expect(posts(fetch, `POST ${B}/templates`)).toBe(1));
    expect(requestTo(fetch, `POST ${B}/templates`)?.body).toMatchObject({
      mediaId: 'm2',
      content: content({ voiceNote: true }),
    });
  });

  it('pollOptionsAddRemove', async () => {
    mockFetch(routes());
    const { user } = open('/templates/new?type=POLL');
    expect(await screen.findByLabelText('Option 1')).toBeVisible();
    expect(screen.getByLabelText('Option 2')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove option 1' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Allow multiple answers' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(screen.getByLabelText('Option 3')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove option 3' }));
    expect(screen.queryByLabelText('Option 3')).toBeNull();

    for (let i = 0; i < 10; i++) await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(screen.getByLabelText('Option 12')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add option' })).toBeDisabled();
  });

  it('pollSendsQuestionAndOptions', async () => {
    const saved = template({ id: 't6', type: 'POLL' });
    const fetch = mockFetch(
      routes({
        [`POST ${B}/templates`]: { status: 201, body: saved },
        [`GET ${B}/templates/t6`]: { status: 200, body: saved },
      }),
    );
    const { user } = open('/templates/new?type=POLL');
    await fill(user, 'Name', 'Feedback');
    await setValue('Question', 'How was {{product}}?');
    await setValue('Option 1', 'Good');
    await setValue('Option 2', 'Bad');
    await user.type(await screen.findByLabelText('Label for product'), 'Product');
    await user.click(screen.getByRole('switch', { name: 'Allow multiple answers' }));
    await save(user);
    await waitFor(() => expect(posts(fetch, `POST ${B}/templates`)).toBe(1));
    expect(requestTo(fetch, `POST ${B}/templates`)?.body).toMatchObject({
      type: 'POLL',
      content: content({ question: 'How was {{product}}?', options: ['Good', 'Bad'], allowMultiple: true }),
      placeholders: [{ name: 'product', fallback: null, label: 'Product', example: null, required: true }],
    });
  });

  it('locationAndContactCardFields', async () => {
    const saved = template({ id: 't5', type: 'LOCATION' });
    const fetch = mockFetch(
      routes({
        [`POST ${B}/templates`]: { status: 201, body: saved },
        [`GET ${B}/templates/t5`]: { status: 200, body: saved },
      }),
    );
    const first = open('/templates/new?type=LOCATION');
    await fill(first.user, 'Name', 'Store');
    await setValue('Latitude', '26.9124');
    await setValue('Longitude', '75.7873');
    await setValue('Location name', 'Jaipur store');
    await setValue('Address', 'MI Road');
    expect(screen.queryByLabelText('Message')).toBeNull();
    await save(first.user);
    await waitFor(() => expect(posts(fetch, `POST ${B}/templates`)).toBe(1));
    expect(requestTo(fetch, `POST ${B}/templates`)?.body).toMatchObject({
      type: 'LOCATION',
      content: content({ latitude: 26.9124, longitude: 75.7873, name: 'Jaipur store', address: 'MI Road' }),
    });
    first.unmount();

    open('/templates/new?type=CONTACT_CARD');
    expect(await screen.findByLabelText('Full name')).toBeVisible();
    expect(screen.getByLabelText('Phone')).toBeVisible();
    expect(screen.getByLabelText('Organization')).toBeVisible();
    expect(screen.getByLabelText('Email')).toBeVisible();
    expect(screen.queryByLabelText('Latitude')).toBeNull();
  });

  it('editLoadsExisting', async () => {
    const existing = template({
      id: 't1',
      name: 'Welcome',
      category: 'Promo',
      version: 2,
      content: content({ body: 'Hi {{contact.name}} {{order_id}}', linkPreview: false }),
      placeholders: [
        placeholderView({ name: 'contact.name', kind: 'CONTACT_FIELD', fallback: 'there' }),
        placeholderView({ name: 'order_id', label: 'Order ID', example: 'FS-1', required: false, fallback: 'n/a' }),
      ],
      warnings: ['Attribute "city" was deleted — fallback will be used'],
    });
    const fetch = mockFetch(routes({ [`GET ${B}/templates/t1`]: { status: 200, body: existing } }));
    open('/templates/t1');
    expect(await screen.findByLabelText(/^Name/)).toHaveValue('Welcome');
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('Promo');
    expect(screen.getByLabelText('Message')).toHaveValue('Hi {{contact.name}} {{order_id}}');
    expect(screen.getByRole('switch', { name: 'Show link preview' })).not.toBeChecked();
    expect(screen.getByLabelText('Fallback for contact.name')).toHaveValue('there');
    expect(screen.getByLabelText('Label for order_id')).toHaveValue('Order ID');
    expect(screen.getByLabelText('Example for order_id')).toHaveValue('FS-1');
    expect(screen.getByLabelText('Fallback for order_id')).toHaveValue('n/a');
    expect(screen.getByText('Attribute "city" was deleted — fallback will be used')).toBeVisible();
    expect(screen.getByText('Text')).toBeVisible();
    expect(callsTo(fetch, `PUT ${B}/templates/t1`)).toBe(0);
  });

  it('editSavesWithVersion', async () => {
    const existing = template({ id: 't1', version: 2, content: content({ body: 'Hi', linkPreview: true }) });
    const fetch = mockFetch(
      routes({
        [`GET ${B}/templates/t1`]: { status: 200, body: existing },
        [`PUT ${B}/templates/t1`]: { status: 200, body: { ...existing, version: 3 } },
      }),
    );
    const { user } = open('/templates/t1');
    await setValue('Message', 'Hello');
    await save(user);
    await waitFor(() => expect(callsTo(fetch, `PUT ${B}/templates/t1`)).toBe(1));
    expect(requestTo(fetch, `PUT ${B}/templates/t1`)?.body).toEqual({
      name: 'Welcome',
      category: null,
      type: 'TEXT',
      content: content({ body: 'Hello', linkPreview: true }),
      mediaId: null,
      placeholders: [],
      version: 2,
    });
    expect(await screen.findByText('Saved')).toBeVisible();
  });

  it('archiveFromHeader', async () => {
    const existing = template({ id: 't1' });
    mockFetch(
      routes({
        [`GET ${B}/templates/t1`]: { status: 200, body: existing },
        [`POST ${B}/templates/t1/archive`]: { status: 200, body: { ...existing, status: 'ARCHIVED' } },
      }),
    );
    const { user } = open('/templates/t1');
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    expect(await screen.findByRole('button', { name: 'Unarchive' })).toBeVisible();
  });

  it('unknownTypeShowsError', async () => {
    mockFetch(routes());
    open('/templates/new?type=NOPE');
    expect(await screen.findByText('Unknown template type')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to templates' })).toHaveAttribute('href', '/templates');
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('agentEditorIsReadOnly', async () => {
    const existing = template({
      id: 't1',
      category: 'Promo',
      content: content({ body: 'Hi {{order_id}}' }),
      placeholders: [placeholderView({ name: 'order_id', label: 'Order ID', required: true })],
    });
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [`GET ${B}/templates/t1`]: { status: 200, body: existing } });
    open('/templates/t1');
    expect(await screen.findByLabelText(/^Name/)).toBeDisabled();
    expect(screen.getByLabelText('Message')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDisabled();
    expect(screen.getByLabelText('Label for order_id')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Insert placeholder/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(callsTo(fetch, `GET ${B}/templates/categories`)).toBe(0);
  });

  it('agentCannotCreate', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND) });
    open('/templates/new?type=TEXT');
    expect(await screen.findByText("You don't have permission to create templates")).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to templates' })).toBeVisible();
  });
});
