"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEMES,
  isThemeId,
  type ThemeDefinition,
  type ThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  definition: ThemeDefinition;
  setTheme: (id: ThemeId) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
  const meta = document.querySelector('meta[name="theme-color"]');
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--theme-color")
    .trim();
  if (meta && accent) meta.setAttribute("content", accent);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    const next = isThemeId(saved) ? saved : DEFAULT_THEME;
    applyTheme(next);
    setThemeState(next);
    setReady(true);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    applyTheme(id);
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      definition: THEMES[theme],
      setTheme,
      ready,
    }),
    [theme, setTheme, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
