import { UserProfile } from '../types/user';
import { calculateAgeFromDOB } from '../utils/dateUtils';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: 'user_primary',
  fullName: '',
  dob: '',
  age: 0,
  gender: 'male',
  maritalStatus: 'single',
  village: '',
  district: '',
  bloodGroup: undefined,
  emergencyContactPhone: undefined,
  ashaWorkerPhone: undefined,
  isOnboardingCompleted: false,
  familyMembers: []
};

export const INITIAL_MOCK_USER = INITIAL_USER_PROFILE;


