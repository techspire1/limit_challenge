'use client';

import { Alert, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Severity = 'success' | 'error' | 'info' | 'warning';

interface Message {
  text: string;
  severity: Severity;
}

interface FeedbackContextValue {
  notify: (text: string, severity?: Severity) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

/** One snackbar for the whole app, so mutations can confirm themselves anywhere. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);

  const notify = useCallback((text: string, severity: Severity = 'success') => {
    setMessage({ text, severity });
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Snackbar
        open={message !== null}
        autoHideDuration={message?.severity === 'error' ? 8000 : 4000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={message?.severity ?? 'info'}
          variant="filled"
          onClose={() => setMessage(null)}
          sx={{ maxWidth: 520 }}
        >
          {message?.text}
        </Alert>
      </Snackbar>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside a FeedbackProvider');
  return context;
}
