// Theme choices for this browser, and the PatternFly classes they put on <html>.
// Mirrored by the boot script in src/index.html (keys, values, defaults, classes).

/** Color scheme: 'light' | 'dark', absent means follow the computer. Kept from the first theme switch. */
export const THEME_KEY = 'omnichannel.theme';
/** 'felt' for Project Felt, absent means the default PatternFly theme. */
export const BRAND_KEY = 'omnichannel.theme.brand';
/** 'system' | 'default' | 'high-contrast' | 'glass'; absent means glass. */
export const CONTRAST_KEY = 'omnichannel.theme.contrast';

export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const CONTRAST_QUERY = '(prefers-contrast: more)';

export type Brand = 'default' | 'felt';
export type ColorScheme = 'system' | 'light' | 'dark';
export type Contrast = 'system' | 'default' | 'high-contrast' | 'glass';

export interface ThemePrefs {
  brand: Brand;
  scheme: ColorScheme;
  contrast: Contrast;
}

export const DEFAULT_PREFS: ThemePrefs = { brand: 'default', scheme: 'system', contrast: 'glass' };

const CLASS = {
  dark: 'pf-v6-theme-dark',
  felt: 'pf-v6-theme-felt',
  glass: 'pf-v6-theme-glass',
  highContrast: 'pf-v6-theme-high-contrast',
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice lasts until reload
  }
}

/** The stored choices; unknown values fall back to the defaults. */
export function readPrefs(): ThemePrefs {
  const scheme = read(THEME_KEY);
  const brand = read(BRAND_KEY);
  const contrast = read(CONTRAST_KEY);
  return {
    brand: brand === 'felt' ? 'felt' : DEFAULT_PREFS.brand,
    scheme: scheme === 'light' || scheme === 'dark' ? scheme : DEFAULT_PREFS.scheme,
    contrast:
      contrast === 'system' || contrast === 'default' || contrast === 'high-contrast' || contrast === 'glass'
        ? contrast
        : DEFAULT_PREFS.contrast,
  };
}

/** Stores only what differs from the defaults, so a default is never pinned. */
export function writePrefs(prefs: ThemePrefs): void {
  write(THEME_KEY, prefs.scheme === 'system' ? null : prefs.scheme);
  write(BRAND_KEY, prefs.brand === 'felt' ? 'felt' : null);
  write(CONTRAST_KEY, prefs.contrast === DEFAULT_PREFS.contrast ? null : prefs.contrast);
}

export function systemMatches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Puts the PatternFly theme classes for {@code prefs} on <html>, resolving 'system' from the computer. */
export function applyPrefs(prefs: ThemePrefs): void {
  const dark = prefs.scheme === 'dark' || (prefs.scheme === 'system' && systemMatches(DARK_QUERY));
  const highContrast =
    prefs.contrast === 'high-contrast' || (prefs.contrast === 'system' && systemMatches(CONTRAST_QUERY));
  const list = document.documentElement.classList;
  list.toggle(CLASS.dark, dark);
  list.toggle(CLASS.felt, prefs.brand === 'felt');
  list.toggle(CLASS.highContrast, highContrast);
  list.toggle(CLASS.glass, prefs.contrast === 'glass');
}
