import { useEffect, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { LanguagePicker } from '@/components/language-picker';
import { APPEARANCE_CHANGED_EVENT, applyTheme, readTheme, setTheme, themes, type ThemeId } from '@/lib/appearance';

export function AppearanceCard() {
  const [selected, setSelected] = useState<ThemeId>(() => readTheme());

  useEffect(() => {
    const update = (event: Event) => {
      const next = (event as CustomEvent<ThemeId>).detail;
      if (next) setSelected(next);
    };
    window.addEventListener(APPEARANCE_CHANGED_EVENT, update);
    return () => window.removeEventListener(APPEARANCE_CHANGED_EVENT, update);
  }, []);

  return (
    <section className="glass appearance-card rounded-3xl p-5 sm:p-6 lg:col-span-2" aria-labelledby="appearance-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[.08] pb-5">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Palette className="h-5 w-5" /></span>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.2em] text-primary">Appearance</p>
            <h2 id="appearance-title" className="mt-2 font-display text-2xl tracking-[-.03em]">Choose your theme</h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Pick an accent palette. Your choice is saved on this device and used throughout the app.</p>
          </div>
        </div>
        <LanguagePicker />
      </div>
      <div className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-5">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => { setSelected(theme.id); setTheme(theme.id); applyTheme(theme.id); }}
            aria-pressed={selected === theme.id}
            aria-label={`Choose ${theme.name} theme`}
            data-testid={`button-theme-${theme.id}`}
            className={`theme-choice flex min-h-[76px] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${selected === theme.id ? 'border-primary/60 bg-primary/[.09] text-foreground ring-1 ring-primary/30' : 'border-white/10 bg-white/[.025] text-muted-foreground hover:border-white/20 hover:bg-white/[.055]'}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15" style={{ background: `linear-gradient(145deg, ${theme.color}, ${theme.color}88)` }}>
              {selected === theme.id && <Check className="h-4 w-4 text-white drop-shadow" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{theme.name}</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{theme.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
