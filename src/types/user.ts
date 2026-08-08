export type GenderOption = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type MaritalStatusOption = 'single' | 'married' | 'divorced' | 'widowed' | 'separated' | 'prefer_not_to_say';

export type RelationshipOption =
  | 'Spouse'
  | 'Wife'
  | 'Husband'
  | 'Son'
  | 'Daughter'
  | 'Father'
  | 'Mother'
  | 'Brother'
  | 'Sister'
  | 'Grandfather'
  | 'Grandmother'
  | 'Grandson'
  | 'Granddaughter'
  | 'Guardian'
  | 'Child'
  | 'Other';

export interface FamilyMember {
  id: string;
  userId?: string;
  fullName: string;
  relation: RelationshipOption | string;
  dob: string; // YYYY-MM-DD
  age: number;
  gender: GenderOption;
  bloodGroup?: string;
  phone?: string;
  knownAllergies?: string;
  medicalConditions?: string;
  currentMedications?: string;
}

export interface UserProfile {
  id: string;
  userId?: string;
  fullName: string;
  dob: string; // YYYY-MM-DD
  age: number;
  gender: GenderOption;
  maritalStatus?: MaritalStatusOption;
  heightCm?: number;
  weightKg?: number;
  village: string;
  district: string;
  bloodGroup?: string;
  phone?: string;
  emergencyContactPhone?: string;
  ashaWorkerPhone?: string;
  knownAllergies?: string;
  medicalConditions?: string;
  currentMedications?: string;
  familyMembers: FamilyMember[];
  isOnboardingCompleted?: boolean;
}
