export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Office {
  id: number;
  name: string;
  city: string;
}

export interface OfficeSummary extends Office {
  active_vehicle_count: number;
  maintenance_cost_last_year: number;
  last_maintenance: string | null;
}

export interface Mechanic {
  id: number;
  name: string;
  certification_number: string;
  is_active: boolean;
}

export interface MechanicWorkload extends Mechanic {
  maintenance_count_current_year: number;
  maintenance_cost_current_year: number;
}

export type MaintenanceType =
  | 'oil_change'
  | 'tire_rotation'
  | 'brake_service'
  | 'inspection'
  | 'engine_repair'
  | 'transmission'
  | 'body_work'
  | 'other';

export const MAINTENANCE_TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'oil_change', label: 'Oil change' },
  { value: 'tire_rotation', label: 'Tire rotation' },
  { value: 'brake_service', label: 'Brake service' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'engine_repair', label: 'Engine repair' },
  { value: 'transmission', label: 'Transmission' },
  { value: 'body_work', label: 'Body work' },
  { value: 'other', label: 'Other' },
];

export interface Vehicle {
  id: number;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  office: number;
  office_name: string;
  office_city: string;
  is_active: boolean;
}

export interface MaintenanceHistoryEntry {
  id: number;
  maintenance_date: string;
  maintenance_type: MaintenanceType;
  maintenance_type_display: string;
  cost: number;
  notes: string;
  mechanic: Mechanic;
}

export interface VehicleDetail extends Omit<Vehicle, 'office'> {
  office: Office;
  maintenance_history: MaintenanceHistoryEntry[];
}

export interface VehicleNeedingMaintenance extends Vehicle {
  last_maintenance: string | null;
  days_since_last_maintenance: number | null;
}

export interface VehicleAssignment {
  id: number;
  from_office: Office | null;
  to_office: Office;
  assigned_at: string;
  note: string;
}

export interface MaintenanceRecord {
  id: number;
  vehicle: number;
  vehicle_vin: string;
  mechanic: number;
  mechanic_name: string;
  maintenance_date: string;
  maintenance_type: MaintenanceType;
  maintenance_type_display: string;
  cost: number;
  notes: string;
}

export type DuplicateField = 'vin' | 'license_plate';

export interface DuplicateCheck {
  conflicts: DuplicateField[];
}

/** Query parameters accepted by the vehicle search endpoint. */
export interface VehicleSearchParams {
  office?: string;
  is_active?: string;
  make?: string;
  model?: string;
  year?: string;
  maintenance_from?: string;
  maintenance_to?: string;
  mechanic_certification_number?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface VehicleInput {
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  office: number;
  is_active: boolean;
}

export interface MaintenanceRecordInput {
  vehicle: number;
  mechanic: number;
  maintenance_date: string;
  maintenance_type: MaintenanceType;
  cost: string;
  notes: string;
}
