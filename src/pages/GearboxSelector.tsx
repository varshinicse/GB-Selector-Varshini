import React, { useState } from 'react';
import { Header } from '../components/Header';
import { RequirementAnalyzer } from '../components/RequirementAnalyzer';
import { OperatingParametersCard } from '../components/OperatingParametersCard';
import { DesignParametersCard } from '../components/DesignParametersCard';
import { ResultsTable } from '../components/ResultsTable';
import { StageDetailsModal } from '../components/StageDetailsModal';
import { ProjectInput } from '../types/ProjectInput';
import { CalculationResult } from '../types/CalculationResult';
import { calculateGearboxOptions } from '../services/gearboxCalculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play } from 'lucide-react';

export const GearboxSelector: React.FC = () => {
  // Initial inputs matching index.html defaults
  const [inputs, setInputs] = useState<ProjectInput>({
    projectName: 'SREEKANTH.M',
    totalRatio: '' as unknown as number,
    powerKW: '' as unknown as number,
    inputRPM: '' as unknown as number,
    stages: 1,
    stageSeries: ['s1'],
    serviceFactor: '' as unknown as number,
  });

  const [numOptions, setNumOptions] = useState<number>(5);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<CalculationResult | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleInputChange = (fields: Partial<ProjectInput>) => {
    setInputs((prev) => ({
      ...prev,
      ...fields,
    }));
  };

  const handleAutoFill = (extracted: Partial<ProjectInput>) => {
    setInputs((prev) => {
      // Filter out undefined/null values so they don't overwrite valid defaults
      const cleanExtracted = Object.entries(extracted).reduce((acc, [key, val]) => {
        if (val !== undefined && val !== null) {
          acc[key as keyof ProjectInput] = val as never;
        }
        return acc;
      }, {} as Partial<ProjectInput>);

      const stagesVal = cleanExtracted.stages ?? prev.stages;
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

      return {
        ...prev,
        ...cleanExtracted,
        stageSeries: seriesVal,
      };
    });
  };

  const handleCalculate = async () => {
    const { totalRatio, stages, powerKW, inputRPM, serviceFactor } = inputs;
    
    if (!totalRatio || !stages || !powerKW || !inputRPM || !serviceFactor) {
      alert("Fill all fields");
      return;
    }

    setLoading(true);
    try {
      const calcResults = await calculateGearboxOptions(inputs, numOptions);
      setResults(calcResults);
    } catch (err) {
      console.error(err);
      alert("Calculation error: " + (err as Error).message);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/40 to-slate-100/60 flex flex-col font-sans transition-colors duration-200">
      <Header
        projectName={inputs.projectName}
        inputValues={inputs}
        results={results}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* AI Requirement Analyzer Card */}
        <RequirementAnalyzer onAutoFill={handleAutoFill} />

        {/* Operating & Design Parameters Side-by-Side */}
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

        {/* Calculation Results Table */}
        <ResultsTable results={results} onSelectOption={handleSelectOption} />
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
