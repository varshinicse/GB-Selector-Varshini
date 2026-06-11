import React, { useState } from 'react';
import { Header } from '../components/Header';
import { RequirementAnalyzer } from '../components/RequirementAnalyzer';
import { OperatingParametersCard } from '../components/OperatingParametersCard';
import { DesignParametersCard } from '../components/DesignParametersCard';
import { ResultsTable } from '../components/ResultsTable';
import { StageDetailsModal } from '../components/StageDetailsModal';
import { AuditDashboard } from './AuditDashboard';
import { ProjectInput, DEFAULT_MECHANICAL_FILTERS } from '../types/ProjectInput';
import { CalculationResult } from '../types/CalculationResult';
import { calculateGearboxOptions } from '../services/gearboxCalculator';
import { EngineeringReport } from '../services/engineeringReasoningEngine';
import { VerificationReport } from '../services/verificationEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, ShieldCheck, Settings2 } from 'lucide-react';

type AppTab = 'selector' | 'audit';

export const GearboxSelector: React.FC = () => {
  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AppTab>('selector');

  // ── Calculator state ───────────────────────────────────────────────────────
  const [inputs, setInputs] = useState<ProjectInput>({
    projectName: 'SREEKANTH.M',
    totalRatio: '',
    powerKW: '',
    inputRPM: '',
    stages: 1,
    stageSeries: ['s1'],
    serviceFactor: '',
    mechanicalFilters: { ...DEFAULT_MECHANICAL_FILTERS },
  });

  const [numOptions, setNumOptions] = useState<number>(5);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<CalculationResult | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Audit reports from RequirementAnalyzer ─────────────────────────────────
  const [engineeringReport, setEngineeringReport] = useState<EngineeringReport | null>(null);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const [auditProjectName, setAuditProjectName] = useState<string>('MAGTORQ Project');

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleInputChange = (fields: Partial<ProjectInput>) => {
    setInputs((prev) => ({ ...prev, ...fields }));
  };

  const handleAutoFill = (extracted: Partial<ProjectInput>) => {
    setInputs((prev) => {
      const cleanExtracted = Object.entries(extracted).reduce((acc, [key, val]) => {
        if (val !== undefined && val !== null) {
          acc[key as keyof ProjectInput] = val as never;
        }
        return acc;
      }, {} as Partial<ProjectInput>);

      const stagesVal = (cleanExtracted.stages as number | undefined) ?? prev.stages;
      let seriesVal = [...prev.stageSeries];

      if (cleanExtracted.stages) {
        seriesVal = [];
        for (let i = 0; i < stagesVal; i++) {
          let defaultSeries = 's4';
          if (i === 0) defaultSeries = 's1';
          else if (i === 1) defaultSeries = 's2';
          else if (i === 2) defaultSeries = 's3';
          seriesVal.push(defaultSeries);
        }
      }

      return { ...prev, ...cleanExtracted, stageSeries: seriesVal };
    });
  };

  // Called by RequirementAnalyzer when AI analysis completes — stores reports for Audit tab
  const handleReportsReady = (
    engReport: EngineeringReport,
    verifReport: VerificationReport,
    projectName: string
  ) => {
    setEngineeringReport(engReport);
    setVerificationReport(verifReport);
    setAuditProjectName(projectName);
  };

  const handleCalculate = async () => {
    const { totalRatio, stages, powerKW, inputRPM, serviceFactor } = inputs;
    if (!totalRatio || !stages || !powerKW || !inputRPM || !serviceFactor) {
      alert('Fill all fields');
      return;
    }
    setLoading(true);
    try {
      const calcResults = await calculateGearboxOptions(inputs, numOptions);
      setResults(calcResults);
    } catch (err) {
      console.error(err);
      alert('Calculation error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (result: CalculationResult) => {
    const idx = results.indexOf(result);
    setSelectedResult(result);
    setSelectedResultIndex(idx);
    setIsModalOpen(true);
  };

  // ── Tab header ─────────────────────────────────────────────────────────────
  const tabBtnCls = (tab: AppTab) =>
    `flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 ${
      activeTab === tab
        ? 'bg-[#ff8c00] text-white shadow-sm'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 bg-white border border-slate-200'
    }`;

  const hasAuditData = engineeringReport !== null && verificationReport !== null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/40 to-slate-100/60 flex flex-col font-sans transition-colors duration-200">
      <Header
        projectName={inputs.projectName}
        inputValues={inputs}
        results={results}
        engineeringReport={engineeringReport}
        verificationReport={verificationReport}
      />

      {/* ── Tab navigation ────────────────────────────────────────────────── */}
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-4 flex items-center gap-2">
        <button className={tabBtnCls('selector')} onClick={() => setActiveTab('selector')}>
          <Settings2 className="h-3.5 w-3.5" />
          Gearbox Selector
        </button>
        <button
          className={`${tabBtnCls('audit')} ${!hasAuditData ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => hasAuditData && setActiveTab('audit')}
          title={!hasAuditData ? 'Run an AI analysis first to unlock the Audit Dashboard' : undefined}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Audit Dashboard
          {hasAuditData && verificationReport && (
            <span className={`ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-full ${
              verificationReport.overallScore === 100
                ? 'bg-emerald-500/20 text-emerald-100'
                : verificationReport.overallScore >= 75
                ? 'bg-amber-500/20 text-amber-100'
                : 'bg-red-500/20 text-red-100'
            }`}>
              {verificationReport.overallScore}/100
            </span>
          )}
        </button>
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-4 space-y-6">

        {/* ────────────────────────── SELECTOR TAB ──────────────────────── */}
        {activeTab === 'selector' && (
          <>
            {/* AI Requirement Analyzer Card */}
            <RequirementAnalyzer
              onAutoFill={handleAutoFill}
              onReportsReady={handleReportsReady}
            />

            {/* Operating & Design Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <OperatingParametersCard values={inputs} onChange={handleInputChange} />
              <DesignParametersCard values={inputs} onChange={handleInputChange} />
            </div>

            {/* Calculation Control Box */}
            <div className="bg-white border-t-4 border-[#ff8c00] border-slate-200 shadow-md rounded-2xl p-5 flex flex-wrap items-center justify-center gap-6 transition-all duration-300 hover:shadow-lg">
              <div className="flex items-center gap-3">
                <Label htmlFor="numOptions" className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Number of Options to display:
                </Label>
                <Input
                  id="numOptions"
                  type="number"
                  min="1"
                  max="10"
                  value={numOptions}
                  onChange={(e) => setNumOptions(parseInt(e.target.value, 10) || 5)}
                  className="w-18 bg-slate-50/50 border-slate-200 focus-visible:ring-2 focus-visible:ring-[#ff8c00]/20 focus-visible:border-[#ff8c00] text-center font-bold text-slate-700 h-9 rounded-xl"
                />
              </div>

              <Button
                onClick={handleCalculate}
                disabled={loading}
                className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all duration-155 shadow-sm hover:shadow-md flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing Drivetrains...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    Calculate Best Options
                  </>
                )}
              </Button>
            </div>

            {/* Results Table */}
            <ResultsTable results={results} onSelectOption={handleSelectOption} />
          </>
        )}

        {/* ────────────────────────── AUDIT TAB ─────────────────────────── */}
        {activeTab === 'audit' && hasAuditData && (
          <AuditDashboard
            engineeringReport={engineeringReport!}
            verificationReport={verificationReport!}
            projectName={auditProjectName}
          />
        )}

        {activeTab === 'audit' && !hasAuditData && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <ShieldCheck className="h-16 w-16 text-slate-200" />
            <h2 className="text-xl font-black text-slate-400">Audit Dashboard</h2>
            <p className="text-sm text-slate-400 font-semibold max-w-md">
              Run an AI requirement analysis first. The audit dashboard becomes available after an engineering report has been generated.
            </p>
            <Button
              onClick={() => setActiveTab('selector')}
              className="bg-[#ff8c00] hover:bg-[#e07b00] text-white font-bold rounded-xl shadow-sm"
            >
              Go to Selector
            </Button>
          </div>
        )}
      </main>

      {/* Stage Breakdown Modal */}
      <StageDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedResult(null);
          setSelectedResultIndex(null);
        }}
        selectedOption={selectedResult}
        optionIndex={selectedResultIndex}
        inputValues={inputs}
      />
    </div>
  );
};
