'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a text input responsive while its committed value lives somewhere slower
 * — here, the URL.
 *
 * The draft updates on every keystroke; the commit fires once typing pauses, so
 * the user does not get a navigation and a request per character.
 */
export function useDebouncedField(
  value: string,
  commit: (next: string) => void,
  delay = 350,
): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  const commitRef = useRef(commit);

  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  // Adopt changes that came from elsewhere, such as the back button or a reset.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => commitRef.current(draft), delay);
    return () => clearTimeout(timer);
  }, [draft, value, delay]);

  return [draft, setDraft];
}

/** Trailing-edge debounce for values that drive a background request. */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
