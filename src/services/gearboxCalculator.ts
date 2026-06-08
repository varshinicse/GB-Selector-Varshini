import { ProjectInput } from '../types/ProjectInput';
import { CalculationResult, StageDetail } from '../types/CalculationResult';
import { seriesData } from '../data/seriesData';
import { selectGearbox } from './gearboxSelector';

/**
 * Calculates permutations of stage ratios, sorts by closeness to target,
 * and maps intermediate and output gearboxes.
 * Structuring as async to enable a future remote REST/GraphQL endpoint transition.
 */
export async function calculateGearboxOptions(
  input: ProjectInput,
  numOptions: number = 5
): Promise<CalculationResult[]> {
  const { totalRatio: reqRatio, stages, powerKW: power, inputRPM: rpm, serviceFactor: sf, stageSeries } = input;

  if (!reqRatio || !stages || !power || !rpm || !sf || !stageSeries || stageSeries.length < stages) {
    throw new Error("Invalid parameters provided for calculations.");
  }

  // Get active series ratios for each stage
  const activeSeriesRatios: number[][] = [];
  for (let i = 0; i < stages; i++) {
    const seriesKey = stageSeries[i];
    const ratios = seriesData[seriesKey];
    if (!ratios) {
      throw new Error(`Invalid series '${seriesKey}' selected for stage ${i + 1}.`);
    }
    activeSeriesRatios.push(ratios);
  }

  const permutations: Omit<CalculationResult, 'lastStageGearbox'>[] = [];

  function generateCombinations(stageIndex: number, currentRatios: number[], currentTotalRatio: number) {
    if (stageIndex === stages) {
      const deviation = ((currentTotalRatio - reqRatio) / reqRatio) * 100;
      // nominal output torque at final stage: (P * 60,000 * totalRatio * 0.97^stages) / (2 * pi * inputRPM)
      const nominal = (power * 60000 * currentTotalRatio * Math.pow(0.97, stages)) / (2 * Math.PI * rpm);
      const max = nominal * sf;
      permutations.push({
        ratios: currentRatios,
        total: currentTotalRatio,
        deviation,
        nominal,
        max
      });
      return;
    }

    const ratiosForStage = activeSeriesRatios[stageIndex];
    for (const r of ratiosForStage) {
      generateCombinations(stageIndex + 1, [...currentRatios, r], currentTotalRatio * r);
    }
  }

  generateCombinations(0, [], 1);

  // Sort by absolute deviation ascending
  permutations.sort((a, b) => Math.abs(a.deviation) - Math.abs(b.deviation));

  // Take top N (capped at 10)
  const topResults = permutations.slice(0, Math.min(numOptions, 10));

  // Resolve the last stage gearbox for each top option
  const resolvedResults: CalculationResult[] = [];
  for (const r of topResults) {
    const lastStageSeriesVal = stageSeries[stages - 1];
    const lastStageRatio = r.ratios[stages - 1];
    const gb = await selectGearbox(
      lastStageSeriesVal,
      r.nominal,
      r.max,
      stages - 1,
      lastStageRatio
    );
    resolvedResults.push({
      ...r,
      lastStageGearbox: gb
    });
  }

  return resolvedResults;
}

/**
 * Calculates stage-by-stage speed, torque, selected gearbox, and safety factors.
 */
export async function getStageDetails(
  input: ProjectInput,
  result: CalculationResult
): Promise<StageDetail[]> {
  const { inputRPM: initialRPM, powerKW: power, serviceFactor: sf, stageSeries } = input;
  
  let speed = initialRPM;
  let torque = (power * 60000) / (2 * Math.PI * speed);

  const stageDetails: StageDetail[] = [];

  for (let idx = 0; idx < result.ratios.length; idx++) {
    const ratio = result.ratios[idx];
    const seriesVal = stageSeries[idx];
    
    speed /= ratio;
    // Apply 3% loss per stage
    torque *= ratio * 0.97;
    const maxTorque = torque * sf;

    const gb = await selectGearbox(seriesVal, torque, maxTorque, idx, ratio);

    let safety = 0;
    if (gb.nominal / torque <= gb.rated / maxTorque) {
      safety = gb.nominal / torque;
    } else {
      safety = gb.rated / maxTorque;
    }

    stageDetails.push({
      stage: idx + 1,
      ratio,
      speed,
      nominalTorque: torque,
      maxTorque,
      selectedGearbox: gb,
      safetyFactor: safety
    });
  }

  return stageDetails;
}
