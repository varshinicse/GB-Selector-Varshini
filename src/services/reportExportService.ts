/**
 * MAGTORQ GB-Selector
 * Report Export Service
 * Generates structured PDF and Excel reports matching the MAGTORQ handbook format.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { EngineeringReport } from './engineeringReasoningEngine';
import { VerificationReport } from './verificationEngine';

// ─── Colour Palette ───────────────────────────────────────────────────────────
const BRAND_ORANGE: [number, number, number] = [255, 140, 0];
const SLATE_900:    [number, number, number] = [15,  23,  42];
const SLATE_700:    [number, number, number] = [51,  65,  85];
const SLATE_100:    [number, number, number] = [241, 245, 249];
const WHITE:        [number, number, number] = [255, 255, 255];
const GREEN:        [number, number, number] = [5,   150, 105];
const RED:          [number, number, number] = [220, 38,  38];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function typeColor(type: string): [number, number, number] {
  switch (type.toUpperCase()) {
    case 'EXTRACTED':  return [5, 150, 105];   // green
    case 'CALCULATED': return [37, 99, 235];   // blue
    case 'DERIVED':    return [124, 58, 237];  // purple
    case 'ENGINE_RULE': return [79, 70, 229];  // indigo
    case 'SUGGESTED':  return [217, 119, 6];   // amber
    case 'ASSUMED':    return [100, 116, 139];  // slate
    default:           return SLATE_700;
  }
}

// ─── PDF Export ──────────────────────────────────────────────────────────────
export function exportToPDF(
  report: EngineeringReport,
  verificationReport: VerificationReport,
  projectName: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  let y = margin;

  // ── Helper: section header ─────────────────────────────────────────────────
  const sectionHeader = (title: string) => {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFillColor(...SLATE_900);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text(title.toUpperCase(), margin + 3, y + 5);
    doc.setTextColor(...SLATE_900);
    y += 10;
  };

  // ── Helper: orange rule ────────────────────────────────────────────────────
  const orangeRule = () => {
    doc.setDrawColor(...BRAND_ORANGE);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + contentW, y);
    y += 3;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════════════

  // Logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...SLATE_900);
  doc.text('MAG', margin, y + 14);
  const magW = doc.getTextWidth('MAG');
  doc.setTextColor(...BRAND_ORANGE);
  doc.text('TORQ', margin + magW, y + 14);
  doc.setTextColor(...SLATE_700);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Planetary Gears Division  |  Engineering Selection & Design', margin, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Date: ${dateStr}`, pageW - margin, y + 14, { align: 'right' });
  doc.text(`Project Ref: ${projectName}`, pageW - margin, y + 20, { align: 'right' });
  y += 26;

  orangeRule();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...SLATE_900);
  doc.text('Engineering Selection & Calculation Audit Report', margin, y + 6);
  y += 12;

  // Verification score banner
  const score = verificationReport.overallScore;
  const scoreColor = score === 100 ? GREEN : score >= 75 ? [217, 119, 6] as [number, number, number] : RED;
  doc.setFillColor(...SLATE_100);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_700);
  doc.text('VERIFICATION SCORE', margin + 4, y + 7);
  doc.setFontSize(18);
  doc.setTextColor(...scoreColor);
  doc.text(`${score}/100`, margin + 4, y + 15);
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_700);
  doc.text(score === 100 ? '✓ ALL CHECKS PASSED' : score >= 75 ? '⚠ REVIEW RECOMMENDED' : '✗ CRITICAL FAILURES DETECTED',
    margin + 40, y + 11);
  y += 22;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Project Profile
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader('1. Project & Application Profile');
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [],
    body: [
      ['Project Name', projectName, 'Application Type', report.applicationType],
      ['Operating Duty', report.dutyType, 'Hours / Day', report.operatingHours],
      ['Load Characteristics', report.loadType, 'Environment', report.environment],
    ],
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: SLATE_700, fillColor: SLATE_100, cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', textColor: SLATE_700, fillColor: SLATE_100, cellWidth: 40 },
      3: { cellWidth: 55 },
    },
    theme: 'plain',
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Engineering Inputs Validation
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader('2. Engineering Inputs Validation');
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Input Component', 'Status', 'Validation Notes']],
    body: report.validation.items.map(v => [
      v.name,
      v.status.replace('✓', '✓').replace('⚠', '⚠').replace('❌', '✗'),
      v.message
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: SLATE_900, textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: contentW - 75 }
    },
    didDrawCell: (data: { column: { index: number }, cell: { text: string[], x: number, y: number, height: number }, section: string }) => {
      if (data.section === 'body' && data.column.index === 1) {
        const txt = data.cell.text[0] || '';
        const fg: [number, number, number] = txt.includes('✓') ? GREEN : txt.includes('⚠') ? [217, 119, 6] : RED;
        doc.setTextColor(...fg);
      }
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: SLATE_100 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Parameter Audit Trail
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader('3. Parameter Audit Trail & Classifications');

  const paramRows = [
    { node: report.powerKW,       label: 'Power (kW)',      display: `${report.powerKW.value} kW` },
    { node: report.motorHP,       label: 'Motor HP',        display: report.motorHP.value ? `${report.motorHP.value} HP` : 'N/A' },
    { node: report.motorPoles,    label: 'Motor Poles',     display: report.motorPoles.value ? `${report.motorPoles.value} Poles` : 'N/A' },
    { node: report.inputRPM,      label: 'Input Speed',     display: `${report.inputRPM.value} RPM` },
    { node: report.outputRPM,     label: 'Output Speed',    display: `${report.outputRPM.value?.toFixed(1)} RPM` },
    { node: report.totalRatio,    label: 'Total Ratio',     display: `${report.totalRatio.value?.toFixed(2)}:1` },
    { node: report.stages,        label: 'Stages',          display: `${report.stages.value} Reduction(s)` },
    { node: report.serviceFactor, label: 'Service Factor',  display: report.serviceFactor.value?.toFixed(2) },
  ];

  if (report.outputTorqueNm?.value) paramRows.push({ node: report.outputTorqueNm, label: 'Output Torque', display: `${Math.round(report.outputTorqueNm.value)} N·m` });
  if (report.rmsTorqueNm?.value) paramRows.push({ node: report.rmsTorqueNm, label: 'RMS Torque', display: `${Math.round(report.rmsTorqueNm.value)} N·m` });
  if (report.accelerationTorqueNm?.value) paramRows.push({ node: report.accelerationTorqueNm, label: 'Accel Torque', display: `${Math.round(report.accelerationTorqueNm.value)} N·m` });
  if (report.effectiveThermalPowerKW?.value) paramRows.push({ node: report.effectiveThermalPowerKW, label: 'Eff Thermal Power', display: `${report.effectiveThermalPowerKW.value.toFixed(2)} kW` });
  if (report.requiredLifeHours?.value) paramRows.push({ node: report.requiredLifeHours, label: 'Required Life', display: `${Math.round(report.requiredLifeHours.value).toLocaleString()} hrs` });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Parameter', 'Value', 'Classification', 'Source', 'Justification']],
    body: paramRows.map(p => [
      p.label, p.display, p.node.type, p.node.source, p.node.reasoning
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: SLATE_900, textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 35 },
      4: { cellWidth: contentW - 110 }
    },
    didDrawCell: (data: { column: { index: number }, cell: { text: string[], x: number, y: number, height: number, width: number }, section: string }) => {
      if (data.section === 'body' && data.column.index === 2) {
        const type = (data.cell.text[0] || '').toUpperCase();
        const [r, g, b] = typeColor(type);
        doc.setFillColor(r, g, b);
        doc.roundedRect(data.cell.x + 1, data.cell.y + 1.5, data.cell.width - 2, data.cell.height - 3, 1, 1, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(type, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
      }
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: SLATE_100 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE BREAK → SECTION 4 — Stage Limits
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = margin;

  sectionHeader('4. Stage Limit Sufficiency Matrix');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_700);
  doc.text(
    `Target Ratio: ${report.totalRatio.value?.toFixed(2)}:1  —  Evaluating MAGTORQ series S1, S2, S3, S4`,
    margin, y
  );
  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Stage Config', 'Calculation Steps (Max Ratio per Stage)', 'Max Ratio Limit', 'Sufficiency']],
    body: report.stageEvaluationTrace.details.map(d => [
      `${d.stages} Stage(s)`,
      d.calculationSteps,
      d.maxRatio.toString(),
      d.isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT'
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: SLATE_900, textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: contentW - 80 },
      2: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 27, halign: 'center', fontStyle: 'bold' }
    },
    didDrawCell: (data: { column: { index: number }, cell: { text: string[], x: number, y: number, height: number }, section: string }) => {
      if (data.section === 'body' && data.column.index === 3) {
        const isSuff = data.cell.text[0] === 'SUFFICIENT';
        doc.setTextColor(...(isSuff ? GREEN : RED));
      }
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: SLATE_100 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // formula box
  doc.setFillColor(...SLATE_100);
  doc.setDrawColor(...BRAND_ORANGE);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentW, 10, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_900);
  doc.text(
    `Minimum Stages Recommended = ${report.stageEvaluationTrace.minimumStagesRequired} Stage(s)  |  Confidence: High`,
    margin + 3, y + 6.5
  );
  y += 14;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — Drivetrain Torque Calculations
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader('5. Drivetrain Mechanical Torque Calculations');

  // Input torque formula box
  doc.setFillColor(...SLATE_100);
  doc.setDrawColor(...BRAND_ORANGE);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentW, 14, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_900);
  doc.text(`Tin = (Power × 60000) / (2 × π × InputRPM)`, margin + 3, y + 5.5);
  doc.text(report.inputTorque.calculationSteps, margin + 3, y + 11);
  y += 18;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Stage', 'Ratio', 'Output Speed', 'Torque Calculation Steps (Tout = Tin × Ratio × 0.97)', 'Nominal Torque', `Peak Torque (SF: ${report.serviceFactor.value?.toFixed(2)})`]],
    body: report.stageTraces.map(t => [
      `Stage ${t.stage}`,
      t.ratio.toFixed(2),
      `${t.speed.toFixed(1)} RPM`,
      t.torqueSteps,
      `${Math.round(t.nominalTorque).toLocaleString()} N·m`,
      `${Math.round(t.maxTorque).toLocaleString()} N·m`
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: SLATE_900, textColor: WHITE, fontSize: 6.5, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: contentW - 100 },
      4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 24, halign: 'center', fontStyle: 'bold' }
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: SLATE_100 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Gearbox Selection & Safety Audit
  // ═══════════════════════════════════════════════════════════════════════════
  if (y > 220) { doc.addPage(); y = margin; }
  sectionHeader('6. Gearbox Selection & Safety Factor Audit');

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Stage', 'Selected Gearbox', 'Nominal Capacity', 'Rated Capacity', 'SF = min(GBNom/Tout, GBRated/Tmax)', 'SF Value', 'Audit']],
    body: report.stageTraces.map(t => [
      `Stage ${t.stage}`,
      `MAGTORQ ${t.selectedGearbox.size} (S${t.selectedGearbox.series})`,
      `${t.selectedGearbox.nominal.toLocaleString()} N·m`,
      `${t.selectedGearbox.rated.toLocaleString()} N·m`,
      `${t.selectedGearbox.nominal}/${Math.round(t.nominalTorque)} = ${(t.selectedGearbox.nominal / t.nominalTorque).toFixed(2)}  |  ${t.selectedGearbox.rated}/${Math.round(t.maxTorque)} = ${(t.selectedGearbox.rated / t.maxTorque).toFixed(2)}`,
      t.safetyFactor.toFixed(2),
      t.safetyFactor >= 1.0 ? 'SAFE' : 'OVERLOADED'
    ]),
    styles: { fontSize: 6.5, cellPadding: 2 },
    headStyles: { fillColor: SLATE_900, textColor: WHITE, fontSize: 6, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: contentW - 120 },
      5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
    },
    didDrawCell: (data: { column: { index: number }, cell: { text: string[], x: number, y: number, height: number }, section: string }) => {
      if (data.section === 'body') {
        if (data.column.index === 5) {
          const sf = parseFloat(data.cell.text[0] || '0');
          doc.setTextColor(...(sf >= 1.0 ? GREEN : RED));
        }
        if (data.column.index === 6) {
          doc.setTextColor(...(data.cell.text[0] === 'SAFE' ? GREEN : RED));
        }
      }
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: SLATE_100 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7 — Verification Score & Recommendation
  // ═══════════════════════════════════════════════════════════════════════════
  if (y > 210) { doc.addPage(); y = margin; }
  sectionHeader('7. Verification Score & Engineering Recommendation');

  // Score card
  const checks = [
    verificationReport.formulaVerification,
    verificationReport.ratioVerification,
    verificationReport.torqueVerification,
    verificationReport.gearboxSelectionVerification,
    verificationReport.safetyFactorVerification,
    verificationReport.databaseVerification,
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Check', 'Result', 'Detail']],
    body: checks.map(c => [c.name, c.passed ? 'PASS' : 'FAIL', c.message.replace(/[✓❌]/g, '').trim()]),
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: SLATE_900, textColor: WHITE, fontSize: 7, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: contentW - 75 }
    },
    didDrawCell: (data: { column: { index: number }, cell: { text: string[], x: number, y: number, height: number }, section: string }) => {
      if (data.section === 'body' && data.column.index === 1) {
        doc.setTextColor(...(data.cell.text[0] === 'PASS' ? GREEN : RED));
      }
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: SLATE_100 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // Recommendation box
  const allSafe = report.stageTraces.every(t => t.safetyFactor >= 1.0);
  doc.setFillColor(...(allSafe ? [236, 253, 245] as [number, number, number] : [254, 242, 242] as [number, number, number]));
  doc.setDrawColor(...(allSafe ? GREEN : RED));
  doc.setLineWidth(0.5);
  const recLines = doc.splitTextToSize(report.finalRecommendation, contentW - 8);
  const recH = Math.max(16, recLines.length * 4 + 8);
  doc.roundedRect(margin, y, contentW, recH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...(allSafe ? GREEN : RED));
  doc.text(recLines, margin + 4, y + 6);
  y += recH + 8;

  // Signature footer
  if (y > 250) { doc.addPage(); y = margin; }
  doc.setDrawColor(...SLATE_700);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 12, margin + 70, y + 12);
  doc.line(pageW - margin - 70, y + 12, pageW - margin, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_700);
  doc.text('Prepared By: MAGTORQ Engineering Assistant', margin, y + 16);
  doc.text('Reviewed By: Lead Mechanical Design Engineer', pageW - margin - 70, y + 16);

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_700);
    doc.text(`Page ${i} of ${pageCount}  |  MAGTORQ Engineering Selection Report  |  ${dateStr}`,
      pageW / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
  }

  doc.save(`MAGTORQ_Report_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export function exportToExcel(
  report: EngineeringReport,
  verificationReport: VerificationReport,
  projectName: string
): void {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summaryData = [
    ['MAGTORQ Engineering Selection Report'],
    ['Project Name', projectName],
    ['Date', new Date().toLocaleDateString('en-GB')],
    ['Application Type', report.applicationType],
    ['Operating Duty', report.dutyType],
    ['Hours / Day', report.operatingHours],
    ['Load Type', report.loadType],
    ['Environment', report.environment],
    [],
    ['Verification Score', `${verificationReport.overallScore}/100`],
    ['Critical Failures', verificationReport.criticalFailures.length],
    ['Warnings', verificationReport.warnings.length],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Sheet 2: Parameter Audit Trail ────────────────────────────────────────
  const paramRows = [
    ['Parameter', 'Value', 'Classification', 'Source', 'Justification'],
    ['Power (kW)', `${report.powerKW.value} kW`, report.powerKW.type, report.powerKW.source, report.powerKW.reasoning],
    ['Motor HP', report.motorHP.value ? `${report.motorHP.value} HP` : 'N/A', report.motorHP.type, report.motorHP.source, report.motorHP.reasoning],
    ['Motor Poles', report.motorPoles.value ? `${report.motorPoles.value} Poles` : 'N/A', report.motorPoles.type, report.motorPoles.source, report.motorPoles.reasoning],
    ['Input Speed', `${report.inputRPM.value} RPM`, report.inputRPM.type, report.inputRPM.source, report.inputRPM.reasoning],
    ['Output Speed', `${report.outputRPM.value?.toFixed(1)} RPM`, report.outputRPM.type, report.outputRPM.source, report.outputRPM.reasoning],
    ['Total Ratio', `${report.totalRatio.value?.toFixed(2)}:1`, report.totalRatio.type, report.totalRatio.source, report.totalRatio.reasoning],
    ['Stages', `${report.stages.value}`, report.stages.type, report.stages.source, report.stages.reasoning],
    ['Service Factor', `${report.serviceFactor.value?.toFixed(2)}`, report.serviceFactor.type, report.serviceFactor.source, report.serviceFactor.reasoning],
  ];

  if (report.outputTorqueNm?.value) paramRows.push(['Output Torque', `${Math.round(report.outputTorqueNm.value)} N·m`, report.outputTorqueNm.type, report.outputTorqueNm.source, report.outputTorqueNm.reasoning]);
  if (report.rmsTorqueNm?.value) paramRows.push(['RMS Torque', `${Math.round(report.rmsTorqueNm.value)} N·m`, report.rmsTorqueNm.type, report.rmsTorqueNm.source, report.rmsTorqueNm.reasoning]);
  if (report.accelerationTorqueNm?.value) paramRows.push(['Accel Torque', `${Math.round(report.accelerationTorqueNm.value)} N·m`, report.accelerationTorqueNm.type, report.accelerationTorqueNm.source, report.accelerationTorqueNm.reasoning]);
  if (report.effectiveThermalPowerKW?.value) paramRows.push(['Eff Thermal Power', `${report.effectiveThermalPowerKW.value.toFixed(2)} kW`, report.effectiveThermalPowerKW.type, report.effectiveThermalPowerKW.source, report.effectiveThermalPowerKW.reasoning]);
  if (report.requiredLifeHours?.value) paramRows.push(['Required Life', `${Math.round(report.requiredLifeHours.value).toLocaleString()} hrs`, report.requiredLifeHours.type, report.requiredLifeHours.source, report.requiredLifeHours.reasoning]);

  const wsParams = XLSX.utils.aoa_to_sheet(paramRows);
  wsParams['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 35 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsParams, 'Parameter Audit');

  // ── Sheet 3: Drivetrain Calculations ──────────────────────────────────────
  const calcHeader = ['Stage', 'Stage Ratio', 'Output Speed (RPM)', 'Nominal Torque (N·m)', 'Peak Torque (N·m)', 'Selected Gearbox', 'Nominal Capacity (N·m)', 'Rated Capacity (N·m)', 'Safety Factor', 'Audit Result'];
  const calcBody = report.stageTraces.map(t => [
    `Stage ${t.stage}`,
    t.ratio.toFixed(2),
    t.speed.toFixed(1),
    Math.round(t.nominalTorque),
    Math.round(t.maxTorque),
    `MAGTORQ ${t.selectedGearbox.size} (S${t.selectedGearbox.series})`,
    t.selectedGearbox.nominal,
    t.selectedGearbox.rated,
    t.safetyFactor.toFixed(2),
    t.safetyFactor >= 1.0 ? 'SAFE' : 'OVERLOADED'
  ]);
  const wsCalc = XLSX.utils.aoa_to_sheet([calcHeader, ...calcBody]);
  wsCalc['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsCalc, 'Drivetrain Calcs');

  // ── Sheet 4: Verification Audit ───────────────────────────────────────────
  const verifHeader = ['Check Name', 'Calculation (Recomputed)', 'Original Value', 'Recomputed Value', 'Error %', 'Passed'];
  const verifBody = verificationReport.calculationsAudited.map(c => [
    c.name, '', c.original, c.recomputed, `${c.errorPct}%`, c.passed ? 'YES' : 'NO'
  ]);
  const wsVerif = XLSX.utils.aoa_to_sheet([verifHeader, ...verifBody]);
  wsVerif['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 10 }];

  // Append critical failures below
  if (verificationReport.criticalFailures.length > 0) {
    const startRow = verifBody.length + 3;
    XLSX.utils.sheet_add_aoa(wsVerif, [['CRITICAL FAILURES']], { origin: { r: startRow, c: 0 } });
    verificationReport.criticalFailures.forEach((f, i) => {
      XLSX.utils.sheet_add_aoa(wsVerif, [[f]], { origin: { r: startRow + 1 + i, c: 0 } });
    });
  }
  XLSX.utils.book_append_sheet(wb, wsVerif, 'Verification Audit');

  // ── Sheet 5: Stage Limits Matrix ─────────────────────────────────────────
  const limitsData = [
    ['Stage Configuration', 'Calculation Steps', 'Max Ratio Limit', 'Sufficiency'],
    ...report.stageEvaluationTrace.details.map(d => [
      `${d.stages} Stage(s)`,
      d.calculationSteps,
      d.maxRatio,
      d.isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT'
    ]),
    [],
    ['Minimum Stages Recommended', report.stageEvaluationTrace.minimumStagesRequired],
    ['Recommended Stages', report.stageEvaluationTrace.recommendedStages],
    ['Reasoning', report.stageEvaluationTrace.reasoning],
  ];
  const wsLimits = XLSX.utils.aoa_to_sheet(limitsData);
  wsLimits['!cols'] = [{ wch: 22 }, { wch: 45 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsLimits, 'Stage Limits');

  XLSX.writeFile(wb, `MAGTORQ_Report_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
