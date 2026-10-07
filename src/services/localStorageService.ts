import { UserProfile, FamilyMember } from '../types/user';
import { HealthRecord } from '../types/records';
import { NotificationItem } from '../types/notification';
import { ChatMessage } from '../types/chat';
import { INITIAL_USER_PROFILE } from '../data/mockUser';
import { calculateAgeFromDOB } from '../utils/dateUtils';

const getProfileKey = (uid?: string) => uid ? `gramcare_user_profile_${uid}` : 'gramcare_user_profile_v2';
const getRecordsKey = (uid?: string) => uid ? `gramcare_records_${uid}` : 'gramcare_health_records_v2';
const getNotifsKey = (uid?: string) => uid ? `gramcare_notifications_${uid}` : 'gramcare_notifications_v2';
const getActivePatientKey = (uid?: string) => uid ? `gramcare_active_patient_${uid}` : 'gramcare_active_patient_v2';

export function isUnwantedFamilyMember(member: Partial<FamilyMember>, primaryName?: string): boolean {
  if (!member) return true;
  const name = (member.fullName || '').trim().toLowerCase();
  const rel = (member.relation || '').trim().toLowerCase();
  const id = (member.id || '').trim().toLowerCase();

  // 1. Primary user ID in family list
  if (id === 'user_primary') return true;

  // 2. Exact match for unwanted ghost profile "Baditha Surendra Other"
  if (name === 'baditha surendra other') return true;

  // 3. Ghost profile created when primary user is assigned relation 'Other', 'Self', or 'Myself'
  if (name === 'baditha surendra' && (rel === 'other' || rel === 'self' || rel === 'myself' || !rel)) {
    return true;
  }

  // 4. Any ghost family member that mirrors the primary user's exact name with relation 'Other'/'Self'
  if (primaryName && name === primaryName.trim().toLowerCase() && (rel === 'other' || rel === 'self' || rel === 'myself' || !rel)) {
    return true;
  }

  return false;
}

export function deduplicateFamily(members: FamilyMember[], primaryName?: string): FamilyMember[] {
  if (!members || !Array.isArray(members)) return [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const unique: FamilyMember[] = [];

  for (const m of members) {
    if (!m || !m.fullName) continue;
    if (isUnwantedFamilyMember(m, primaryName)) continue;
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

      const updatedPrimaryAge = rawProfile.dob ? calculateAgeFromDOB(rawProfile.dob) : rawProfile.age;
      const deduplicated = deduplicateFamily(rawProfile.familyMembers || [], rawProfile.fullName);
      const updatedFamily = deduplicated.map(member => ({
        ...member,
        age: member.dob ? calculateAgeFromDOB(member.dob) : member.age
      }));

      // If raw stored profile contained unwanted ghost entries, purge immediately
      if (rawProfile.familyMembers && rawProfile.familyMembers.length !== updatedFamily.length) {
        try {
          const toSave = {
            ...rawProfile,
            age: updatedPrimaryAge,
            familyMembers: updatedFamily
          };
          localStorage.setItem(key, JSON.stringify(toSave));
        } catch {}
      }

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
      const deduplicated = deduplicateFamily(profile.familyMembers || [], profile.fullName);
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
    if (isUnwantedFamilyMember(member, profile.fullName)) {
      return profile;
    }
    const calculatedMember = {
      ...member,
      age: member.dob ? calculateAgeFromDOB(member.dob) : member.age
    };
    const updated = {
      ...profile,
      familyMembers: deduplicateFamily([...(profile.familyMembers || []), calculatedMember], profile.fullName)
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
      return rawRecords.filter(r => r && r.patientName);
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
      return rawNotifs.filter(n => n && n.message);
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
    const active = localStorage.getItem(getActivePatientKey(uid)) || 'user_primary';
    if (active === 'user_primary') return 'user_primary';
    const profile = this.getUserProfile(uid);
    const exists = (profile.familyMembers || []).some(f => f.id === active);
    if (!exists) {
      try {
        localStorage.setItem(getActivePatientKey(uid), 'user_primary');
      } catch {}
      return 'user_primary';
    }
    return active;
  },

  setActivePatientId(patientId: string, uid?: string): void {
    try {
      localStorage.setItem(getActivePatientKey(uid), patientId);
    } catch {}
  },

  getChatMessages(patientId?: string, uid?: string, conversationId?: string): ChatMessage[] | null {
    try {
      const convSuffix = conversationId ? `_${conversationId}` : '';
      const key = `gramcare_chat_${uid || 'anon'}_${patientId || 'default'}${convSuffix}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  saveChatMessages(messages: ChatMessage[], patientId?: string, uid?: string, conversationId?: string): void {
    try {
      const convSuffix = conversationId ? `_${conversationId}` : '';
      const key = `gramcare_chat_${uid || 'anon'}_${patientId || 'default'}${convSuffix}`;
      localStorage.setItem(key, JSON.stringify(messages));
    } catch {}
  },

  clearChatMessages(patientId?: string, uid?: string, conversationId?: string): void {
    try {
      const convSuffix = conversationId ? `_${conversationId}` : '';
      const key = `gramcare_chat_${uid || 'anon'}_${patientId || 'default'}${convSuffix}`;
      localStorage.removeItem(key);
      if (conversationId && (conversationId === 'conv_default' || conversationId === 'default')) {
        localStorage.removeItem(`gramcare_chat_${uid || 'anon'}_${patientId || 'default'}`);
      }
    } catch {}
  },

  clearAllOfflineData(): void {
    localStorage.clear();
  }
};
