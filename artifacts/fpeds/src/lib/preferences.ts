export type LocalPreference = 'privacyMode' | 'reduceMotion' | 'autoSignOut';

const STORAGE_KEYS: Record<LocalPreference, string> = {
  privacyMode: 'moraltown:privacy-mode',
  reduceMotion: 'moraltown:reduce-motion',
  autoSignOut: 'moraltown:auto-signout',
};

export const PREFERENCES_CHANGED_EVENT = 'moraltown:preferences-changed';

export function readPreference(preference: LocalPreference): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS[preference]) === 'true';
  } catch {
    return false;
  }
}

export function syncDocumentPreferences(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('moraltown-privacy-mode', readPreference('privacyMode'));
  document.documentElement.classList.toggle('moraltown-reduce-motion', readPreference('reduceMotion'));
}

export function writePreference(preference: LocalPreference, enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS[preference], String(enabled));
  } catch {
    // The current page still reflects the selected setting if storage is blocked.
  }
  syncDocumentPreferences();
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
}