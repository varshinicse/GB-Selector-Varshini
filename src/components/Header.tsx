import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Settings, FolderKanban, FileDown, Sheet } from 'lucide-react';
import { ProjectInput } from '../types/ProjectInput';
import { CalculationResult } from '../types/CalculationResult';
import { EngineeringReport } from '../services/engineeringReasoningEngine';
import { VerificationReport } from '../services/verificationEngine';
import { exportToPDF, exportToExcel } from '../services/reportExportService';

interface HeaderProps {
  projectName: string;
  inputValues: ProjectInput;
  results: CalculationResult[];
  engineeringReport?: EngineeringReport | null;
  verificationReport?: VerificationReport | null;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  inputValues,
  results,
  engineeringReport,
  verificationReport,
}) => {
  useEffect(() => {
    document.title = projectName ? `MAGTORQ | ${projectName}` : 'MAGTORQ Gearbox Selector';
  }, [projectName]);

  const handleExportJSON = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      inputParameters: inputValues,
      calculationResults: results.map(r => ({
        ratios: r.ratios,
        totalRatio: r.total,
        deviationPercent: r.deviation,
        nominalTorqueNm: r.nominal,
        maxTorqueNm: r.max,
        selectedGearbox: r.lastStageGearbox ? {
          size: r.lastStageGearbox.size,
          nominalCapacity: r.lastStageGearbox.nominal,
          ratedCapacity: r.lastStageGearbox.rated,
        } : null
      }))
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute('href', dataStr);
    anchor.setAttribute('download', `magtorq_project_${projectName.replace(/\s+/g, '_') || 'export'}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleExportPDF = () => {
    if (!engineeringReport || !verificationReport) {
      alert('Run an AI analysis first to generate the full engineering report before exporting to PDF.');
      return;
    }
    exportToPDF(engineeringReport, verificationReport, projectName || 'MAGTORQ Project');
  };

  const handleExportExcel = () => {
    if (!engineeringReport || !verificationReport) {
      alert('Run an AI analysis first to generate the full engineering report before exporting to Excel.');
      return;
    }
    exportToExcel(engineeringReport, verificationReport, projectName || 'MAGTORQ Project');
  };

  const hasReport = !!(engineeringReport && verificationReport);

  return (
    <header className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 border-b border-slate-800 py-3 px-6 flex items-center justify-between shadow-md sticky top-0 z-50">
      <div className="flex items-center space-x-3.5">
        <div className="flex items-center gap-2">
          <div className="bg-[#ff8c00] p-1.5 rounded-lg flex items-center justify-center text-white shadow-inner">
            <Settings className="h-5 w-5 animate-[spin_20s_linear_infinite]" />
          </div>
          <span className="font-extrabold text-2xl tracking-wider text-white">
            MAG<span className="text-[#ff8c00]">TORQ</span>
          </span>
        </div>
        <span className="h-5 w-[1px] bg-slate-700 hidden sm:inline-block" />
        <span className="text-slate-300 font-semibold text-sm hidden sm:inline-block tracking-wide">
          Standard Gearbox Selector
        </span>
        <span className="bg-[#ff8c00]/10 border border-[#ff8c00]/40 text-[#ff8c00] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider hidden md:inline-block">
          v3.0.0-enterprise
        </span>
      </div>

      <div className="flex items-center space-x-2">
        {projectName && (
          <div className="flex items-center gap-1.5 bg-slate-850/80 border border-slate-700/60 px-3 py-1.5 rounded-lg text-slate-100 shadow-sm">
            <FolderKanban className="h-4 w-4 text-[#ff8c00]" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Project:</span>
            <span className="text-sm font-bold text-white tracking-wide">{projectName}</span>
          </div>
        )}

        {/* PDF Export */}
        <Button
          variant="outline"
          size="sm"
          className={`bg-transparent border-slate-700 hover:border-red-400 text-slate-200 hover:text-white hover:bg-red-500/10 flex items-center gap-1.5 transition-all duration-200 shadow-sm ${
            !hasReport ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          onClick={handleExportPDF}
          title={hasReport ? 'Export engineering report as PDF' : 'Run AI analysis first'}
        >
          <FileDown className="h-4 w-4" />
          <span className="hidden md:inline font-bold text-xs">PDF</span>
        </Button>

        {/* Excel Export */}
        <Button
          variant="outline"
          size="sm"
          className={`bg-transparent border-slate-700 hover:border-emerald-400 text-slate-200 hover:text-white hover:bg-emerald-500/10 flex items-center gap-1.5 transition-all duration-200 shadow-sm ${
            !hasReport ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          onClick={handleExportExcel}
          title={hasReport ? 'Export engineering report as Excel' : 'Run AI analysis first'}
        >
          <Sheet className="h-4 w-4" />
          <span className="hidden md:inline font-bold text-xs">Excel</span>
        </Button>

        {/* JSON Export */}
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent border-slate-700 hover:border-[#ff8c00] text-slate-200 hover:text-white hover:bg-[#ff8c00]/5 flex items-center gap-2 transition-all duration-200 shadow-sm"
          onClick={handleExportJSON}
          title="Export raw data (JSON)"
        >
          <Download className="h-4 w-4" />
          <span className="hidden md:inline font-bold text-xs">JSON</span>
        </Button>
      </div>
    </header>
  );
};
