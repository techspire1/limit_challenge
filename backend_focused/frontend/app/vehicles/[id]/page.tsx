import { notFound } from 'next/navigation';

import { VehicleDetailView } from './vehicle-detail-view';

// `params` is a Promise in Next.js 16; synchronous access was removed.
export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicleId = Number(id);

  if (!Number.isInteger(vehicleId) || vehicleId <= 0) notFound();

  return <VehicleDetailView vehicleId={vehicleId} />;
}
