'use client';

import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Divider,
  Link as MuiLink,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { ErrorState } from '@/components/common/StateViews';
import { PriorityChip, StatusChip } from '@/components/common/StatusChip';
import { ContactsSection, DocumentsSection, NotesSection } from './SubmissionDetailSections';
import { formatDateTime, formatRelative } from '@/lib/format';
import { isNotFoundError } from '@/lib/errors';
import { useSubmissionDetail } from '@/lib/hooks/useSubmissions';
import type { SubmissionDetail } from '@/lib/types';

export function SubmissionDetailView({ id }: { id: string }) {
  const query = useSubmissionDetail(id);
  const searchParams = useSearchParams();

  // Carried over from the list so "Back" returns to the same filters, page and
  // sort the user left, instead of a reset list.
  const returnTo = searchParams.get('returnTo');
  const backHref = returnTo ? `/submissions?${returnTo}` : '/submissions';

  return (
    <Stack spacing={3}>
      <Box>
        <Button
          component={Link}
          href={backHref}
          startIcon={<ArrowBackRoundedIcon />}
          size="small"
          sx={{ ml: -1 }}
        >
          Back to submissions
        </Button>
      </Box>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <Card>
          <ErrorState
            error={query.error}
            title={
              isNotFoundError(query.error) ? 'Submission not found' : 'Could not load submission'
            }
            onRetry={isNotFoundError(query.error) ? undefined : () => query.refetch()}
          />
        </Card>
      ) : (
        <SubmissionDetailContent submission={query.data} backHref={backHref} />
      )}
    </Stack>
  );
}

function SubmissionDetailContent({
  submission,
  backHref,
}: {
  submission: SubmissionDetail;
  backHref: string;
}) {
  return (
    <Stack spacing={3}>
      <Box>
        <Breadcrumbs sx={{ mb: 1 }}>
          <MuiLink component={Link} href={backHref} underline="hover" color="inherit">
            Submissions
          </MuiLink>
          <Typography color="text.primary">{submission.company.legalName}</Typography>
        </Breadcrumbs>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'center' }}
          sx={{ flexWrap: 'wrap' }}
        >
          <Typography variant="h4" component="h1">
            {submission.company.legalName}
          </Typography>
          <Stack direction="row" spacing={1}>
            <StatusChip status={submission.status} />
            <PriorityChip priority={submission.priority} />
          </Stack>
        </Stack>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {[submission.company.industry, submission.company.headquartersCity]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Summary
          </Typography>
          <Typography variant="body2" color={submission.summary ? 'text.primary' : 'text.disabled'}>
            {submission.summary || 'No summary was provided with this submission.'}
          </Typography>
        </CardContent>
        <Divider />
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            }}
          >
            <Field label="Broker">
              <Typography variant="body2" fontWeight={600}>
                {submission.broker.name}
              </Typography>
              {submission.broker.primaryContactEmail ? (
                <MuiLink
                  href={`mailto:${submission.broker.primaryContactEmail}`}
                  variant="caption"
                  underline="hover"
                >
                  {submission.broker.primaryContactEmail}
                </MuiLink>
              ) : null}
            </Field>

            <Field label="Owner">
              <Typography variant="body2" fontWeight={600}>
                {submission.owner.fullName}
              </Typography>
              <MuiLink
                href={`mailto:${submission.owner.email}`}
                variant="caption"
                underline="hover"
              >
                {submission.owner.email}
              </MuiLink>
            </Field>

            <Field label="Created">
              <Typography variant="body2" fontWeight={600}>
                {formatDateTime(submission.createdAt)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatRelative(submission.createdAt)}
              </Typography>
            </Field>

            <Field label="Last updated">
              <Typography variant="body2" fontWeight={600}>
                {formatDateTime(submission.updatedAt)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatRelative(submission.updatedAt)}
              </Typography>
            </Field>
          </Box>
        </CardContent>
      </Card>

      <ContactsSection contacts={submission.contacts} />
      <DocumentsSection documents={submission.documents} />
      <NotesSection notes={submission.notes} />
    </Stack>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function DetailSkeleton() {
  return (
    <Stack spacing={3}>
      <Box>
        <Skeleton variant="text" width={320} height={48} />
        <Skeleton variant="text" width={200} />
      </Box>
      <Card>
        <CardContent>
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="70%" />
        </CardContent>
        <Divider />
        <CardContent>
          <Skeleton variant="rounded" height={64} />
        </CardContent>
      </Card>
      {[0, 1].map((key) => (
        <Card key={key}>
          <CardContent>
            <Skeleton variant="rounded" height={140} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
