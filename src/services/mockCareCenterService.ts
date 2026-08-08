import { HealthcareCenter, EmergencyContact } from '../types/healthCenter';
import { MOCK_HEALTHCARE_CENTERS, MOCK_EMERGENCY_CONTACTS } from '../data/mockCenters';

export const mockCareCenterService = {
  getNearbyCenters(): HealthcareCenter[] {
    return MOCK_HEALTHCARE_CENTERS.sort((a, b) => a.distanceKm - b.distanceKm);
  },

  getEmergencyContacts(): EmergencyContact[] {
    return MOCK_EMERGENCY_CONTACTS;
  }
};
