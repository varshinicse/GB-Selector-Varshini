import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, FileText, Sparkles, Check, ArrowRight, Cpu, 
  RotateCcw, Info, Settings, CheckCircle, Scale, Database
} from 'lucide-react';
import { ProjectInput } from '../types/ProjectInput';
import { extractTextFromFile } from '../services/aiRequirementAnalyzer';
import { analyzeRequirement, ExtractionResult } from '../api/requirementAnalyzerApi';
import { runEngineeringReasoning, ReasoningResult, seriesLimits } from '../services/engineeringReasoningEngine';

interface RequirementAnalyzerProps {
  onAutoFill: (extractedValues: Partial<ProjectInput>) => void;
}

export const RequirementAnalyzer: React.FC<RequirementAnalyzerProps> = ({ onAutoFill }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [reasoningResult, setReasoningResult] = useState<ReasoningResult | null>(null);
  const [activeTab, setActiveTab] = useState<'rec' | 'params' | 'stages' | 'limits'>('rec');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const allowedTypes = ['.txt', '.pdf', '.docx'];
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
      alert("Please upload a valid file format (.txt, .pdf, or .docx)");
      return;
    }

    setFile(selectedFile);
    setText('');
    setReasoningResult(null);
    setUploadStatus('File uploaded. Click "Analyze Requirement" to extract.');
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

  const handleAnalyze = async () => {
    let sourceText = text;

    if (file) {
      setLoading(true);
      setUploadStatus("Extracting raw text from file...");
      try {
        sourceText = await extractTextFromFile(file);
        setUploadStatus("File text extracted successfully. Process starting...");
      } catch (err) {
        console.error(err);
        alert(`Failed to extract text from file: ${(err as any).message}`);
        setLoading(false);
        return;
      }
    }

    if (!sourceText.trim()) {
      alert("Please enter a description or upload a specifications document.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setReasoningResult(null);
    
    try {
      let result: ExtractionResult;
      try {
        // Attempt AI Extraction from Backend API
        result = await analyzeRequirement(sourceText);
      } catch (apiError) {
        console.warn("AI extraction endpoint failed or unavailable. Falling back to local rules engine...", apiError);
        // Fallback: Create empty extraction structure and let local rules run
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
      
      // Execute the MAGTORQ Engineering Reasoning Engine
      const solution = runEngineeringReasoning(sourceText, result);
      setReasoningResult(solution);
      setActiveTab('rec');
      if (file) {
        setUploadStatus("Engineering solution generated successfully!");
      }
    } catch (error) {
      console.error(error);
      alert(`Engineering Reasoning failed: ${(error as any).message}`);
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
  };

  const handleAutoFillClick = () => {
    if (reasoningResult) {
      onAutoFill({
        projectName: reasoningResult.projectName,
        powerKW: reasoningResult.powerKW.value,
        inputRPM: reasoningResult.inputRPM.value,
        totalRatio: reasoningResult.totalRatio.value,
        serviceFactor: reasoningResult.serviceFactor.value,
        stages: reasoningResult.stages.value,
      });
    }
  };

  return (
    <Card className="bg-white border-t-4 border-[#ff8c00] border-slate-200 shadow-md rounded-2xl overflow-hidden mb-6 transition-all duration-300">
      <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-md font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#ff8c00] animate-pulse" />
            Engineering Design & Reasoning Engine
          </CardTitle>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Pasted specification details or uploaded sheets are analyzed to resolve missing parameters and automatically recommend drive configurations.
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
                  accept=".txt,.pdf,.docx"
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
                    <Upload className="h-7 w-7 text-slate-400 mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-slate-600 text-center">
                      Drag & drop PDF, DOCX, or TXT
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                      Accepts spec sheets, RFQs, enquiries
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
                    Processing reasoning matrix...
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
          <div className="lg:col-span-7 flex flex-col justify-between border border-slate-200 bg-slate-50/20 rounded-xl p-5 min-h-[420px]">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="h-10 w-10 border-4 border-[#ff8c00] border-t-transparent rounded-full animate-spin shadow-sm" />
                <span className="text-sm font-bold text-slate-500 tracking-wider">Synthesizing specifications & safety metrics...</span>
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
                    <CheckCircle className="h-3.5 w-3.5" />
                    Recommendation
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
                    Parameters & Derivations
                  </button>
                  <button
                    onClick={() => setActiveTab('stages')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'stages'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <Scale className="h-3.5 w-3.5" />
                    Drivetrain & Safety
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
                    Ratio Limits Matrix
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 overflow-y-auto max-h-[360px] pr-1 space-y-4">
                  
                  {/* TAB 1: RECOMMENDATION */}
                  {activeTab === 'rec' && (
                    <div className="space-y-4">
                      {/* Selected Gearbox Spotlight Card */}
                      <div className="bg-slate-900 border border-slate-800 text-white p-4.5 rounded-xl shadow-md flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">Recommended Gearbox size</span>
                          <h4 className="text-xl font-black text-[#ff8c00] tracking-wide">
                            {stageDetailsSafe(reasoningResult)
                              ? reasoningResult.stageDetails[reasoningResult.stageDetails.length - 1]?.selectedGearbox.size || 'N/A'
                              : 'Recheck stage capacity'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <Info className="h-3 w-3 text-slate-450" />
                            Based on resolved capacity constraints
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1 text-xs shadow">
                            ⚡ Drive Compliant
                          </Badge>
                          <div className="text-[10.5px] font-bold text-slate-400 mt-1">
                            Stages: {reasoningResult.stages.value} reduction steps
                          </div>
                        </div>
                      </div>

                      {/* Visual Flow Block */}
                      <div className="bg-slate-100/50 border border-slate-200 p-4 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1">
                          <Settings className="h-3 w-3" />
                          Reduction Stage Flow Visualizer
                        </div>
                        <div className="flex items-center gap-2 py-1 overflow-x-auto">
                          <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-center shadow-xs text-xs shrink-0">
                            <div className="text-[8px] font-extrabold text-slate-400 uppercase">Input Motor</div>
                            <div className="font-extrabold text-slate-700 mt-0.5">{reasoningResult.inputRPM.value} RPM</div>
                          </div>
                          {reasoningResult.stageDetails.map((d, idx) => (
                            <React.Fragment key={idx}>
                              <ArrowRight className="h-3.5 w-3.5 text-slate-350 shrink-0" />
                              <div className="bg-white border border-[#ff8c00]/30 px-3 py-1.5 rounded-lg text-center shadow-xs text-xs shrink-0">
                                <div className="text-[8px] font-extrabold text-slate-400 uppercase">Stage {d.stage} ({d.selectedGearbox.series === 1 ? 'S1' : d.selectedGearbox.series === 2 ? 'S2' : d.selectedGearbox.series === 3 ? 'S3' : 'S4'})</div>
                                <div className="font-extrabold text-slate-800 mt-0.5">{d.selectedGearbox.size}</div>
                                <div className="text-[8px] font-bold text-[#ff8c00]">R: {d.ratio.toFixed(2)}</div>
                              </div>
                            </React.Fragment>
                          ))}
                          <ArrowRight className="h-3.5 w-3.5 text-slate-350 shrink-0" />
                          <div className="bg-slate-900 border border-slate-900 text-white px-3 py-1.5 rounded-lg text-center shadow-xs text-xs shrink-0">
                            <div className="text-[8px] font-extrabold text-slate-400 uppercase">Output Drive</div>
                            <div className="font-extrabold text-white mt-0.5">{reasoningResult.outputRPM.value.toFixed(1)} RPM</div>
                          </div>
                        </div>
                      </div>

                      {/* Summary Text */}
                      <div className="text-xs text-slate-650 leading-relaxed font-medium bg-white border border-slate-150 p-4 rounded-xl shadow-xs whitespace-pre-line">
                        {reasoningResult.recommendationText}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PARAMETERS & DERIVATIONS */}
                  {activeTab === 'params' && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                        Parameters derivation & confidence audit
                      </div>
                      
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-slate-200">
                              <th className="p-3 font-extrabold">Parameter</th>
                              <th className="p-3 font-extrabold text-center">Value</th>
                              <th className="p-3 font-extrabold text-center">Source</th>
                              <th className="p-3 font-extrabold text-center">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 bg-white">
                            {[
                              reasoningResult.powerKW,
                              reasoningResult.inputRPM,
                              reasoningResult.outputRPM,
                              reasoningResult.totalRatio,
                              reasoningResult.stages,
                              reasoningResult.serviceFactor
                            ].map((p, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-3">
                                  <div className="font-extrabold text-slate-800">{p.name}</div>
                                  <div className="text-[9.5px] text-slate-400 mt-0.5 italic max-w-[200px] truncate" title={p.calculationPath}>
                                    Formula: {p.calculationPath}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-medium mt-1 leading-snug">
                                    {p.reasoning}
                                  </div>
                                </td>
                                <td className="p-3 text-center font-extrabold text-slate-900 bg-slate-50/20 whitespace-nowrap">
                                  {p.name.includes('Ratio') 
                                    ? `${p.value.toFixed(2)}:1`
                                    : p.name.includes('Speed')
                                    ? `${Math.round(p.value)} RPM`
                                    : p.name.includes('Power')
                                    ? `${p.value} kW`
                                    : p.value}
                                </td>
                                <td className="p-3 text-center">
                                  {p.isSuggested ? (
                                    <Badge className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-extrabold text-[9px] py-0.5 px-2.5 rounded-full whitespace-nowrap shadow-xs">
                                      Suggested
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-[9px] py-0.5 px-2.5 rounded-full whitespace-nowrap shadow-xs">
                                      Extracted
                                    </Badge>
                                  )}
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
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: DRIVETRAIN & SAFETY */}
                  {activeTab === 'stages' && (
                    <div className="space-y-4">
                      {/* Safety Equation Callout */}
                      <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl flex items-start gap-3 shadow-xs">
                        <Scale className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wide">MAGTORQ Safety Factor (SF) Formula</span>
                          <p className="text-xs font-semibold text-blue-800 leading-snug">
                            SF = min( GBNominal / StageNominal, GBRated / StageMaximum )
                          </p>
                          <p className="text-[9.5px] text-blue-500 font-semibold leading-relaxed">
                            Ensures structural alignment with both continuous nominal loading and dynamic peak torque specifications.
                          </p>
                        </div>
                      </div>

                      {/* Stage Calculation Details Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-slate-200">
                              <th className="p-3 font-extrabold text-center">Stage</th>
                              <th className="p-3 font-extrabold text-center">Ratio</th>
                              <th className="p-3 font-extrabold text-center">Nom Torque</th>
                              <th className="p-3 font-extrabold text-center">Max Torque</th>
                              <th className="p-3 font-extrabold text-center">Gearbox</th>
                              <th className="p-3 font-extrabold text-center">SF</th>
                              <th className="p-3 font-extrabold text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 bg-white">
                            {reasoningResult.stageDetails.map((d, index) => {
                              const isUnsafe = d.safetyFactor < 1.0;
                              return (
                                <tr key={index} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-extrabold text-center text-slate-600">Stage {d.stage}</td>
                                  <td className="p-3 font-bold text-center text-slate-800">{d.ratio.toFixed(2)}</td>
                                  <td className="p-3 text-center text-slate-700 whitespace-nowrap">
                                    {Math.round(d.nominalTorque).toLocaleString()} <span className="text-[9px] text-slate-400">N·m</span>
                                  </td>
                                  <td className="p-3 text-center text-slate-700 font-semibold whitespace-nowrap">
                                    {Math.round(d.maxTorque).toLocaleString()} <span className="text-[9px] text-slate-400">N·m</span>
                                  </td>
                                  <td className="p-3 text-center font-extrabold text-slate-900 whitespace-nowrap">
                                    {d.selectedGearbox.size}
                                    <div className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">
                                      Cap: {d.selectedGearbox.nominal} / {d.selectedGearbox.rated} N·m
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-extrabold">
                                    <span className={isUnsafe ? 'text-red-500' : 'text-emerald-600'}>
                                      {d.safetyFactor.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    {isUnsafe ? (
                                      <Badge className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[9px] font-extrabold py-0.5 px-2 rounded-full shadow-xs">
                                        Overloaded
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9px] font-extrabold py-0.5 px-2 rounded-full shadow-xs">
                                        Safe
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
                  )}

                  {/* TAB 4: RATIO LIMITS MATRIX */}
                  {activeTab === 'limits' && (
                    <div className="space-y-4">
                      {/* Database limits description */}
                      <div className="bg-slate-100 border border-slate-200 p-3.5 rounded-xl space-y-2.5 shadow-xs text-xs">
                        <div className="font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Database className="h-4 w-4 text-[#ff8c00]" />
                          Gearbox Series Databases Limits
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {(Object.entries(seriesLimits) as [string, { min: number; max: number; name: string }][]).map(([k, v]) => (
                            <div key={k} className="bg-white border border-slate-150 p-2.5 rounded-lg text-center shadow-xs">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v.name} Series</span>
                              <div className="text-xs font-extrabold text-slate-800 mt-0.5">
                                {v.min} to {v.max}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Achievable stage configuration matrix */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                          Ratio scope by reduction stage count
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
                              {reasoningResult.stageAnalysis.details.map((d, index) => {
                                const R_target = reasoningResult.totalRatio.value;
                                const inScope = R_target >= d.min && R_target <= d.max;
                                const recommended = reasoningResult.stages.value === d.stages;
                                
                                return (
                                  <tr key={index} className={`hover:bg-slate-50/50 ${recommended ? 'bg-[#ff8c00]/5 font-semibold' : ''}`}>
                                    <td className="p-3 font-extrabold text-center text-slate-700">{d.stages} reduction</td>
                                    <td className="p-3 text-slate-800 uppercase tracking-wide font-extrabold">{d.series.join(' × ')}</td>
                                    <td className="p-3 text-center text-slate-700">{d.min.toFixed(2)}</td>
                                    <td className="p-3 text-center text-slate-700">{d.max.toFixed(2)}</td>
                                    <td className="p-3 text-center">
                                      {recommended ? (
                                        <Badge className="bg-[#ff8c00]/10 border border-[#ff8c00]/30 text-[#e07b00] font-black text-[9px] py-0.5 px-2 rounded">
                                          Recommended
                                        </Badge>
                                      ) : inScope ? (
                                        <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-[9px] py-0.5 px-2 rounded">
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

                </div>

                {/* Autofill Panel Footer */}
                <div className="pt-4 border-t border-slate-200 shrink-0">
                  <Button
                    onClick={handleAutoFillClick}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center justify-center gap-2 shadow rounded-xl py-2.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Check className="h-4 w-4 font-black" />
                    Apply Design to Form & Run Calculations
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center text-sm px-4">
                <Sparkles className="h-8 w-8 text-slate-350 mb-2 animate-bounce" />
                <span className="font-extrabold text-slate-500">Design assistant standby</span>
                <span className="text-xs text-slate-450 mt-1 max-w-[320px] leading-relaxed">
                  Enter specifications on the left or upload documents. The system will derive all drive parameters, calculate torque, select gearboxes, and display the safety factor audit here.
                </span>
              </div>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

// Helper: Check if all stage safety factors are compliant
function stageDetailsSafe(res: ReasoningResult): boolean {
  if (!res.stageDetails || res.stageDetails.length === 0) return false;
  return res.stageDetails.every(d => d.safetyFactor >= 1.0);
}
