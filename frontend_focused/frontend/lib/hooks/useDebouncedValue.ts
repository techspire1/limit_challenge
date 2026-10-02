'use client';

import { useEffect, useState } from 'react';

/**
 * Delays propagating a fast-changing value, so a search box fires one request
 * when the user stops typing rather than one per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
