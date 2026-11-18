import * as React from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Content, Label, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import {
  type BrandPagesAddress,
  checkBrandPagesAddress,
  getCustomerPagesAddresses,
  setBrandPagesAddress,
} from '@app/api/pagesAddresses';
import { useLoad } from '@app/admin/useLoad';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { LinkAddressDialog } from '@app/Customers/LinkAddressDialog';
import { STATUS_TEXT } from '@app/Customers/linkAddressText';
import { useSession } from '@app/session/SessionContext';

const STATUS_COLOR = { WORKING: 'green', UNCHECKED: 'grey', FAILING: 'red' } as const;

type Work = 'check' | 'remove' | 'save';
const WORK_TEXT: Record<Work, string> = { check: 'Checking…', remove: 'Removing…', save: 'Saving…' };

// the viewer's own locale and time zone
const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const moment = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const sentence = (text: string) => text.replace(/[.\s]+$/, '');

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** The link addresses of a customer's brands (link addresses spec §5.9); only the super admin sees it. */
export const LinkAddressesCard: React.FunctionComponent<{ customerId: string }> = ({ customerId }) => {
  const { token } = useSession();
  const list = useLoad((t) => getCustomerPagesAddresses(t, customerId), [customerId], { keepOnError: true });
  const [editing, setEditing] = React.useState<BrandPagesAddress | null>(null);
  const [removing, setRemoving] = React.useState<BrandPagesAddress | null>(null);
  const [working, setWorking] = React.useState<Record<string, Work | undefined>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  const put = (row: BrandPagesAddress) =>
    list.setData((d) => (d ? { ...d, brands: d.brands.map((b) => (b.workspaceId === row.workspaceId ? row : b)) } : d));
  const busyOn = (id: string, work: Work | undefined) => setWorking((w) => ({ ...w, [id]: work }));

  const check = async (b: BrandPagesAddress) => {
    if (working[b.workspaceId]) return;
    busyOn(b.workspaceId, 'check');
    setError(null);
    try {
      put(await checkBrandPagesAddress(token as string, customerId, b.workspaceId));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NO_PAGES_ADDRESS') {
        // removed meanwhile, from another screen: show what is stored now
        setError(`${b.workspaceName} has no link address any more.`);
        list.reload();
      } else {
        setError(`${b.workspaceName}: ${messageFor(e)}`);
      }
    } finally {
      busyOn(b.workspaceId, undefined);
    }
  };

  const remove = async (b: BrandPagesAddress) => {
    busyOn(b.workspaceId, 'remove');
    setRemoveError(null);
    try {
      put(await setBrandPagesAddress(token as string, customerId, b.workspaceId, null, b.version));
      setRemoving(null);
    } catch (e) {
      setRemoveError(messageFor(e));
    } finally {
      busyOn(b.workspaceId, undefined);
    }
  };

  const data = list.data;
  return (
    <Card>
      <CardTitle>Link addresses</CardTitle>
      <CardBody>
        <Content component="p">
          Message and form links of a brand open under its own address once the check passes; until then they use the
          platform address.
        </Content>
        {list.error && <Alert variant="danger" isInline isPlain title={list.error} />}
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        {!data && !list.error && <Spinner size="md" aria-label="Loading link addresses" />}
        {data && (
          <Table aria-label="Link addresses" variant="compact">
            <Thead>
              <Tr>
                <Th>Brand</Th>
                <Th>Address</Th>
                <Th>Status</Th>
                <Th screenReaderText="Actions" />
              </Tr>
            </Thead>
            <Tbody>
              {data.brands.map((b) => {
                const work = working[b.workspaceId];
                const busy = !!work;
                const a = b.address;
                return (
                  <Tr key={b.workspaceId}>
                    <Td dataLabel="Brand">{b.workspaceName}</Td>
                    <Td dataLabel="Address">
                      {a ? a.baseUrl : 'Uses the platform address'}
                      {b.formerHosts.map((f) => (
                        <div key={f.host} className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                          {`Earlier address ${f.host} must keep working until ${day(f.until)}, for links already sent.`}
                        </div>
                      ))}
                    </Td>
                    <Td dataLabel="Status">
                      {work ? (
                        WORK_TEXT[work]
                      ) : a ? (
                        <>
                          <Label isCompact color={STATUS_COLOR[a.status]}>
                            {STATUS_TEXT[a.status]}
                          </Label>
                          {a.status === 'FAILING' && a.lastError && <span> {a.lastError}</span>}
                          {a.status === 'WORKING' && a.lastError && (
                            // the daily check waits for three failures in a row before it calls an address Failing
                            <div className="pf-v6-u-font-size-sm">{`The last daily check failed: ${sentence(
                              a.lastError,
                            )}. It turns Failing after three failed daily checks in a row.`}</div>
                          )}
                          {a.checkedAt && (
                            <div className="pf-v6-u-color-200 pf-v6-u-font-size-sm">{`checked ${moment(a.checkedAt)}`}</div>
                          )}
                        </>
                      ) : null}
                    </Td>
                    <Td dataLabel="Actions" modifier="nowrap">
                      <Button variant="link" isInline isDisabled={busy} onClick={() => setEditing(b)}>
                        {a ? 'Change…' : 'Set…'}
                      </Button>{' '}
                      {a && (
                        <>
                          <Button variant="link" isInline isDisabled={busy} onClick={() => void check(b)}>
                            Check
                          </Button>{' '}
                          <Button
                            variant="link"
                            isInline
                            isDanger
                            isDisabled={busy}
                            onClick={() => {
                              setRemoveError(null);
                              setRemoving(b);
                            }}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </CardBody>
      {editing && data && (
        <LinkAddressDialog
          customerId={customerId}
          brand={editing}
          platformBaseUrl={data.platformBaseUrl}
          keepDays={data.keepDays}
          onSaving={(on) => busyOn(editing.workspaceId, on ? 'save' : undefined)}
          onDone={(row) => {
            put(row);
            setEditing(null);
          }}
          onCancel={() => {
            setEditing(null);
            // someone may have changed it meanwhile (a stale version): the next open uses what is stored now
            list.reload();
          }}
        />
      )}
      {removing && removing.address && data && (
        <ConfirmModal
          title="Remove link address"
          confirmLabel="Remove"
          variant="danger"
          busy={!!working[removing.workspaceId]}
          error={removeError}
          onConfirm={() => void remove(removing)}
          onCancel={() => setRemoving(null)}
        >
          {`Remove the link address of ${removing.workspaceName}? Its links will use the platform address. ${hostOf(
            removing.address.baseUrl,
          )} must keep working for ${data.keepDays} days, for links already sent.`}
        </ConfirmModal>
      )}
    </Card>
  );
};
