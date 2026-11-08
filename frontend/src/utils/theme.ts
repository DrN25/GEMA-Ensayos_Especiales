// Gestión de tema (claro/oscuro) con persistencia en localStorage para Ensayos Especiales (SIGEG 2.0).
// Alineado al estándar de GEMA-Mapeo.
// Se aplica ANTES del primer render (main.tsx) para evitar parpadeos de contraste.

const THEME_KEY = 'sigeg_theme';

export const getStoredDarkMode = (): boolean => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch {
    // localStorage no disponible
  }
  return true; // Default: oscuro (Obsidian Space Blue de SIGEG)
};

export const applyThemeClass = (dark: boolean): void => {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
};

export const applyStoredTheme = (): void => {
  applyThemeClass(getStoredDarkMode());
};

export const persistTheme = (dark: boolean): void => {
  applyThemeClass(dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    // Memoria fallback
  }
};
