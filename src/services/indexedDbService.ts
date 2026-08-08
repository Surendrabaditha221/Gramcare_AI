import { HealthRecord } from '../types/records';
import { UserProfile, FamilyMember } from '../types/user';
import { HealthcareCenter } from '../types/healthCenter';

const DB_NAME = 'GramCareDB';
const DB_VERSION = 1;

export interface PendingSyncItem {
  id: string;
  type: 'patient' | 'record' | 'alert' | 'triage_log';
  payload: any;
  timestamp: string;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('patientProfiles')) {
        db.createObjectStore('patientProfiles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('healthRecords')) {
        db.createObjectStore('healthRecords', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('nearbyFacilities')) {
        db.createObjectStore('nearbyFacilities', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pendingSyncQueue')) {
        const store = db.createObjectStore('pendingSyncQueue', { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const indexedDbService = {
  // --- Patient Profiles ---
  async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction('patientProfiles', 'readwrite');
      const store = tx.objectStore('patientProfiles');
      store.put({ ...profile, id: 'user_primary' });
    } catch (e) {
      console.warn('IndexedDB saveUserProfile fallback:', e);
    }
  },

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('patientProfiles', 'readonly');
        const store = tx.objectStore('patientProfiles');
        const req = store.get('user_primary');
        req.onsuccess = () => {
          const res = req.result;
          if (res) {
            if (res.fullName === 'Baditha Surendra' || res.fullName === 'Rajesh Kumar') {
              res.fullName = '';
              res.dob = '';
              res.age = 0;
            }
            if (res.familyMembers && Array.isArray(res.familyMembers)) {
              res.familyMembers = res.familyMembers.filter((m: any) =>
                m && m.fullName &&
                !m.fullName.includes('Sunita') &&
                !m.fullName.includes('Aarav') &&
                !m.fullName.includes('Rajesh')
              );
            }
          }
          resolve(res || null);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  // --- Health Records ---
  async saveHealthRecord(record: HealthRecord): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction('healthRecords', 'readwrite');
      const store = tx.objectStore('healthRecords');
      store.put(record);
    } catch (e) {
      console.warn('IndexedDB saveHealthRecord fallback:', e);
    }
  },

  async getHealthRecords(): Promise<HealthRecord[]> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('healthRecords', 'readonly');
        const store = tx.objectStore('healthRecords');
        const req = store.getAll();
        req.onsuccess = () => {
          const list: HealthRecord[] = req.result || [];
          const cleaned = list.filter(r =>
            r && r.patientName &&
            !r.patientName.includes('Sunita') &&
            !r.patientName.includes('Aarav') &&
            !r.patientName.includes('Rajesh') &&
            !(r.facilityOrDoctor && r.facilityOrDoctor.includes('Devgarh'))
          );
          resolve(cleaned);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  },

  // --- Nearby Healthcare Facilities ---
  async saveNearbyFacilities(facilities: HealthcareCenter[]): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction('nearbyFacilities', 'readwrite');
      const store = tx.objectStore('nearbyFacilities');
      facilities.forEach(f => store.put(f));
    } catch (e) {
      console.warn('IndexedDB saveNearbyFacilities fallback:', e);
    }
  },

  async getNearbyFacilities(): Promise<HealthcareCenter[]> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('nearbyFacilities', 'readonly');
        const store = tx.objectStore('nearbyFacilities');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  },

  // --- Pending Offline Synchronization Queue ---
  async addPendingSyncItem(type: 'patient' | 'record' | 'alert' | 'triage_log', payload: any): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction('pendingSyncQueue', 'readwrite');
      const store = tx.objectStore('pendingSyncQueue');
      const item: PendingSyncItem = {
        id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type,
        payload,
        timestamp: new Date().toISOString(),
        synced: false
      };
      store.put(item);
    } catch (e) {
      console.warn('IndexedDB addPendingSyncItem error:', e);
    }
  },

  async getPendingSyncItems(): Promise<PendingSyncItem[]> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('pendingSyncQueue', 'readonly');
        const store = tx.objectStore('pendingSyncQueue');
        const req = store.getAll();
        req.onsuccess = () => {
          const items: PendingSyncItem[] = req.result || [];
          resolve(items.filter(item => !item.synced));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  },

  async markSyncItemsCompleted(itemIds: string[]): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction('pendingSyncQueue', 'readwrite');
      const store = tx.objectStore('pendingSyncQueue');
      itemIds.forEach(id => store.delete(id));
    } catch (e) {
      console.warn('IndexedDB markSyncItemsCompleted error:', e);
    }
  },

  async clearAllData(): Promise<void> {
    try {
      const db = await openDB();
      const stores = ['patientProfiles', 'healthRecords', 'nearbyFacilities', 'pendingSyncQueue'];
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach(s => tx.objectStore(s).clear());
    } catch (e) {
      console.warn('IndexedDB clearAllData error:', e);
    }
  }
};
