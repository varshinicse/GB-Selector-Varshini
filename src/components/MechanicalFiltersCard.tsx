/**
 * MAGTORQ GB-Selector
 * Mechanical Filters Card
 * UI panel for mounting, shaft, frame, and adapter preferences.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Wrench, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MechanicalFilters, DEFAULT_MECHANICAL_FILTERS, MountingType, ShaftType } from '../types/Gearbox';

interface MechanicalFiltersCardProps {
  filters: MechanicalFilters;
  onChange: (filters: MechanicalFilters) => void;
}

const MOUNTING_OPTIONS: Array<{ value: MountingType | 'Any'; label: string }> = [
  { value: 'Any', label: 'Any' },
  { value: 'Foot', label: 'Foot Mount' },
  { value: 'Flange', label: 'Flange Mount' },
  { value: 'Hollow Shaft', label: 'Hollow Shaft' },
  { value: 'Torque Arm', label: 'Torque Arm' },
];

const SHAFT_OPTIONS: Array<{ value: ShaftType | 'Any'; label: string }> = [
  { value: 'Any', label: 'Any' },
  { value: 'Solid', label: 'Solid Shaft' },
  { value: 'Hollow', label: 'Hollow Shaft' },
  { value: 'Splined', label: 'Splined Shaft' },
];

const ADAPTER_OPTIONS: Array<{ value: boolean | null; label: string }> = [
  { value: null, label: 'Any' },
  { value: true, label: 'Required' },
  { value: false, label: 'Not Required' },
];

function SelectGroup<T extends string | boolean | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all duration-150 ${
              value === opt.value
                ? 'bg-[#ff8c00] border-[#ff8c00] text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const MechanicalFiltersCard: React.FC<MechanicalFiltersCardProps> = ({ filters, onChange }) => {
  const update = (partial: Partial<MechanicalFilters>) =>
    onChange({ ...filters, ...partial });

  const isDefault =
    filters.mounting === 'Any' &&
    filters.shaft === 'Any' &&
    filters.frameMin === null &&
    filters.frameMax === null &&
    filters.adapterRequired === null;

  return (
    <Card className="bg-white border-t-4 border-[#ff8c00] border-slate-200 shadow-md rounded-2xl transition-all duration-300 hover:shadow-lg">
      <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[#ff8c00]" />
            Mechanical Configuration Filters
          </div>
          {!isDefault && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 h-6 px-2"
              onClick={() => onChange({ ...DEFAULT_MECHANICAL_FILTERS })}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </CardTitle>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
          Filter gearbox selections by mounting configuration, shaft type, frame size, and adapter requirements.
          <span className="text-amber-500 font-bold ml-1">
            ⚠ Catalog data is schema-ready — populate Gearbox.ts with catalog values to activate filtering.
          </span>
        </p>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Mounting Type */}
        <SelectGroup
          label="Mounting Type"
          options={MOUNTING_OPTIONS}
          value={filters.mounting}
          onChange={v => update({ mounting: v as MountingType | 'Any' })}
        />

        {/* Shaft Type */}
        <SelectGroup
          label="Output Shaft Type"
          options={SHAFT_OPTIONS}
          value={filters.shaft}
          onChange={v => update({ shaft: v as ShaftType | 'Any' })}
        />

        {/* Frame Size Range */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Frame Size (Housing OD, mm)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.frameMin ?? ''}
              onChange={e => update({ frameMin: e.target.value ? parseFloat(e.target.value) : null })}
              className="h-8 w-24 text-xs font-bold rounded-lg border-slate-200 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00]"
            />
            <span className="text-xs text-slate-400 font-bold">—</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.frameMax ?? ''}
              onChange={e => update({ frameMax: e.target.value ? parseFloat(e.target.value) : null })}
              className="h-8 w-24 text-xs font-bold rounded-lg border-slate-200 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00]"
            />
            <span className="text-[10px] text-slate-400 font-semibold">mm</span>
            {(filters.frameMin !== null || filters.frameMax !== null) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-slate-400 hover:text-slate-600 px-1.5"
                onClick={() => update({ frameMin: null, frameMax: null })}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Adapter Plate */}
        <SelectGroup
          label="Adapter Plate"
          options={ADAPTER_OPTIONS}
          value={filters.adapterRequired}
          onChange={v => update({ adapterRequired: v as boolean | null })}
        />

        {/* Active filter summary */}
        {!isDefault && (
          <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold text-[#ff8c00] uppercase tracking-wider mb-1">Active Filters</p>
            <div className="flex flex-wrap gap-1">
              {filters.mounting !== 'Any' && (
                <span className="bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Mounting: {filters.mounting}
                </span>
              )}
              {filters.shaft !== 'Any' && (
                <span className="bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Shaft: {filters.shaft}
                </span>
              )}
              {(filters.frameMin !== null || filters.frameMax !== null) && (
                <span className="bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Frame: {filters.frameMin ?? '—'}–{filters.frameMax ?? '—'} mm
                </span>
              )}
              {filters.adapterRequired !== null && (
                <span className="bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Adapter: {filters.adapterRequired ? 'Required' : 'Not Required'}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
