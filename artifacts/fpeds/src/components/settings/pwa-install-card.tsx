import { useEffect, useState } from 'react';
import { Check, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandaloneApp(): boolean {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true;
}

export function PwaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const updateInstalled = () => setInstalled(isStandaloneApp());
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    updateInstalled();
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <section className="glass overflow-hidden rounded-3xl lg:col-span-2">
      <div className="border-b border-white/[.08] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[.2em] text-primary">Mobile app</p>
            <h2 className="mt-2 font-display text-2xl tracking-[-.03em]">Keep MoralTown on your home screen</h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
              Install opens the mailbox in a standalone app window. Mailbox links stay inside that window.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {installed ? (
          <p className="flex items-center gap-2 text-sm text-primary" role="status">
            <Check className="h-4 w-4" /> MoralTown is open as an installed app.
          </p>
        ) : installPrompt ? (
          <Button onClick={install} className="w-full sm:w-auto" data-testid="button-install-app">
            <Download className="h-4 w-4" /> Install MoralTown
          </Button>
        ) : (
          <p className="rounded-xl border border-white/[.08] bg-white/[.025] px-4 py-3 text-xs leading-5 text-muted-foreground">
            {ios
              ? 'In Safari, tap Share, then Add to Home Screen. Open the new home-screen icon to use the standalone app.'
              : 'Open your browser menu and choose Install app or Add to Home Screen. Then launch MoralTown from its new icon.'}
          </p>
        )}
      </div>
    </section>
  );
}