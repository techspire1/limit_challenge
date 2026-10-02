'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useMemo } from 'react';

import { PageHeader } from '@/components/app-shell';
import { AsyncSection } from '@/components/async-section';
import { formatCurrency, formatDate, pluralize } from '@/lib/format';
import { useMechanicWorkload } from '@/lib/hooks/use-mechanics';
import { useOfficeSummary } from '@/lib/hooks/use-offices';
import { useVehiclesNeedingMaintenance } from '@/lib/hooks/use-vehicles';

const OVERDUE_PREVIEW_SIZE = 8;

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary" display="block" lineHeight={1.4}>
          {label}
        </Typography>
        <Typography
          variant="h5"
          fontWeight={700}
          // Currency totals can outgrow a narrow card, so let them wrap rather
          // than spill over the edge.
          sx={{ overflowWrap: 'anywhere' }}
        >
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const summary = useOfficeSummary();
  const workload = useMechanicWorkload();
  const overdue = useVehiclesNeedingMaintenance({ page_size: OVERDUE_PREVIEW_SIZE });

  const totals = useMemo(() => {
    const offices = summary.data ?? [];
    return {
      activeVehicles: offices.reduce((sum, office) => sum + office.active_vehicle_count, 0),
      spend: offices.reduce((sum, office) => sum + office.maintenance_cost_last_year, 0),
      offices: offices.length,
    };
  }, [summary.data]);

  return (
    <>
      <PageHeader
        title="Fleet overview"
        description="Where the fleet sits today, what it cost over the last 12 months, and what needs attention."
        actions={
          <Button variant="contained" component={Link} href="/vehicles">
            Search vehicles
          </Button>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          label="Active vehicles"
          value={summary.isPending ? '—' : String(totals.activeVehicles)}
          hint={`across ${pluralize(totals.offices, 'office')}`}
        />
        <StatCard
          label="Maintenance (12 mo)"
          value={summary.isPending ? '—' : formatCurrency(totals.spend)}
          hint="all offices combined"
        />
        <StatCard
          label="Needing maintenance"
          value={overdue.isPending ? '—' : String(overdue.data?.count ?? 0)}
          hint="never serviced or 365+ days"
        />
        <StatCard
          label="Mechanics on staff"
          value={
            workload.isPending ? '—' : String(workload.data?.filter((m) => m.is_active).length ?? 0)
          }
          hint="active certifications"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={3}>
          <Card>
            <Typography variant="subtitle1" fontWeight={700} sx={{ px: 2, py: 1.5 }}>
              Offices
            </Typography>
            <Divider />
            <Box sx={{ p: 2 }}>
              <AsyncSection
                isPending={summary.isPending}
                isError={summary.isError}
                error={summary.error}
                onRetry={() => summary.refetch()}
                isEmpty={(summary.data?.length ?? 0) === 0}
                emptyTitle="No offices yet"
                emptyDescription="Create an office before adding vehicles."
                emptyAction={
                  <Button variant="contained" component={Link} href="/offices">
                    Manage offices
                  </Button>
                }
              >
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Office</TableCell>
                        <TableCell align="right">Active vehicles</TableCell>
                        <TableCell align="right">Spend (12 mo)</TableCell>
                        <TableCell align="right">Last maintenance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {summary.data?.map((office) => (
                        <TableRow key={office.id} hover>
                          <TableCell>
                            <Link href={`/vehicles?office=${office.id}`}>{office.name}</Link>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {office.city}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{office.active_vehicle_count}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(office.maintenance_cost_last_year)}
                          </TableCell>
                          <TableCell align="right">{formatDate(office.last_maintenance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AsyncSection>
            </Box>
          </Card>

          <Card>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ px: 2, py: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                Needs maintenance
              </Typography>
              <Typography variant="caption" color="text.secondary">
                oldest first
              </Typography>
            </Stack>
            <Divider />
            <Box sx={{ p: 2 }}>
              <AsyncSection
                isPending={overdue.isPending}
                isError={overdue.isError}
                error={overdue.error}
                onRetry={() => overdue.refetch()}
                isEmpty={(overdue.data?.results.length ?? 0) === 0}
                emptyTitle="Everything is up to date"
                emptyDescription="No active vehicle is overdue for service."
              >
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Vehicle</TableCell>
                        <TableCell>Office</TableCell>
                        <TableCell align="right">Last serviced</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {overdue.data?.results.map((vehicle) => (
                        <TableRow key={vehicle.id} hover>
                          <TableCell>
                            <Link href={`/vehicles/${vehicle.id}`}>{vehicle.license_plate}</Link>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </Typography>
                          </TableCell>
                          <TableCell>{vehicle.office_name}</TableCell>
                          <TableCell align="right">
                            {vehicle.last_maintenance ? (
                              <>
                                {formatDate(vehicle.last_maintenance)}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                >
                                  {pluralize(vehicle.days_since_last_maintenance ?? 0, 'day')} ago
                                </Typography>
                              </>
                            ) : (
                              <Chip size="small" color="warning" label="Never serviced" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {(overdue.data?.count ?? 0) > OVERDUE_PREVIEW_SIZE ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    Showing {OVERDUE_PREVIEW_SIZE} of {overdue.data?.count}.
                  </Typography>
                ) : null}
              </AsyncSection>
            </Box>
          </Card>
        </Stack>

        <Card>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, py: 1.5 }}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              Mechanic workload
            </Typography>
            <Typography variant="caption" color="text.secondary">
              this year
            </Typography>
          </Stack>
          <Divider />
          <Box sx={{ p: 2 }}>
            <AsyncSection
              isPending={workload.isPending}
              isError={workload.isError}
              error={workload.error}
              onRetry={() => workload.refetch()}
              isEmpty={(workload.data?.length ?? 0) === 0}
              emptyTitle="No mechanics yet"
              emptyAction={
                <Button variant="contained" component={Link} href="/mechanics">
                  Manage mechanics
                </Button>
              }
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Mechanic</TableCell>
                      <TableCell align="right">Jobs</TableCell>
                      <TableCell align="right">Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workload.data?.map((mechanic) => (
                      <TableRow key={mechanic.id} hover>
                        <TableCell>
                          <Stack direction="row" alignItems="center" gap={1}>
                            {mechanic.name}
                            {mechanic.is_active ? null : (
                              <Chip size="small" variant="outlined" label="Inactive" />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {mechanic.certification_number}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {mechanic.maintenance_count_current_year}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(mechanic.maintenance_cost_current_year)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AsyncSection>
          </Box>
        </Card>
      </Box>
    </>
  );
}
