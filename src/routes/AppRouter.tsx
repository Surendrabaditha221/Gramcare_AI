import React, { useState, useEffect } from 'react';
import { AppLayout } from '../layouts/AppLayout';

// 18 Screens Imports
import { SplashScreen } from '../screens/01_SplashScreen';
import { AIIntroScreen } from '../screens/00_AIIntroScreen';
import { LanguageScreen } from '../screens/02_LanguageScreen';
import { OnboardingScreen } from '../screens/03_OnboardingScreen';
import { LoginSignupScreen } from '../screens/04_LoginSignupScreen';
import { ProfileSetupScreen } from '../screens/05_ProfileSetupScreen';
import { ProfileConfirmScreen } from '../screens/06_ProfileConfirmScreen';
import { HomeDashboardScreen } from '../screens/07_HomeDashboardScreen';
import { SelectPatientScreen } from '../screens/08_SelectPatientScreen';
import { AIAssistantScreen } from '../screens/09_AIAssistantScreen';
import { SymptomTriageScreen } from '../screens/10_SymptomTriageScreen';
import { TriageGuidanceScreen } from '../screens/11_TriageGuidanceScreen';
import { DocumentScannerScreen } from '../screens/12_DocumentScannerScreen';
import { HealthRecordsScreen } from '../screens/13_HealthRecordsScreen';
import { NearbyHealthcareScreen } from '../screens/14_NearbyHealthcareScreen';
import { SOSEmergencyScreen } from '../screens/15_SOSEmergencyScreen';
import { NotificationsScreen } from '../screens/16_NotificationsScreen';
import { ProfileScreen } from '../screens/17_ProfileScreen';
import { SettingsScreen } from '../screens/18_SettingsScreen';
import { HealthGuidanceScreen } from '../screens/HealthGuidanceScreen';

// Contexts, Hooks & Services
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePatientSelector } from '../hooks/usePatientSelector';
import { localStorageService } from '../services/localStorageService';
import { indexedDbService } from '../services/indexedDbService';
import { processPendingOfflineSync } from '../services/syncService';
import { saveRecordBackend, syncOfflineDataBackend } from '../services/api';
import { HealthRecord, DocumentScanResult } from '../types/records';
import { EmergencyModal } from '../components/Emergency/EmergencyModal';
import { Loader2 } from 'lucide-react';

export const AppRouter: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();

  // Navigation Flow State
  const [currentRoute, setCurrentRoute] = useState<string>('splash');
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [triageDataResult, setTriageDataResult] = useState<any>(null);

  // User-scoped health records & notifications state
  const [records, setRecords] = useState<HealthRecord[]>(() => localStorageService.getHealthRecords(user?.uid));
  const [notifications, setNotifications] = useState(() => localStorageService.getNotifications(user?.uid));

  const { isOnline } = useOnlineStatus();
  const {
    profile,
    activePatient,
    activePatientId,
    activePatientName,
    selectPatient,
    updatePrimaryProfile,
    addFamilyMember,
    updateFamilyMember,
    removeFamilyMember
  } = usePatientSelector();

  // Refresh records and notifications when user changes
  useEffect(() => {
    setRecords(localStorageService.getHealthRecords(user?.uid));
    setNotifications(localStorageService.getNotifications(user?.uid));
  }, [user?.uid]);

  const userHasCompletedProfile = Boolean(
    user && (
      user.profileCompleted ||
      user.isProfileCompleted ||
      user.isOnboardingCompleted ||
      profile?.profileCompleted ||
      profile?.isProfileCompleted ||
      profile?.isOnboardingCompleted ||
      (profile?.fullName && (profile?.dob || profile?.age))
    )
  );

  // Smart Initial Route & Persistent Auto-Login Handler
  useEffect(() => {
    if (authLoading) return;
    // Do NOT interrupt splash or intro animations!
    if (['splash', 'ai_intro'].includes(currentRoute)) return;

    const isLanguageSet = Boolean(
      localStorage.getItem('gramcare_language_selected') === 'true' ||
      (user && (user.language || user.preferredLanguage))
    );

    if (user) {
      if (userHasCompletedProfile) {
        if (['onboarding', 'auth', 'language', 'profile_setup', 'profile_confirm'].includes(currentRoute)) {
          setCurrentRoute('home');
        }
      } else {
        if (currentRoute === 'auth') {
          if (!isLanguageSet) {
            setCurrentRoute('language');
          } else {
            setCurrentRoute('profile_setup');
          }
        }
      }
    } else {
      const protectedRoutes = ['home', 'patient_select', 'assistant', 'triage', 'triage_result', 'scanner', 'records', 'nearby', 'notifications', 'profile', 'settings'];
      if (protectedRoutes.includes(currentRoute)) {
        setCurrentRoute('auth');
      }
    }
  }, [user, userHasCompletedProfile, authLoading, currentRoute]);

  // Load IndexedDB records on mount if available
  useEffect(() => {
    indexedDbService.getHealthRecords().then((idbRecords) => {
      if (idbRecords && idbRecords.length > 0) {
        setRecords(idbRecords);
      }
    });
  }, []);

  // Sync Google Auth display name & email with primary patient profile
  useEffect(() => {
    if (user && user.displayName && profile.fullName !== user.displayName) {
      const updated = {
        ...profile,
        fullName: user.displayName,
        email: user.email || profile.email
      };
      updatePrimaryProfile(updated);
      localStorageService.saveUserProfile(updated, user.uid);
      indexedDbService.saveUserProfile(updated);
    }
  }, [user?.displayName, user?.email]);

  // Automatic sync when connection returns
  useEffect(() => {
    if (isOnline) {
      processPendingOfflineSync().then(() => {
        syncOfflineDataBackend({
          userId: user?.uid,
          patients: [profile, ...(profile.familyMembers || [])],
          records: records,
          alerts: notifications
        }, user?.uid).catch(() => {});
      });
    }
  }, [isOnline, user?.uid]);

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    localStorage.removeItem('gramcare_onboarding_completed');
    await logout();
    setTriageDataResult(null);
    selectPatient('user_primary');
    setRecords([]);
    setNotifications([]);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(null, '', window.location.pathname);
    }
    navigateTo('auth');
  };

  // Route protection effect
  useEffect(() => {
    const protectedRoutes = ['home', 'patient_select', 'assistant', 'triage', 'triage_result', 'scanner', 'records', 'nearby', 'notifications', 'profile', 'settings'];
    if (!user && protectedRoutes.includes(currentRoute)) {
      setCurrentRoute('auth');
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState(null, '', window.location.pathname);
      }
    }
  }, [user, currentRoute]);

  // Back button popstate protection
  useEffect(() => {
    const handlePopState = () => {
      const protectedRoutes = ['home', 'patient_select', 'assistant', 'triage', 'triage_result', 'scanner', 'records', 'nearby', 'notifications', 'profile', 'settings'];
      if (!user && protectedRoutes.includes(currentRoute)) {
        setCurrentRoute('auth');
        if (typeof window !== 'undefined' && window.history) {
          window.history.pushState(null, '', window.location.pathname);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, currentRoute]);

  const handleSaveScanRecord = async (scan: DocumentScanResult) => {
    const newRecord: HealthRecord = {
      id: scan.id,
      patientId: activePatientId,
      patientName: activePatientName,
      title: `${scan.docType} Scan Result`,
      type: 'medical_document',
      date: scan.date,
      summary: scan.keyFindings.join('. '),
      facilityOrDoctor: scan.doctorOrLabName,
      tags: ['Scanned', scan.docType]
    };
    const updated = localStorageService.saveHealthRecord(newRecord, user?.uid);
    await indexedDbService.saveHealthRecord(newRecord);
    setRecords(updated);

    if (isOnline) {
      await saveRecordBackend(newRecord, user?.uid).catch(() => {});
    } else {
      await indexedDbService.addPendingSyncItem('record', newRecord);
    }

    navigateTo('records');
  };

  const handleCompleteTriage = async (data: any) => {
    setTriageDataResult(data);
    const newRecord: HealthRecord = {
      id: `triage_log_${Date.now()}`,
      patientId: activePatientId,
      patientName: activePatientName,
      title: `Triage: ${data.mainComplaint}`,
      type: 'triage_session',
      date: new Date().toISOString().split('T')[0],
      summary: `Triage evaluation completed for ${data.mainComplaint}. Urgency: ${data.isUrgent ? 'Urgent' : 'Mild/Moderate'}.`,
      facilityOrDoctor: 'GramCare AI Triage Engine',
      tags: ['Triage', data.severity]
    };
    const updated = localStorageService.saveHealthRecord(newRecord, user?.uid);
    await indexedDbService.saveHealthRecord(newRecord);
    setRecords(updated);

    if (isOnline) {
      await saveRecordBackend(newRecord, user?.uid).catch(() => {});
    } else {
      await indexedDbService.addPendingSyncItem('record', newRecord);
    }

    navigateTo('triage_result');
  };

  const handleMarkNotificationsRead = () => {
    const updated = localStorageService.markNotificationsRead(user?.uid);
    setNotifications(updated);
  };

  if (authLoading && !['splash', 'ai_intro'].includes(currentRoute)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        color: '#0f766e',
        gap: '12px'
      }}>
        <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '15px', fontWeight: 600 }}>Loading GramCare AI Session...</span>
      </div>
    );
  }

  // Full-screen Onboarding & Auth screens
  if (currentRoute === 'splash') {
    return (
      <SplashScreen
        onComplete={() => {
          navigateTo('ai_intro');
        }}
      />
    );
  }
  if (currentRoute === 'ai_intro') {
    return (
      <AIIntroScreen
        onComplete={() => {
          const isLanguageSet = Boolean(
            localStorage.getItem('gramcare_language_selected') === 'true' ||
            (user && (user.language || user.preferredLanguage))
          );

          if (user && userHasCompletedProfile) {
            // Logged-in / Returning User -> Direct to Dashboard!
            navigateTo('home');
          } else if (user) {
            // Logged-in user without completed patient profile -> Language / Profile Setup
            if (!isLanguageSet) {
              navigateTo('language');
            } else {
              navigateTo('profile_setup');
            }
          } else {
            // First-Time User (Not logged in)
            const hasSeenOnboarding = localStorage.getItem('gramcare_has_seen_onboarding') === 'true';
            if (!hasSeenOnboarding) {
              navigateTo('onboarding');
            } else if (!isLanguageSet) {
              navigateTo('language');
            } else {
              navigateTo('auth');
            }
          }
        }}
      />
    );
  }
  if (currentRoute === 'onboarding') {
    return (
      <OnboardingScreen
        onComplete={() => {
          localStorage.setItem('gramcare_has_seen_onboarding', 'true');
          const isLanguageSet = Boolean(
            localStorage.getItem('gramcare_language_selected') === 'true' ||
            (user && (user.language || user.preferredLanguage))
          );
          if (!isLanguageSet) {
            navigateTo('language');
          } else if (user) {
            navigateTo('profile_setup');
          } else {
            navigateTo('auth');
          }
        }}
      />
    );
  }
  if (currentRoute === 'auth') {
    return (
      <LoginSignupScreen
        onSuccess={() => {
          const isLanguageSet = Boolean(
            localStorage.getItem('gramcare_language_selected') === 'true' ||
            (user && (user.language || user.preferredLanguage))
          );
          if (userHasCompletedProfile) {
            navigateTo('home');
          } else if (!isLanguageSet) {
            navigateTo('language');
          } else {
            navigateTo('profile_setup');
          }
        }}
      />
    );
  }
  if (currentRoute === 'language') {
    return (
      <LanguageScreen
        onNext={() => {
          localStorage.setItem('gramcare_language_selected', 'true');
          if (user && userHasCompletedProfile) {
            navigateTo('home');
          } else if (user) {
            navigateTo('profile_setup');
          } else {
            navigateTo('auth');
          }
        }}
      />
    );
  }
  if (currentRoute === 'profile_setup') {
    return (
      <ProfileSetupScreen
        initialProfile={profile}
        onNext={(updated) => {
          const finalProfile = {
            ...updated,
            profileCompleted: true,
            isProfileCompleted: true,
            isOnboardingCompleted: true
          };
          updatePrimaryProfile(finalProfile);
          navigateTo('home');
        }}
      />
    );
  }
  if (currentRoute === 'profile_confirm') {
    return (
      <ProfileConfirmScreen
        profile={profile}
        onEdit={() => navigateTo('profile_setup')}
        onConfirm={() => {
          const finalProfile = {
            ...profile,
            profileCompleted: true,
            isProfileCompleted: true,
            isOnboardingCompleted: true
          };
          updatePrimaryProfile(finalProfile);
          navigateTo('home');
        }}
      />
    );
  }
  if (currentRoute === 'sos') {
    return (
      <SOSEmergencyScreen
        onBack={() => navigateTo('home')}
        onNavigateToNearby={() => navigateTo('nearby')}
      />
    );
  }

  // Main application router with AppLayout wrapper
  const renderScreen = () => {
    switch (currentRoute) {
      case 'home':
        return (
          <HomeDashboardScreen
            userName={user?.displayName || profile.fullName}
            isOnline={isOnline}
            profile={profile}
            activePatientId={activePatientId}
            onSelectPatient={selectPatient}
            onAddFamilyMember={addFamilyMember}
            onNavigate={navigateTo}
            onOpenEmergency={() => navigateTo('sos')}
          />
        );
      case 'patient_select':
        return (
          <SelectPatientScreen
            profile={profile}
            activePatientId={activePatientId}
            onSelectPatient={selectPatient}
            onAddFamilyMember={addFamilyMember}
            onContinue={() => navigateTo('home')}
          />
        );
      case 'assistant':
        return (
          <AIAssistantScreen
            activePatientName={activePatientName}
            activePatient={activePatient}
            onNavigate={navigateTo}
          />
        );
      case 'triage':
        return (
          <SymptomTriageScreen
            isOnline={isOnline}
            activePatientName={activePatientName}
            onCompleteTriage={handleCompleteTriage}
            onOpenEmergency={() => navigateTo('sos')}
          />
        );
      case 'triage_result':
        return (
          <TriageGuidanceScreen
            triageData={triageDataResult}
            onNavigate={navigateTo}
            onOpenEmergency={() => navigateTo('sos')}
          />
        );
      case 'firstaid':
        return <HealthGuidanceScreen />;
      case 'scanner':
        return (
          <DocumentScannerScreen
            activePatientName={activePatientName}
            onSaveRecord={handleSaveScanRecord}
          />
        );
      case 'records':
        return (
          <HealthRecordsScreen
            records={records}
            profile={profile}
            activePatientId={activePatientId}
            onSelectPatient={selectPatient}
            onAddFamilyMember={addFamilyMember}
            onNavigateToScan={() => navigateTo('scanner')}
          />
        );
      case 'nearby':
        return <NearbyHealthcareScreen />;
      case 'notifications':
        return (
          <NotificationsScreen
            notifications={notifications}
            onMarkAllRead={handleMarkNotificationsRead}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            profile={{ ...profile, fullName: profile.fullName || user?.displayName || '' }}
            onEditProfile={() => navigateTo('profile_setup')}
            onNavigateToSettings={() => navigateTo('settings')}
            onLogout={handleLogout}
            onUpdateFamilyMember={updateFamilyMember}
            onRemoveFamilyMember={removeFamilyMember}
            onUpdateProfile={updatePrimaryProfile}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            onLogout={handleLogout}
          />
        );
      default:
        return (
          <HomeDashboardScreen
            userName={user?.displayName || profile.fullName}
            isOnline={isOnline}
            profile={profile}
            activePatientId={activePatientId}
            onSelectPatient={selectPatient}
            onAddFamilyMember={addFamilyMember}
            onNavigate={navigateTo}
            onOpenEmergency={() => navigateTo('sos')}
          />
        );
    }
  };

  return (
    <AppLayout
      currentRoute={currentRoute}
      onNavigate={navigateTo}
      onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
      showBottomNav={!['splash', 'ai_intro', 'language', 'onboarding', 'auth', 'profile_setup', 'profile_confirm', 'sos'].includes(currentRoute)}
      activePatientName={activePatientName}
      userName={user?.displayName || profile.fullName}
    >
      {renderScreen()}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
      />
    </AppLayout>
  );
};
