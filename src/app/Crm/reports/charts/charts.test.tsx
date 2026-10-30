import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { SegmentedBar } from './SegmentedBar';
import { StatTile } from './StatTile';
import { compact } from './chartText';

const money = (v: number) => `₹${v.toLocaleString('en-IN')}`;

const ROWS = [
  { key: 'a', label: 'Alpha', value: 300, hint: '3 deals' },
  { key: 'b', label: 'Beta', value: 1200 },
  { key: 'c', label: 'Gamma', value: 50 },
  { key: 'd', label: 'Delta', value: 700 },
  { key: 'e', label: 'Epsilon', value: 900 },
  { key: 'f', label: 'A very long category label that keeps on going', value: 10 },
];

const bars = (container: HTMLElement) => Array.from(container.querySelectorAll('rect.crm-chart__bar'));

describe('report charts', () => {
  it('barChartRanksAndLabelsTopThree', () => {
    const { container } = render(<BarChart title="By owner" rows={ROWS} format={money} />);
    const drawn = bars(container);
    expect(drawn).toHaveLength(6);
    const widths = drawn.map((r) => Number(r.getAttribute('width')));
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
    const labels = Array.from(container.querySelectorAll('text.crm-chart__label')).map((t) => t.textContent);
    expect(labels[0]).toBe('Beta');
    const values = Array.from(container.querySelectorAll('text.crm-chart__value')).map((t) => t.textContent);
    expect(values).toEqual([money(1200), money(900), money(700)]);
  });

  it('barChartKeepsOrderWhenAsked', () => {
    const { container } = render(<BarChart title="Funnel" rows={ROWS} format={String} keepOrder />);
    const labels = Array.from(container.querySelectorAll('text.crm-chart__label')).map((t) => t.textContent);
    expect(labels[0]).toBe('Alpha');
    expect(labels[1]).toBe('Beta');
  });

  it('barChartTooltipShowsFullLabelAndHint', async () => {
    const user = userEvent.setup();
    const { container } = render(<BarChart title="By owner" rows={ROWS} format={money} />);
    const labels = Array.from(container.querySelectorAll('text.crm-chart__label')).map((t) => t.textContent ?? '');
    expect(labels.some((l) => l.endsWith('…'))).toBe(true);
    const hits = container.querySelectorAll('rect.crm-chart__hit');
    await user.hover(hits[hits.length - 1]);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('A very long category label that keeps on going');
    await user.hover(hits[5 - 0 - 5]);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Beta');
    const alphaIndex = Array.from(container.querySelectorAll('text.crm-chart__label')).findIndex((t) =>
      t.textContent?.startsWith('Alpha'),
    );
    await user.hover(hits[alphaIndex]);
    expect(screen.getByRole('tooltip')).toHaveTextContent('3 deals');
  });

  it('lineChartDrawsOneSeriesPathEach', () => {
    const series = ['Created', 'Won', 'Lost'].map((label, i) => ({
      key: label.toLowerCase(),
      label,
      points: [0, 1, 2].map((d) => ({ x: new Date(2026, 9, 20 + d), y: (i + 1) * (d + 1) })),
    }));
    const { container } = render(
      <LineChart title="Deals over time" series={series} formatY={String} formatX={(d) => String(d.getDate())} />,
    );
    const paths = Array.from(container.querySelectorAll('path.crm-chart__line'));
    expect(paths).toHaveLength(3);
    expect(paths.map((p) => p.getAttribute('stroke'))).toEqual([
      'var(--crm-series-1)',
      'var(--crm-series-2)',
      'var(--crm-series-3)',
    ]);
  });

  it('lineChartLegendForTwoOrMoreSeries', () => {
    const one = [{ key: 'a', label: 'Only', points: [{ x: new Date(2026, 0, 1), y: 1 }] }];
    const { container, unmount } = render(<LineChart title="One" series={one} formatY={String} formatX={String} />);
    expect(container.querySelector('.crm-chart__legend')).toBeNull();
    unmount();
    const two = [...one, { key: 'b', label: 'Other', points: [{ x: new Date(2026, 0, 1), y: 2 }] }];
    const second = render(<LineChart title="Two" series={two} formatY={String} formatX={String} />);
    const legend = second.container.querySelector('.crm-chart__legend') as HTMLElement;
    expect(legend).not.toBeNull();
    expect(within(legend).getByText('Only')).toBeInTheDocument();
    expect(within(legend).getByText('Other')).toBeInTheDocument();
  });

  it('lineChartCrosshairTooltipListsEverySeries', () => {
    const series = ['Created', 'Won'].map((label, i) => ({
      key: label.toLowerCase(),
      label,
      points: [0, 1, 2].map((d) => ({ x: new Date(2026, 9, 20 + d), y: (i + 1) * 10 + d })),
    }));
    const { container } = render(
      <LineChart title="Deals over time" series={series} formatY={String} formatX={(d) => `day ${d.getDate()}`} />,
    );
    const hit = container.querySelector('rect.crm-chart__hit') as SVGRectElement;
    fireEvent.mouseMove(hit, { clientX: 0, clientY: 0 });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('day 20');
    expect(tip).toHaveTextContent('Created');
    expect(tip).toHaveTextContent('10');
    expect(tip).toHaveTextContent('Won');
    expect(tip).toHaveTextContent('20');
    expect(container.querySelector('line.crm-chart__crosshair')).not.toBeNull();
    fireEvent.mouseLeave(hit);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('seriesColoursComeFromCssVariables', () => {
    const series = [1, 2].map((n) => ({ key: `s${n}`, label: `S${n}`, points: [{ x: new Date(2026, 0, n), y: n }] }));
    const { container } = render(
      <>
        <BarChart title="Bars" rows={ROWS} format={String} />
        <LineChart title="Lines" series={series} formatY={String} formatX={String} />
        <SegmentedBar ariaLabel="Delivery" total={10} parts={[{ key: 'a', label: 'Sent', value: 6 }]} />
      </>,
    );
    const painted = Array.from(container.querySelectorAll('[fill], [stroke]'));
    for (const el of painted) {
      for (const attr of ['fill', 'stroke']) {
        const v = el.getAttribute(attr);
        if (v) expect(v).not.toMatch(/^#[0-9a-f]{3,8}$/i);
      }
    }
  });

  it('segmentedBarGapsAndOrder', () => {
    const { container } = render(
      <SegmentedBar
        ariaLabel="Delivery of Diwali"
        total={100}
        parts={[
          { key: 'sent', label: 'Sent', value: 50 },
          { key: 'delivered', label: 'Delivered', value: 30 },
          { key: 'read', label: 'Read', value: 0 },
          { key: 'failed', label: 'Failed', value: 20 },
        ]}
      />,
    );
    const parts = Array.from(container.querySelectorAll('.crm-segmented__part')) as HTMLElement[];
    expect(parts).toHaveLength(3); // a part at zero draws nothing
    expect(parts.map((p) => p.style.flexBasis)).toEqual(['50%', '30%', '20%']);
    expect(parts.map((p) => p.style.background)).toEqual([
      'var(--crm-series-1)',
      'var(--crm-series-2)',
      'var(--crm-series-4)',
    ]);
    expect(screen.getByRole('img', { name: 'Delivery of Diwali' })).toBeInTheDocument();
  });

  it('statTileRendersLabelValueSub', () => {
    render(<StatTile label="Won in period" value="₹5,000" sub="1 deal" />);
    expect(screen.getByText('Won in period')).toBeInTheDocument();
    expect(screen.getByText('₹5,000')).toBeInTheDocument();
    expect(screen.getByText('1 deal')).toBeInTheDocument();
  });

  it('chartsHaveAccessibleNames', () => {
    const series = [{ key: 'a', label: 'A', points: [{ x: new Date(2026, 0, 1), y: 1 }] }];
    render(
      <>
        <BarChart title="By owner" period="1 Aug – 29 Oct 2026" rows={ROWS} format={String} />
        <LineChart title="Deals over time" period="last 90 days" series={series} formatY={String} formatX={String} />
      </>,
    );
    expect(screen.getByRole('img', { name: 'By owner, 1 Aug – 29 Oct 2026' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Deals over time, last 90 days' })).toBeInTheDocument();
  });

  it('emptyRowsRenderNothing', () => {
    const { container } = render(<BarChart title="Empty" rows={[]} format={String} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('compactNumbers', () => {
    expect(compact(950)).toBe('950');
    expect(compact(1200)).toBe('1.2k');
    expect(compact(3_400_000)).toBe('3.4M');
    expect(compact(10_000)).toBe('10k');
  });
});
