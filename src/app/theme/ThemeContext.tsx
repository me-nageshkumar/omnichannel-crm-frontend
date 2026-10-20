import * as React from 'react';
import { CONTRAST_QUERY, DARK_QUERY, ThemePrefs, applyPrefs, readPrefs, writePrefs } from '@app/theme/themeStore';

interface ThemeValue {
  prefs: ThemePrefs;
  choose: (change: Partial<ThemePrefs>) => void;
}

const ThemeContext = React.createContext<ThemeValue | null>(null);

/** Holds the theme choices and keeps <html> in step with them, and with the computer for 'system'. */
export const ThemeProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = React.useState<ThemePrefs>(readPrefs);

  React.useLayoutEffect(() => {
    applyPrefs(prefs);
    if (typeof window.matchMedia !== 'function') return undefined;
    const queries = [DARK_QUERY, CONTRAST_QUERY].map((q) => window.matchMedia(q));
    const onChange = () => applyPrefs(prefs);
    queries.forEach((q) => q.addEventListener('change', onChange));
    return () => queries.forEach((q) => q.removeEventListener('change', onChange));
  }, [prefs]);

  const choose = React.useCallback((change: Partial<ThemePrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...change };
      writePrefs(next);
      return next;
    });
  }, []);

  const value = React.useMemo(() => ({ prefs, choose }), [prefs, choose]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeValue {
  const value = React.useContext(ThemeContext);
  if (!value) throw new Error('useTheme outside ThemeProvider');
  return value;
}
