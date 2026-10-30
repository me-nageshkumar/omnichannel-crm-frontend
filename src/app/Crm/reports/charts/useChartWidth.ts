import * as React from 'react';

export const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 240;

/**
 * The real width of the chart's box, so the SVG draws at scale 1 and its text keeps its size on a phone and on a
 * wide card alike. Starts at the default until the box is measured; follows resizes where ResizeObserver exists.
 */
export function useChartWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(Math.max(MIN_WIDTH, w));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
