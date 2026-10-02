import { Skeleton, Stack } from '@mui/material';
import { Suspense } from 'react';

import { VehiclesWorkspace } from './vehicles-workspace';

// The workspace reads its filters from `useSearchParams`, which requires a
// Suspense boundary so the rest of the route can still be prerendered.
export default function VehiclesPage() {
  return (
    <Suspense
      fallback={
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={220} />
          <Skeleton variant="rounded" height={400} />
        </Stack>
      }
    >
      <VehiclesWorkspace />
    </Suspense>
  );
}
