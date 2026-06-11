import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wrench, Layers, ShieldCheck, Cog } from 'lucide-react';
import { ProjectInput } from '../types/ProjectInput';

interface DesignParametersCardProps {
  values: ProjectInput;
  onChange: (fields: Partial<ProjectInput>) => void;
}

export const DesignParametersCard: React.FC<DesignParametersCardProps> = ({
  values,
  onChange,
}) => {
  const handleStagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') return;
    
    let newStages = parseInt(value, 10);
    if (newStages < 1) newStages = 1;
    if (newStages > 4) newStages = 4;

    const newStageSeries = [...values.stageSeries];
    
    if (newStages > newStageSeries.length) {
      for (let i = newStageSeries.length; i < newStages; i++) {
        let defaultSeries = 's4';
        if (i === 0) defaultSeries = 's1';
        else if (i === 1) defaultSeries = 's2';
        else if (i === 2) defaultSeries = 's3';
        newStageSeries.push(defaultSeries);
      }
    } else if (newStages < newStageSeries.length) {
      newStageSeries.splice(newStages);
    }

    onChange({
      stages: newStages,
      stageSeries: newStageSeries,
    });
  };

  const handleSeriesChange = (stageIdx: number, val: string) => {
    const newStageSeries = [...values.stageSeries];
    newStageSeries[stageIdx] = val;
    onChange({ stageSeries: newStageSeries });
  };

  const handleSfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onChange({
      serviceFactor: value === '' ? '' : parseFloat(value)
    });
  };

  return (
    <Card className="bg-white border-t-4 border-[#ff8c00] border-slate-200 shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <Wrench className="h-4.5 w-4.5 text-[#ff8c00]" />
          Design Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="stages" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            No. of Stages
          </Label>
          <Input
            id="stages"
            type="number"
            min="1"
            max="4"
            value={values.stages}
            onChange={handleStagesChange}
            className="bg-slate-50/30 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00] rounded-xl transition-all duration-200 text-sm py-2 h-9"
          />
        </div>

        {/* Dynamic Stage Dropdowns */}
        <div className="space-y-3 pt-1">
          {Array.from({ length: values.stages }).map((_, idx) => {
            const currentSeries = values.stageSeries[idx] || 's4';
            return (
              <div key={idx} className="flex items-center justify-between gap-4 bg-slate-50/40 border border-slate-150 rounded-xl p-2.5 shadow-inner">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Cog className="h-3.5 w-3.5 text-[#ff8c00] animate-[spin_10s_linear_infinite]" />
                  Stage {idx + 1} Series
                </Label>
                <select
                  value={currentSeries}
                  onChange={(e) => handleSeriesChange(idx, e.target.value)}
                  className="flex h-9 w-[120px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#ff8c00]/25 focus:border-[#ff8c00] text-slate-700"
                >
                  <option value="s1">S1 (Stage 1)</option>
                  <option value="s2">S2 (Stage 2)</option>
                  <option value="s3">S3 (Stage 3)</option>
                  <option value="s4">S4 (Stage 4)</option>
                </select>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="serviceFactor" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            Service Factor
          </Label>
          <Input
            id="serviceFactor"
            type="number"
            min="1.0"
            step="0.1"
            placeholder="E.g., 1.5"
            value={values.serviceFactor}
            onChange={handleSfChange}
            className="bg-slate-50/30 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00] rounded-xl transition-all duration-200 text-sm py-2 h-9"
          />
        </div>
      </CardContent>
    </Card>
  );
};
