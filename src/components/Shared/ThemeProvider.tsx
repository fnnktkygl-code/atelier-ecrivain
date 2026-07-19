'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Theme } from '@/types/reader';

interface ThemeContextValue {
  theme: Theme;
  themeAuto: boolean;
  setTheme: (t: Theme) => void;
  setThemeAuto: (auto: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'day',
  themeAuto: false,
  setTheme: () => {},
  setThemeAuto: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function computeAutoTheme(): Theme {
  const h = new Date().getHours();
  return h >= 20 || h < 7 ? 'night' : 'day';
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('day');
  const [themeAuto, setThemeAutoState] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('atelier-theme');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.themeAuto) {
          setThemeAutoState(true);
          setThemeState(computeAutoTheme());
        } else if (parsed.theme) {
          setThemeState(parsed.theme);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply theme class to body
  useEffect(() => {
    const applied = themeAuto ? computeAutoTheme() : theme;
    document.body.classList.remove('sepia', 'night');
    if (applied === 'sepia') document.body.classList.add('sepia');
    if (applied === 'night') document.body.classList.add('night');
  }, [theme, themeAuto]);

  // Auto theme: re-evaluate periodically
  useEffect(() => {
    if (!themeAuto) return;
    const interval = setInterval(() => {
      setThemeState(computeAutoTheme());
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [themeAuto]);

  const persist = useCallback((t: Theme, auto: boolean) => {
    try {
      localStorage.setItem('atelier-theme', JSON.stringify({ theme: t, themeAuto: auto }));
    } catch {
      // ignore
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setThemeAutoState(false);
    persist(t, false);
  }, [persist]);

  const setThemeAuto = useCallback((auto: boolean) => {
    setThemeAutoState(auto);
    if (auto) {
      const computed = computeAutoTheme();
      setThemeState(computed);
      persist(computed, true);
    } else {
      persist(theme, false);
    }
  }, [theme, persist]);

  return (
    <ThemeContext.Provider value={{ theme, themeAuto, setTheme, setThemeAuto }}>
      {children}
    </ThemeContext.Provider>
  );
}
