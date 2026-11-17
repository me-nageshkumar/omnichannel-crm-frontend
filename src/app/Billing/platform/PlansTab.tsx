import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Label,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { ActionsColumn, type IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  PERIOD_LABEL,
  PERIOD_MONTHS,
  type Plan,
  type PlanStatus,
  activatePlan,
  deletePlan,
  listPlans,
  planHistory,
  retirePlan,
} from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { useSession } from '@app/session/SessionContext';
import { BillingHistoryModal } from '@app/Billing/platform/BillingHistoryModal';
import { DuplicatePlanModal } from '@app/Billing/platform/DuplicatePlanModal';

type Filter = 'ALL' | PlanStatus;
type Dialog = { kind: 'duplicate' | 'history' | 'delete'; plan: Plan };

const FILTERS: Record<Filter, string> = { ALL: 'All', DRAFT: 'Draft', ACTIVE: 'Active', RETIRED: 'Retired' };
const STATUS_COLOR: Record<PlanStatus, 'grey' | 'green' | 'orange'> = {
  DRAFT: 'grey',
  ACTIVE: 'green',
  RETIRED: 'orange',
};

const byRank = (a: Plan, b: Plan) =>
  a.rank - b.rank || PERIOD_MONTHS[a.period] - PERIOD_MONTHS[b.period] || a.code.localeCompare(b.code);

export const PlanStatusLabel: React.FunctionComponent<{ status: PlanStatus }> = ({ status }) => (
  <Label isCompact color={STATUS_COLOR[status]}>
    {FILTERS[status]}
  </Label>
);

/** The plans customers are put on. Every price shown is the one the server worked out. */
export const PlansTab: React.FunctionComponent = () => {
  const { token } = useSession();
  const canManage = useAccess().has('plan:manage');
  const plans = useLoad((t) => listPlans(t));
  const [filter, setFilter] = React.useState<Filter>('ALL');
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const change = useAction();
  const remove = useAction();

  const put = (p: Plan) => plans.setData((list) => [...(list ?? []).filter((x) => x.code !== p.code), p]);

  const move = async (p: Plan, to: (token: string, code: string) => Promise<Plan>) => {
    const moved = await change.run(() => to(token as string, p.code));
    if (moved) put(moved);
  };

  const onDelete = async (p: Plan) => {
    const done = await remove.run(async () => {
      await deletePlan(token as string, p.code);
      return true;
    });
    if (done) {
      plans.setData((list) => (list ?? []).filter((x) => x.code !== p.code));
      setDialog(null);
    }
  };

  const actionsOf = (p: Plan): IAction[] => {
    const history: IAction = { title: 'History', onClick: () => setDialog({ kind: 'history', plan: p }) };
    if (!canManage) return [history];
    const actions: IAction[] = [];
    if (p.status !== 'ACTIVE') actions.push({ title: 'Activate', onClick: () => void move(p, activatePlan) });
    if (p.status === 'ACTIVE') actions.push({ title: 'Retire', onClick: () => void move(p, retirePlan) });
    actions.push({ title: 'Duplicate', onClick: () => setDialog({ kind: 'duplicate', plan: p }) }, history);
    if (p.status === 'DRAFT') {
      actions.push({
        title: 'Delete',
        onClick: () => {
          remove.reset();
          setDialog({ kind: 'delete', plan: p });
        },
      });
    }
    return actions;
  };

  const shown = (plans.data ?? []).filter((p) => filter === 'ALL' || p.status === filter).sort(byRank);

  return (
    <>
      {plans.error && <Alert variant="danger" isInline title={plans.error} />}
      {change.error && <Alert variant="danger" isInline title={change.error} />}
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <ToggleGroup aria-label="Status filter">
              {(Object.keys(FILTERS) as Filter[]).map((f) => (
                <ToggleGroupItem key={f} text={FILTERS[f]} isSelected={filter === f} onChange={() => setFilter(f)} />
              ))}
            </ToggleGroup>
          </ToolbarItem>
          {canManage && (
            <ToolbarItem>
              <Button variant="primary" component={(props) => <Link {...props} to="/platform/plans/new" />}>
                New plan
              </Button>
            </ToolbarItem>
          )}
        </ToolbarContent>
      </Toolbar>
      {plans.loading && !plans.data ? (
        <Spinner aria-label="Loading plans" />
      ) : (
        <Table aria-label="Plans" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th width={10}>Period</Th>
              <Th width={10}>Rank</Th>
              <Th width={10}>Actual price</Th>
              <Th width={10}>Discount</Th>
              <Th width={10}>Price</Th>
              <Th width={10}>Status</Th>
              <Th width={10}>Customers</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {shown.map((p) => (
              <Tr key={p.code}>
                <Td dataLabel="Name">
                  <Link to={`/platform/plans/${encodeURIComponent(p.code)}`}>{p.name}</Link>
                </Td>
                <Td dataLabel="Period">{PERIOD_LABEL[p.period]}</Td>
                <Td dataLabel="Rank">{`#${p.rank}`}</Td>
                <Td dataLabel="Actual price">{formatMoney(p.actualPrice, 'INR')}</Td>
                <Td dataLabel="Discount">{`${p.discountPercent}%`}</Td>
                <Td dataLabel="Price">{formatMoney(p.discountedPrice, 'INR')}</Td>
                <Td dataLabel="Status">
                  <PlanStatusLabel status={p.status} />
                </Td>
                <Td dataLabel="Customers">{p.customers}</Td>
                <Td isActionCell>
                  <ActionsColumn items={actionsOf(p)} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      {dialog?.kind === 'duplicate' && (
        <DuplicatePlanModal
          plan={dialog.plan}
          onSaved={(copy) => {
            put(copy);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'history' && (
        <BillingHistoryModal
          title={`History of ${dialog.plan.name}`}
          load={(t) => planHistory(t, dialog.plan.code)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={`Delete ${dialog.plan.name}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={remove.busy}
          error={remove.error}
          onConfirm={() => void onDelete(dialog.plan)}
          onCancel={() => setDialog(null)}
        >
          The draft plan is removed for good.
        </ConfirmModal>
      )}
    </>
  );
};
