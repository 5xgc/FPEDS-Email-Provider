import { ArrowLeft, Unplug } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ParticleField } from '@/components/particle-field';

export default function NotFound() {
  const [, setLocation] = useLocation();
  return <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background/75 p-6"><ParticleField dense /><div className="glass relative z-10 max-w-md rounded-3xl p-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Unplug className="h-6 w-6" /></div><p className="mt-8 font-mono text-[10px] uppercase tracking-[.22em] text-primary">Quietly lost</p><h1 className="mt-3 font-display text-5xl">This address is empty.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">The page you’re looking for is not part of this private workspace.</p><Button onClick={() => setLocation('/')} className="mt-7" data-testid="button-return-home"><ArrowLeft className="h-4 w-4" /> Return to entry</Button></div></main>;
}