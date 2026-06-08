import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalculationResult } from '../types/CalculationResult';
import { ChevronDown, ListFilter } from 'lucide-react';

interface ResultsTableProps {
  results: CalculationResult[];
  onSelectOption: (result: CalculationResult) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ results, onSelectOption }) => {
  if (results.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-2xl overflow-hidden mt-6 transition-all duration-300">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
            <ListFilter className="h-4.5 w-4.5 text-[#ff8c00]" />
            Calculation Results (Top {results.length} Options)
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Permutations are ranked by deviation. Double-click any row to open the detailed engineering breakdown.
          </p>
        </div>
        <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded tracking-wide">
          AUTO-RESOLVED
        </div>
      </div>

      <div className="overflow-x-auto max-h-[420px] scrollbar-thin">
        <Table className="relative w-full border-collapse">
          <TableHeader className="bg-slate-900 sticky top-0 z-10 shadow-md">
            <TableRow className="border-0 hover:bg-slate-900">
              <TableHead className="w-[85px] text-center font-bold text-slate-200 text-xs uppercase tracking-wider py-3.5">Opt</TableHead>
              <TableHead className="text-center font-bold text-slate-200 text-xs uppercase tracking-wider py-3.5">Ratios Breakdown</TableHead>
              <TableHead className="text-center font-bold text-slate-200 text-xs uppercase tracking-wider py-3.5">Total Ratio</TableHead>
              <TableHead className="text-center font-bold text-slate-200 text-xs uppercase tracking-wider py-3.5">
                <div className="flex items-center justify-center gap-1">
                  Dev %
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </div>
              </TableHead>
              <TableHead className="text-center font-bold text-slate-200 text-xs uppercase tracking-wider py-3.5">Nom Torque (N·m)</TableHead>
              <TableHead className="text-center font-bold text-slate-200 text-xs uppercase tracking-wider py-3.5">Max Torque (N·m)</TableHead>
              <TableHead className="text-center font-bold text-slate-200 text-xs uppercase tracking-wider py-3.5">Selected Output model</TableHead>
              <TableHead className="text-center font-bold text-slate-200 text-xs uppercase tracking-wider py-3.5">Safety Check</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r, i) => {
              const gb = r.lastStageGearbox;
              const nominalExceeded = gb ? r.nominal > gb.nominal : false;
              const ratedExceeded = gb ? r.max > gb.rated : false;
              const isOverloaded = nominalExceeded || ratedExceeded;
              const isHighDev = Math.abs(r.deviation) > 3;

              return (
                <TableRow
                  key={i}
                  onDoubleClick={() => onSelectOption(r)}
                  className="even:bg-slate-50/40 hover:bg-[#ff8c00]/5 dark:hover:bg-[#ff8c00]/5 cursor-pointer transition-all duration-150 border-b border-slate-100/80"
                  title="Double-click to open detailed stage breakdown"
                >
                  <TableCell className="font-bold text-center text-slate-500 py-3.5">
                    #{i + 1}
                  </TableCell>
                  <TableCell className="font-semibold text-center text-slate-800 py-3.5 tracking-wide">
                    {r.ratios.map(x => x.toFixed(2)).join(' × ')}
                  </TableCell>
                  <TableCell className="font-extrabold text-center text-slate-900 py-3.5">
                    {r.total.toFixed(2)}
                  </TableCell>
                  <TableCell
                    className={`font-extrabold text-center py-3.5 ${
                      isHighDev
                        ? 'text-red-500 text-shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                        : 'text-[#ff8c00]'
                    }`}
                  >
                    {r.deviation > 0 ? `+${r.deviation.toFixed(2)}` : r.deviation.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-center text-slate-700 py-3.5 font-medium">
                    {Math.round(r.nominal).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center text-slate-700 py-3.5 font-semibold">
                    {Math.round(r.max).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center font-extrabold text-slate-900 py-3.5">
                    {gb ? gb.size : 'N/A'}
                  </TableCell>
                  <TableCell className="text-center py-3.5">
                    {isOverloaded ? (
                      <Badge className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold px-2.5 py-1 rounded-full text-[10px] tracking-wide shadow-sm flex items-center justify-center gap-1 mx-auto max-w-[100px] transition-colors duration-150">
                        <span>⚠ Overloaded</span>
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-[10px] tracking-wide shadow-sm flex items-center justify-center gap-1 mx-auto max-w-[85px] transition-colors duration-150">
                        <span>⚡ Safe</span>
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
  );
};
