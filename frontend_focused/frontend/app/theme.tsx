'use client';

import { createTheme } from '@mui/material/styles';

/**
 * A quiet, dense theme: this is a workspace an operations manager keeps open
 * all day, so the data should carry the visual weight, not the chrome.
 */
export const theme = createTheme({
  palette: {
    primary: { main: '#0f62fe' },
    background: { default: '#f5f7fb', paper: '#ffffff' },
    divider: 'rgba(15, 23, 42, 0.1)',
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    h4: { fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: 'rgba(15, 23, 42, 0.1)' } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: '#fbfcfe' },
      },
    },
    MuiChip: {
      styleOverrides: { sizeSmall: { fontWeight: 600 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
});
