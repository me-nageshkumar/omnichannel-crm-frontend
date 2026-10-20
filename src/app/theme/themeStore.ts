export const THEME_KEY = 'omnichannel.theme';

/** PatternFly switches every component to its dark tokens when this class is on <html>. */
export const DARK_CLASS = 'pf-v6-theme-dark';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

export type ThemeChoice = 'light' | 'dark' | 'system';

/** The theme this browser chose, or 'system' when none is stored or the stored value is unknown. */
export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function writeTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // storage unavailable: the choice lasts until reload
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function applyDark(dark: boolean): void {
  document.documentElement.classList.toggle(DARK_CLASS, dark);
}
