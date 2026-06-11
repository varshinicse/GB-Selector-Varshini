/**
 * MAGTORQ GB-Selector
 * Parameter Origin Matrix
 * Tabular breakdown of all parameters with source badges and confidence indicators.
 */

import React from 'react';
import { AlertTriangle, HelpCircle, Cpu, BookOpen, Calculator } from 'lucide-react';
import { EngineeringReport, AuditParameterNode } from '../services/engineeringReasoningEngine';

interface ParameterOriginMatrixProps {
  report: EngineeringReport;
}

type ParameterType = 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED' | 'ENGINE_RULE';

const TYPE_CONFIG: Record<ParameterType, {
  label: string;
  badgeCls: string;
  dotCls: string;
  icon: React.ReactNode;
  desc: string;
}> = {
  EXTRACTED: {
    label: 'Provided',
    badgeCls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dotCls: 'bg-emerald-500',
    icon: <BookOpen className="h-3 w-3" />,
    desc: 'Directly from document'
  },
  CALCULATED: {
    label: 'Calculated',
    badgeCls: 'bg-blue-100 text-blue-700 border-blue-200',
    dotCls: 'bg-blue-500',
    icon: <Calculator className="h-3 w-3" />,
    desc: 'Derived by formula'
  },
  DERIVED: {
    label: 'Derived',
    badgeCls: 'bg-purple-100 text-purple-700 border-purple-200',
    dotCls: 'bg-purple-500',
    icon: <Cpu className="h-3 w-3" />,
    desc: 'Derived from related inputs'
  },
  ENGINE_RULE: {
    label: 'Derived (Rule)',
    badgeCls: 'bg-indigo-100 text-indigo-750 border-indigo-200',
    dotCls: 'bg-indigo-500',
    icon: <Cpu className="h-3 w-3" />,
    desc: 'Resolved via Engineering Derivation Rule'
  },
  SUGGESTED: {
    label: 'Suggested',
    badgeCls: 'bg-amber-100 text-amber-700 border-amber-200',
    dotCls: 'bg-amber-500',
    icon: <AlertTriangle className="h-3 w-3" />,
    desc: 'Engine-suggested default'
  },
  ASSUMED: {
    label: 'Assumed',
    badgeCls: 'bg-slate-100 text-slate-500 border-slate-200',
    dotCls: 'bg-slate-400',
    icon: <HelpCircle className="h-3 w-3" />,
    desc: 'Assumed — verify required'
  }
};

function ConfidencePip({ level }: { level: string }) {
  const cls =
    level === 'High' ? 'bg-emerald-500' :
    level === 'Medium' ? 'bg-amber-400' :
    'bg-red-400';
  return (
    <div className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${cls} shadow-sm`} />
      <span className={`text-[10px] font-bold ${
        level === 'High' ? 'text-emerald-600' : level === 'Medium' ? 'text-amber-600' : 'text-red-600'
      }`}>{level}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ParameterRow({ node, label, unit }: { node: AuditParameterNode<any>; label: string; unit?: string }) {
  const type = (node.type || 'ASSUMED') as ParameterType;
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.ASSUMED;
  const displayVal = node.value != null
    ? `${typeof node.value === 'number' ? node.value.toFixed(node.value % 1 === 0 ? 0 : 2) : node.value}${unit ? ` ${unit}` : ''}`
    : '—';

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors duration-100 group">
      {/* Parameter */}
      <td className="py-2.5 px-3">
        <span className="text-xs font-bold text-slate-700">{label}</span>
      </td>
      {/* Value */}
      <td className="py-2.5 px-3">
        <span className={`text-xs font-black ${node.value != null ? 'text-slate-900' : 'text-slate-400'}`}>
          {displayVal}
        </span>
      </td>
      {/* Type badge */}
      <td className="py-2.5 px-3">
        <span className={`inline-flex items-center gap-1 border text-[9px] font-black px-1.5 py-0.5 rounded-full ${cfg.badgeCls}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      </td>
      {/* Confidence */}
      <td className="py-2.5 px-3">
        <ConfidencePip level={node.confidence} />
      </td>
      {/* Source */}
      <td className="py-2.5 px-3">
        <span className="text-[10px] text-slate-500 font-semibold">{node.source}</span>
      </td>
      {/* Justification */}
      <td className="py-2.5 px-3">
        <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
          {node.reasoning}
        </p>
      </td>
    </tr>
  );
}

export const ParameterOriginMatrix: React.FC<ParameterOriginMatrixProps> = ({ report }) => {
  // Count types for summary pills
  const coreTypes: ParameterType[] = [
    report.powerKW.type, report.motorHP.type, report.motorPoles.type,
    report.inputRPM.type, report.outputRPM.type, report.totalRatio.type,
    report.stages.type, report.serviceFactor.type
  ] as ParameterType[];

  if (report.outputTorqueNm) coreTypes.push(report.outputTorqueNm.type);
  if (report.rmsTorqueNm) coreTypes.push(report.rmsTorqueNm.type);
  if (report.accelerationTorqueNm) coreTypes.push(report.accelerationTorqueNm.type);
  if (report.effectiveThermalPowerKW) coreTypes.push(report.effectiveThermalPowerKW.type);
  if (report.requiredLifeHours) coreTypes.push(report.requiredLifeHours.type);

  if (report.extractedEngineeringParams) {
    Object.entries(report.extractedEngineeringParams).forEach(([key, node]) => {
      const coreKeys = [
        'powerKW', 'motorHP', 'motorPoles', 'inputRPM', 'outputRPM',
        'totalRatio', 'stages', 'serviceFactor', 'outputTorqueNm',
        'rmsTorqueNm', 'accelerationTorqueNm', 'effectiveThermalPowerKW',
        'requiredLifeHours'
      ];
      if (!coreKeys.includes(key)) {
        coreTypes.push(node.type);
      }
    });
  }

  const typeCounts = coreTypes.reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Legend pills */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_CONFIG) as ParameterType[]).map(t => {
          const cfg = TYPE_CONFIG[t];
          const count = typeCounts[t] || 0;
          return (
            <div key={t} className={`flex items-center gap-1.5 border text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badgeCls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotCls}`} />
              {cfg.label}
              {count > 0 && (
                <span className="bg-white/60 rounded-full px-1 font-black">{count}</span>
              )}
              <span className="text-[9px] font-medium opacity-70">— {cfg.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Matrix table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900">
              {['Parameter', 'Value', 'Origin', 'Confidence', 'Source', 'Justification'].map(h => (
                <th key={h} className="py-2.5 px-3 text-[9px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            <ParameterRow node={report.powerKW} label="Power" unit="kW" />
            <ParameterRow node={report.motorHP} label="Motor HP" unit="HP" />
            <ParameterRow node={report.motorPoles} label="Motor Poles" unit="Poles" />
            <ParameterRow node={report.inputRPM} label="Input Speed" unit="RPM" />
            <ParameterRow node={report.outputRPM} label="Output Speed" unit="RPM" />
            <ParameterRow node={report.totalRatio} label="Total Ratio" unit=":1" />
            <ParameterRow node={report.stages} label="Stages" />
            <ParameterRow node={report.serviceFactor} label="Service Factor" />
            {report.outputTorqueNm?.value !== undefined && report.outputTorqueNm?.value !== null && <ParameterRow node={report.outputTorqueNm} label="Output Torque" unit="N·m" />}
            {report.rmsTorqueNm?.value !== undefined && report.rmsTorqueNm?.value !== null && <ParameterRow node={report.rmsTorqueNm} label="RMS Torque" unit="N·m" />}
            {report.accelerationTorqueNm?.value !== undefined && report.accelerationTorqueNm?.value !== null && <ParameterRow node={report.accelerationTorqueNm} label="Acceleration Torque" unit="N·m" />}
            {report.effectiveThermalPowerKW?.value !== undefined && report.effectiveThermalPowerKW?.value !== null && <ParameterRow node={report.effectiveThermalPowerKW} label="Effective Thermal Power" unit="kW" />}
            {report.requiredLifeHours?.value !== undefined && report.requiredLifeHours?.value !== null && <ParameterRow node={report.requiredLifeHours} label="Required Life" unit="hrs" />}
            {report.extractedEngineeringParams && Object.entries(report.extractedEngineeringParams).map(([key, node]) => {
              const coreKeys = [
                'powerKW', 'motorHP', 'motorPoles', 'inputRPM', 'outputRPM',
                'totalRatio', 'stages', 'serviceFactor', 'outputTorqueNm',
                'rmsTorqueNm', 'accelerationTorqueNm', 'effectiveThermalPowerKW',
                'requiredLifeHours'
              ];
              if (coreKeys.includes(key)) return null;
              
              let unit = '';
              if (key.endsWith('_kW') || key.toLowerCase().includes('power')) unit = 'kW';
              else if (key.endsWith('_m_s') || key.toLowerCase().includes('speed')) {
                unit = 'm/s';
              } else if (key.endsWith('_m') || key.toLowerCase().includes('diameter')) unit = 'm';
              else if (key.endsWith('_N') || key.toLowerCase().includes('load') || key.toLowerCase().includes('pull')) {
                unit = 'N';
              } else if (key.endsWith('_Pa')) unit = 'Pa';
              else if (key.endsWith('_kg_m3')) unit = 'kg/m³';
              else if (key.endsWith('_kg_m2')) unit = 'kg·m²';
              else if (key.endsWith('_RPM')) unit = 'RPM';
              else if (key.endsWith('_s')) unit = 's';
              else if (key.endsWith('_min')) unit = 'min';

              return (
                <ParameterRow 
                  key={key} 
                  node={node} 
                  label={node.name} 
                  unit={unit} 
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Assumptions list */}
      {report.assumptions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-xs font-black text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Engineering Assumptions ({report.assumptions.length})
          </h4>
          <ul className="space-y-2">
            {report.assumptions.map((a, i) => (
              <li key={i} className="flex gap-2 text-[11px]">
                <span className="font-black text-amber-700 shrink-0 mt-0.5">•</span>
                <span>
                  <strong className="text-amber-800">{a.parameter}</strong>
                  <span className="text-amber-700"> assumed as </span>
                  <strong className="text-amber-800">{a.assumption}</strong>
                  <span className="text-amber-600"> — {a.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
