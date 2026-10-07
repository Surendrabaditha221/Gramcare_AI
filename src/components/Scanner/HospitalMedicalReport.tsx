import React, { useState } from 'react';
import {
  HeartPulse, Printer, Download, Save, RotateCcw, FileText, CheckCircle2,
  AlertTriangle, AlertCircle, Info, User, Calendar, Clock, Stethoscope,
  FlaskConical, ChevronDown, ChevronUp, Copy, Check, ShieldAlert,
  Sparkles, Eye, FileCode
} from 'lucide-react';
import {
  DocumentScanResult, LabTestItem, LabTestPanel, NarrativeSection,
  ReportPatientDetails, ReportMetaDetails
} from '../../types/records';
import { UserProfile } from '../../types/user';
import { generateHospitalReportPdf } from '../../utils/reportPdfGenerator';

interface HospitalMedicalReportProps {
  scanResult: DocumentScanResult;
  backendResult?: any;
  userProfile?: UserProfile | null;
  activePatientName?: string;
  capturedImageUrl?: string | null;
  onSaveRecord: (result: DocumentScanResult) => void;
  onScanAnother: () => void;
}

export const HospitalMedicalReport: React.FC<HospitalMedicalReportProps> = ({
  scanResult,
  backendResult,
  userProfile,
  activePatientName,
  capturedImageUrl,
  onSaveRecord,
  onScanAnother,
}) => {
  const [showOriginalDoc, setShowOriginalDoc] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Normalize extracted patient details vs authenticated profile
  const extractedPatient: ReportPatientDetails = {
    name: scanResult.patientDetails?.name || backendResult?.patient_details?.name || scanResult.extractedPatientName || '',
    patientId: scanResult.patientDetails?.patientId || backendResult?.patient_details?.patient_id || '',
    age: scanResult.patientDetails?.age || backendResult?.patient_details?.age || undefined,
    gender: scanResult.patientDetails?.gender || backendResult?.patient_details?.gender || '',
    referringDoctor: scanResult.patientDetails?.referringDoctor || backendResult?.patient_details?.referring_doctor || scanResult.doctorOrLabName || '',
    department: scanResult.patientDetails?.department || backendResult?.patient_details?.department || '',
    contact: scanResult.patientDetails?.contact || backendResult?.patient_details?.contact || '',
  };

  // Report metadata
  const reportMeta: ReportMetaDetails = {
    reportId: scanResult.reportDetails?.reportId || backendResult?.report_details?.report_id || `GMC-${scanResult.id.slice(-6).toUpperCase()}`,
    laboratoryName: scanResult.reportDetails?.laboratoryName || backendResult?.report_details?.lab_name || scanResult.doctorOrLabName || 'GramCare Diagnostic Services',
    department: scanResult.reportDetails?.department || backendResult?.report_details?.department || 'Clinical Pathology & Laboratory Medicine',
    specimenType: scanResult.reportDetails?.specimenType || backendResult?.report_details?.specimen_type || '',
    collectionDate: scanResult.reportDetails?.collectionDate || backendResult?.report_details?.sample_collection_date || scanResult.date || '',
    collectionTime: scanResult.reportDetails?.collectionTime || backendResult?.report_details?.sample_collection_time || '',
    reportDate: scanResult.reportDetails?.reportDate || backendResult?.report_details?.report_date || scanResult.date || new Date().toISOString().split('T')[0],
    reportTime: scanResult.reportDetails?.reportTime || backendResult?.report_details?.report_time || '',
    status: scanResult.reportDetails?.status || backendResult?.report_details?.report_status || 'Final / AI-Extracted',
  };

  // Extract or normalize panels
  const rawPanels: any[] = scanResult.testPanels || backendResult?.test_panels || [];
  let testPanels: LabTestPanel[] = [];

  if (rawPanels.length > 0) {
    testPanels = rawPanels.map((p) => ({
      panelName: p.panelName || p.panel_name || 'Laboratory Investigation',
      specimenType: p.specimenType || p.specimen_type || reportMeta.specimenType,
      results: (p.results || []).map((r: any) => ({
        testName: r.testName || r.test_name || 'Test',
        result: String(r.result !== undefined ? r.result : (r.value !== undefined ? r.value : '')),
        unit: r.unit || '',
        referenceRange: r.referenceRange || r.reference_range || '',
        status: (r.status || r.flag || (r.referenceRange || r.reference_range ? 'Normal' : 'Range Not Provided')) as any,
        notes: r.notes || '',
      })),
    }));
  } else if (scanResult.keyFindings && scanResult.keyFindings.length > 0) {
    // Parse key findings into structured lab items if available
    const parsedResults: LabTestItem[] = scanResult.keyFindings.map((finding) => {
      // Regex to detect patterns like: "Hemoglobin: 13.8 g/dL (13.0-17.0)" or "WBC: 6,200 /uL"
      const match = finding.match(/^([^:\-]+)[:\-]\s*([0-9.,><]+)\s*([a-zA-Z/%µuL\^]*)\s*(?:\((?:Ref|Range|Normal)?\s*:?\s*([^)]+)\))?\s*(\[?(?:High|Low|Normal|Critical|Abnormal)\]?)?/i);
      if (match) {
        const testName = match[1].trim();
        const resultVal = match[2].trim();
        const unit = match[3].trim();
        const range = match[4]?.trim() || '';
        let flagStr = match[5]?.replace(/[[\]]/g, '').trim();
        if (!flagStr) {
          flagStr = range ? 'Normal' : 'Range Not Provided';
        }
        return {
          testName,
          result: resultVal,
          unit,
          referenceRange: range || undefined,
          status: (flagStr || 'Range Not Provided') as any,
        };
      }
      return {
        testName: finding,
        result: 'Observed',
        unit: '',
        referenceRange: undefined,
        status: 'Range Not Provided',
      };
    });

    testPanels = [
      {
        panelName: `${scanResult.docType} Findings`,
        specimenType: reportMeta.specimenType,
        results: parsedResults,
      },
    ];
  }

  // Narrative sections (e.g. for Radiology, Ultrasound, Narrative reports)
  const rawNarrative: any[] = scanResult.narrativeSections || backendResult?.narrative_sections || [];
  const narrativeSections: NarrativeSection[] = rawNarrative.map((n) => ({
    sectionTitle: n.sectionTitle || n.section_title || 'Clinical Evaluation',
    modality: n.modality,
    technique: n.technique,
    findings: n.findings || '',
    impression: n.impression || '',
  }));

  // Abnormal alerts: look into testPanels or backendResult
  const abnormalAlerts: LabTestItem[] = [];
  testPanels.forEach((panel) => {
    panel.results.forEach((item) => {
      const st = (item.status || '').toLowerCase();
      if (st.includes('high') || st.includes('low') || st.includes('abnormal') || st.includes('critical')) {
        abnormalAlerts.push(item);
      }
    });
  });

  // Extraction status
  const extractionStatus = scanResult.extractionStatus || backendResult?.extraction_status || 'complete';
  const aiSummaryText = scanResult.aiSummary || backendResult?.ai_summary || '';
  const followUpText = scanResult.rawTextPreview || backendResult?.follow_up_instructions || '';
  const rawOcrText = backendResult?.raw_extracted_text || '';

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Trigger PDF generator
  const handleDownloadPdf = () => {
    const activeProfileData = userProfile ? {
      name: userProfile.fullName,
      age: userProfile.age,
      gender: userProfile.gender,
      patientId: userProfile.id || userProfile.uid,
      phone: userProfile.phone,
    } : (activePatientName ? { name: activePatientName } : undefined);

    const fullResult: DocumentScanResult = {
      ...scanResult,
      patientDetails: extractedPatient,
      reportDetails: reportMeta,
      testPanels,
      narrativeSections,
      abnormalAlerts,
      aiSummary: aiSummaryText,
    };

    generateHospitalReportPdf(fullResult, activeProfileData);
  };

  // Save Record
  const handleSave = async () => {
    try {
      setSaveLoading(true);
      const fullResult: DocumentScanResult = {
        ...scanResult,
        patientDetails: extractedPatient,
        reportDetails: reportMeta,
        testPanels,
        narrativeSections,
        abnormalAlerts,
        aiSummary: aiSummaryText,
        scanImageUrl: capturedImageUrl || undefined,
      };
      await onSaveRecord(fullResult);
      setIsSaved(true);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCopyOcr = () => {
    if (rawOcrText) {
      navigator.clipboard.writeText(rawOcrText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('critical')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fecaca'
        }}>
          <AlertCircle size={12} />
          CRITICAL
        </span>
      );
    }
    if (s.includes('high')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          backgroundColor: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a'
        }}>
          ▲ HIGH
        </span>
      );
    }
    if (s.includes('low')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          backgroundColor: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a'
        }}>
          ▼ LOW
        </span>
      );
    }
    if (s.includes('normal')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: '#ecfdf5',
          color: '#047857',
          border: '1px solid #a7f3d0'
        }}>
          <CheckCircle2 size={12} />
          NORMAL
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: '#f1f5f9',
        color: '#475569',
        border: '1px solid #cbd5e1'
      }}>
        {status || 'Range Not Provided'}
      </span>
    );
  };

  return (
    <div className="gramcare-hospital-report-container" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Print Stylesheet injection */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .gramcare-hospital-report-card, .gramcare-hospital-report-card * {
            visibility: visible;
          }
          .gramcare-hospital-report-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Banner Navigation / Quick Actions */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#0f766e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <HeartPulse size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f766e', margin: 0 }}>
              Hospital Medical Report
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              AI-Extracted Diagnostic Laboratory Sheet
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: '#0f766e',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15,118,110,0.2)'
            }}
          >
            <Download size={15} />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* MAIN HOSPITAL MEDICAL REPORT SHEET */}
      <div className="gramcare-hospital-report-card" style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 4px 16px -2px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.03)',
        overflow: 'hidden'
      }}>
        {/* SECTION A: HOSPITAL HEADER */}
        <div style={{
          backgroundColor: '#0f766e',
          color: '#ffffff',
          padding: '24px 28px',
          borderBottom: '3px solid #14b8a6',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.15)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <HeartPulse size={34} color="#ffffff" />
              </div>

              <div>
                <h1 style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  margin: 0,
                  color: '#ffffff',
                  textTransform: 'uppercase'
                }}>
                  GramCare Multispeciality Hospital
                </h1>
                <p style={{
                  fontSize: '13px',
                  color: '#ccfbf1',
                  margin: '3px 0 0 0',
                  fontWeight: 500
                }}>
                  Rural Healthcare Suite | Diagnostic & Laboratory Services
                </p>
                <div style={{
                  fontSize: '11px',
                  color: '#99f6e4',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Stethoscope size={13} />
                  <span>{reportMeta.department}</span>
                </div>
              </div>
            </div>

            {/* Header Right: Report ID & Status */}
            <div style={{ textAlign: 'right', minWidth: '160px' }}>
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                border: '1px solid rgba(255,255,255,0.4)',
                marginBottom: '6px'
              }}>
                {(reportMeta.status || 'FINAL / AI-EXTRACTED').toUpperCase()}
              </div>
              <div style={{ fontSize: '11px', color: '#ccfbf1' }}>
                Report ID: <strong style={{ color: '#ffffff', letterSpacing: '0.5px' }}>{reportMeta.reportId}</strong>
              </div>
              <div style={{ fontSize: '11px', color: '#ccfbf1', marginTop: '2px' }}>
                Issued: {reportMeta.reportDate} {reportMeta.reportTime && `• ${reportMeta.reportTime}`}
              </div>
            </div>
          </div>

          {/* AI-Assisted Notice Bar */}
          <div style={{
            marginTop: '16px',
            padding: '6px 12px',
            backgroundColor: 'rgba(15, 23, 42, 0.25)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={13} color="#5eead4" />
            <span>AI-Assisted Digital Document Extraction. Original laboratory reference ranges apply. Consult a registered physician for clinical diagnosis.</span>
          </div>
        </div>

        {/* SECTION B: PATIENT INFORMATION CARD */}
        <div style={{
          padding: '20px 28px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{
              fontSize: '13px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: '#0f766e',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <User size={15} />
              Patient Identification & Demographics
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              {extractedPatient.name ? (
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                  Document Extracted
                </span>
              ) : null}
              {userProfile?.fullName ? (
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                  Verified Profile Linked
                </span>
              ) : null}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px 20px',
            backgroundColor: '#ffffff',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Patient Full Name</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {extractedPatient.name || userProfile?.fullName || activePatientName || 'Not Available'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Patient ID / UHID</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px', fontFamily: 'monospace' }}>
                {extractedPatient.patientId || userProfile?.id || userProfile?.uid || 'Not Available'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Age / Gender</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                {extractedPatient.age ? `${extractedPatient.age} Yrs` : (userProfile?.age ? `${userProfile.age} Yrs` : 'Age Not Available')}
                {' / '}
                {extractedPatient.gender || userProfile?.gender || 'Not Available'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Referring Physician / Clinic</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                {extractedPatient.referringDoctor || 'Self / Direct Walk-In'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Department / Ward</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                {extractedPatient.department || reportMeta.department || 'Out-Patient Department (OPD)'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Location / Village</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                {userProfile?.village ? `${userProfile.village}${userProfile.district ? `, ${userProfile.district}` : ''}` : 'Not Available'}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION C: SPECIMEN & DIAGNOSTIC DETAILS */}
        <div style={{
          padding: '14px 28px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#475569' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FlaskConical size={14} color="#0f766e" />
              <span>Specimen: <strong style={{ color: '#0f172a' }}>{reportMeta.specimenType || 'Specimen Not Specified'}</strong></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#0f766e" />
              <span>Collected: <strong style={{ color: '#0f172a' }}>{reportMeta.collectionDate || reportMeta.reportDate || 'Date Not Stated'}</strong></span>
            </div>

            {reportMeta.collectionTime && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} color="#0f766e" />
                <span>Time: <strong style={{ color: '#0f172a' }}>{reportMeta.collectionTime}</strong></span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Stethoscope size={14} color="#0f766e" />
              <span>Lab Facility: <strong style={{ color: '#0f172a' }}>{reportMeta.laboratoryName}</strong></span>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Investigation: <strong style={{ color: '#0f766e' }}>{scanResult.docType}</strong>
          </div>
        </div>

        {/* SECTION 7: ABNORMAL RESULTS & ALERTS (If any out of range) */}
        {abnormalAlerts.length > 0 && (
          <div style={{
            margin: '20px 28px',
            padding: '16px 20px',
            backgroundColor: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <ShieldAlert size={20} color="#b45309" />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
                Attention: Test Findings Outside Reference Range ({abnormalAlerts.length})
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {abnormalAlerts.map((alert, idx) => (
                <div key={idx} style={{
                  backgroundColor: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #fcd34d',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{alert.testName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Ref: {alert.referenceRange || 'Range Not Provided'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#b45309' }}>
                      {alert.result} <span style={{ fontSize: '11px', fontWeight: 500 }}>{alert.unit}</span>
                    </div>
                    <div style={{ marginTop: '2px' }}>
                      {getStatusBadge(alert.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#92400e', lineHeight: 1.4 }}>
              * Laboratory reference ranges may vary between laboratories and instruments. Please consult a qualified doctor at your nearest Primary Health Centre (PHC), CHC, or hospital for clinical interpretation.
            </p>
          </div>
        )}

        {/* SECTION 4: STRUCTURED LABORATORY RESULTS TABLES */}
        <div style={{ padding: '24px 28px' }}>
          {testPanels.length > 0 ? (
            testPanels.map((panel, pIdx) => (
              <div key={pIdx} style={{ marginBottom: pIdx < testPanels.length - 1 ? '28px' : '0' }}>
                {/* Panel Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 16px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '8px 8px 0 0',
                  border: '1px solid #cbd5e1',
                  borderBottom: 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FlaskConical size={16} color="#0f766e" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {panel.panelName}
                    </h4>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    {panel.results.length} {panel.results.length === 1 ? 'Parameter' : 'Parameters'}
                  </span>
                </div>

                {/* Laboratory Table */}
                <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '0 0 8px 8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '580px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', width: '38%' }}>
                          Test Name
                        </th>
                        <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', width: '18%' }}>
                          Result
                        </th>
                        <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', width: '14%' }}>
                          Unit
                        </th>
                        <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', width: '18%' }}>
                          Reference Range
                        </th>
                        <th style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', width: '12%' }}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {panel.results.map((row, rIdx) => {
                        const isAbnormal = (row.status || '').toLowerCase().includes('high') ||
                                           (row.status || '').toLowerCase().includes('low') ||
                                           (row.status || '').toLowerCase().includes('critical');
                        return (
                          <tr
                            key={rIdx}
                            style={{
                              backgroundColor: isAbnormal ? '#fffdf7' : (rIdx % 2 === 0 ? '#ffffff' : '#fcfcfd'),
                              borderBottom: rIdx < panel.results.length - 1 ? '1px solid #e2e8f0' : 'none',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                              {row.testName}
                              {row.notes && (
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
                                  {row.notes}
                                </div>
                              )}
                            </td>
                            <td style={{
                              padding: '12px 14px',
                              fontSize: '13.5px',
                              fontWeight: isAbnormal ? 800 : 700,
                              color: isAbnormal ? '#b45309' : '#0f172a',
                              textAlign: 'right',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}>
                              {row.result}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>
                              {row.unit || '—'}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>
                              {row.referenceRange ? (
                                <span style={{ fontWeight: 500 }}>{row.referenceRange}</span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>Range Not Provided</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {getStatusBadge(row.status)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            /* Narrative or Non-Table Report Fallback */
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '10px',
              padding: '24px',
              textAlign: 'center'
            }}>
              <FileText size={32} color="#0f766e" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                Narrative Medical Report
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                No tabular numerical laboratory parameters were found in this document. Please review the diagnostic narrative findings below.
              </div>
            </div>
          )}

          {/* Narrative / Radiology Reports Section (e.g. X-Ray, CT, Ultrasound) */}
          {narrativeSections.length > 0 && (
            <div style={{ marginTop: '28px' }}>
              <div style={{
                padding: '10px 16px',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px 8px 0 0',
                border: '1px solid #cbd5e1',
                borderBottom: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Stethoscope size={16} color="#0f766e" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase' }}>
                  Diagnostic Radiology & Clinical Narrative Findings
                </h4>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '0 0 8px 8px', padding: '16px', backgroundColor: '#ffffff' }}>
                {narrativeSections.map((sec, idx) => (
                  <div key={idx} style={{ marginBottom: idx < narrativeSections.length - 1 ? '16px' : '0' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                      {sec.sectionTitle} {sec.modality && `(${sec.modality})`}
                    </div>
                    {sec.findings && (
                      <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, marginBottom: '6px' }}>
                        <strong>Findings: </strong>{sec.findings}
                      </div>
                    )}
                    {sec.impression && (
                      <div style={{
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: '#166534',
                        fontWeight: 600
                      }}>
                        <strong>Impression: </strong>{sec.impression}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Identified Medications (if Prescription or clinical document) */}
          {(scanResult.medicationsMentioned?.length ?? 0) > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h4 style={{
                margin: '0 0 10px 0',
                fontSize: '13px',
                fontWeight: 700,
                color: '#0f766e',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Identified Prescribed Medications ({scanResult.medicationsMentioned?.length})
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {scanResult.medicationsMentioned?.map((med, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 12px',
                      backgroundColor: '#f0fdf4',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    • {med}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 6: AI-EXTRACTED SUMMARY */}
          <div style={{
            marginTop: '28px',
            padding: '18px 20px',
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #a7f3d0',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#0f766e" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f766e' }}>
                  AI-Extracted Summary
                </h4>
              </div>

              {/* Neutral extraction status */}
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: extractionStatus === 'complete' ? '#dcfce7' : '#fef3c7',
                color: extractionStatus === 'complete' ? '#15803d' : '#b45309',
                border: extractionStatus === 'complete' ? '1px solid #86efac' : '1px solid #fde68a'
              }}>
                {extractionStatus === 'complete' ? 'Extraction Complete' : 'Verification Required'}
              </span>
            </div>

            <p style={{
              margin: '0 0 10px 0',
              fontSize: '13px',
              color: '#166534',
              lineHeight: 1.6
            }}>
              {aiSummaryText || (scanResult.keyFindings.length > 0 ? scanResult.keyFindings.join('. ') : 'Document parsed successfully with standard parameters.')}
            </p>

            <div style={{ fontSize: '11px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={13} />
              <span>Documented findings are extracted directly from the physical document. This AI summary is an assistive overview and does not replace professional clinical diagnosis.</span>
            </div>
          </div>

          {/* SECTION 8: FOLLOW-UP INSTRUCTIONS */}
          <div style={{
            marginTop: '20px',
            padding: '16px 20px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Clock size={16} color="#0f766e" />
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Follow-Up Instructions & Clinical Advice
              </h4>
            </div>

            <p style={{
              margin: 0,
              fontSize: '13px',
              color: followUpText ? '#334155' : '#64748b',
              fontStyle: followUpText ? 'normal' : 'italic',
              lineHeight: 1.5
            }}>
              {followUpText || 'No specific follow-up instructions were found in the uploaded document.'}
            </p>

            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: '#fffbeb',
              borderRadius: '6px',
              border: '1px solid #fde68a',
              fontSize: '11px',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertTriangle size={14} color="#b45309" />
              <span>Please consult your treating physician or visit your nearest Primary Health Centre (PHC) for prescription renewals and medical guidance.</span>
            </div>
          </div>

          {/* SECTION 9: ORIGINAL DOCUMENT & EXTRACTED TEXT (Collapsible) */}
          <div style={{ marginTop: '24px' }}>
            <button
              onClick={() => setShowOriginalDoc(!showOriginalDoc)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: showOriginalDoc ? '10px 10px 0 0' : '10px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} color="#0f766e" />
                Original Document & Extracted Text
              </span>
              {showOriginalDoc ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showOriginalDoc && (
              <div style={{
                padding: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderTop: 'none',
                borderRadius: '0 0 10px 10px',
                display: 'grid',
                gridTemplateColumns: capturedImageUrl ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
                gap: '16px'
              }}>
                {/* Document Preview Image */}
                {capturedImageUrl && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                      Captured Source Document
                    </div>
                    <div style={{
                      maxHeight: '360px',
                      overflow: 'auto',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={capturedImageUrl}
                        alt="Scanned Medical Document"
                        style={{ maxWidth: '100%', maxHeight: '340px', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                )}

                {/* Raw Extracted OCR Text */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                      Extracted Text Content (OCR)
                    </span>
                    {rawOcrText && (
                      <button
                        onClick={handleCopyOcr}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#f8fafc',
                          cursor: 'pointer',
                          color: '#334155'
                        }}
                      >
                        {copiedText ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                      </button>
                    )}
                  </div>

                  <div style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5
                  }}>
                    {rawOcrText || scanResult.keyFindings.join('\n') || 'No raw OCR stream available for this document.'}
                  </div>

                  {/* Raw JSON Debug Inspector (Admin/Developer use) */}
                  <div style={{ marginTop: '10px' }}>
                    <button
                      onClick={() => setShowRawJson(!showRawJson)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '11px',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'underline'
                      }}
                    >
                      <FileCode size={12} />
                      <span>{showRawJson ? 'Hide Raw JSON Data' : 'Inspect Raw JSON Data'}</span>
                    </button>

                    {showRawJson && (
                      <pre style={{
                        marginTop: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        padding: '10px',
                        backgroundColor: '#0f172a',
                        color: '#38bdf8',
                        borderRadius: '6px',
                        fontSize: '11px',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {JSON.stringify(backendResult || scanResult, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* REPORT FOOTER SIGNATURE & DISCLAIMER */}
        <div style={{
          padding: '16px 28px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Report Generated by <strong>GramCare AI Multispeciality Diagnostic Engine</strong>
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
              Rural Healthcare Suite • ISO/IEC 27001 & Commercial Privacy Compliant Architecture
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
              Laboratory Services Unit
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              GramCare Rural Medical Centre
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 10: PROFESSIONAL ACTION BUTTONS */}
      <div className="no-print" style={{
        marginTop: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <button
          onClick={onScanAnother}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 20px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            backgroundColor: '#ffffff',
            color: '#334155',
            border: '1.5px solid #cbd5e1',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <RotateCcw size={16} />
          <span>Scan Another Document</span>
        </button>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownloadPdf}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 20px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: '#f0fdf4',
              color: '#0f766e',
              border: '1.5px solid #0f766e',
              cursor: 'pointer'
            }}
          >
            <Download size={16} />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaved || saveLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 24px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: isSaved ? '#16a34a' : '#0f766e',
              color: '#ffffff',
              border: 'none',
              cursor: isSaved || saveLoading ? 'default' : 'pointer',
              boxShadow: '0 2px 6px rgba(15,118,110,0.25)',
              opacity: saveLoading ? 0.7 : 1,
              transition: 'background-color 0.2s ease'
            }}
          >
            {isSaved ? (
              <>
                <CheckCircle2 size={16} />
                <span>Saved to Health Records</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{saveLoading ? 'Saving...' : 'Save to Health Records'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
