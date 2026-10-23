/**
 * The colours a lane can have. The server stores `#rrggbb` (or none) and PatternFly tokens are CSS variables, so each
 * entry is the hex value of a PatternFly 6 palette colour, picked from the 40 shade because it reads on both the light
 * and the dark theme. `token` names the variable it mirrors; keep the two in step when the PatternFly palette moves.
 */
export interface LaneColor {
  name: string;
  hex: string;
  token: string;
}

export const LANE_COLOR_OPTIONS: LaneColor[] = [
  { name: 'Blue', hex: '#4394e5', token: '--pf-t--color--blue--40' },
  { name: 'Teal', hex: '#63bdbd', token: '--pf-t--color--teal--40' },
  { name: 'Green', hex: '#87bb62', token: '--pf-t--color--green--40' },
  { name: 'Yellow', hex: '#dca614', token: '--pf-t--color--yellow--40' },
  { name: 'Orange', hex: '#f5921b', token: '--pf-t--color--orange--40' },
  { name: 'Red', hex: '#f56e6e', token: '--pf-t--color--red--40' },
  { name: 'Purple', hex: '#876fd4', token: '--pf-t--color--purple--40' },
  { name: 'Grey', hex: '#a3a3a3', token: '--pf-t--color--gray--40' },
];

/** The `#rrggbb` values sent to the server, in palette order. */
export const LANE_COLORS: string[] = LANE_COLOR_OPTIONS.map((c) => c.hex);

/** The colour a lane added at {@code index} starts with; the palette repeats after eight lanes. */
export const nextLaneColor = (index: number): string =>
  LANE_COLORS[((index % LANE_COLORS.length) + LANE_COLORS.length) % LANE_COLORS.length];
