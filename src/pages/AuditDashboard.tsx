/**
 * MAGTORQ GB-Selector
 * Audit & Verification Dashboard — Full page showing:
 * - 100-point animated score card
 * - Parameter Origin Matrix
 * - Calculation Audit Table (original vs. recomputed vs. error%)
 * - Database Integrity Panel
 * - Critical Failures & Warnings
 */

import React, { useState } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, Database,
  ChevronDown, ChevronRight, Info, Activity
} from 'lucide-react';
import { ScoreGauge } from '../components/ScoreGauge';
import { ParameterOriginMatrix } from '../components/ParameterOriginMatrix';
import { EngineeringReport } from '../services/engineeringReasoningEngine';
import { VerificationReport } from '../services/verificationEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditDashboardProps {
  engineeringReport: EngineeringReport;
  verificationReport: VerificationReport;
  projectName: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CheckNodeCardProps {
  name: string;
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
}

const CheckNodeCard: React.FC<CheckNodeCardProps> = ({ name, passed, message }) => (
  <div className={`rounded-xl border p-3.5 flex items-start gap-3 transition-all duration-200 ${
    passed
      ? 'border-emerald-200 bg-emerald-50'
      : 'border-red-200 bg-red-50'
  }`}>
    {passed
      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
      : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
    }
    <div>
      <p className={`text-xs font-black ${passed ? 'text-emerald-700' : 'text-red-700'}`}>{name}</p>
      <p className={`text-[10px] mt-0.5 leading-relaxed ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
        {message.replace(/[✓❌✗]/g, '').trim()}
      </p>
    </div>
  </div>
);

interface CollapseSection {
  id: string;
  title: string;
  children: React.ReactNode;
  count?: number;
  severity?: 'critical' | 'warning' | 'info' | 'neutral';
}

const CollapseSection: React.FC<CollapseSection> = ({ id, title, children, count, severity = 'neutral' }) => {
  const [open, setOpen] = useState(true);

  const headerCls = {
    critical: 'border-red-200 bg-red-50 text-red-700',
    warning:  'border-amber-200 bg-amber-50 text-amber-700',
    info:     'border-blue-200 bg-blue-50 text-blue-700',
    neutral:  'border-slate-200 bg-slate-50 text-slate-700',
  }[severity];

  const dotCls = {
    critical: 'bg-red-500',
    warning:  'bg-amber-500',
    info:     'bg-blue-500',
    neutral:  'bg-slate-400',
  }[severity];

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm" id={id}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 border-b ${headerCls} transition-colors duration-150`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotCls}`} />
          <span className="text-xs font-black uppercase tracking-wider">{title}</span>
          {count !== undefined && (
            <span className="text-[10px] font-black bg-white/60 px-1.5 py-0.5 rounded-full border border-current/20">
              {count}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="bg-white p-4">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export const AuditDashboard: React.FC<AuditDashboardProps> = ({
  engineeringReport,
  verificationReport,
  projectName
}) => {
  const score = verificationReport.overallScore;
  const checks = [
    verificationReport.formulaVerification,
    verificationReport.ratioVerification,
    verificationReport.torqueVerification,
    verificationReport.gearboxSelectionVerification,
    verificationReport.safetyFactorVerification,
    verificationReport.databaseVerification,
  ];
  const passCount = checks.filter(c => c.passed).length;

  return (
    <div className="w-full space-y-6">

      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-[#ff8c00]" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Verification & Audit Dashboard</span>
        </div>
        <h1 className="text-xl font-black text-white">{projectName}</h1>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Engineering Design & Reasoning Engine — Independent Calculation Review
        </p>
      </div>

      {/* ── Score + Checks Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Score Gauge */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center gap-3">
          <ScoreGauge score={score} size={170} />
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall Score</p>
            <p className="text-xs text-slate-600 font-semibold mt-0.5">
              {passCount} of {checks.length} checks passed
            </p>
          </div>
        </div>

        {/* Check Nodes */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {checks.map((c, i) => (
            <CheckNodeCard key={i} {...c} />
          ))}
        </div>
      </div>

      {/* ── Score Category Breakdown ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-[#ff8c00]" />
          Score Category Breakdown (25 pts each)
        </h3>
        {[
          { label: 'Input Validation', key: 'input', score: !verificationReport.criticalFailures.some(f => f.toLowerCase().includes('negative') || f.toLowerCase().includes('input')) ? 25 : 0 },
          { label: 'Formula Accuracy', key: 'formula', score: !verificationReport.criticalFailures.some(f => f.toLowerCase().includes('recalculation') || f.toLowerCase().includes('deviation') || f.toLowerCase().includes('formula')) ? 25 : 0 },
          { label: 'Database Integrity', key: 'db', score: !verificationReport.criticalFailures.some(f => f.toLowerCase().includes('database error') || f.toLowerCase().includes('loading failure')) ? 25 : 0 },
          { label: 'Gearbox Selection', key: 'gb', score: !verificationReport.criticalFailures.some(f => f.toLowerCase().includes('safety factor') || f.toLowerCase().includes('exceeds largest') || f.toLowerCase().includes('impossible stage') || f.toLowerCase().includes('capacity')) ? 25 : 0 },
        ].map(cat => {
          const pct = cat.score; // out of 25 → display as fraction of 25
          const color = cat.score === 25 ? '#10b981' : '#ef4444';
          return (
            <div key={cat.key} className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-600">{cat.label}</span>
                <span className="text-xs font-black" style={{ color }}>{cat.score}/25</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(pct / 25) * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Critical Failures ─────────────────────────────────────────────── */}
      {verificationReport.criticalFailures.length > 0 && (
        <CollapseSection
          id="critical-failures"
          title="Critical Failures"
          count={verificationReport.criticalFailures.length}
          severity="critical"
        >
          <ul className="space-y-2">
            {verificationReport.criticalFailures.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                <span className="text-red-700 font-semibold leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </CollapseSection>
      )}

      {/* ── Warnings ──────────────────────────────────────────────────────── */}
      {verificationReport.warnings.length > 0 && (
        <CollapseSection
          id="warnings"
          title="Warnings"
          count={verificationReport.warnings.length}
          severity="warning"
        >
          <ul className="space-y-2">
            {verificationReport.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-amber-700 font-semibold leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </CollapseSection>
      )}

      {/* ── Infos & AI Extractions ────────────────────────────────────────── */}
      {verificationReport.infos.length > 0 && (
        <CollapseSection
          id="infos"
          title="AI Extraction Log & Derivation Notes"
          count={verificationReport.infos.length}
          severity="info"
        >
          <ul className="space-y-1.5">
            {verificationReport.infos.map((info, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-blue-700 font-semibold">{info}</span>
              </li>
            ))}
          </ul>
        </CollapseSection>
      )}

      {/* ── Calculation Audit Table ───────────────────────────────────────── */}
      <CollapseSection
        id="calc-audit"
        title="Formula Re-computation Audit (tolerance ≤ 0.1%)"
        count={verificationReport.calculationsAudited.length}
        severity="neutral"
      >
        {verificationReport.calculationsAudited.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No calculations were re-computed (requires a valid drivetrain solution).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  {['Calculation Name', 'Original', 'Recomputed', 'Error %', 'Result'].map(h => (
                    <th key={h} className="py-2 px-2 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {verificationReport.calculationsAudited.map((c, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`}>
                    <td className="py-2 px-2 text-xs font-semibold text-slate-700">{c.name}</td>
                    <td className="py-2 px-2 text-xs font-mono text-slate-800 font-bold">{c.original}</td>
                    <td className="py-2 px-2 text-xs font-mono text-slate-800">{c.recomputed}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs font-black ${
                        c.errorPct <= 0.1 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {c.errorPct.toFixed(4)}%
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {c.passed
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> PASS
                          </span>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                            <XCircle className="h-3 w-3" /> FAIL
                          </span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapseSection>

      {/* ── Parameter Origin Matrix ───────────────────────────────────────── */}
      <CollapseSection
        id="param-origin"
        title="Parameter Origin Matrix — Provided / Derived / Calculated"
        severity="neutral"
      >
        <ParameterOriginMatrix report={engineeringReport} />
      </CollapseSection>

      {/* ── Database Integrity ────────────────────────────────────────────── */}
      <CollapseSection
        id="db-integrity"
        title="Database Integrity Scan"
        severity={verificationReport.databaseVerification.passed ? 'neutral' : 'critical'}
      >
        <div className="flex items-start gap-3">
          <Database className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className={`text-xs font-bold ${
              verificationReport.databaseVerification.passed ? 'text-emerald-700' : 'text-red-700'
            }`}>
              {verificationReport.databaseVerification.message.replace(/[✓❌]/g, '').trim()}
            </p>
            {verificationReport.databaseVerification.passed && (
              <ul className="text-[11px] text-slate-500 space-y-1 font-semibold">
                <li>✓ All gearbox nominal & rated capacities are positive non-zero values.</li>
                <li>✓ No duplicate gearbox size entries detected.</li>
                <li>✓ All S1–S4 stage ratio tables within specification bounds.</li>
              </ul>
            )}
          </div>
        </div>
      </CollapseSection>

      {/* ── Stage-by-Stage Drivetrain Summary ────────────────────────────── */}
      {engineeringReport.stageTraces.length > 0 && (
        <CollapseSection
          id="stage-trace"
          title="Stage-by-Stage Drivetrain Summary"
          severity="neutral"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-slate-900">
                  {['Stage', 'Ratio', 'Output Speed', 'Nominal Torque', 'Peak Torque', 'Selected Gearbox', 'Safety Factor', 'Status'].map(h => (
                    <th key={h} className="py-2.5 px-3 text-[9px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engineeringReport.stageTraces.map((t, i) => {
                  const safe = t.safetyFactor >= 1.0;
                  return (
                    <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className="py-2.5 px-3 text-xs font-black text-slate-700">Stage {t.stage}</td>
                      <td className="py-2.5 px-3 text-xs font-bold text-slate-700">{t.ratio.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{t.speed.toFixed(1)} RPM</td>
                      <td className="py-2.5 px-3 text-xs font-bold text-slate-800">{Math.round(t.nominalTorque).toLocaleString()} N·m</td>
                      <td className="py-2.5 px-3 text-xs font-bold text-slate-800">{Math.round(t.maxTorque).toLocaleString()} N·m</td>
                      <td className="py-2.5 px-3 text-xs font-bold text-slate-900">
                        MAGTORQ {t.selectedGearbox.size}
                        <span className="font-normal text-slate-400 ml-1">(S{t.selectedGearbox.series})</span>
                      </td>
                      <td className={`py-2.5 px-3 text-xs font-black ${safe ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.safetyFactor.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                          safe
                            ? 'text-emerald-700 bg-emerald-100 border-emerald-200'
                            : 'text-red-700 bg-red-100 border-red-200'
                        }`}>
                          {safe ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {safe ? 'SAFE' : 'OVERLOADED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapseSection>
      )}
    </div>
  );
};
