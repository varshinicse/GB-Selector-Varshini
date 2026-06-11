import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ProjectInput } from '../types/ProjectInput';
import { CalculationResult, StageDetail } from '../types/CalculationResult';
import { getStageDetails } from '../services/gearboxCalculator';
import { ArrowRight, Layers, ShieldCheck, Gauge, Zap } from 'lucide-react';

interface StageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOption: CalculationResult | null;
  optionIndex: number | null;
  inputValues: ProjectInput | null;
}

export const StageDetailsModal: React.FC<StageDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedOption,
  optionIndex,
  inputValues,
}) => {
  const [details, setDetails] = useState<StageDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (isOpen && selectedOption && inputValues) {
      Promise.resolve().then(() => {
        if (active) setLoading(true);
      });
      getStageDetails(inputValues, selectedOption)
        .then(res => {
          if (active) {
            setDetails(res);
            setLoading(false);
          }
        })
        .catch(err => {
          console.error(err);
          if (active) {
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, selectedOption, inputValues]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl sm:max-w-[90vw] lg:max-w-5xl bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden p-0 gap-0">
        <DialogHeader className="py-4.5 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#ff8c00]" />
            Drivetrain Configuration Breakdown – Option {optionIndex !== null ? `#${optionIndex + 1}` : ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 border-4 border-[#ff8c00] border-t-transparent rounded-full animate-spin shadow-sm" />
            <span className="text-sm font-bold text-slate-500 tracking-wider">Solving intermediate stage matrices...</span>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Visual Drivetrain Flow */}
            {details.length > 0 && (
              <div className="bg-slate-50/60 border border-slate-150 rounded-xl p-4.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3.5 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#ff8c00]" />
                  Reduction Stage Flow Visualizer
                </div>
                
                <div className="flex items-center justify-start md:justify-center gap-4 py-2 overflow-x-auto flex-nowrap pb-3">
                  <div className="flex flex-col items-center bg-white border border-slate-200 px-3.5 py-2 rounded-lg shadow-sm text-center min-w-[100px] shrink-0">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Input Motor</span>
                    <span className="text-sm font-black text-slate-700 mt-1">{inputValues?.inputRPM} RPM</span>
                    <span className="text-[10px] font-bold text-[#ff8c00] mt-0.5">{inputValues?.powerKW} kW</span>
                  </div>

                  {details.map((d, idx) => (
                    <React.Fragment key={idx}>
                      <ArrowRight className="h-5 w-5 text-slate-300 animate-pulse shrink-0" />
                      <div className="flex flex-col items-center bg-white border border-[#ff8c00]/30 hover:border-[#ff8c00] px-3.5 py-2 rounded-lg shadow-sm text-center min-w-[120px] transition-colors shrink-0">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Stage {d.stage}</span>
                        <span className="text-xs font-black text-slate-800 mt-1">{d.selectedGearbox.size}</span>
                        <span className="text-[10px] font-bold text-slate-500 mt-0.5">Ratio: {d.ratio.toFixed(2)}</span>
                      </div>
                    </React.Fragment>
                  ))}

                  <ArrowRight className="h-5 w-5 text-slate-300 shrink-0" />
                  <div className="flex flex-col items-center bg-slate-900 border border-slate-900 px-3.5 py-2 rounded-lg shadow-md text-center min-w-[100px] shrink-0">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Final Output</span>
                    <span className="text-sm font-black text-white mt-1">{(selectedOption?.total || 0).toFixed(1)} Ratio</span>
                    <span className="text-[10px] font-bold text-[#ff8c00] mt-0.5">{details[details.length - 1]?.speed.toFixed(1)} RPM</span>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Calculations Grid */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
              <Table className="w-full min-w-[850px] border-collapse">
                <TableHeader className="bg-slate-900">
                  <TableRow className="border-0">
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">Stage</TableHead>
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">Ratio</TableHead>
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">Output Speed</TableHead>
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">Nom Torque</TableHead>
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">Max Torque</TableHead>
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">Gearbox size</TableHead>
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">GB Nom cap</TableHead>
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">GB Rated cap</TableHead>
                    <TableHead className="font-bold text-slate-200 text-xs uppercase text-center py-3">Safety Factor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((d, index) => {
                    const isUnsafe = d.safetyFactor < 1.0;
                    return (
                      <TableRow key={index} className="even:bg-slate-50/30 hover:bg-slate-50/80 border-b border-slate-100/80">
                        <TableCell className="text-center font-bold text-slate-500 py-3.5">
                          Stage {d.stage}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-slate-800 py-3.5">
                          {d.ratio.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center py-3.5 font-medium text-slate-700">
                          <span className="flex items-center justify-center gap-1">
                            <Gauge className="h-3 w-3 text-slate-400" />
                            {d.speed.toFixed(1)} <span className="text-[10px] text-slate-400">RPM</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-3.5 font-medium text-slate-700">
                          <span className="flex items-center justify-center gap-1">
                            <Zap className="h-3 w-3 text-slate-350" />
                            {Math.round(d.nominalTorque).toLocaleString()} <span className="text-[10px] text-slate-400">N·m</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-3.5 font-bold text-slate-800">
                          {Math.round(d.maxTorque).toLocaleString()} <span className="text-[10px] text-slate-400">N·m</span>
                        </TableCell>
                        <TableCell className="text-center font-extrabold text-slate-900 py-3.5">
                          {d.selectedGearbox.size}
                        </TableCell>
                        <TableCell className="text-center text-slate-500 py-3.5 text-xs font-semibold">
                          {d.selectedGearbox.nominal.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-slate-500 py-3.5 text-xs font-semibold">
                          {d.selectedGearbox.rated.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center py-3.5">
                          {isUnsafe ? (
                            <Badge className="bg-red-500 hover:bg-red-600 text-white font-extrabold px-3 py-1 rounded shadow-sm text-xs min-w-[55px] justify-center transition-colors">
                              {d.safetyFactor.toFixed(2)}
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1 rounded shadow-sm text-xs min-w-[55px] justify-center transition-colors">
                              {d.safetyFactor.toFixed(2)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
