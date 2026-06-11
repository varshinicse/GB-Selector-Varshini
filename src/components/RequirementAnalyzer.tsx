import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, FileText, Sparkles, Check, ArrowRight, Cpu, 
  RotateCcw, Info, Settings, CheckCircle, Database,
  AlertTriangle, Shield, Clipboard, FileDown, Eye, Image, Sheet
} from 'lucide-react';
import { ProjectInput } from '../types/ProjectInput';
import { extractTextFromFile } from '../services/aiRequirementAnalyzer';
import { analyzeRequirement, ExtractionResult } from '../api/requirementAnalyzerApi';
import { 
  generateAuditReport, 
  seriesLimits, 
  EngineeringReport
} from '../services/engineeringReasoningEngine';
import { 
  verifyEngineeringReport, 
  VerificationReport 
} from '../services/verificationEngine';
import { ExtractionReviewPanel } from './ExtractionReviewPanel';
import { exportToPDF, exportToExcel } from '../services/reportExportService';

interface RequirementAnalyzerProps {
  onAutoFill: (extractedValues: Partial<ProjectInput>) => void;
  onReportsReady?: (report: EngineeringReport, verification: VerificationReport, projectName: string) => void;
}

export const RequirementAnalyzer: React.FC<RequirementAnalyzerProps> = ({ onAutoFill, onReportsReady }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [reasoningResult, setReasoningResult] = useState<EngineeringReport | null>(null);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const [activeTab, setActiveTab] = useState<'rec' | 'validation' | 'params' | 'trace' | 'limits' | 'verification'>('rec');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accordion state for calculation steps
  const [expandedAccordion, setExpandedAccordion] = useState<Record<string, boolean>>({
    step1: true,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
    step6: false,
    step7: false
  });

  const toggleAccordion = (step: string) => {
    setExpandedAccordion(prev => ({
      ...prev,
      [step]: !prev[step]
    }));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (file) {
      setFile(null);
      setUploadStatus('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      await processSelectedFile(selectedFile);
    }
  };

  const processSelectedFile = async (selectedFile: File) => {
    const allowedTypes = ['.txt', '.pdf', '.docx', '.jpg', '.jpeg', '.png', '.bmp', '.tiff'];
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
      alert('Please upload a valid file format (.txt, .pdf, .docx, .jpg, .jpeg, .png)');
      return;
    }

    setFile(selectedFile);
    setText('');
    setReasoningResult(null);
    setVerificationReport(null);
    setShowReviewPanel(false);
    const isImage = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'].includes(fileExt);
    setUploadStatus(isImage
      ? 'Image uploaded. Click "Analyze & Design Drive" for AI visual extraction.'
      : 'File uploaded. Click "Analyze & Design Drive" to extract.');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      await processSelectedFile(droppedFile);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const timeoutPromise = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout"));
      }, ms);
      promise.then(
        (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleAnalyze = async () => {
    let sourceText = text;
    let fileBase64: string | null = null;
    let fileMime: string | null = null;

    if (file) {
      setLoading(true);
      setUploadStatus("Extracting raw text from file...");
      try {
        sourceText = await extractTextFromFile(file);
        setUploadStatus("File text extracted. Reading binary data...");
      } catch (err) {
        console.warn("Client-side text extraction failed, proceeding with visual/multimodal analysis...", err);
        sourceText = "";
        setUploadStatus("No readable text found. Reading binary data for visual analysis...");
      }
      try {
        fileBase64 = await getBase64(file);
        fileMime = file.type || 'application/pdf';
        setUploadStatus("File read successfully. Process starting...");
      } catch (err) {
        console.error(err);
        const errMsg = err instanceof Error ? err.message : String(err);
        alert(`Failed to read file binary: ${errMsg}`);
        setLoading(false);
        return;
      }
    }

    if (!sourceText.trim() && !fileBase64) {
      alert("Please enter a description or upload a specifications document.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setReasoningResult(null);
    setVerificationReport(null);
    
    try {
      let result: ExtractionResult;
      try {
        // Give Gemini longer timeout (8 seconds) if a PDF file is uploaded directly to allow multimodal processing
        const timeoutMs = file ? 8000 : 3500;
        result = await timeoutPromise(analyzeRequirement(sourceText, fileBase64, fileMime), timeoutMs);
      } catch (apiError) {
        console.warn("AI extraction endpoint failed, timed out, or unavailable. Falling back to local rules engine...", apiError);
        result = {
          projectName: 'Local Engine Resolution',
          powerKW: null,
          inputRPM: null,
          outputRPM: null,
          targetRatio: null,
          applicationType: null,
          serviceFactor: null,
          numberOfStages: null
        };
      }
      
      const solution = generateAuditReport(sourceText, result);
      const verification = verifyEngineeringReport(solution, result);
      setReasoningResult(solution);
      setVerificationReport(verification);
      setActiveTab('rec');
      setShowReviewPanel(true);
      if (file) {
        setUploadStatus('Engineering solution generated successfully!');
      }

      // Notify parent (GearboxSelector) so the Audit Dashboard tab gets populated
      if (onReportsReady) {
        onReportsReady(solution, verification, solution.projectName);
      }

      // Auto-fill the form when there are no critical failures
      if (verification.criticalFailures.length === 0) {
        onAutoFill({
          projectName: solution.projectName,
          powerKW: solution.powerKW.value,
          inputRPM: solution.inputRPM.value,
          totalRatio: solution.totalRatio.value,
          serviceFactor: solution.serviceFactor.value,
          stages: solution.stages.value,
        });
      }
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : String(error);
      alert(`Engineering Reasoning failed: ${errMsg}`);
      if (file) {
        setUploadStatus("Engineering solution failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setText('');
    setFile(null);
    setUploadStatus('');
    setReasoningResult(null);
    setVerificationReport(null);
    setShowReviewPanel(false);
  };

  const handleAutoFillClick = () => {
    if (reasoningResult) {
      if (verificationReport && verificationReport.criticalFailures.length > 0) {
        alert("Action blocked: This drivetrain configuration has failed engineering verification checks. Please check the Verification tab for details.");
        return;
      }
      
      const valuesToFill: Partial<ProjectInput> = {
        projectName: reasoningResult.projectName
      };
      
      if (reasoningResult.powerKW.value !== null && reasoningResult.powerKW.value !== undefined && !isNaN(reasoningResult.powerKW.value)) {
        valuesToFill.powerKW = reasoningResult.powerKW.value;
      }
      if (reasoningResult.inputRPM.value !== null && reasoningResult.inputRPM.value !== undefined && !isNaN(reasoningResult.inputRPM.value)) {
        valuesToFill.inputRPM = reasoningResult.inputRPM.value;
      }
      if (reasoningResult.totalRatio.value !== null && reasoningResult.totalRatio.value !== undefined && !isNaN(reasoningResult.totalRatio.value)) {
        valuesToFill.totalRatio = reasoningResult.totalRatio.value;
      }
      if (reasoningResult.serviceFactor.value !== null && reasoningResult.serviceFactor.value !== undefined && !isNaN(reasoningResult.serviceFactor.value)) {
        valuesToFill.serviceFactor = reasoningResult.serviceFactor.value;
      }
      if (reasoningResult.stages.value !== null && reasoningResult.stages.value !== undefined && !isNaN(reasoningResult.stages.value)) {
        valuesToFill.stages = reasoningResult.stages.value;
      }
      
      onAutoFill(valuesToFill);
    }
  };

  // PDF export via jsPDF
  const handleExportPDF = () => {
    if (!reasoningResult || !verificationReport) return;
    exportToPDF(reasoningResult, verificationReport, reasoningResult.projectName || 'MAGTORQ Project');
  };

  // Excel export via SheetJS
  const handleExportExcel = () => {
    if (!reasoningResult || !verificationReport) return;
    exportToExcel(reasoningResult, verificationReport, reasoningResult.projectName || 'MAGTORQ Project');
  };

  // Legacy browser-print (kept for reference, not exposed in UI)
  const exportAuditReport = () => {
    if (!reasoningResult) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup blocked! Please allow popups for this page to view the engineering report.");
      return;
    }

    const {
      projectName, applicationType, dutyType, operatingHours, loadType, environment,
      powerKW, motorHP, motorPoles, inputRPM, outputRPM, totalRatio, stages, serviceFactor,
      stageEvaluationTrace, inputTorque, stageTraces, finalRecommendation, validation
    } = reasoningResult;

    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MAGTORQ Calculation Audit Report - ${projectName}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 40px; background-color: #ffffff; }
          .header { border-bottom: 3px solid #ff8c00; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo { font-size: 24px; font-weight: 900; color: #0f172a; tracking-wide: 1px; }
          .logo span { color: #ff8c00; }
          .header-info { text-align: right; font-size: 11px; color: #64748b; font-weight: 600; line-height: 1.4; }
          h1 { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          h2 { font-size: 13px; font-weight: 800; color: #ff8c00; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 30px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-size: 12px; }
          .meta-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
          .meta-item:last-child { border-bottom: none; }
          .meta-label { font-weight: 700; color: #475569; }
          .meta-val { font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; page-break-inside: avoid; }
          th { background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
          td { border: 1px solid #cbd5e1; padding: 8px 10px; color: #334155; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .formula-box { background: #f1f5f9; border-left: 4px solid #ff8c00; padding: 10px 15px; font-family: monospace; font-size: 11px; margin: 10px 0; border-radius: 0 6px 6px 0; font-weight: bold; color: #0f172a; page-break-inside: avoid; }
          .recommendation-box { border: 2px solid #10b981; background: #ecfdf5; border-radius: 8px; padding: 15px; font-size: 12px; color: #065f46; font-weight: 500; margin-top: 25px; page-break-inside: avoid; line-height: 1.6; }
          .footer-signature { display: flex; justify-content: space-between; margin-top: 60px; font-size: 10px; color: #64748b; font-weight: bold; page-break-inside: avoid; }
          .sig-box { width: 220px; text-align: center; }
          .sig-line { border-top: 1px solid #94a3b8; margin-bottom: 5px; }
          .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: 800; border-radius: 4px; text-transform: uppercase; }
          .badge-extracted { background-color: #d1fae5; color: #065f46; }
          .badge-suggested { background-color: #fef3c7; color: #92400e; }
          .badge-calculated { background-color: #dbeafe; color: #1e40af; }
          .badge-derived { background-color: #f3e8ff; color: #6b21a8; }
          .badge-assumed { background-color: #f1f5f9; color: #475569; }
          .badge-valid { background-color: #d1fae5; color: #065f46; border: 1px solid #10b981; }
          .badge-missing { background-color: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
          @media print {
            body { padding: 0; font-size: 10pt; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MAG<span>TORQ</span></div>
          <div class="header-info">
            MAGTORQ Planetary Gears Division<br/>
            Engineering Selection & Design Department<br/>
            Date: ${dateStr}<br/>
            Project Ref: ${projectName.replace(/[^a-zA-Z0-9\s]/g, '')}
          </div>
        </div>

        <h1>Engineering Selection & Calculation Audit Report</h1>
        
        <h2>1. Project & Application Profile</h2>
        <div class="meta-grid">
          <div>
            <div class="meta-item"><span class="meta-label">Project Name:</span><span class="meta-val">${projectName}</span></div>
            <div class="meta-item"><span class="meta-label">Application Type:</span><span class="meta-val">${applicationType}</span></div>
            <div class="meta-item"><span class="meta-label">Operating Duty:</span><span class="meta-val">${dutyType}</span></div>
          </div>
          <div>
            <div class="meta-item"><span class="meta-label">Hours of Operation:</span><span class="meta-val">${operatingHours}</span></div>
            <div class="meta-item"><span class="meta-label">Load Characteristics:</span><span class="meta-val">${loadType}</span></div>
            <div class="meta-item"><span class="meta-label">Environment:</span><span class="meta-val">${environment}</span></div>
          </div>
        </div>

        <h2>2. Engineering Inputs Validation</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 40%">Input Component</th>
              <th style="width: 25%; text-align: center;">Status</th>
              <th style="width: 35%">Validation Notes</th>
            </tr>
          </thead>
          <tbody>
            ${validation.items.map(v => `
              <tr>
                <td><strong>${v.name}</strong></td>
                <td style="text-align: center;">
                  <span class="badge ${v.status.includes('Valid') ? 'badge-valid' : 'badge-missing'}">
                    ${v.status}
                  </span>
                </td>
                <td>${v.message}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>3. Parameter Audit Trail & Classifications</h2>
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Derived Value</th>
              <th>Classification</th>
              <th>Source Reference</th>
              <th>Engineering Justification</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Power</strong></td>
              <td>${powerKW.value} kW</td>
              <td><span class="badge badge-${powerKW.type.toLowerCase()}">${powerKW.type}</span></td>
              <td>${powerKW.source}</td>
              <td>${powerKW.reasoning}</td>
            </tr>
            <tr>
              <td><strong>Motor HP</strong></td>
              <td>${motorHP.value ? `${motorHP.value} HP` : 'N/A'}</td>
              <td><span class="badge badge-${motorHP.type.toLowerCase()}">${motorHP.type}</span></td>
              <td>${motorHP.source}</td>
              <td>${motorHP.reasoning}</td>
            </tr>
            <tr>
              <td><strong>Motor Poles</strong></td>
              <td>${motorPoles.value || 'N/A'} Poles</td>
              <td><span class="badge badge-${motorPoles.type.toLowerCase()}">${motorPoles.type}</span></td>
              <td>${motorPoles.source}</td>
              <td>${motorPoles.reasoning}</td>
            </tr>
            <tr>
              <td><strong>Input Speed</strong></td>
              <td>${inputRPM.value} RPM</td>
              <td><span class="badge badge-${inputRPM.type.toLowerCase()}">${inputRPM.type}</span></td>
              <td>${inputRPM.source}</td>
              <td>${inputRPM.reasoning}</td>
            </tr>
            <tr>
              <td><strong>Output Speed</strong></td>
              <td>${outputRPM.value.toFixed(1)} RPM</td>
              <td><span class="badge badge-${outputRPM.type.toLowerCase()}">${outputRPM.type}</span></td>
              <td>${outputRPM.source}</td>
              <td>${outputRPM.reasoning}</td>
            </tr>
            <tr>
              <td><strong>Total Ratio</strong></td>
              <td>${totalRatio.value.toFixed(2)}:1</td>
              <td><span class="badge badge-${totalRatio.type.toLowerCase()}">${totalRatio.type}</span></td>
              <td>${totalRatio.source}</td>
              <td>${totalRatio.reasoning}</td>
            </tr>
            <tr>
              <td><strong>Stages</strong></td>
              <td>${stages.value} Reduction(s)</td>
              <td><span class="badge badge-${stages.type.toLowerCase()}">${stages.type}</span></td>
              <td>${stages.source}</td>
              <td>${stages.reasoning}</td>
            </tr>
            <tr>
              <td><strong>Service Factor</strong></td>
              <td>${serviceFactor.value.toFixed(2)}</td>
              <td><span class="badge badge-${serviceFactor.type.toLowerCase()}">${serviceFactor.type}</span></td>
              <td>${serviceFactor.source}</td>
              <td>${serviceFactor.reasoning}</td>
            </tr>
          </tbody>
        </table>

        <div class="page-break"></div>

        <h2>4. Design Stage limits & Sufficiency Checks</h2>
        <p style="font-size: 11px; margin-top: 0; color: #475569;">
          Target Ratio: <strong>${totalRatio.value.toFixed(2)}</strong>. Evaluating standard combinations of MAGTORQ series databases S1, S2, S3, and S4:
        </p>
        <table>
          <thead>
            <tr>
              <th style="text-align: center;">Planetary Stages</th>
              <th>Calculation Steps (Max Ratio per Stage Count)</th>
              <th style="text-align: center;">Max Ratio Limit</th>
              <th style="text-align: center;">Design Sufficiency</th>
            </tr>
          </thead>
          <tbody>
            ${stageEvaluationTrace.details.map(d => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${d.stages} Stage(s)</td>
                <td>${d.calculationSteps}</td>
                <td style="text-align: center; font-weight: bold;">${d.maxRatio}</td>
                <td style="text-align: center; font-weight: bold; color: ${d.isSufficient ? '#059669' : '#dc2626'}">
                  ${d.isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="formula-box">
          Minimum Stages Recommendation = ${stageEvaluationTrace.minimumStagesRequired} Stage(s)<br/>
          Confidence: High | Derivation Rule: First planetary combination sequence satisfying Ratio <= MaxRatioLimit
        </div>

        <h2>5. Drivetrain Mechanical Torque Calculations</h2>
        <div class="formula-box">
          Input Torque Equation:<br/>
          Tin = (P × 60000) / (2 × π × Nin)<br/>
          Steps: Tin = (${powerKW.value} kW × 60000) / (2 × π × ${inputRPM.value} RPM) = ${inputTorque.result.toFixed(2)} N·m
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center;">Reduction Stage</th>
              <th style="text-align: center;">Stage Ratio</th>
              <th style="text-align: center;">Output Speed</th>
              <th>Output Torque Calculation Steps ( Tout = Tin × Ratio × 0.97 )</th>
              <th style="text-align: center;">Nominal Torque</th>
              <th style="text-align: center;">Peak Torque (SF: ${serviceFactor.value.toFixed(2)})</th>
            </tr>
          </thead>
          <tbody>
            ${stageTraces.map(t => `
              <tr>
                <td style="text-align: center; font-weight: bold;">Stage ${t.stage}</td>
                <td style="text-align: center; font-weight: bold;">${t.ratio.toFixed(2)}</td>
                <td style="text-align: center;">${t.speed.toFixed(1)} RPM</td>
                <td>${t.torqueSteps}</td>
                <td style="text-align: center; font-weight: bold;">${Math.round(t.nominalTorque).toLocaleString()} N·m</td>
                <td style="text-align: center; font-weight: bold;">${Math.round(t.maxTorque).toLocaleString()} N·m</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>6. Gearbox Selection & Safety Audit</h2>
        <table>
          <thead>
            <tr>
              <th style="text-align: center;">Stage</th>
              <th>Selected Gearbox Model</th>
              <th>Database Capacities</th>
              <th>Safety Factor Audit Steps ( SF = min(GBNom/Tout, GBRated/Tmax) )</th>
              <th style="text-align: center;">SF Value</th>
              <th style="text-align: center;">Drivetrain Audit</th>
            </tr>
          </thead>
          <tbody>
            ${stageTraces.map(t => `
              <tr>
                <td style="text-align: center; font-weight: bold;">Stage ${t.stage}</td>
                <td style="font-weight: bold; color: #0f172a;">MAGTORQ ${t.selectedGearbox.size} (Series ${t.selectedGearbox.series})</td>
                <td>Nominal: ${t.selectedGearbox.nominal} N·m<br/>Rated: ${t.selectedGearbox.rated} N·m</td>
                <td>
                  Nom Check: ${t.selectedGearbox.nominal} / ${Math.round(t.nominalTorque)} = ${(t.selectedGearbox.nominal / t.nominalTorque).toFixed(2)}<br/>
                  Rated Check: ${t.selectedGearbox.rated} / ${Math.round(t.maxTorque)} = ${(t.selectedGearbox.rated / t.maxTorque).toFixed(2)}
                </td>
                <td style="text-align: center; font-weight: bold; color: ${t.safetyFactor >= 1.0 ? '#059669' : '#dc2626'}">
                  ${t.safetyFactor.toFixed(2)}
                </td>
                <td style="text-align: center;">
                  <span class="badge ${t.safetyFactor >= 1.0 ? 'badge-valid' : 'badge-missing'}">
                    ${t.safetyFactor >= 1.0 ? 'SAFE' : 'OVERLOADED'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>7. Verification & Engineering Recommendation</h2>
        <div class="recommendation-box" style="border-color: ${stageTraces.every(t => t.safetyFactor >= 1.0) ? '#10b981' : '#ef4444'}; background-color: ${stageTraces.every(t => t.safetyFactor >= 1.0) ? '#ecfdf5' : '#fef2f2'}; color: ${stageTraces.every(t => t.safetyFactor >= 1.0) ? '#065f46' : '#991b1b'};">
          ${finalRecommendation.replace(/\n/g, '<br/>')}
        </div>

        <div class="footer-signature">
          <div class="sig-box">
            <div class="sig-line"></div>
            Prepared By: MAGTORQ Engineering Assistant
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            Reviewed By: Lead Mechanical Design Engineer
          </div>
        </div>

        <div class="no-print" style="margin-top: 40px; text-align: center;">
          <button onclick="window.print()" style="background: #ff8c00; border: none; color: #fff; padding: 10px 24px; font-size: 13px; font-weight: bold; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            Print / Save to PDF
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHTML);
    printWindow.document.close();
  };

  return (
    <>
    <Card className="bg-white border-t-4 border-[#ff8c00] border-slate-200 shadow-md rounded-2xl overflow-hidden mb-6 transition-all duration-300">
      <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-md font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#ff8c00] animate-pulse" />
            Engineering Design & Reasoning Engine
          </CardTitle>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Pasted specifications or files are mapped through deterministic rules to suggest drivetrains with absolute traceability.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-emerald-700 text-xs font-bold shadow-sm">
          <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
          <Cpu className="h-3 w-3" />
          Reasoning Engine Active
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column: Inputs */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Input specifications text
              </div>
              
              <Textarea
                placeholder='Paste engineering specs, RFQs, or email descriptions here. E.g., "Need a drive system for a heavy conveyor. A 4-pole motor provides power. Speed needs to drop to 15 RPM. Motor size is 15 kW. Load runs continuously."'
                value={text}
                onChange={handleTextChange}
                className="min-h-[140px] resize-y bg-slate-50/30 border-slate-200 focus-visible:ring-[#ff8c00] focus-visible:border-[#ff8c00] text-sm rounded-xl transition-all duration-200"
              />

              <div className="relative flex items-center justify-center py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-150" />
                </div>
                <span className="relative bg-white px-3.5 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                  OR
                </span>
              </div>

              {/* File Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                  isDragOver
                    ? 'border-[#ff8c00] bg-[#ff8c00]/5 scale-[0.99]'
                    : file
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50 bg-slate-50/20'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".txt,.pdf,.docx,.jpg,.jpeg,.png,.bmp,.tiff"
                  className="hidden"
                />
                
                {file ? (
                  <>
                    <FileText className="h-7 w-7 text-emerald-500 mb-1.5" />
                    <span className="text-sm font-bold text-emerald-600 max-w-[280px] truncate">
                      {file.name}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB • Click to replace file
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 mb-1.5">
                      <Upload className="h-6 w-6 text-slate-400" />
                      <Image className="h-6 w-6 text-slate-400" />
                    </div>
                    <span className="text-sm font-semibold text-slate-600 text-center">
                      Drag &amp; drop PDF, DOCX, TXT, or Image
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                      Accepts spec sheets, RFQs, scanned documents, JPG/PNG
                    </span>
                  </>
                )}
              </div>
              
              {uploadStatus && (
                <div className="text-[11px] font-semibold text-slate-550 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-inner max-w-full truncate">
                  {uploadStatus}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-white font-bold flex items-center justify-center gap-2 shadow-sm rounded-xl py-2 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                disabled={loading || (!text.trim() && !file)}
                onClick={handleAnalyze}
              >
                {loading ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    Processing reasoning...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze & Design Drive
                  </>
                )}
              </Button>
              
              {(text || file || reasoningResult) && (
                <Button
                  variant="outline"
                  className="border-slate-200 text-slate-500 font-bold rounded-xl transition-all duration-200 hover:bg-slate-100"
                  onClick={handleReset}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Engineering Reasoning & Solution Output */}
          <div className="lg:col-span-7 flex flex-col justify-between border border-slate-200 bg-slate-50/20 rounded-xl p-5 min-h-[460px]">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="h-10 w-10 border-4 border-[#ff8c00] border-t-transparent rounded-full animate-spin shadow-sm" />
                <span className="text-sm font-bold text-slate-500 tracking-wider">Synthesizing deterministic solutions...</span>
              </div>
            ) : reasoningResult ? (
              <div className="flex-1 flex flex-col justify-between h-full">
                
                {/* Tabs Header */}
                <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 mb-4 shrink-0">
                  <button
                    onClick={() => setActiveTab('rec')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'rec'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Recommendation
                  </button>
                  <button
                    onClick={() => setActiveTab('validation')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'validation'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Validation & Assumptions
                  </button>
                  <button
                    onClick={() => setActiveTab('params')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'params'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Parameters Audit
                  </button>
                  <button
                    onClick={() => setActiveTab('trace')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'trace'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    Calculation Trace
                  </button>
                  <button
                    onClick={() => setActiveTab('limits')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'limits'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <Database className="h-3.5 w-3.5" />
                    Limits Matrix
                  </button>
                  <button
                    onClick={() => setActiveTab('verification')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'verification'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Verification
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 space-y-4">
                    {/* TAB 1: RECOMMENDATION */}
                  {activeTab === 'rec' && (
                    <div className="space-y-4">
                      {verificationReport?.isMissingInputsCritical ? (
                        /* Case 1: Additional Engineering Inputs Required */
                        <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/30 p-5 rounded-xl text-center space-y-3 shadow-xs">
                          <AlertTriangle className="h-10 w-10 text-[#ff8c00] mx-auto animate-pulse" />
                          <h4 className="text-md font-bold text-slate-800 uppercase tracking-wide">
                            Additional Inputs Required for {reasoningResult.applicationKnowledge?.detectedApplication || reasoningResult.applicationType} Selection
                          </h4>
                          <p className="text-xs text-slate-650 font-semibold leading-relaxed">
                            Selection blocked. We detected the application as <strong>{reasoningResult.applicationKnowledge?.detectedApplication || reasoningResult.applicationType}</strong>, but crucial parameters required to finalize the planetary drivetrain design could not be resolved.
                          </p>
                          
                          {/* Clarification Questions Panel */}
                          <div className="text-left bg-white border border-slate-200 p-4 rounded-xl text-xs text-slate-700 space-y-3 shadow-inner">
                            <div className="font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                              <Info className="h-4 w-4 text-[#ff8c00]" />
                              Engineering Follow-Up Questions:
                            </div>
                            
                            <div className="space-y-3 divide-y divide-slate-50">
                              {reasoningResult.applicationKnowledge?.clarificationQuestions && reasoningResult.applicationKnowledge.clarificationQuestions.length > 0 ? (
                                reasoningResult.applicationKnowledge.clarificationQuestions.map((q, idx) => (
                                  <div key={idx} className="pt-2.5 first:pt-0">
                                    <p className="font-extrabold text-[#ff8c00] text-[10px] uppercase tracking-wider mb-0.5">
                                      Question {idx + 1}
                                    </p>
                                    <p className="font-semibold text-slate-700 text-xs leading-relaxed">
                                      {q}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-500 font-medium">Please specify motor power and either target speed or gear ratio.</div>
                              )}
                            </div>
                            
                            {/* Missing Params List */}
                            <div className="pt-3 border-t border-slate-100 space-y-1">
                              <div className="font-extrabold text-slate-800 text-[10.5px]">Blocked Parameters:</div>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {verificationReport.missingInputs.map((param, idx) => (
                                  <Badge key={idx} className="bg-red-50 text-red-750 border border-red-200 text-[9px] font-black">
                                    {param}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : verificationReport?.blockRecommendation ? (
                        /* Case 3: Engineering Review Required (Critical Failure) */
                        <div className="bg-red-50 border border-red-200 p-5 rounded-xl text-center space-y-3 shadow-xs">
                          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto animate-bounce" />
                          <h4 className="text-md font-bold text-red-800 uppercase tracking-wide">Engineering Review Required</h4>
                          <p className="text-xs text-red-700 font-semibold leading-relaxed">
                            The verification engine has blocked this drivetrain configuration. The safety margins, overload ratios, or calculated values did not pass the independent engineering review.
                          </p>
                          <div className="text-left bg-white border border-red-150 p-3.5 rounded-lg text-[10.5px] font-mono text-slate-700 space-y-1.5 max-h-[140px] overflow-y-auto shadow-inner">
                            {verificationReport.criticalFailures.map((err, idx) => (
                              <div key={idx} className="text-red-650 flex items-start gap-1">
                                <span className="text-red-500 shrink-0 font-bold">•</span>
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Case 2 / Normal Warnings Banner */}
                          {verificationReport && verificationReport.warnings.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-2 text-xs text-amber-800 font-semibold shadow-xs">
                              <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <div className="font-extrabold uppercase tracking-wider text-[10px] text-amber-900">Engineering Warning</div>
                                <div className="space-y-0.5 text-amber-850">
                                  {verificationReport.warnings.map((wrn, idx) => (
                                    <div key={idx} className="flex items-start gap-1">
                                      <span>•</span>
                                      <span>{wrn}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="text-[10px] text-amber-700 font-bold mt-1">Note: Warnings have no impact on structural calculations or selection compliance.</div>
                              </div>
                            </div>
                          )}
                          {/* Spotlight Card */}
                          <div className="bg-slate-900 border border-slate-800 text-white p-4.5 rounded-xl shadow-md flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono">Recommended output model</span>
                              <h4 className="text-xl font-black text-[#ff8c00] tracking-wide">
                                {reasoningResult.validation.isValid && reasoningResult.stageTraces.length > 0
                                  ? reasoningResult.stageTraces[reasoningResult.stageTraces.length - 1].selectedGearbox.size
                                  : 'Review Warnings'}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                <Info className="h-3 w-3 text-slate-450" />
                                Deterministic size resolved from database
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge className={`${reasoningResult.validation.isValid && reasoningResult.stageTraces.every(t => t.safetyFactor >= 1.0) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'} text-white font-extrabold px-3 py-1 text-xs shadow`}>
                                {reasoningResult.validation.isValid && reasoningResult.stageTraces.every(t => t.safetyFactor >= 1.0) ? '⚡ Drive Compliant' : '⚠ Action Required'}
                              </Badge>
                              <div className="text-[10.5px] font-bold text-slate-400 mt-1">
                                Stages: {reasoningResult.stages.value} Planetary
                              </div>
                            </div>
                          </div>

                          {/* Stage flow visualizer */}
                          {reasoningResult.validation.isValid && (
                            <div className="bg-slate-100/50 border border-slate-200 p-4 rounded-xl space-y-2">
                              <div className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1 font-mono">
                                <Settings className="h-3 w-3" />
                                Drivetrain sequence
                              </div>
                              <div className="flex items-center gap-2 py-1 overflow-x-auto">
                                <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-center shadow-xs text-xs shrink-0">
                                  <div className="text-[8px] font-extrabold text-slate-450 uppercase">Input Motor</div>
                                  <div className="font-extrabold text-slate-700 mt-0.5">{reasoningResult.inputRPM.value} RPM</div>
                                  <div className="text-[8.5px] font-bold text-[#ff8c00] mt-0.5">{reasoningResult.powerKW.value} kW</div>
                                </div>
                                {reasoningResult.stageTraces.map((d, idx) => (
                                  <React.Fragment key={idx}>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-350 shrink-0 animate-pulse" />
                                    <div className="bg-white border border-[#ff8c00]/30 px-3 py-1.5 rounded-lg text-center shadow-xs text-xs shrink-0">
                                      <div className="text-[8px] font-extrabold text-slate-450 uppercase">Stage {d.stage} ({d.selectedGearbox.series === 1 ? 'S1' : d.selectedGearbox.series === 2 ? 'S2' : d.selectedGearbox.series === 3 ? 'S3' : 'S4'})</div>
                                      <div className="font-extrabold text-slate-800 mt-0.5">{d.selectedGearbox.size}</div>
                                      <div className="text-[8.5px] font-bold text-[#ff8c00]">R: {d.ratio.toFixed(2)}</div>
                                    </div>
                                  </React.Fragment>
                                ))}
                                <ArrowRight className="h-3.5 w-3.5 text-slate-350 shrink-0" />
                                <div className="bg-slate-900 border border-slate-900 text-white px-3 py-1.5 rounded-lg text-center shadow-xs text-xs shrink-0">
                                  <div className="text-[8px] font-extrabold text-slate-450 uppercase">Output Drive</div>
                                  <div className="font-extrabold text-white mt-0.5">{reasoningResult.outputRPM.value.toFixed(1)} RPM</div>
                                  <div className="text-[8.5px] font-bold text-[#ff8c00] mt-0.5">{Math.round(reasoningResult.overallOutputTorque).toLocaleString()} N·m</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Text Output */}
                          <div className="text-xs text-slate-650 leading-relaxed font-medium bg-white border border-slate-150 p-4 rounded-xl shadow-xs whitespace-pre-line">
                            {reasoningResult.finalRecommendation}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB 2: VALIDATION & ASSUMPTIONS */}
                  {activeTab === 'validation' && (
                    <div className="space-y-5">
                      
                      {/* Validation Panel */}
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1 font-mono">
                          <CheckCircle className="h-3.5 w-3.5 text-slate-500" />
                          Engineering Input Validation
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs divide-y divide-slate-150">
                          {reasoningResult.validation.items.map((item, idx) => (
                            <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/30">
                              <div>
                                <span className="font-bold text-slate-800">{item.name}</span>
                                <p className="text-[10.5px] text-slate-450 font-medium mt-0.5">{item.message}</p>
                              </div>
                              <Badge className={`font-black text-[9px] py-0.5 px-2 rounded ${
                                item.status.includes('✓ Valid')
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : item.status.includes('⚠ Missing')
                                  ? 'bg-amber-100 text-amber-800 border border-amber-250'
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {item.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Assumptions Panel */}
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1 font-mono">
                          <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                          Engineering Assumptions & Fallbacks
                        </div>
                        {reasoningResult.assumptions.length > 0 ? (
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs divide-y divide-slate-150">
                            {reasoningResult.assumptions.map((ass, idx) => (
                              <div key={idx} className="p-3.5 hover:bg-slate-50/30">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-slate-100 text-slate-600 font-extrabold text-[8.5px] py-0.5 rounded uppercase">
                                    Assumed
                                  </Badge>
                                  <span className="font-bold text-slate-800">{ass.parameter}: {ass.assumption}</span>
                                </div>
                                <p className="text-[10.5px] text-slate-500 font-medium mt-1 leading-snug">
                                  <strong>Reasoning:</strong> {ass.reason}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-emerald-50/50 border border-emerald-150 p-4 rounded-xl text-center text-xs font-semibold text-emerald-800 flex items-center justify-center gap-2">
                            <Check className="h-4 w-4" />
                            No engineering assumptions required. All parameters successfully extracted from specifications.
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* TAB 3: PARAMETERS AUDIT */}
                  {activeTab === 'params' && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">
                        Design parameter origins & classifications
                      </div>
                      
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-slate-200">
                              <th className="p-3 font-extrabold">Parameter</th>
                              <th className="p-3 font-extrabold text-center">Value</th>
                              <th className="p-3 font-extrabold text-center">Classification</th>
                              <th className="p-3 font-extrabold text-center">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 bg-white">
                            {[
                              reasoningResult.powerKW,
                              reasoningResult.motorHP,
                              reasoningResult.motorPoles,
                              reasoningResult.inputRPM,
                              reasoningResult.outputRPM,
                              reasoningResult.totalRatio,
                              reasoningResult.stages,
                              reasoningResult.serviceFactor
                            ].map((p, idx) => {
                              const isNull = p.value === null;
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-3">
                                    <div className="font-extrabold text-slate-800">{p.name}</div>
                                    <div className="text-[10px] text-slate-450 mt-0.5 font-medium leading-snug">
                                      {p.reasoning}
                                    </div>
                                    {p.detectedText && (
                                      <div className="text-[9px] bg-slate-50 border border-slate-150 px-2 py-0.5 rounded mt-1.5 inline-block text-slate-500 font-mono">
                                        Detected text: "${p.detectedText}"
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-center font-extrabold text-slate-900 bg-slate-50/20 whitespace-nowrap">
                                    {isNull ? 'N/A' : (
                                      p.name.includes('Ratio') 
                                        ? `${p.value!.toFixed(2)}:1`
                                        : p.name.includes('Speed') || p.name.includes('RPM')
                                        ? `${Math.round(p.value!)} RPM`
                                        : p.name.includes('Power')
                                        ? `${p.value!} kW`
                                        : p.name.includes('HP')
                                        ? `${p.value!} HP`
                                        : p.value
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    <Badge className={`font-black text-[8.5px] py-0.5 px-2 rounded whitespace-nowrap shadow-xs ${
                                      p.type === 'EXTRACTED'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-150'
                                        : p.type === 'CALCULATED'
                                        ? 'bg-blue-50 text-blue-800 border border-blue-150'
                                        : p.type === 'DERIVED'
                                        ? 'bg-purple-50 text-purple-800 border border-purple-150'
                                        : p.type === 'SUGGESTED'
                                        ? 'bg-amber-50 text-amber-800 border border-amber-150'
                                        : 'bg-slate-100 text-slate-650'
                                    }`}>
                                      {p.type}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-center">
                                    <Badge className={`font-extrabold text-[9px] py-0.5 px-2 rounded-full whitespace-nowrap shadow-xs ${
                                      p.confidence === 'High'
                                        ? 'bg-emerald-100 border border-emerald-250 text-emerald-700'
                                        : p.confidence === 'Medium'
                                        ? 'bg-amber-100 border border-amber-250 text-amber-700'
                                        : 'bg-red-100 border border-red-250 text-red-750'
                                    }`}>
                                      {p.confidence}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: CALCULATION TRACE */}
                  {activeTab === 'trace' && (
                    <div className="space-y-4">
                      
                      <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">
                        Drivetrain derivation timeline & calculation audit
                      </div>

                      {/* Timeline View */}
                      <div className="relative border-l border-slate-200 pl-5 ml-2.5 space-y-5">
                        
                        {/* Step 1: Extraction Trace */}
                        <div className="relative">
                          <span className="absolute -left-[26px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-900 ring-4 ring-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <div className="border border-slate-200 rounded-xl bg-white p-3 shadow-xs">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleAccordion('step1')}>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                1. Extraction Audit Trace
                              </span>
                              <Badge className="bg-slate-100 text-slate-600 font-extrabold text-[8px] py-0.5">
                                {expandedAccordion.step1 ? 'Collapse' : 'Expand'}
                              </Badge>
                            </div>
                            
                            {expandedAccordion.step1 && (
                              <div className="mt-3 text-xs space-y-2 border-t border-slate-100 pt-2 text-slate-650 font-medium">
                                <p><strong>Project:</strong> {reasoningResult.projectName}</p>
                                <p><strong>Application:</strong> {reasoningResult.applicationType}</p>
                                <p><strong>Duty profile:</strong> {reasoningResult.dutyType} duty, {reasoningResult.operatingHours}, {reasoningResult.loadType} loading, {reasoningResult.environment} environment</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 2: Derivation Trace */}
                        <div className="relative">
                          <span className="absolute -left-[26px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-900 ring-4 ring-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <div className="border border-slate-200 rounded-xl bg-white p-3 shadow-xs">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleAccordion('step2')}>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                2. Converted & Derived Values
                              </span>
                              <Badge className="bg-slate-100 text-slate-600 font-extrabold text-[8px] py-0.5">
                                {expandedAccordion.step2 ? 'Collapse' : 'Expand'}
                              </Badge>
                            </div>

                            {expandedAccordion.step2 && (
                              <div className="mt-3 space-y-3 border-t border-slate-100 pt-2.5">
                                {/* HP to kW Formula Card */}
                                <div className="bg-slate-50 border-l-2 border-[#ff8c00] p-2.5 rounded-r-lg font-mono text-[11px] font-bold text-slate-800">
                                  Power Conversion Formula:<br/>
                                  P_kW = HP × 0.7457<br/>
                                  Steps: {reasoningResult.motorHP.calculationSteps}
                                </div>
                                <div className="bg-slate-50 border-l-2 border-[#ff8c00] p-2.5 rounded-r-lg font-mono text-[11px] font-bold text-slate-800">
                                  Poles-to-Speed Slip Mapping:<br/>
                                  Formula: N_in = f(Poles)<br/>
                                  Steps: {reasoningResult.inputRPM.calculationSteps}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 3: Ratio Trace */}
                        <div className="relative">
                          <span className="absolute -left-[26px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-900 ring-4 ring-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <div className="border border-slate-200 rounded-xl bg-white p-3 shadow-xs">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleAccordion('step3')}>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                3. Speed & Ratio Resolvers
                              </span>
                              <Badge className="bg-slate-100 text-slate-600 font-extrabold text-[8px] py-0.5">
                                {expandedAccordion.step3 ? 'Collapse' : 'Expand'}
                              </Badge>
                            </div>

                            {expandedAccordion.step3 && (
                              <div className="mt-3 space-y-3 border-t border-slate-100 pt-2.5">
                                <div className="bg-slate-50 border-l-2 border-[#ff8c00] p-2.5 rounded-r-lg font-mono text-[11px] font-bold text-slate-800">
                                  Drivetrain Gear Ratio Equation:<br/>
                                  Formula: {reasoningResult.totalRatio.formula}<br/>
                                  Steps: {reasoningResult.totalRatio.calculationSteps}<br/>
                                  Result: Ratio = {reasoningResult.totalRatio.value.toFixed(2)}
                                </div>
                                <div className="bg-slate-50 border-l-2 border-[#ff8c00] p-2.5 rounded-r-lg font-mono text-[11px] font-bold text-slate-800">
                                  Target Speed Resolver:<br/>
                                  Formula: {reasoningResult.outputRPM.formula}<br/>
                                  Steps: {reasoningResult.outputRPM.calculationSteps}<br/>
                                  Result: OutputRPM = {reasoningResult.outputRPM.value.toFixed(1)} RPM
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 4: Stage Trace */}
                        <div className="relative">
                          <span className="absolute -left-[26px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-900 ring-4 ring-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <div className="border border-slate-200 rounded-xl bg-white p-3 shadow-xs">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleAccordion('step4')}>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                4. Stage Limit Evaluation
                              </span>
                              <Badge className="bg-slate-100 text-slate-600 font-extrabold text-[8px] py-0.5">
                                {expandedAccordion.step4 ? 'Collapse' : 'Expand'}
                              </Badge>
                            </div>

                            {expandedAccordion.step4 && (
                              <div className="mt-3 space-y-3 border-t border-slate-100 pt-2.5">
                                <div className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider font-mono">
                                  Stage Database Bounds Evaluation
                                </div>
                                <div className="space-y-1.5">
                                  {reasoningResult.stageEvaluationTrace.details.map((d, index) => (
                                    <div key={index} className="flex justify-between items-center bg-slate-50 p-2 rounded text-[11px] font-semibold">
                                      <span className="text-slate-600">{d.stages} Stage Max Ratio Limit:</span>
                                      <span className={d.isSufficient ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                                        {d.maxRatio} ({d.isSufficient ? '✓ Sufficient' : '❌ Insufficient'})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="bg-blue-50/50 border-l-2 border-blue-500 p-2.5 rounded-r-lg font-mono text-[11px] font-bold text-blue-800">
                                  Stage Recommendation Logic:<br/>
                                  Formula: Minimum Stage Count = first(stages where Ratio &le; MaxRatio)<br/>
                                  Result: {reasoningResult.stages.calculationSteps}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 5: Torque Trace */}
                        <div className="relative">
                          <span className="absolute -left-[26px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-900 ring-4 ring-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <div className="border border-slate-200 rounded-xl bg-white p-3 shadow-xs">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleAccordion('step5')}>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                5. Torque Calculation Trace
                              </span>
                              <Badge className="bg-slate-100 text-slate-600 font-extrabold text-[8px] py-0.5">
                                {expandedAccordion.step5 ? 'Collapse' : 'Expand'}
                              </Badge>
                            </div>

                            {expandedAccordion.step5 && (
                              <div className="mt-3 space-y-3 border-t border-slate-100 pt-2.5">
                                <div className="bg-slate-50 border-l-2 border-[#ff8c00] p-2.5 rounded-r-lg font-mono text-[11px] font-bold text-slate-800">
                                  Motor Input Torque Equation:<br/>
                                  Formula: {reasoningResult.inputTorque.formula}<br/>
                                  Steps: {reasoningResult.inputTorque.calculationSteps}
                                </div>

                                <div className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider font-mono mt-3">
                                  Intermediate Stage-by-Stage Amplification
                                </div>
                                <div className="space-y-2">
                                  {reasoningResult.stageTraces.map((t, idx) => (
                                    <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 space-y-1 font-mono text-[10.5px]">
                                      <div className="font-extrabold text-slate-700">Stage {t.stage} Torque amplification:</div>
                                      <div className="font-semibold text-slate-500">Formula: Tout = Tin &times; Ratio &times; 0.97 (efficiency)</div>
                                      <div className="font-bold text-slate-800">Steps: {t.torqueSteps}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 6: Gearbox Selection Trace */}
                        <div className="relative">
                          <span className="absolute -left-[26px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-900 ring-4 ring-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <div className="border border-slate-200 rounded-xl bg-white p-3 shadow-xs">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleAccordion('step6')}>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                6. Gearbox Selection Audit
                              </span>
                              <Badge className="bg-slate-100 text-slate-600 font-extrabold text-[8px] py-0.5">
                                {expandedAccordion.step6 ? 'Collapse' : 'Expand'}
                              </Badge>
                            </div>

                            {expandedAccordion.step6 && (
                              <div className="mt-3 space-y-3 border-t border-slate-100 pt-2.5">
                                <div className="space-y-3">
                                  {reasoningResult.stageTraces.map((t, idx) => (
                                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-xs space-y-1.5">
                                      <div className="font-bold text-slate-800">Stage {t.stage}: Selected MAGTORQ {t.selectedGearbox.size}</div>
                                      <p className="text-[11px] text-slate-500 font-medium"><strong>Rule Applied:</strong> {t.selectionRuleApplied}</p>
                                      <p className="text-[11px] text-slate-600 font-semibold leading-relaxed"><strong>Reasoning:</strong> {t.selectionReason}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 7: Safety Factor Trace */}
                        <div className="relative">
                          <span className="absolute -left-[26px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-900 ring-4 ring-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          <div className="border border-slate-200 rounded-xl bg-white p-3 shadow-xs">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleAccordion('step7')}>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                7. Safety Factor Auditing
                              </span>
                              <Badge className="bg-slate-100 text-slate-600 font-extrabold text-[8px] py-0.5">
                                {expandedAccordion.step7 ? 'Collapse' : 'Expand'}
                              </Badge>
                            </div>

                            {expandedAccordion.step7 && (
                              <div className="mt-3 space-y-3 border-t border-slate-100 pt-2.5">
                                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg font-mono text-[10.5px] font-bold text-blue-800 leading-snug">
                                  SF Formula: SF = min(GBNominal / StageNominal, GBRated / StageMaximum)
                                </div>
                                <div className="space-y-3.5">
                                  {reasoningResult.stageTraces.map((t, idx) => (
                                    <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 space-y-1 text-xs">
                                      <div className="font-extrabold text-slate-700">Stage {t.stage} Safety Verification:</div>
                                      <p className="text-[11px] text-slate-550 font-mono">{t.gbNominalCheck}</p>
                                      <p className="text-[11px] text-slate-550 font-mono">{t.gbRatedCheck}</p>
                                      <div className="text-[11px] text-slate-800 font-bold font-mono">Calculated: {t.safetySteps}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  )}

                  {/* TAB 5: LIMITS MATRIX */}
                  {activeTab === 'limits' && (
                    <div className="space-y-4">
                      <div className="bg-slate-100 border border-slate-200 p-3.5 rounded-xl space-y-2.5 shadow-xs text-xs">
                        <div className="font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                          <Database className="h-4 w-4 text-[#ff8c00]" />
                          Gearbox Series Databases Limits
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {(Object.entries(seriesLimits) as [string, { min: number; max: number; name: string }][]).map(([k, v]) => (
                            <div key={k} className="bg-white border border-slate-150 p-2.5 rounded-lg text-center shadow-xs">
                              <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest">{v.name} Series</span>
                              <div className="text-xs font-extrabold text-slate-800 mt-0.5">
                                {v.min.toFixed(2)} to {v.max.toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">
                          Ratio scope by planetary stage count
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-900 text-slate-200">
                                <th className="p-3 font-extrabold text-center">Stages</th>
                                <th className="p-3 font-extrabold">Series Sequence</th>
                                <th className="p-3 font-extrabold text-center">Min Ratio</th>
                                <th className="p-3 font-extrabold text-center">Max Ratio</th>
                                <th className="p-3 font-extrabold text-center">Scope Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 bg-white">
                              {reasoningResult.stageEvaluationTrace.details.map((d, index) => {
                                const isRecommended = reasoningResult.stages.value === d.stages;
                                
                                return (
                                  <tr key={index} className={`hover:bg-slate-50/50 ${isRecommended ? 'bg-[#ff8c00]/5 font-semibold' : ''}`}>
                                    <td className="p-3 font-extrabold text-center text-slate-700">{d.stages} Stage(s)</td>
                                    <td className="p-3 text-slate-800 uppercase tracking-wide font-extrabold">
                                      {d.stages === 1 ? 'S1' : d.stages === 2 ? 'S1 × S2' : d.stages === 3 ? 'S1 × S2 × S3' : 'S1 × S2 × S3 × S4'}
                                    </td>
                                    <td className="p-3 text-center text-slate-750">
                                      {d.stages === 1 ? seriesLimits.s1.min : d.stages === 2 ? (seriesLimits.s1.min * seriesLimits.s2.min).toFixed(2) : d.stages === 3 ? (seriesLimits.s1.min * seriesLimits.s2.min * seriesLimits.s3.min).toFixed(2) : (seriesLimits.s1.min * seriesLimits.s2.min * seriesLimits.s3.min * seriesLimits.s4.min).toFixed(2)}
                                    </td>
                                    <td className="p-3 text-center text-slate-750">{d.maxRatio}</td>
                                    <td className="p-3 text-center">
                                      {isRecommended ? (
                                        <Badge className="bg-[#ff8c00]/10 border border-[#ff8c00]/30 text-[#e07b00] font-black text-[9px] py-0.5 px-2 rounded">
                                          Recommended
                                        </Badge>
                                      ) : d.isSufficient ? (
                                        <Badge className="bg-emerald-50 border border-emerald-250 text-emerald-800 font-extrabold text-[9px] py-0.5 px-2 rounded">
                                          In Range
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-slate-100 text-slate-400 font-medium text-[9px] py-0.5 px-2 rounded">
                                          Out of Scope
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: VERIFICATION & RELIABILITY */}
                  {activeTab === 'verification' && verificationReport && (
                    <div className="space-y-4">
                      {/* Overall Engineering Reliability Score */}
                      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                            Overall Engineering Reliability
                          </span>
                          <span className={`text-sm font-black px-2.5 py-0.5 rounded-full ${
                            verificationReport.overallScore === 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {verificationReport.overallScore}% Health
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              verificationReport.overallScore === 100 ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${verificationReport.overallScore}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                          {verificationReport.criticalFailures.length === 0
                            ? "✓ All independent mechanical recalculations, database integrity constraints, and sizing validations have passed without critical failures." 
                            : `❌ ${verificationReport.criticalFailures.length} critical verification failure(s) detected. Sizing recommendations are blocked until resolved.`}
                        </p>
                      </div>

                      {/* Severity Counts Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-blue-50/20 border border-blue-150 p-2.5 rounded-xl text-center shadow-xs">
                          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider font-mono">INFO</span>
                          <div className="text-lg font-black text-blue-800 mt-0.5">{verificationReport.infos.length}</div>
                        </div>
                        <div className="bg-amber-50/20 border border-amber-150 p-2.5 rounded-xl text-center shadow-xs">
                          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider font-mono">WARNINGS</span>
                          <div className="text-lg font-black text-amber-800 mt-0.5">{verificationReport.warnings.length}</div>
                        </div>
                        <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/20 p-2.5 rounded-xl text-center shadow-xs">
                          <span className="text-[9px] font-bold text-[#e07b00] uppercase tracking-wider font-mono">MISSING INPUTS</span>
                          <div className="text-lg font-black text-slate-800 mt-0.5">{verificationReport.missingInputs.length}</div>
                        </div>
                        <div className="bg-red-50/20 border border-red-150 p-2.5 rounded-xl text-center shadow-xs">
                          <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider font-mono">CRITICAL FAILURES</span>
                          <div className="text-lg font-black text-red-800 mt-0.5">{verificationReport.criticalFailures.length}</div>
                        </div>
                      </div>

                      {/* Detailed Lists by Severity */}
                      {(verificationReport.criticalFailures.length > 0 || 
                        verificationReport.missingInputs.length > 0 || 
                        verificationReport.warnings.length > 0 || 
                        verificationReport.infos.length > 0) && (
                        <div className="space-y-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs text-xs">
                          <div className="font-extrabold text-slate-700 uppercase tracking-wider font-mono text-[10px]">
                            Audit Classification Details
                          </div>

                          {verificationReport.criticalFailures.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="font-bold text-red-800 uppercase text-[9px] tracking-wider">Critical Failures:</div>
                              <ul className="list-disc list-inside space-y-1 text-slate-650 bg-red-50/20 border border-red-100 rounded-lg p-2.5 font-semibold leading-relaxed">
                                {verificationReport.criticalFailures.map((item, idx) => (
                                  <li key={idx} className="text-red-700">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {verificationReport.missingInputs.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="font-bold text-slate-700 uppercase text-[9px] tracking-wider font-mono">Missing Inputs:</div>
                              <ul className="list-disc list-inside space-y-1 text-slate-650 bg-slate-50 border border-slate-150 rounded-lg p-2.5 font-semibold leading-relaxed">
                                {verificationReport.missingInputs.map((item, idx) => (
                                  <li key={idx} className="text-slate-650">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {verificationReport.warnings.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="font-bold text-amber-800 uppercase text-[9px] tracking-wider">Warnings:</div>
                              <ul className="list-disc list-inside space-y-1 text-slate-650 bg-amber-50/10 border border-amber-100 rounded-lg p-2.5 font-semibold leading-relaxed">
                                {verificationReport.warnings.map((item, idx) => (
                                  <li key={idx} className="text-amber-805">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {verificationReport.infos.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="font-bold text-blue-800 uppercase text-[9px] tracking-wider">Info Logs:</div>
                              <ul className="list-disc list-inside space-y-1 text-slate-650 bg-blue-50/10 border border-blue-100 rounded-lg p-2.5 font-semibold leading-relaxed">
                                {verificationReport.infos.map((item, idx) => (
                                  <li key={idx} className="text-blue-805">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Six Verification Nodes Checklist */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          verificationReport.formulaVerification,
                          verificationReport.ratioVerification,
                          verificationReport.torqueVerification,
                          verificationReport.gearboxSelectionVerification,
                          verificationReport.safetyFactorVerification,
                          verificationReport.databaseVerification
                        ].map((node, index) => (
                          <div key={index} className={`border p-3 rounded-xl flex items-start gap-2.5 shadow-xs transition-colors ${
                            node.passed 
                              ? 'border-emerald-150 bg-emerald-50/10' 
                              : 'border-red-150 bg-red-50/10'
                          }`}>
                            {node.passed ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                            )}
                            <div className="space-y-0.5">
                              <div className={`text-xs font-extrabold ${node.passed ? 'text-slate-800' : 'text-red-800'}`}>
                                {node.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold leading-normal">
                                {node.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Independent Recalculation Audit Logs Table */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">
                          Independent Recalculation Audit Logs
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-900 text-slate-200">
                                <th className="p-2.5 font-extrabold">Audit Parameter</th>
                                <th className="p-2.5 font-extrabold text-right">Original</th>
                                <th className="p-2.5 font-extrabold text-right">Recomputed</th>
                                <th className="p-2.5 font-extrabold text-right">Dev (%)</th>
                                <th className="p-2.5 font-extrabold text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 bg-white">
                              {verificationReport.calculationsAudited.map((calc, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-extrabold text-slate-700">{calc.name}</td>
                                  <td className="p-2.5 text-right font-mono text-slate-600">{calc.original}</td>
                                  <td className="p-2.5 text-right font-mono text-slate-600">{calc.recomputed}</td>
                                  <td className={`p-2.5 text-right font-mono font-bold ${calc.errorPct > 0.1 ? 'text-red-650' : 'text-slate-600'}`}>
                                    {calc.errorPct.toFixed(3)}%
                                  </td>
                                  <td className="p-2.5 text-center">
                                    {calc.passed ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Pass
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-700 border border-red-200">
                                        Fail
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Autofill & PDF Panel Footer */}
                <div className="pt-4 border-t border-slate-200 shrink-0 flex gap-3">
                  <Button
                    onClick={exportAuditReport}
                    variant="outline"
                    className="border-slate-200 text-slate-700 font-extrabold flex items-center justify-center gap-2 shadow-xs rounded-xl py-2 transition-all duration-200 hover:bg-slate-100"
                  >
                    <FileDown className="h-4 w-4" />
                    Export Audit Report (PDF)
                  </Button>
                  <Button
                    className="flex items-center justify-center gap-1.5 border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 font-bold rounded-xl py-2 transition-all duration-200 border"
                    onClick={handleExportPDF}
                    title="Export engineering report as PDF"
                  >
                    <FileDown className="h-4 w-4" />
                    PDF
                  </Button>
                  <Button
                    className="flex items-center justify-center gap-1.5 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 font-bold rounded-xl py-2 transition-all duration-200 border"
                    onClick={handleExportExcel}
                    title="Export engineering report as Excel"
                  >
                    <Sheet className="h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    onClick={handleAutoFillClick}
                    disabled={verificationReport ? verificationReport.criticalFailures.length > 0 : false}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold flex items-center justify-center gap-2 shadow rounded-xl py-2 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Check className="h-4 w-4 font-black" />
                    Apply Design to Form
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center text-sm px-4">
                <Sparkles className="h-8 w-8 text-slate-350 mb-2 animate-bounce" />
                <span className="font-extrabold text-slate-500">Design assistant standby</span>
                <span className="text-xs text-slate-450 mt-1 max-w-[320px] leading-relaxed">
                  Enter specifications on the left or upload documents. The system will derive all drive parameters, validate inputs, calculate torque, select gearboxes, and display safety factor audits here.
                </span>
              </div>
            )}
          </div>

        </div>
      </CardContent>
    </Card>

    {/* Extraction Review Panel — shown below the card after AI analysis */}
    {showReviewPanel && reasoningResult && (
      <ExtractionReviewPanel
        report={reasoningResult}
        onApply={(overrides) => {
          onAutoFill(overrides);
          setShowReviewPanel(false);
        }}
        onDismiss={() => setShowReviewPanel(false)}
      />
    )}
    </>
  );
};
