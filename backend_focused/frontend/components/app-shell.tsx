'use client';

import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/offices', label: 'Offices' },
  { href: '/mechanics', label: 'Mechanics' },
];

function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 3 }}>
          <Typography
            component={Link}
            href="/"
            variant="h6"
            sx={{ fontWeight: 700, color: 'text.primary', textDecoration: 'none' }}
          >
            Fleet Tracker
          </Typography>
          <Stack direction="row" spacing={1} component="nav">
            {NAV_ITEMS.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  size="small"
                  color={current ? 'primary' : 'inherit'}
                  aria-current={current ? 'page' : undefined}
                  sx={{
                    fontWeight: current ? 700 : 500,
                    bgcolor: current ? 'action.selected' : 'transparent',
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" component="main" sx={{ flex: 1, py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h5" component="h1" fontWeight={700}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Stack direction="row" spacing={1}>
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}
