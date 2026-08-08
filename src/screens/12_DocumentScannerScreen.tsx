import React, { useState } from 'react';
import { ScanLine, Camera, Upload, CheckCircle2, Loader2, Save, WifiOff, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { analyzeDocumentBackend } from '../services/api';
import { DocumentScanResult } from '../types/records';
import { PrimaryButton } from '../components/Common/PrimaryButton';
import { SecondaryButton } from '../components/Common/SecondaryButton';

interface DocumentScannerScreenProps {
  activePatientName: string;
  onSaveRecord: (scanResult: DocumentScanResult) => void;
}

export const DocumentScannerScreen: React.FC<DocumentScannerScreenProps> = ({
  activePatientName,
  onSaveRecord
}) => {
  const { lang, t } = useLanguage();
  const { isOnline, backendStatus, isBackendAvailable } = useOnlineStatus();
  const [docType, setDocType] = useState<'Prescription' | 'Medical Report' | 'Health Record'>('Prescription');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<DocumentScanResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  const isFeatureAvailable = isOnline && isBackendAvailable;

  const handleStartScan = async () => {
    if (!isOnline || !isBackendAvailable) return;
    setError(null);
    setIsScanning(true);
    try {
      const backendScan = await analyzeDocumentBackend(docType, activePatientName);
      if (backendScan) {
        setScanResult(backendScan);
      } else {
        setError(
          lang === 'te'
            ? 'కొన్ని ఆన్‌లైన్ సేవలు అందుబాటులో లేవు. దయచేసి కొద్దిసేపటి తర్వాత మళ్ళీ ప్రయత్నించండి.'
            : 'Some online services unavailable. Please try again shortly.'
        );
      }
    } catch {
      setError(
        lang === 'te'
          ? 'కొన్ని ఆన్‌లైన్ సేవలు అందుబాటులో లేవు. దయచేసి కొద్దిసేపటి తర్వాత మళ్ళీ ప్రయత్నించండి.'
          : 'Some online services unavailable. Please try again shortly.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div>
      {/* Title Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <ScanLine size={24} />
          {t.scannerTitle}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Document scanner for prescriptions and pathology lab reports.
        </p>
      </div>

      {/* State C: Offline Status Notice */}
      {!isOnline && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1.5px solid #fca5a5',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <WifiOff size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#991b1b', fontWeight: 700 }}>
              {lang === 'te' ? 'మీరు ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు' : "You're Currently Offline"}
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#b91c1c', lineHeight: 1.4 }}>
              {lang === 'te'
                ? 'మెడికల్ డాక్యుమెంట్ AI విశ్లేషణ కోసం ఇంటర్నెట్ కనెక్షన్ అవసరం. అత్యవసర మరియు ప్రాథమిక చికిత్స ఫీచర్లు అందుబాటులో ఉన్నాయి.'
                : 'Connect to the internet to use GramCare document scanner. Offline emergency and first-aid tools remain available.'}
            </p>
          </div>
        </div>
      )}

      {/* State B: Service UNREACHABLE Notice */}
      {isOnline && backendStatus === 'UNREACHABLE' && (
        <div style={{
          backgroundColor: '#fff7ed',
          border: '1.5px solid #fed7aa',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertTriangle size={22} color="#c2410c" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#9a3412', fontWeight: 700 }}>
              {lang === 'te' ? 'కొన్ని ఆన్‌లైన్ సేవలు అందుబాటులో లేవు' : 'Some Online Services Unavailable'}
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#c2410c', lineHeight: 1.4 }}>
              {lang === 'te'
                ? 'కొన్ని ఆన్‌లైన్ సేవలు అందుబాటులో లేవు. దయచేసి కొద్దిసేపటి తర్వాత మళ్ళీ ప్రయత్నించండి.'
                : 'GramCare backend service is currently unreachable. Offline features remain available.'}
            </p>
          </div>
        </div>
      )}

      {error && isOnline && isBackendAvailable && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1.5px solid #fca5a5',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#991b1b'
        }}>
          {error}
        </div>
      )}

      {scanResult ? (
        /* Extracted Information View */
        <div className="card" style={{ border: '2px solid #0f766e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <CheckCircle2 size={24} color="#16a34a" />
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0f766e' }}>
              {t.extractedInfoTitle}
            </h3>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
              Document Type: <strong>{scanResult.docType}</strong>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
              Extracted Patient: <strong>{scanResult.extractedPatientName}</strong>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Issued by: <strong>{scanResult.doctorOrLabName}</strong> ({scanResult.date})
            </div>
          </div>

          <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1e293b' }}>
            Key Medical Findings:
          </h4>
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px 0', fontSize: '14px', color: '#334155' }}>
            {scanResult.keyFindings.map((finding, idx) => (
              <li key={idx} style={{ marginBottom: '6px' }}>{finding}</li>
            ))}
          </ul>

          {scanResult.medicationsMentioned && scanResult.medicationsMentioned.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#0f766e' }}>
                Medications Identified:
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {scanResult.medicationsMentioned.map((med, idx) => (
                  <span key={idx} className="badge badge-low" style={{ fontSize: '12px' }}>
                    {med}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <PrimaryButton
              onClick={() => {
                onSaveRecord(scanResult);
                setScanResult(null);
              }}
            >
              <Save size={16} />
              <span>Save Record</span>
            </PrimaryButton>
            <SecondaryButton onClick={() => setScanResult(null)}>
              Scan Another
            </SecondaryButton>
          </div>
        </div>
      ) : (
        /* Capture & Select View */
        <div className="card">
          <label className="form-label">Select Document Type:</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {(['Prescription', 'Medical Report', 'Health Record'] as const).map((type) => (
              <button
                key={type}
                type="button"
                disabled={!isFeatureAvailable}
                onClick={() => setDocType(type)}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: `1.5px solid ${docType === type ? '#0f766e' : '#cbd5e1'}`,
                  backgroundColor: docType === type ? '#f0fdf4' : '#ffffff',
                  color: docType === type ? '#0f766e' : '#475569',
                  fontWeight: docType === type ? 700 : 500,
                  fontSize: '12px',
                  cursor: isFeatureAvailable ? 'pointer' : 'not-allowed'
                }}
              >
                {type}
              </button>
            ))}
          </div>

          <div style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '30px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            marginBottom: '16px'
          }}>
            <div style={{
              backgroundColor: '#e2e8f0',
              color: '#475569',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <Camera size={28} />
            </div>
            <p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600, color: '#334155' }}>
              Capture Prescription or Report Photo
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Supported formats: JPG, PNG, PDF document scans
            </p>
          </div>

          {isScanning ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#0f766e' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                GramCare Medical Document AI is analyzing document...
              </p>
            </div>
          ) : (
            <PrimaryButton
              disabled={!isFeatureAvailable}
              onClick={handleStartScan}
            >
              <Upload size={16} />
              <span>{isFeatureAvailable ? 'Scan Document Now' : 'Scan Unavailable Offline'}</span>
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );
};
