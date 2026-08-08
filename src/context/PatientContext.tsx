import React, { createContext, useContext, useState, useEffect } from 'react';
import { localStorageService, deduplicateFamily } from '../services/localStorageService';
import { indexedDbService } from '../services/indexedDbService';
import { fetchPatientsBackend, savePatientBackend, fetchUserProfileBackend, saveUserProfileBackend } from '../services/api';
import { UserProfile, FamilyMember } from '../types/user';
import { calculateAgeFromDOB } from '../utils/dateUtils';
import { useAuth } from './AuthContext';

export interface ActivePatientContext {
  id: string;
  fullName: string;
  relation: string;
  dob: string;
  age: number;
  gender: string;
  bloodGroup?: string;
  knownAllergies?: string;
  medicalConditions?: string;
  currentMedications?: string;
  isPrimary: boolean;
}

interface PatientContextType {
  profile: UserProfile;
  activePatient: ActivePatientContext;
  activePatientId: string;
  activePatientName: string;
  activePatientRelation: string;
  activePatientAge: number;
  isLoading: boolean;
  selectPatient: (id: string) => void;
  updatePrimaryProfile: (updatedProfile: UserProfile) => void;
  addFamilyMember: (member: FamilyMember) => void;
  updateFamilyMember: (member: FamilyMember) => void;
  removeFamilyMember: (memberId: string) => void;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userUid = user?.uid;
  const userEmail = user?.email;

  const [profile, setProfile] = useState<UserProfile>(() => localStorageService.getUserProfile(userUid));
  const [activePatientId, setActivePatientId] = useState<string>(() => localStorageService.getActivePatientId(userUid));
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const current = localStorageService.getUserProfile(userUid);
    setProfile(current);
    setActivePatientId(localStorageService.getActivePatientId(userUid));
  }, [userUid]);

  useEffect(() => {
    async function syncPatients() {
      if (!userUid && !userEmail) return;
      setIsLoading(true);
      try {
        const mongoProfile = await fetchUserProfileBackend(userEmail || undefined, userUid || undefined);
        if (mongoProfile) {
          const merged: UserProfile = {
            ...profile,
            ...mongoProfile,
            isOnboardingCompleted: true
          };
          setProfile(merged);
          localStorageService.saveUserProfile(merged, userUid);
          indexedDbService.saveUserProfile(merged);
        } else {
          const backendPatients = await fetchPatientsBackend(userUid);
          if (backendPatients && backendPatients.length > 0) {
            const primary = backendPatients.find((p: any) => p.id === 'user_primary' || p.relation === 'Self' || p.userId === userUid);
            if (primary) {
              const family = backendPatients.filter(p => p.id !== primary.id);
              const deduplicated = deduplicateFamily([...(profile.familyMembers || []), ...(family as any)]);
              const merged: UserProfile = {
                ...profile,
                ...primary,
                familyMembers: deduplicated,
                isOnboardingCompleted: Boolean(primary.fullName && primary.age)
              };
              setProfile(merged);
              localStorageService.saveUserProfile(merged, userUid);
            }
          }
        }
      } catch (e) {
        console.warn('Could not sync patients from backend, using local store:', e);
      } finally {
        setIsLoading(false);
      }
    }
    syncPatients();
  }, [userUid, userEmail]);

  const selectPatient = (id: string) => {
    setActivePatientId(id);
    localStorageService.setActivePatientId(id, userUid);
  };

  const updatePrimaryProfile = (updatedProfile: UserProfile) => {
    const recalculated: UserProfile = {
      ...updatedProfile,
      age: updatedProfile.dob ? calculateAgeFromDOB(updatedProfile.dob) : updatedProfile.age,
      isOnboardingCompleted: true
    };
    localStorageService.saveUserProfile(recalculated, userUid);
    indexedDbService.saveUserProfile(recalculated);
    setProfile(recalculated);

    saveUserProfileBackend({ ...recalculated, uid: userUid, userId: userUid, email: userEmail }).catch(err => {
      console.warn('Backend user profile update deferred to offline sync:', err);
    });
    savePatientBackend({ ...recalculated, userId: userUid }, userUid).catch(err => {
      console.warn('Backend patient update deferred to offline sync:', err);
    });
  };

  const addFamilyMember = (member: FamilyMember) => {
    const updated = localStorageService.addFamilyMember(member, userUid);
    setProfile(updated);
    selectPatient(member.id);

    savePatientBackend({ ...member, userId: userUid }, userUid).catch(err => {
      console.warn('Backend patient save deferred to offline sync:', err);
    });
  };

  const updateFamilyMember = (member: FamilyMember) => {
    const updated = localStorageService.updateFamilyMember(member, userUid);
    setProfile(updated);

    savePatientBackend({ ...member, userId: userUid }, userUid).catch(err => {
      console.warn('Backend patient update deferred to offline sync:', err);
    });
  };

  const removeFamilyMember = (memberId: string) => {
    const updated = localStorageService.removeFamilyMember(memberId, userUid);
    setProfile(updated);
    if (activePatientId === memberId) {
      selectPatient('user_primary');
    }
  };

  let activePatient: ActivePatientContext = {
    id: 'user_primary',
    fullName: profile.fullName || user?.displayName || 'Current User',
    relation: 'Myself',
    dob: profile.dob,
    age: profile.dob ? calculateAgeFromDOB(profile.dob) : profile.age,
    gender: profile.gender,
    bloodGroup: profile.bloodGroup,
    knownAllergies: profile.knownAllergies,
    medicalConditions: profile.medicalConditions,
    currentMedications: profile.currentMedications,
    isPrimary: true
  };

  if (activePatientId !== 'user_primary') {
    const familyMember = (profile.familyMembers || []).find(f => f.id === activePatientId);
    if (familyMember) {
      activePatient = {
        id: familyMember.id,
        fullName: familyMember.fullName,
        relation: familyMember.relation,
        dob: familyMember.dob,
        age: familyMember.dob ? calculateAgeFromDOB(familyMember.dob) : familyMember.age,
        gender: familyMember.gender,
        bloodGroup: familyMember.bloodGroup,
        knownAllergies: familyMember.knownAllergies,
        medicalConditions: familyMember.medicalConditions,
        currentMedications: familyMember.currentMedications,
        isPrimary: false
      };
    }
  }

  return (
    <PatientContext.Provider
      value={{
        profile,
        activePatient,
        activePatientId,
        activePatientName: activePatient.fullName,
        activePatientRelation: activePatient.relation,
        activePatientAge: activePatient.age,
        isLoading,
        selectPatient,
        updatePrimaryProfile,
        addFamilyMember,
        updateFamilyMember,
        removeFamilyMember
      }}
    >
      {children}
    </PatientContext.Provider>
  );
};

export const usePatientSelector = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatientSelector must be used within a PatientProvider');
  }
  return context;
};
