import { Suspense } from 'react';
import { Box, Card, Skeleton, Stack } from '@mui/material';

import { SubmissionsWorkspace } from '@/components/submissions/SubmissionsWorkspace';

export const metadata = {
  title: 'Submissions · Submission Tracker',
};

export default function SubmissionsPage() {
  // The workspace reads the query string via `useSearchParams`, which Next
  // requires to sit inside a Suspense boundary so the shell can prerender.
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <SubmissionsWorkspace />
    </Suspense>
  );
}

function WorkspaceFallback() {
  return (
    <Stack spacing={3}>
      <Box>
        <Skeleton variant="text" width={240} height={48} />
        <Skeleton variant="text" width={420} />
      </Box>
      <Card>
        <Box sx={{ p: 2 }}>
          <Skeleton variant="rounded" height={56} />
        </Box>
      </Card>
      <Card>
        <Box sx={{ p: 2 }}>
          <Skeleton variant="rounded" height={320} />
        </Box>
      </Card>
    </Stack>
  );
}
