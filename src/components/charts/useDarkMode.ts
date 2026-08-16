'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the `dark` class on <html> so charts can pick the dark-mode palette
 * steps. Dark mode is a *selected* palette, not an automatic inversion.
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
