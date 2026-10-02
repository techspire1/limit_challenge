'use client';

import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import Link from 'next/link';
import type { PropsWithChildren } from 'react';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar>
          <Box
            component={Link}
            href="/submissions"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <InboxRoundedIcon color="primary" />
            <Typography variant="h6" component="span">
              Submission Tracker
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
