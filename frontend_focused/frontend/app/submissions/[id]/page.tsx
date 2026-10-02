import { Suspense } from 'react';
import { Box, Card, CardContent, Skeleton, Stack } from '@mui/material';

import { SubmissionDetailView } from '@/components/submissions/SubmissionDetailView';

export const metadata = {
  title: 'Submission · Submission Tracker',
};

export default async function SubmissionDetailPage({
  params,
}: {
  // Route params are a promise in Next 16.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The view reads `returnTo` from the query string, which needs a Suspense
  // boundary around `useSearchParams`.
  return (
    <Suspense fallback={<DetailFallback />}>
      <SubmissionDetailView id={id} />
    </Suspense>
  );
}

function DetailFallback() {
  return (
    <Stack spacing={3}>
      <Box>
        <Skeleton variant="text" width={320} height={48} />
      </Box>
      <Card>
        <CardContent>
          <Skeleton variant="rounded" height={160} />
        </CardContent>
      </Card>
    </Stack>
  );
}
