import { DocumentScanResult } from '../types/records';

export const mockScanService = {
  async processDocumentScan(docType: 'Prescription' | 'Medical Report' | 'Health Record', patientName: string): Promise<DocumentScanResult> {
    // Simulate OCR processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (docType === 'Prescription') {
      return {
        id: `scan_${Date.now()}`,
        docType: 'Prescription',
        extractedPatientName: patientName,
        doctorOrLabName: 'Medical Officer (PHC)',
        date: new Date().toISOString().split('T')[0],
        keyFindings: [
          'Diagnosis: Acute Viral Fever & Upper Respiratory Tract Infection',
          'Advice: Cold sponging, 3-day course Paracetamol 500mg, ORS hydration',
          'Follow-up: Please visit your nearest Primary Health Centre (PHC), Community Health Centre (CHC), or hospital if fever persists after 3 days'
        ],
        medicationsMentioned: ['Tab. Paracetamol 500mg', 'ORS Powder Packets', 'Cetirizine 10mg'],
        rawTextPreview: 'PHC OPD Ticket #4829 | Patient: ' + patientName + ' | Rx: Paracetamol 500mg TDS, ORS 1L daily. Follow up 3 days.'
      };
    } else {
      return {
        id: `scan_${Date.now()}`,
        docType: 'Medical Report',
        extractedPatientName: patientName,
        doctorOrLabName: 'District Pathology Lab',
        date: new Date().toISOString().split('T')[0],
        keyFindings: [
          'Hemoglobin (Hb): 12.4 g/dL (Normal)',
          'Malaria Antigen (Pf/Pv): Negative',
          'Blood Sugar (Random): 110 mg/dL (Normal)'
        ],
        rawTextPreview: 'Pathology Report | Patient: ' + patientName + ' | Hb: 12.4 g/dL | MP: Negative | Widal: Negative.'
      };
    }
  }
};
