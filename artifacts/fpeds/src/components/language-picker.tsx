import { Languages } from 'lucide-react';
import { languages, useLanguage } from '@/lib/language';

export function LanguagePicker({ placement = 'inline' }: { placement?: 'inline' | 'fixed' }) {
  const [language, changeLanguage] = useLanguage();
  const fixed = placement === 'fixed';

  return (
    <div className={`language-control flex items-center gap-2.5 px-3 py-2 ${fixed ? 'fixed bottom-4 left-4 z-[70] w-[156px]' : 'w-full max-w-xs'}`} data-testid={`language-picker-${placement}`}>
      <Languages className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <label className="min-w-0 flex-1">
        <span className="block font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Language</span>
        <select
          value={language}
          onChange={(event) => changeLanguage(event.target.value as typeof language)}
          className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent text-xs font-medium text-foreground outline-none"
          aria-label="Language"
          data-testid={`select-language-${placement}`}
        >
          {languages.map((item) => <option key={item.code} value={item.code} className="bg-[#111] text-white">{item.name}</option>)}
        </select>
      </label>
    </div>
  );
}
