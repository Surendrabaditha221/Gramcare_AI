export type CenterType = 'phc' | 'chc' | 'subcenter' | 'hospital' | 'district_hospital' | 'clinic' | 'pharmacy' | 'diagnostic' | 'emergency';

export interface FacilitySource {
  provider: 'OpenStreetMap' | 'Google Places' | 'OpenGovernmentData' | string;
  sourceId: string;
}

export interface HealthcareCenter {
  id: string;
  name: string;
  hindiName?: string;
  type: CenterType;
  distanceKm: number;
  villageOrTaluka?: string;
  district?: string;
  address?: string;
  phone?: string;
  emergency24x7?: boolean;
  servicesAvailable?: string[];
  ashaWorkerName?: string;
  isOpenNow?: boolean;
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  website?: string;
  source?: string;
  sources?: FacilitySource[];
}

export interface EmergencyContact {
  id: string;
  title: string;
  hindiTitle: string;
  number: string;
  description: string;
  hindiDescription: string;
  isPrimary?: boolean;
}
