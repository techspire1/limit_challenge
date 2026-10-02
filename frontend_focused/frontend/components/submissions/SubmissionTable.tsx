'use client';

import {
  Box,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import Link from 'next/link';

import { PriorityChip, StatusChip } from '@/components/common/StatusChip';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { SortDirection, SubmissionListItem, SubmissionSortField } from '@/lib/types';

interface Column {
  id: SubmissionSortField | 'attachments';
  label: string;
  sortable: boolean;
  align?: 'left' | 'right';
  width?: number | string;
}

const COLUMNS: Column[] = [
  { id: 'company', label: 'Company', sortable: true, width: '26%' },
  { id: 'status', label: 'Status', sortable: true },
  { id: 'priority', label: 'Priority', sortable: true },
  { id: 'broker', label: 'Broker', sortable: true, width: '18%' },
  { id: 'owner', label: 'Owner', sortable: true },
  { id: 'createdAt', label: 'Created', sortable: true },
  { id: 'attachments', label: 'Attached', sortable: false, align: 'right' },
  { id: 'latestNoteAt', label: 'Latest note', sortable: true, width: '22%' },
];

interface SubmissionTableProps {
  submissions: SubmissionListItem[];
  sortBy: SubmissionSortField;
  sortDirection: SortDirection;
  onSort: (field: SubmissionSortField) => void;
  /** The list's query string, so returning from a detail page restores the view. */
  listQueryString: string;
}

export function SubmissionTable({
  submissions,
  sortBy,
  sortDirection,
  onSort,
  listQueryString,
}: SubmissionTableProps) {
  return (
    <Table size="small" sx={{ minWidth: 1080 }}>
      <TableHead>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableCell
              key={column.id}
              align={column.align ?? 'left'}
              width={column.width}
              sortDirection={column.sortable && sortBy === column.id ? sortDirection : false}
            >
              {column.sortable ? (
                <TableSortLabel
                  active={sortBy === column.id}
                  direction={sortBy === column.id ? sortDirection : 'asc'}
                  onClick={() => onSort(column.id as SubmissionSortField)}
                >
                  {column.label}
                </TableSortLabel>
              ) : (
                column.label
              )}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>

      <TableBody>
        {submissions.map((submission) => (
          <TableRow
            key={submission.id}
            hover
            sx={{ '&:last-child td': { borderBottom: 0 }, verticalAlign: 'top' }}
          >
            <TableCell>
              {/* The whole row is navigable, but the link sits on the company
                  name so it is keyboard reachable and shows a real href. */}
              <Box
                component={Link}
                href={`/submissions/${submission.id}${listQueryString ? `?returnTo=${encodeURIComponent(listQueryString)}` : ''}`}
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {submission.company.legalName}
              </Box>
              <Typography variant="caption" color="text.secondary" display="block">
                {[submission.company.industry, submission.company.headquartersCity]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </TableCell>

            <TableCell>
              <StatusChip status={submission.status} />
            </TableCell>

            <TableCell>
              <PriorityChip priority={submission.priority} />
            </TableCell>

            <TableCell>
              <Typography variant="body2">{submission.broker.name}</Typography>
            </TableCell>

            <TableCell>
              <Typography variant="body2">{submission.owner.fullName}</Typography>
            </TableCell>

            <TableCell>
              <Tooltip title={formatDateTime(submission.createdAt)}>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                  {formatRelative(submission.createdAt)}
                </Typography>
              </Tooltip>
            </TableCell>

            <TableCell align="right">
              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Tooltip
                  title={`${submission.documentCount} document${submission.documentCount === 1 ? '' : 's'}`}
                >
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <AttachFileRoundedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">
                      {submission.documentCount}
                    </Typography>
                  </Stack>
                </Tooltip>
                <Tooltip
                  title={`${submission.noteCount} note${submission.noteCount === 1 ? '' : 's'}`}
                >
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">
                      {submission.noteCount}
                    </Typography>
                  </Stack>
                </Tooltip>
              </Stack>
            </TableCell>

            <TableCell>
              {submission.latestNote ? (
                <>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {submission.latestNote.authorName} ·{' '}
                    {formatRelative(submission.latestNote.createdAt)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {submission.latestNote.bodyPreview}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  No notes yet
                </Typography>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Mirrors the real table's columns so the first load does not shift the layout
 * once data arrives.
 */
export function SubmissionTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table size="small" sx={{ minWidth: 1080 }}>
      <TableHead>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableCell key={column.id} align={column.align ?? 'left'} width={column.width}>
              {column.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {COLUMNS.map((column) => (
              <TableCell key={column.id}>
                <Skeleton
                  variant="text"
                  width={column.id === 'latestNoteAt' || column.id === 'company' ? '85%' : '60%'}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
