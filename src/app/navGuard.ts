/**
 * One screen at a time may hold unsaved work. It registers a guard; the sidebar's links ask it before navigating
 * (the app's router has no data router, so React Router cannot block for us).
 */
let guard: ((to: string) => boolean) | null = null;

/** Registers the guard; returns the function that removes it. A guard answers true to let the navigation happen. */
export function registerNavGuard(fn: (to: string) => boolean): () => void {
  guard = fn;
  return () => {
    if (guard === fn) guard = null;
  };
}

/** True when nothing holds the navigation back; false when the guard took it over (it will ask and navigate itself). */
export function navGuardAllows(to: string): boolean {
  return guard ? guard(to) : true;
}
