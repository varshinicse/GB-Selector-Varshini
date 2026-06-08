import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Tag, Compass, Zap, Gauge } from 'lucide-react';
import { ProjectInput } from '../types/ProjectInput';

interface OperatingParametersCardProps {
  values: ProjectInput;
  onChange: (fields: Partial<ProjectInput>) => void;
}

export const OperatingParametersCard: React.FC<OperatingParametersCardProps> = ({
  values,
  onChange,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    onChange({
      [id]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    });
  };

  return (
    <Card className="bg-white border-t-4 border-[#ff8c00] border-slate-200 shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <Settings className="h-4.5 w-4.5 text-[#ff8c00] animate-[spin_30s_linear_infinite]" />
          Operating Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="projectName" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-slate-400" />
            Project Name
          </Label>
          <Input
            id="projectName"
            type="text"
            placeholder="E.g., Conveyor S1"
            value={values.projectName}
            onChange={handleChange}
            className="bg-slate-50/30 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00] rounded-xl transition-all duration-200 text-sm py-2 h-9"
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="totalRatio" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-slate-400" />
            Total Required Ratio
          </Label>
          <Input
            id="totalRatio"
            type="number"
            min="1"
            step="0.01"
            placeholder="Target reduction ratio"
            value={values.totalRatio}
            onChange={handleChange}
            className="bg-slate-50/30 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00] rounded-xl transition-all duration-200 text-sm py-2 h-9"
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="powerKW" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-slate-400" />
            Power (kW)
          </Label>
          <Input
            id="powerKW"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="Input drive power in kilowatts"
            value={values.powerKW}
            onChange={handleChange}
            className="bg-slate-50/30 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00] rounded-xl transition-all duration-200 text-sm py-2 h-9"
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="inputRPM" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-slate-400" />
            Input Speed (RPM)
          </Label>
          <Input
            id="inputRPM"
            type="number"
            min="1"
            placeholder="Motor shaft speed in RPM"
            value={values.inputRPM}
            onChange={handleChange}
            className="bg-slate-50/30 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00] rounded-xl transition-all duration-200 text-sm py-2 h-9"
          />
        </div>
      </CardContent>
    </Card>
  );
};
