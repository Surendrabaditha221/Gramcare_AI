export type UrgencyCategory = 'Emergency Attention' | 'Seek Medical Care Soon' | 'Non-Urgent Guidance';
export type TriageSeverity = 'low' | 'moderate' | 'urgent' | 'emergency';

export interface SymptomCategory {
  id: string;
  name: string;
  hindiName?: string;
  teluguName?: string;
  iconName: string;
  description: string;
}

export interface SymptomOption {
  id: string;
  categoryId: string;
  name: string;
  hindiName?: string;
  teluguName?: string;
  description: string;
  isRedFlag?: boolean;
}

export interface TriageInput {
  patientId?: string;
  patientName?: string;
  ageGroup: 'child' | 'adult' | 'elderly' | 'pregnant';
  mainComplaint: string;
  duration: 'today' | 'few_days' | 'week_plus';
  severity: 'Mild' | 'Moderate' | 'Severe';
  selectedSymptomIds: string[];
  warningSigns: string[];
  additionalDetails?: string;
}

export interface TriageGuidanceResult {
  id: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  severity: TriageSeverity;
  urgencyCategory: UrgencyCategory;
  title: string;
  teluguTitle: string;
  summary: string;
  teluguSummary: string;
  reportedSymptoms: string[];
  teluguReportedSymptoms: string[];
  recommendedNextActions: string[];
  teluguRecommendedNextActions: string[];
  warningSigns: string[];
  teluguWarningSigns: string[];
  redFlagWarning?: boolean;
  disclaimer: string;
}

export interface FirstAidTopic {
  id: string;
  title: string;
  hindiTitle?: string;
  teluguTitle?: string;
  category: 'emergency' | 'maternal' | 'child' | 'general' | 'bites';
  icon: string;
  summary: string;
  steps: string[];
  hindiSteps?: string[];
  teluguSteps?: string[];
  doNotDo: string[];
  hindiDoNotDo?: string[];
  teluguDoNotDo?: string[];
  isAvailableOffline: boolean;
}
