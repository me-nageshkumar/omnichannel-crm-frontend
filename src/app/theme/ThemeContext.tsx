import * as React from 'react';
import { DARK_QUERY, ThemeChoice, applyDark, readTheme, systemPrefersDark, writeTheme } from '@app/theme/themeStore';

interface ThemeValue {
  choice: ThemeChoice;
  choose: (choice: ThemeChoice) => void;
}

const ThemeContext = React.createContext<ThemeValue | null>(null);

/** Holds the light/dark choice and keeps <html> in step with it, and with the computer under 'system'. */
export const ThemeProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [choice, setChoice] = React.useState<ThemeChoice>(readTheme);

  React.useLayoutEffect(() => {
    if (choice !== 'system') {
      applyDark(choice === 'dark');
      return;
    }
    applyDark(systemPrefersDark());
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (e: { matches: boolean }) => applyDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [choice]);

  const choose = React.useCallback((next: ThemeChoice) => {
    writeTheme(next);
    setChoice(next);
  }, []);

  const value = React.useMemo(() => ({ choice, choose }), [choice, choose]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeValue {
  const value = React.useContext(ThemeContext);
  if (!value) throw new Error('useTheme outside ThemeProvider');
  return value;
}
