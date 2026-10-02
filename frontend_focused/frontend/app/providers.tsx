'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useState } from 'react';

import { theme } from './theme';

export default function Providers({ children }: PropsWithChildren) {
  // One client per browser session, created lazily so it is never shared
  // between requests on the server.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Submissions are reviewed over minutes, not seconds; refetching on
            // every window focus would be noise.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    // Emotion's styles are inserted by the server and the client; without this
    // the two disagree and React reports a hydration mismatch.
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </AppRouterCacheProvider>
  );
}
