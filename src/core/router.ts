import { useEffect, useState } from 'preact/hooks';

/** Маршрутизация через hash: #/m/a/spl → ['m','a','spl']. Работает на GitHub Pages без настройки сервера. */
export function parseHash(h: string): string[] {
  return h.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function useRoute(): string[] {
  const [r, setR] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => {
      setR(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(path: string): void {
  location.hash = path.startsWith('#') ? path : '#' + path;
}
