export type ThemeId = 'ember' | 'violet' | 'ocean' | 'forest' | 'gold';

export const APPEARANCE_CHANGED_EVENT = 'moraltown:appearance-changed';
const THEME_STORAGE_KEY = 'moraltown:theme';

export const themes: Array<{
  id: ThemeId;
  name: string;
  color: string;
  detail: string;
}> = [
  { id: 'ember', name: 'Ember', color: '#e53d45', detail: 'Crimson and carbon' },
  { id: 'violet', name: 'Violet', color: '#a875f5', detail: 'Electric violet' },
  { id: 'ocean', name: 'Ocean', color: '#27b9e8', detail: 'Cool blue glass' },
  { id: 'forest', name: 'Forest', color: '#39bd7c', detail: 'Deep green' },
  { id: 'gold', name: 'Gold', color: '#eeb542', detail: 'Warm amber' },
];

export function readTheme(): ThemeId {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return themes.some((theme) => theme.id === value) ? (value as ThemeId) : 'ember';
  } catch {
    return 'ember';
  }
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: ThemeId): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The current page still updates even when browser storage is unavailable.
  }
  applyTheme(theme);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APPEARANCE_CHANGED_EVENT, { detail: theme }));
  }
}

export function syncTheme(): void {
  applyTheme(readTheme());
}
