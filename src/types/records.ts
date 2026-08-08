export type RecordType = 'triage_session' | 'medical_document' | 'clinical_visit';

export interface HealthRecord {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  teluguTitle?: string;
  type: RecordType;
  date: string;
  summary: string;
  teluguSummary?: string;
  facilityOrDoctor?: string;
  downloadUrl?: string;
  tags?: string[];
}

export interface DocumentScanResult {
  id: string;
  docType: 'Prescription' | 'Medical Report' | 'Health Record';
  extractedPatientName: string;
  doctorOrLabName: string;
  date: string;
  keyFindings: string[];
  medicationsMentioned?: string[];
  rawTextPreview: string;
  scanImageUrl?: string;
}
