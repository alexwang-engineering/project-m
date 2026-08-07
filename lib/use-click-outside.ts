import { useEffect, useRef } from 'react';

/** Extracted from components/Dashboard.tsx, which had this defined privately for its own dropdowns - shared here since components/search/SearchBox.tsx needs the identical behavior. */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);
  return ref;
}
