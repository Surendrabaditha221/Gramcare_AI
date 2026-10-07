/**
 * GramCare AI — Multispeciality Hospital Report PDF Generator
 * Uses jsPDF to generate a structured, vector-crisp clinical laboratory report.
 */
import { jsPDF } from 'jspdf';
import { DocumentScanResult, LabTestPanel } from '../types/records';

export function generateHospitalReportPdf(
  scanResult: DocumentScanResult,
  activePatientProfile?: {
    name?: string;
    age?: number | string;
    gender?: string;
    patientId?: string;
    phone?: string;
  }
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 16) {
      doc.addPage();
      cursorY = margin;
      drawMiniHeader();
    }
  };

  const drawMiniHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 118, 110); // Teal
    doc.text('GRAMCARE MULTISPECIALITY HOSPITAL', margin, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Clinical Laboratory Report (Contd.)', pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 4;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 6;
  };

  // 1. HOSPITAL BANNER HEADER
  doc.setFillColor(15, 118, 110); // #0f766e Primary Teal
  doc.rect(margin, cursorY, contentWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAMCARE MULTISPECIALITY HOSPITAL', margin + 6, cursorY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(204, 251, 241); // Soft mint/teal light
  doc.text('Rural Healthcare Suite | Diagnostic & Laboratory Medicine Services', margin + 6, cursorY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const statusLabel = scanResult.reportDetails?.status || 'FINAL REPORT';
  doc.text(statusLabel.toUpperCase(), pageWidth - margin - 6, cursorY + 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text('AI-Assisted Document Extraction', pageWidth - margin - 6, cursorY + 14, { align: 'right' });

  cursorY += 26;

  // 2. REPORT METADATA & PATIENT INFORMATION CARD
  const patientName =
    scanResult.patientDetails?.name ||
    scanResult.extractedPatientName ||
    activePatientProfile?.name ||
    'Not Available';

  const patientId =
    scanResult.patientDetails?.patientId ||
    activePatientProfile?.patientId ||
    'Not Available';

  const age =
    scanResult.patientDetails?.age ||
    activePatientProfile?.age ||
    'Not Available';

  const gender =
    scanResult.patientDetails?.gender ||
    activePatientProfile?.gender ||
    'Not Available';

  const referringDoctor =
    scanResult.patientDetails?.referringDoctor ||
    scanResult.doctorOrLabName ||
    'Not Available';

  const department =
    scanResult.reportDetails?.department ||
    scanResult.patientDetails?.department ||
    (scanResult.docType === 'Prescription' ? 'General Medicine' : 'Clinical Pathology');

  const reportId =
    scanResult.reportDetails?.reportId ||
    scanResult.id ||
    `GCH-LAB-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  const collectionDate =
    scanResult.reportDetails?.collectionDate ||
    scanResult.date ||
    'Not Available';

  const reportDate =
    scanResult.reportDetails?.reportDate ||
    scanResult.date ||
    new Date().toISOString().split('T')[0];

  const specimenType =
    scanResult.reportDetails?.specimenType ||
    'Not Available';

  // Draw 2-column info box
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, cursorY, contentWidth, 38, 2, 2, 'FD');

  const col1X = margin + 4;
  const col2X = margin + contentWidth / 2 + 4;
  let infoY = cursorY + 6;

  const drawInfoRow = (x: number, y: number, label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(value, x + 34, y);
  };

  drawInfoRow(col1X, infoY, 'Patient Name:', patientName);
  drawInfoRow(col2X, infoY, 'Report ID:', reportId);
  infoY += 6;

  drawInfoRow(col1X, infoY, 'Age / Gender:', `${age} / ${gender}`);
  drawInfoRow(col2X, infoY, 'Report Date:', reportDate);
  infoY += 6;

  drawInfoRow(col1X, infoY, 'Patient ID / Reg:', patientId);
  drawInfoRow(col2X, infoY, 'Collection Date:', collectionDate);
  infoY += 6;

  drawInfoRow(col1X, infoY, 'Ref. Doctor:', referringDoctor);
  drawInfoRow(col2X, infoY, 'Specimen Type:', specimenType);
  infoY += 6;

  drawInfoRow(col1X, infoY, 'Department:', department);
  drawInfoRow(col2X, infoY, 'Document Type:', scanResult.docType);

  cursorY += 43;

  // 3. ABNORMAL ALERTS HIGHLIGHT BAR (If present)
  const abnormalAlerts = scanResult.abnormalAlerts || [];
  if (abnormalAlerts.length > 0) {
    checkPageBreak(24);
    doc.setFillColor(254, 242, 242); // #fef2f2 soft red
    doc.setDrawColor(252, 165, 165); // #fca5a5
    doc.roundedRect(margin, cursorY, contentWidth, 14 + abnormalAlerts.length * 5, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(185, 28, 28); // #b91c1c
    doc.text('ABNORMAL LABORATORY FINDINGS REQUIRING ATTENTION:', margin + 4, cursorY + 5);

    let alertY = cursorY + 10;
    abnormalAlerts.forEach((alert) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(153, 27, 27);
      doc.text(
        `• ${alert.testName}: ${alert.result} ${alert.unit || ''} (Reference: ${alert.referenceRange || 'Not Provided'}) [Flag: ${alert.status}]`,
        margin + 6,
        alertY
      );
      alertY += 5;
    });

    cursorY += 18 + abnormalAlerts.length * 5;
  }

  // 4. STRUCTURED LABORATORY TEST TABLES
  const panels: LabTestPanel[] = scanResult.testPanels && scanResult.testPanels.length > 0
    ? scanResult.testPanels
    : [];

  if (panels.length > 0) {
    panels.forEach((panel) => {
      checkPageBreak(24);

      // Panel Header
      doc.setFillColor(240, 253, 250); // #f0fdfa soft teal
      doc.setDrawColor(204, 251, 241);
      doc.roundedRect(margin, cursorY, contentWidth, 7, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 118, 110);
      doc.text(panel.panelName.toUpperCase(), margin + 4, cursorY + 5);
      cursorY += 9;

      // Table Header Row
      doc.setFillColor(241, 245, 249); // #f1f5f9
      doc.rect(margin, cursorY, contentWidth, 6, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      const colTestW = contentWidth * 0.38;
      const colResultW = contentWidth * 0.18;
      const colUnitW = contentWidth * 0.14;
      const colRangeW = contentWidth * 0.18;
      const colStatusW = contentWidth * 0.12;

      let tableColX = margin + 3;
      doc.text('TEST NAME', tableColX, cursorY + 4.2);
      tableColX += colTestW;
      doc.text('RESULT', tableColX, cursorY + 4.2);
      tableColX += colResultW;
      doc.text('UNIT', tableColX, cursorY + 4.2);
      tableColX += colUnitW;
      doc.text('REFERENCE RANGE', tableColX, cursorY + 4.2);
      tableColX += colRangeW;
      doc.text('STATUS', tableColX, cursorY + 4.2);

      cursorY += 7;

      // Rows
      panel.results.forEach((test, idx) => {
        checkPageBreak(7);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, cursorY - 1, contentWidth, 6, 'F');
        }

        let rowX = margin + 3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        // Test Name
        const truncatedTestName = test.testName.length > 36 ? `${test.testName.slice(0, 34)}...` : test.testName;
        doc.text(truncatedTestName, rowX, cursorY + 3.5);
        rowX += colTestW;

        // Result (bold if abnormal)
        const isAbnormal = test.status === 'High' || test.status === 'Low' || test.status === 'Abnormal';
        if (isAbnormal) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(185, 28, 28);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
        }
        doc.text(test.result, rowX, cursorY + 3.5);
        rowX += colResultW;

        // Unit
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(test.unit || '-', rowX, cursorY + 3.5);
        rowX += colUnitW;

        // Reference range
        doc.text(test.referenceRange || 'Not Provided', rowX, cursorY + 3.5);
        rowX += colRangeW;

        // Status badge text
        if (test.status === 'High') {
          doc.setTextColor(180, 83, 9); // Amber
          doc.text('High', rowX, cursorY + 3.5);
        } else if (test.status === 'Low') {
          doc.setTextColor(180, 83, 9);
          doc.text('Low', rowX, cursorY + 3.5);
        } else if (test.status === 'Normal') {
          doc.setTextColor(22, 101, 52); // Green
          doc.text('Normal', rowX, cursorY + 3.5);
        } else {
          doc.setTextColor(100, 116, 139);
          doc.text(test.status || '-', rowX, cursorY + 3.5);
        }

        cursorY += 6;
      });

      cursorY += 4;
    });
  } else if (scanResult.keyFindings && scanResult.keyFindings.length > 0) {
    // Fallback: Structured Key Findings section
    checkPageBreak(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 118, 110);
    doc.text('EXTRACTED CLINICAL FINDINGS', margin, cursorY);
    cursorY += 5;

    scanResult.keyFindings.forEach((finding) => {
      checkPageBreak(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const splitFinding = doc.splitTextToSize(`• ${finding}`, contentWidth - 4);
      doc.text(splitFinding, margin + 2, cursorY);
      cursorY += splitFinding.length * 4.5;
    });

    cursorY += 4;
  }

  // 5. RADIOLOGY / NARRATIVE SECTIONS (if present)
  if (scanResult.narrativeSections && scanResult.narrativeSections.length > 0) {
    scanResult.narrativeSections.forEach((section) => {
      checkPageBreak(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 118, 110);
      doc.text(section.modalityOrExam || 'CLINICAL EXAMINATION / RADIOLOGY', margin, cursorY);
      cursorY += 5;

      if (section.clinicalHistory) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text('Indication:', margin + 2, cursorY);
        doc.setFont('helvetica', 'normal');
        doc.text(section.clinicalHistory, margin + 22, cursorY);
        cursorY += 5;
      }

      const findingsList = Array.isArray(section.findings)
        ? section.findings
        : (section.findings ? [String(section.findings)] : []);

      if (findingsList.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text('Findings:', margin + 2, cursorY);
        cursorY += 4;
        findingsList.forEach((f: string) => {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          const split = doc.splitTextToSize(`- ${f}`, contentWidth - 8);
          doc.text(split, margin + 4, cursorY);
          cursorY += split.length * 4.2;
        });
      }

      if (section.impression) {
        cursorY += 2;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, cursorY, contentWidth, 12, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 118, 110);
        doc.text('IMPRESSION:', margin + 4, cursorY + 5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(section.impression, margin + 28, cursorY + 5);
        cursorY += 15;
      }
    });
  }

  // 6. MEDICATIONS MENTIONED (if Prescription)
  if (scanResult.medicationsMentioned && scanResult.medicationsMentioned.length > 0) {
    checkPageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 118, 110);
    doc.text('MEDICATIONS IDENTIFIED IN DOCUMENT', margin, cursorY);
    cursorY += 5;

    scanResult.medicationsMentioned.forEach((med) => {
      checkPageBreak(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(`℞  ${med}`, margin + 4, cursorY);
      cursorY += 5;
    });

    cursorY += 4;
  }

  // 7. AI-EXTRACTED SUMMARY
  if (scanResult.aiSummary) {
    checkPageBreak(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 118, 110);
    doc.text('AI-EXTRACTED CLINICAL SUMMARY', margin, cursorY);
    cursorY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const summaryLines = doc.splitTextToSize(scanResult.aiSummary, contentWidth);
    doc.text(summaryLines, margin, cursorY);
    cursorY += summaryLines.length * 4.2 + 4;
  }

  // 8. FOLLOW-UP INSTRUCTIONS
  checkPageBreak(18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('FOLLOW-UP INSTRUCTIONS', margin, cursorY);
  cursorY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const instructions =
    scanResult.rawTextPreview ||
    'Please visit your nearest Primary Health Centre (PHC), Community Health Centre (CHC), or hospital for in-person medical evaluation.';
  const instructionLines = doc.splitTextToSize(instructions, contentWidth);
  doc.text(instructionLines, margin, cursorY);
  cursorY += instructionLines.length * 4.2 + 5;

  // 9. MANDATORY CLINICAL DISCLAIMER & FOOTER
  checkPageBreak(18);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 4;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  const disclaimer =
    'NOTICE: This document is an AI-assisted structured extraction generated by GramCare AI. Reference ranges may vary between accredited laboratories. This report does not constitute a clinical diagnosis or treatment prescription. Always consult a qualified medical practitioner at your local PHC/CHC or hospital.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
  doc.text(disclaimerLines, margin, cursorY);

  // Add Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `GramCare AI Health Suite — Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  const safeFilename = `GramCare_Report_${patientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(safeFilename);
}
