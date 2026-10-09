import type { ReactNode } from 'react';
import { SafeFrame } from '@/lib/video';
import './film.css';

export function Stage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <SafeFrame className={className}>{children}</SafeFrame>;
}

export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}images/moraltown-brand.png`}
      alt="MoralTown"
      className={`block object-contain ${className}`}
    />
  );
}

export function AppWindow({
  children,
  label = 'MoralTown Mail',
  className = '',
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`film-window ${className}`}>
      <div className="film-window-bar">
        <div className="flex items-center gap-[.65vmin]">
          <span className="h-[.8vmin] w-[.8vmin] rounded-full bg-primary shadow-[0_0_1.3vmin_rgba(224,52,55,.75)]" />
          <span className="font-display text-[1.4vmin] font-semibold tracking-[-.03em]">{label}</span>
        </div>
        <div className="flex gap-[.45vmin]" aria-hidden="true">
          <span className="h-[.55vmin] w-[.55vmin] rounded-full bg-white/20" />
          <span className="h-[.55vmin] w-[.55vmin] rounded-full bg-white/20" />
          <span className="h-[.55vmin] w-[.55vmin] rounded-full bg-white/20" />
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function FilmTag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-primary/25 bg-primary/[.09] px-[1.05vmin] py-[.55vmin] font-mono text-[1.25vmin] uppercase tracking-[.15em] text-primary ${className}`}>
      {children}
    </span>
  );
}

export function FieldLine({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`border-b border-white/[.09] py-[1.15vmin] ${className}`}>
      <p className="font-mono text-[1.15vmin] uppercase tracking-[.15em] text-white/35">{label}</p>
      <p className="mt-[.7vmin] truncate text-[1.9vmin] text-white/80">{value}</p>
    </div>
  );
}
