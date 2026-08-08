import { indexedDbService, PendingSyncItem } from './indexedDbService';
import { syncOfflineDataBackend } from './api';

let isSyncing = false;

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  message: string;
}

export async function processPendingOfflineSync(): Promise<SyncResult> {
  if (isSyncing) {
    return { success: false, syncedCount: 0, message: 'Sync already in progress.' };
  }

  isSyncing = true;

  try {
    const pendingItems: PendingSyncItem[] = await indexedDbService.getPendingSyncItems();

    if (pendingItems.length === 0) {
      isSyncing = false;
      return { success: true, syncedCount: 0, message: 'No pending offline items to sync.' };
    }

    const payload: {
      patients: any[];
      records: any[];
      alerts: any[];
      triage_logs: any[];
    } = {
      patients: [],
      records: [],
      alerts: [],
      triage_logs: []
    };

    const itemIdsToClear: string[] = [];

    pendingItems.forEach(item => {
      itemIdsToClear.push(item.id);
      if (item.type === 'patient') payload.patients.push(item.payload);
      else if (item.type === 'record') payload.records.push(item.payload);
      else if (item.type === 'alert') payload.alerts.push(item.payload);
      else if (item.type === 'triage_log') payload.triage_logs.push(item.payload);
    });

    const res = await syncOfflineDataBackend(payload);

    if (res && res.status === 'success') {
      await indexedDbService.markSyncItemsCompleted(itemIdsToClear);
      isSyncing = false;
      return {
        success: true,
        syncedCount: pendingItems.length,
        message: res.message || `Successfully synchronized ${pendingItems.length} offline items.`
      };
    } else {
      isSyncing = false;
      return {
        success: false,
        syncedCount: 0,
        message: 'Backend rejected sync payload or connection dropped.'
      };
    }
  } catch (err: any) {
    isSyncing = false;
    return {
      success: false,
      syncedCount: 0,
      message: err?.message || 'Sync failed due to network exception.'
    };
  }
}
