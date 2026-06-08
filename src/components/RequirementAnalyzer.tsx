import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, FileText, Sparkles, Check, ArrowRight, Cpu, 
  Zap, Compass, ShieldCheck, Gauge, RotateCcw, AlertTriangle
} from 'lucide-react';
import { ProjectInput } from '../types/ProjectInput';
import { extractTextFromFile } from '../services/aiRequirementAnalyzer';
import { analyzeRequirement, ExtractionResult } from '../api/requirementAnalyzerApi';

interface RequirementAnalyzerProps {
  onAutoFill: (extractedValues: Partial<ProjectInput>) => void;
}

type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export const RequirementAnalyzer: React.FC<RequirementAnalyzerProps> = ({ onAutoFill }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractionResult | null>(null);
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
    setExtractedData(null);
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
        setUploadStatus("File text extracted successfully. Calling Gemini...");
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
    setExtractedData(null);
    
    try {
      const result = await analyzeRequirement(sourceText);
      setExtractedData(result);
      if (file) {
        setUploadStatus("Analysis complete!");
      }
    } catch (error) {
      console.error(error);
      alert(`AI Requirement Extraction failed: ${(error as any).message}`);
      if (file) {
        setUploadStatus("Analysis failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setText('');
    setFile(null);
    setUploadStatus('');
    setExtractedData(null);
  };

  const handleAutoFillClick = () => {
    if (extractedData) {
      onAutoFill({
        projectName: extractedData.projectName || "AI Extracted Project",
        powerKW: extractedData.powerKW || undefined,
        inputRPM: extractedData.inputRPM || undefined,
        totalRatio: extractedData.targetRatio || undefined,
        serviceFactor: extractedData.serviceFactor || undefined,
        stages: extractedData.numberOfStages || undefined,
      });
    }
  };

  // Determine extraction confidence score
  const getConfidenceLevel = (data: ExtractionResult): ConfidenceLevel => {
    const importantFields = [
      data.projectName,
      data.powerKW,
      data.inputRPM,
      data.outputRPM || data.targetRatio,
      data.serviceFactor
    ];
    
    const extractedCount = importantFields.filter(field => field !== null && field !== undefined).length;
    
    if (extractedCount >= 4) return 'High';
    if (extractedCount >= 2) return 'Medium';
    return 'Low';
  };

  const confidenceLevel = extractedData ? getConfidenceLevel(extractedData) : null;

  return (
    <Card className="bg-white border-t-4 border-[#ff8c00] border-slate-200 shadow-md rounded-2xl overflow-hidden mb-6 transition-all duration-300">
      <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-md font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#ff8c00] animate-pulse" />
            AI Requirement Analyzer
          </CardTitle>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Upload customer specifications or paste project requirements. The system automatically extracts parameters.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-emerald-700 text-xs font-bold shadow-sm">
          <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
          <Cpu className="h-3 w-3" />
          AI Engine Ready
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Input Design Specifications
              </div>
              
              <Textarea
                placeholder='Paste engineering specs here. E.g., "We require a gearbox for a conveyor application. Motor power is 15 kW. Input speed is 1500 RPM. Required output speed is 15 RPM. SF is 1.5."'
                value={text}
                onChange={handleTextChange}
                className="min-h-[110px] resize-y bg-slate-50/30 border-slate-200 focus-visible:ring-[#ff8c00] focus-visible:border-[#ff8c00] text-sm rounded-xl transition-all duration-200"
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
                      Or click here to browse files
                    </span>
                  </>
                )}
              </div>
              
              {uploadStatus && (
                <div className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-inner max-w-full truncate">
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
                    AI Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze Requirement
                  </>
                )}
              </Button>
              
              {(text || file || extractedData) && (
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

          <div className="flex flex-col justify-between border border-slate-200 bg-slate-50/30 rounded-xl p-5 min-h-[320px]">
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Extracted Parameters Preview
                </div>
                
                {extractedData && confidenceLevel && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Confidence:</span>
                    {confidenceLevel === 'High' && (
                      <Badge className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold py-0.5 px-2 hover:bg-emerald-100">
                        High Confidence
                      </Badge>
                    )}
                    {confidenceLevel === 'Medium' && (
                      <Badge className="bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-extrabold py-0.5 px-2 hover:bg-amber-100">
                        Medium Confidence
                      </Badge>
                    )}
                    {confidenceLevel === 'Low' && (
                      <Badge className="bg-red-100 border border-red-200 text-red-800 text-[10px] font-extrabold py-0.5 px-2 hover:bg-red-100">
                        Low Confidence
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              
              {loading ? (
                /* Pulsing Skeletons */
                <div className="grid grid-cols-2 gap-4 animate-pulse flex-1 items-center">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-slate-100 border border-slate-200 rounded-xl p-3 h-20 flex flex-col justify-between" />
                  ))}
                </div>
              ) : extractedData ? (
                <div className="flex flex-col gap-4 flex-1 justify-between">
                  {/* Structured Mini-cards */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <FileText className="h-3 w-3 text-slate-400" />
                        Project Name
                      </div>
                      <div className="text-sm font-extrabold text-slate-800 mt-1 truncate max-w-full">
                        {extractedData.projectName || "N/A"}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <Zap className="h-3 w-3 text-amber-500" />
                        Drive Power
                      </div>
                      <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                        {extractedData.powerKW ? `${extractedData.powerKW} kW` : "N/A"}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <Gauge className="h-3 w-3 text-[#ff8c00]" />
                        Input Speed
                      </div>
                      <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                        {extractedData.inputRPM ? `${extractedData.inputRPM} RPM` : "N/A"}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <Compass className="h-3 w-3 text-blue-500" />
                        Target Ratio
                      </div>
                      <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                        {extractedData.targetRatio || "N/A"}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <Cpu className="h-3 w-3 text-[#ff8c00]" />
                        Stages suggestion
                      </div>
                      <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                        {extractedData.numberOfStages || "N/A"}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                        Service Factor
                      </div>
                      <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                        {extractedData.serviceFactor || "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Warning Cards for Missing Fields */}
                  <div className="space-y-2">
                    {!extractedData.inputRPM && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-150 p-2.5 rounded-lg text-red-700 text-xs font-semibold">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <span>⚠ Input RPM Not Found</span>
                      </div>
                    )}
                    {!extractedData.outputRPM && !extractedData.targetRatio && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-150 p-2.5 rounded-lg text-red-700 text-xs font-semibold">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <span>⚠ Output RPM Not Found</span>
                      </div>
                    )}
                    {!extractedData.targetRatio && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-150 p-2.5 rounded-lg text-red-700 text-xs font-semibold">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <span>⚠ Ratio Not Found</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center text-sm px-4">
                  <Sparkles className="h-8 w-8 text-slate-300 mb-2 animate-bounce" />
                  <span className="font-semibold text-slate-500">No parameters extracted</span>
                  <span className="text-xs text-slate-400 mt-1 max-w-[280px]">
                    Type details (e.g. 15 kW power, 1500 RPM input speed, 15 RPM output) or drag files to extract specs.
                  </span>
                </div>
              )}
            </div>

            {extractedData && (
              <Button
                onClick={handleAutoFillClick}
                className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-sm rounded-xl py-2.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Check className="h-4 w-4 font-extrabold" />
                Auto Fill Form
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
