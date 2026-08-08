export type NotificationCategory = 'health' | 'records' | 'system' | 'reminders';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  teluguTitle: string;
  message: string;
  teluguMessage: string;
  timestamp: string;
  isRead: boolean;
  actionRoute?: string;
}
