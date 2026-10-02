'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import type { Broker } from '@/lib/types';

async function fetchBrokers() {
  const response = await apiClient.get<Broker[]>('/brokers/');
  return response.data;
}

export function useBrokerOptions() {
  return useQuery({
    queryKey: ['brokers'],
    queryFn: fetchBrokers,
    // Brokers are reference data for a dropdown; refetching them per filter
    // change would be pure overhead.
    staleTime: 5 * 60_000,
  });
}
