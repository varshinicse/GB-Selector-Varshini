/* eslint-disable react-hooks/set-state-in-effect */
/**
 * MAGTORQ GB-Selector
 * Extraction Review Panel
 * Side-by-side AI extraction results with editable overrides and confidence colour coding.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, AlertTriangle, HelpCircle, Edit3, ArrowRight, RotateCcw
} from 'lucide-react';
import { EngineeringReport } from '../services/engineeringReasoningEngine';
import { ProjectInput } from '../types/ProjectInput';

// ─── Types ────────────────────────────────────────────────────────────────────

type ParameterType = 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED';

interface ExtractedParam {
  label: string;
  key: keyof ReviewOverrides;
  aiValue: string | number | null;
  sourceType: ParameterType;
  unit?: string;
  reasoning: string;
}

interface ReviewOverrides {
  powerKW: string;
  inputRPM: string;
  outputRPM: string;
  totalRatio: string;
  serviceFactor: string;
  stages: string;
}

interface ExtractionReviewPanelProps {
  report: EngineeringReport;
  onApply: (overrides: Partial<ProjectInput>) => void;
  onDismiss: () => void;
}

// ─── Confidence Styling ───────────────────────────────────────────────────────

function typeStyle(type: ParameterType): {
  bg: string; text: string; border: string; icon: React.ReactNode; label: string
} {
  switch (type) {
    case 'EXTRACTED':
      return {
        bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
        label: 'EXTRACTED'
      };
    case 'CALCULATED':
      return {
        bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />,
        label: 'CALCULATED'
      };
    case 'DERIVED':
      return {
        bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-purple-500" />,
        label: 'DERIVED'
      };
    case 'SUGGESTED':
      return {
        bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
        icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
        label: 'SUGGESTED'
      };
    case 'ASSUMED':
    default:
      return {
        bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200',
        icon: <HelpCircle className="h-3.5 w-3.5 text-slate-400" />,
        label: 'ASSUMED'
      };
  }
}

function confidenceBanner(types: ParameterType[]): { text: string; cls: string; icon: React.ReactNode } {
  const hasAssumed = types.some(t => t === 'ASSUMED');
  const hasSuggested = types.some(t => t === 'SUGGESTED' || t === 'DERIVED');
  const allExtracted = types.every(t => t === 'EXTRACTED' || t === 'CALCULATED');

  if (allExtracted) {
    return {
      text: 'High confidence — all key parameters were directly extracted from the document.',
      cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
    };
  }
  if (hasAssumed) {
    return {
      text: 'Low confidence — some parameters were assumed. Review and correct overrides before calculating.',
      cls: 'bg-red-50 border-red-200 text-red-700',
      icon: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
    };
  }
  if (hasSuggested) {
    return {
      text: 'Medium confidence — some parameters were derived or suggested. Verify the values below.',
      cls: 'bg-amber-50 border-amber-200 text-amber-700',
      icon: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
    };
  }
  return {
    text: 'Parameters resolved successfully.',
    cls: 'bg-slate-50 border-slate-200 text-slate-700',
    icon: <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0" />
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ExtractionReviewPanel: React.FC<ExtractionReviewPanelProps> = ({
  report,
  onApply,
  onDismiss
}) => {
  const params: ExtractedParam[] = [
    {
      label: 'Power',
      key: 'powerKW',
      aiValue: report.powerKW.value,
      sourceType: report.powerKW.type as ParameterType,
      unit: 'kW',
      reasoning: report.powerKW.reasoning
    },
    {
      label: 'Input Speed',
      key: 'inputRPM',
      aiValue: report.inputRPM.value,
      sourceType: report.inputRPM.type as ParameterType,
      unit: 'RPM',
      reasoning: report.inputRPM.reasoning
    },
    {
      label: 'Output Speed',
      key: 'outputRPM',
      aiValue: report.outputRPM.value ? parseFloat(report.outputRPM.value.toFixed(1)) : null,
      sourceType: report.outputRPM.type as ParameterType,
      unit: 'RPM',
      reasoning: report.outputRPM.reasoning
    },
    {
      label: 'Total Ratio',
      key: 'totalRatio',
      aiValue: report.totalRatio.value ? parseFloat(report.totalRatio.value.toFixed(2)) : null,
      sourceType: report.totalRatio.type as ParameterType,
      unit: ':1',
      reasoning: report.totalRatio.reasoning
    },
    {
      label: 'Service Factor',
      key: 'serviceFactor',
      aiValue: report.serviceFactor.value ? parseFloat(report.serviceFactor.value.toFixed(2)) : null,
      sourceType: report.serviceFactor.type as ParameterType,
      reasoning: report.serviceFactor.reasoning
    },
    {
      label: 'Stages',
      key: 'stages',
      aiValue: report.stages.value,
      sourceType: report.stages.type as ParameterType,
      reasoning: report.stages.reasoning
    },
  ];

  const initialOverrides: ReviewOverrides = {
    powerKW: report.powerKW.value != null ? String(report.powerKW.value) : '',
    inputRPM: report.inputRPM.value != null ? String(report.inputRPM.value) : '',
    outputRPM: report.outputRPM.value != null ? String(parseFloat(report.outputRPM.value.toFixed(1))) : '',
    totalRatio: report.totalRatio.value != null ? String(parseFloat(report.totalRatio.value.toFixed(2))) : '',
    serviceFactor: report.serviceFactor.value != null ? String(parseFloat(report.serviceFactor.value.toFixed(2))) : '',
    stages: report.stages.value != null ? String(report.stages.value) : '',
  };

  const [overrides, setOverrides] = useState<ReviewOverrides>(initialOverrides);
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOverrides(initialOverrides);
    setEditingKeys(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  const handleOverride = (key: keyof ReviewOverrides, value: string) => {
    setOverrides(prev => ({ ...prev, [key]: value }));
    setEditingKeys(prev => new Set(prev).add(key));
  };

  const handleReset = (key: keyof ReviewOverrides) => {
    setOverrides(prev => ({
      ...prev,
      [key]: initialOverrides[key]
    }));
    setEditingKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleApply = () => {
    const result: Partial<ProjectInput> = {};
    if (overrides.powerKW) result.powerKW = parseFloat(overrides.powerKW);
    if (overrides.inputRPM) result.inputRPM = parseFloat(overrides.inputRPM);
    if (overrides.totalRatio) result.totalRatio = parseFloat(overrides.totalRatio);
    if (overrides.serviceFactor) result.serviceFactor = parseFloat(overrides.serviceFactor);
    if (overrides.stages) result.stages = parseInt(overrides.stages, 10);
    result.projectName = report.projectName;
    onApply(result);
  };

  const banner = confidenceBanner(params.map(p => p.sourceType));
  const editedCount = editingKeys.size;

  return (
    <Card className="border border-slate-200 bg-white shadow-md rounded-2xl overflow-hidden mt-4">
      <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-[#ff8c00]" />
          Extraction Review Panel
          <Badge className="ml-auto bg-slate-100 text-slate-600 font-bold text-[10px] border border-slate-200">
            {params.length} Parameters Extracted
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Confidence Banner */}
        <div className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 text-xs font-semibold ${banner.cls}`}>
          {banner.icon}
          <span>{banner.text}</span>
        </div>

        {/* Parameter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {params.map((param) => {
            const style = typeStyle(param.sourceType);
            const isEdited = editingKeys.has(param.key);
            const currentVal = overrides[param.key];
            const displayAI = param.aiValue != null ? `${param.aiValue}${param.unit ?? ''}` : 'Not detected';

            return (
              <div
                key={param.key}
                className={`rounded-xl border p-3 space-y-2 transition-all duration-200 ${
                  isEdited
                    ? 'border-[#ff8c00]/40 bg-[#ff8c00]/5 shadow-sm'
                    : `${style.border} ${style.bg}`
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {param.label}
                  </span>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${style.bg} ${style.text} border ${style.border}`}>
                    {style.icon}
                    {style.label}
                  </div>
                </div>

                {/* AI Value */}
                <div className="text-[10px] text-slate-500 font-medium">
                  AI Detected: <span className={`font-bold ${param.aiValue != null ? 'text-slate-800' : 'text-red-500'}`}>
                    {displayAI}
                  </span>
                </div>

                {/* Override Input */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 font-semibold">
                    {isEdited ? '✎ Override Value' : 'Value'}
                    {param.unit && <span className="text-slate-400 ml-1">({param.unit})</span>}
                  </Label>
                  <div className="flex gap-1.5">
                    <Input
                      type={param.key === 'stages' ? 'number' : 'number'}
                      value={currentVal}
                      onChange={e => handleOverride(param.key, e.target.value)}
                      className={`h-7 text-xs font-bold rounded-lg border transition-all ${
                        isEdited
                          ? 'border-[#ff8c00] bg-white focus-visible:ring-[#ff8c00]/20'
                          : 'border-slate-200 bg-white/50'
                      }`}
                      placeholder={`Enter ${param.label.toLowerCase()}`}
                    />
                    {isEdited && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReset(param.key)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 shrink-0"
                        title="Reset to AI value"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reasoning tooltip */}
                <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-2" title={param.reasoning}>
                  {param.reasoning}
                </p>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
          {editedCount > 0 && (
            <span className="text-[11px] font-semibold text-[#ff8c00] bg-[#ff8c00]/10 border border-[#ff8c00]/20 px-2 py-1 rounded-lg">
              {editedCount} override{editedCount > 1 ? 's' : ''} applied
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 text-slate-500 text-xs font-bold rounded-xl"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              className="bg-[#ff8c00] hover:bg-[#e07b00] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150"
              onClick={handleApply}
            >
              Apply to Calculator
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
