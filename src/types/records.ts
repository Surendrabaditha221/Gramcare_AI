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
  scanResult?: DocumentScanResult;
}

export interface LabTestItem {
  testName: string;
  result: string;
  unit: string;
  referenceRange?: string;
  status: 'Normal' | 'High' | 'Low' | 'Abnormal' | 'Borderline' | 'Not Provided' | string;
  notes?: string;
}

export interface LabTestPanel {
  panelName: string;
  department?: string;
  specimenType?: string;
  results: LabTestItem[];
}

export interface NarrativeSection {
  sectionTitle?: string;
  modality?: string;
  modalityOrExam?: string;
  clinicalHistory?: string;
  technique?: string;
  findings: string[] | string;
  impression?: string;
}

export interface ReportPatientDetails {
  name?: string;
  patientId?: string;
  age?: string | number;
  gender?: string;
  referringDoctor?: string;
  department?: string;
  contact?: string;
}

export interface ReportMetaDetails {
  reportId?: string;
  laboratoryName?: string;
  department?: string;
  specimenType?: string;
  collectionDate?: string;
  collectionTime?: string;
  reportDate?: string;
  reportTime?: string;
  status?: string;
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
  // Professional Multispeciality Hospital Report Structure
  patientDetails?: ReportPatientDetails;
  reportDetails?: ReportMetaDetails;
  testPanels?: LabTestPanel[];
  narrativeSections?: NarrativeSection[];
  abnormalAlerts?: LabTestItem[];
  aiSummary?: string;
  extractionStatus?: 'complete' | 'partial' | 'unclear';
  rawBackendJson?: any;
}
