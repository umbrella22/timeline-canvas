import { useEffect } from 'react';

type Locale = 'zh' | 'en';

const STORAGE_KEY = 'timeline-canvas-docs-lang';

const getLocaleFromPathname = (pathname: string, base: string): Locale => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const rest = pathname.startsWith(normalizedBase) ? pathname.slice(normalizedBase.length) : pathname;
  return rest === 'en' || rest.startsWith('en/') ? 'en' : 'zh';
};

const getPreferredLocale = (): Locale => {
  const lang = (navigator.languages?.[0] || navigator.language || '').toLowerCase();
  return lang.startsWith('en') ? 'en' : 'zh';
};

const getBase = (): string => {
  const preferredBase = '/timeline-canvas/';
  return window.location.pathname.startsWith(preferredBase) ? preferredBase : '/';
};

const isBaseRoot = (pathname: string, base: string): boolean => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return pathname === normalizedBase || pathname === `${normalizedBase}index.html`;
};

const AutoLocale = () => {
  useEffect(() => {
    const base = getBase();
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;

    if (!stored && isBaseRoot(window.location.pathname, base)) {
      const preferred = getPreferredLocale();
      if (preferred === 'en') {
        const target = `${base}en/${window.location.search}${window.location.hash}`;
        window.location.replace(target);
        return;
      }
    }

    const syncLocaleToStorage = () => {
      const locale = getLocaleFromPathname(window.location.pathname, base);
      localStorage.setItem(STORAGE_KEY, locale);
    };

    syncLocaleToStorage();

    const notify = () => window.dispatchEvent(new Event('rspress:locationchange'));
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function (...args) {
      originalPush.apply(this, args as any);
      notify();
    } as any;

    history.replaceState = function (...args) {
      originalReplace.apply(this, args as any);
      notify();
    } as any;

    window.addEventListener('popstate', notify);
    window.addEventListener('rspress:locationchange', syncLocaleToStorage);

    return () => {
      history.pushState = originalPush;
      history.replaceState = originalReplace;
      window.removeEventListener('popstate', notify);
      window.removeEventListener('rspress:locationchange', syncLocaleToStorage);
    };
  }, []);

  return null;
};

export default AutoLocale;

