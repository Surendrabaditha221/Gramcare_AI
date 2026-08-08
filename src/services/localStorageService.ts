import { UserProfile, FamilyMember } from '../types/user';
import { HealthRecord } from '../types/records';
import { NotificationItem } from '../types/notification';
import { INITIAL_USER_PROFILE } from '../data/mockUser';
import { calculateAgeFromDOB } from '../utils/dateUtils';

const getProfileKey = (uid?: string) => uid ? `gramcare_user_profile_${uid}` : 'gramcare_user_profile_v2';
const getRecordsKey = (uid?: string) => uid ? `gramcare_records_${uid}` : 'gramcare_health_records_v2';
const getNotifsKey = (uid?: string) => uid ? `gramcare_notifications_${uid}` : 'gramcare_notifications_v2';
const getActivePatientKey = (uid?: string) => uid ? `gramcare_active_patient_${uid}` : 'gramcare_active_patient_v2';

export function deduplicateFamily(members: FamilyMember[]): FamilyMember[] {
  if (!members || !Array.isArray(members)) return [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const unique: FamilyMember[] = [];

  for (const m of members) {
    if (!m || !m.fullName) continue;
    const cleanName = m.fullName.trim().toLowerCase();
    const id = m.id;

    if ((id && seenIds.has(id)) || (cleanName && seenNames.has(cleanName))) {
      continue;
    }

    if (id) seenIds.add(id);
    if (cleanName) seenNames.add(cleanName);
    unique.push(m);
  }

  return unique;
}

export const localStorageService = {
  getUserProfile(uid?: string): UserProfile {
    try {
      const key = getProfileKey(uid);
      const data = localStorage.getItem(key);
      let rawProfile: UserProfile = data ? JSON.parse(data) : INITIAL_USER_PROFILE;

      if (rawProfile) {
        if (rawProfile.fullName === 'Baditha Surendra' || rawProfile.fullName === 'Rajesh Kumar') {
          if (!rawProfile.isOnboardingCompleted) {
            rawProfile.fullName = '';
            rawProfile.dob = '';
            rawProfile.age = 0;
            rawProfile.village = '';
            rawProfile.district = '';
            rawProfile.emergencyContactPhone = undefined;
            rawProfile.ashaWorkerPhone = undefined;
            rawProfile.isOnboardingCompleted = false;
          }
        }
        if (rawProfile.familyMembers && Array.isArray(rawProfile.familyMembers)) {
          rawProfile.familyMembers = rawProfile.familyMembers.filter(m =>
            m && m.fullName &&
            !m.fullName.includes('Sunita') &&
            !m.fullName.includes('Aarav') &&
            !m.fullName.includes('Rajesh')
          );
        }
      }

      const updatedPrimaryAge = rawProfile.dob ? calculateAgeFromDOB(rawProfile.dob) : rawProfile.age;
      const deduplicated = deduplicateFamily(rawProfile.familyMembers || []);
      const updatedFamily = deduplicated.map(member => ({
        ...member,
        age: member.dob ? calculateAgeFromDOB(member.dob) : member.age
      }));

      return {
        ...rawProfile,
        age: updatedPrimaryAge,
        familyMembers: updatedFamily
      };
    } catch {
      return INITIAL_USER_PROFILE;
    }
  },

  saveUserProfile(profile: UserProfile, uid?: string): void {
    try {
      const key = getProfileKey(uid);
      const updatedPrimaryAge = profile.dob ? calculateAgeFromDOB(profile.dob) : profile.age;
      const deduplicated = deduplicateFamily(profile.familyMembers || []);
      const updatedFamily = deduplicated.map(member => ({
        ...member,
        age: member.dob ? calculateAgeFromDOB(member.dob) : member.age
      }));

      const toSave = {
        ...profile,
        age: updatedPrimaryAge,
        familyMembers: updatedFamily
      };
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save user profile', e);
    }
  },

  addFamilyMember(member: FamilyMember, uid?: string): UserProfile {
    const profile = this.getUserProfile(uid);
    const calculatedMember = {
      ...member,
      age: member.dob ? calculateAgeFromDOB(member.dob) : member.age
    };
    const updated = {
      ...profile,
      familyMembers: deduplicateFamily([...(profile.familyMembers || []), calculatedMember])
    };
    this.saveUserProfile(updated, uid);
    return updated;
  },

  updateFamilyMember(updatedMember: FamilyMember, uid?: string): UserProfile {
    const profile = this.getUserProfile(uid);
    const calculatedMember = {
      ...updatedMember,
      age: updatedMember.dob ? calculateAgeFromDOB(updatedMember.dob) : updatedMember.age
    };
    const updatedMembers = (profile.familyMembers || []).map(m =>
      m.id === updatedMember.id ? calculatedMember : m
    );
    const updatedProfile = {
      ...profile,
      familyMembers: updatedMembers
    };
    this.saveUserProfile(updatedProfile, uid);
    return updatedProfile;
  },

  removeFamilyMember(memberId: string, uid?: string): UserProfile {
    const profile = this.getUserProfile(uid);
    const updatedMembers = (profile.familyMembers || []).filter(m => m.id !== memberId);
    const updatedProfile = {
      ...profile,
      familyMembers: updatedMembers
    };
    this.saveUserProfile(updatedProfile, uid);

    if (this.getActivePatientId(uid) === memberId) {
      this.setActivePatientId('user_primary', uid);
    }

    return updatedProfile;
  },

  getHealthRecords(uid?: string): HealthRecord[] {
    try {
      const key = getRecordsKey(uid);
      const data = localStorage.getItem(key);
      const rawRecords: HealthRecord[] = data ? JSON.parse(data) : [];
      return rawRecords.filter(r =>
        r && r.patientName &&
        !r.patientName.includes('Sunita') &&
        !r.patientName.includes('Aarav') &&
        !r.patientName.includes('Rajesh') &&
        !(r.facilityOrDoctor && r.facilityOrDoctor.includes('Devgarh'))
      );
    } catch {
      return [];
    }
  },

  saveHealthRecord(record: HealthRecord, uid?: string): HealthRecord[] {
    try {
      const current = this.getHealthRecords(uid);
      const updated = [record, ...current];
      localStorage.setItem(getRecordsKey(uid), JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to save health record', e);
      return [];
    }
  },

  getNotifications(uid?: string): NotificationItem[] {
    try {
      const data = localStorage.getItem(getNotifsKey(uid));
      const rawNotifs: NotificationItem[] = data ? JSON.parse(data) : [];
      return rawNotifs.filter(n =>
        n && n.message &&
        !n.message.includes('Sunita') &&
        !n.message.includes('Devgarh')
      );
    } catch {
      return [];
    }
  },

  markNotificationsRead(uid?: string): NotificationItem[] {
    const notifs = this.getNotifications(uid).map(n => ({ ...n, isRead: true }));
    try {
      localStorage.setItem(getNotifsKey(uid), JSON.stringify(notifs));
    } catch (e) {
      console.error('Failed to mark notifications read', e);
    }
    return notifs;
  },

  getPreferredLanguage(): string {
    try {
      return localStorage.getItem('gramcare_pref_lang_v2') || 'en';
    } catch {
      return 'en';
    }
  },

  savePreferredLanguage(lang: string): void {
    try {
      localStorage.setItem('gramcare_pref_lang_v2', lang);
    } catch (e) {
      console.error('Failed to save preferred language', e);
    }
  },

  getActivePatientId(uid?: string): string {
    return localStorage.getItem(getActivePatientKey(uid)) || 'user_primary';
  },

  setActivePatientId(id: string, uid?: string): void {
    localStorage.setItem(getActivePatientKey(uid), id);
  },

  clearAllOfflineData(): void {
    localStorage.clear();
  }
};
