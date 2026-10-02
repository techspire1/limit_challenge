'use client';

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/common/StateViews';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import type { Contact, Document, NoteDetail } from '@/lib/types';

interface SectionProps {
  title: string;
  count: number;
  icon: ReactNode;
  children: ReactNode;
}

export function DetailSection({ title, count, icon, children }: SectionProps) {
  return (
    <Card>
      <CardHeader
        avatar={icon}
        title={title}
        subheader={count === 1 ? '1 item' : `${count} items`}
        titleTypographyProps={{ variant: 'h6' }}
        sx={{ pb: 1.5 }}
      />
      <Divider />
      {children}
    </Card>
  );
}

export function ContactsSection({ contacts }: { contacts: Contact[] }) {
  return (
    <DetailSection
      title="Contacts"
      count={contacts.length}
      icon={<PeopleOutlineRoundedIcon color="action" />}
    >
      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts recorded"
          description="The broker has not shared a point of contact for this submission."
        />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ fontWeight: 600 }}>{contact.name}</TableCell>
                  <TableCell>{contact.role || '—'}</TableCell>
                  <TableCell>
                    {contact.email ? (
                      <MuiLink href={`mailto:${contact.email}`} underline="hover">
                        {contact.email}
                      </MuiLink>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{contact.phone || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </DetailSection>
  );
}

export function DocumentsSection({ documents }: { documents: Document[] }) {
  return (
    <DetailSection
      title="Documents"
      count={documents.length}
      icon={<AttachFileRoundedIcon color="action" />}
    >
      {documents.length === 0 ? (
        <EmptyState
          title="No documents attached"
          description="Supporting files uploaded for this submission will appear here."
        />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell align="right">File</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ fontWeight: 600 }}>{document.title}</TableCell>
                  <TableCell>{document.docType || '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title={formatDateTime(document.uploadedAt)}>
                      <span>{formatDate(document.uploadedAt)}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    {document.fileUrl ? (
                      <MuiLink
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      >
                        Open
                        <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                      </MuiLink>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        No file
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </DetailSection>
  );
}

export function NotesSection({ notes }: { notes: NoteDetail[] }) {
  return (
    <DetailSection
      title="Notes"
      count={notes.length}
      icon={<ChatBubbleOutlineRoundedIcon color="action" />}
    >
      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Collaboration notes on this submission will show up here, newest first."
        />
      ) : (
        <CardContent>
          {/* A timeline rather than a table: notes are prose of varying length,
              and the newest is what someone picking this up needs first. */}
          <Stack spacing={2.5}>
            {notes.map((note, index) => (
              <Box key={note.id}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="baseline"
                  sx={{ flexWrap: 'wrap', mb: 0.5 }}
                >
                  <Typography variant="subtitle2">{note.authorName}</Typography>
                  <Tooltip title={formatDateTime(note.createdAt)}>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelative(note.createdAt)}
                    </Typography>
                  </Tooltip>
                  {index === 0 ? (
                    <Typography variant="caption" color="primary.main" fontWeight={600}>
                      Latest
                    </Typography>
                  ) : null}
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {note.body}
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      )}
    </DetailSection>
  );
}
