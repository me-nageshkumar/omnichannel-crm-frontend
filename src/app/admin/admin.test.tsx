import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@app/api/client';
import { useAction } from '@app/admin/useAction';
import { TemporaryPasswordModal } from '@app/admin/TemporaryPasswordModal';
import { EMPTY_PERSON, PersonFields, validatePerson } from '@app/admin/PersonFields';

describe('useAction', () => {
  it('maps DUPLICATE to the field', async () => {
    const { result } = renderHook(() => useAction(['username']));
    await act(async () => {
      await result.current.run(() => Promise.reject(new ApiError(409, 'DUPLICATE', undefined, 'username')));
    });
    expect(result.current.fieldErrors).toEqual({ username: 'Username is already in use.' });
    expect(result.current.error).toBeNull();
  });

  it('puts an error on a field the form does not show in the banner', async () => {
    const { result } = renderHook(() => useAction(['name']));
    await act(async () => {
      await result.current.run(() => Promise.reject(new ApiError(409, 'DUPLICATE', undefined, 'username')));
    });
    expect(result.current.error).toBe('username: Username is already in use.');
  });

  it('maps VALIDATION fields', async () => {
    const { result } = renderHook(() => useAction(['name']));
    await act(async () => {
      await result.current.run(() =>
        Promise.reject(new ApiError(400, 'VALIDATION', undefined, undefined, { name: 'must not be blank' })),
      );
    });
    expect(result.current.fieldErrors).toEqual({ name: 'must not be blank' });
  });

  it('maps FORBIDDEN to a message', async () => {
    const { result } = renderHook(() => useAction());
    let value: unknown = 'unset';
    await act(async () => {
      value = await result.current.run(() => Promise.reject(new ApiError(403, 'FORBIDDEN')));
    });
    expect(value).toBeUndefined();
    expect(result.current.error).toBe("You don't have permission to do that.");
  });

  it('returns the result and clears errors on success', async () => {
    const { result } = renderHook(() => useAction());
    let value: unknown;
    await act(async () => {
      value = await result.current.run(() => Promise.resolve(42));
    });
    expect(value).toBe(42);
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });
});

describe('TemporaryPasswordModal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the password once and closes', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TemporaryPasswordModal username="arun" password="temp-pass-123" onClose={onClose} />);
    expect(screen.getByText('Temporary password for arun')).toBeVisible();
    expect(screen.getByDisplayValue('temp-pass-123')).toBeVisible();
    expect(screen.getByText(/It won't be shown again\./)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PersonFields', () => {
  it('hides username and password on edit', () => {
    render(<PersonFields mode="edit" values={EMPTY_PERSON} onChange={() => undefined} errors={{}} />);
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Username/)).toBeNull();
    expect(screen.queryByLabelText(/^Temporary password/)).toBeNull();
  });

  it('shows username and temporary password on create', () => {
    render(<PersonFields mode="create" values={EMPTY_PERSON} onChange={() => undefined} errors={{}} />);
    expect(screen.getByLabelText(/^Username/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Temporary password/)).toBeInTheDocument();
  });

  it('a temporary password under 10 characters is invalid', () => {
    const errors = validatePerson({ ...EMPTY_PERSON, name: 'A', username: 'a', temporaryPassword: 'short' }, 'create');
    expect(errors).toEqual({ temporaryPassword: 'At least 10 characters.' });
  });

  it('name and username are required', () => {
    expect(validatePerson(EMPTY_PERSON, 'create')).toMatchObject({ name: 'Required.', username: 'Required.' });
    expect(validatePerson(EMPTY_PERSON, 'edit')).toEqual({ name: 'Required.' });
  });
});
