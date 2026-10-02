'use client';

import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { PropsWithChildren, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FeedbackProvider } from '@/components/feedback-provider';

function useTheme() {
  return useMemo(
    () =>
      createTheme({
        palette: {
          primary: {
            main: '#0f62fe',
          },
          background: {
            default: '#f5f7fb',
          },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
        },
        components: {
          MuiPaper: { defaultProps: { elevation: 0 } },
          MuiCard: {
            defaultProps: { variant: 'outlined' },
            styleOverrides: { root: { height: '100%' } },
          },
          MuiTableCell: { styleOverrides: { head: { fontWeight: 700 } } },
          MuiTextField: { defaultProps: { size: 'small' } },
        },
      }),
    [],
  );
}

export default function Providers({ children }: PropsWithChildren) {
  const theme = useTheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // A 400 or 404 will not fix itself, so only retry once for the
            // transient cases.
            retry: 1,
          },
        },
      }),
  );

  return (
    // Without this, Emotion flushes its server-rendered <style> tags into the
    // body and hydration mismatches against the client tree.
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <FeedbackProvider>{children}</FeedbackProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppRouterCacheProvider>
  );
}
