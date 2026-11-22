import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Registra o Service Worker e acompanha atualizações. Chamar uma vez em main.tsx. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        const track = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            // Nova versão instalada e já existe uma ativa => oferece atualização ao usuário
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = worker;
              notify();
            }
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) {
          waitingWorker = reg.waiting;
          notify();
        }
        reg.addEventListener('updatefound', () => track(reg.installing));
        setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch(() => undefined);

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function usePWA() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
    return choice.outcome === 'accepted';
  }, []);

  const applyUpdate = useCallback(() => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  return {
    canInstall: deferredPrompt !== null,
    installed: isStandalone(),
    ios: isIOS(),
    updateAvailable: waitingWorker !== null,
    install,
    applyUpdate,
  };
}
