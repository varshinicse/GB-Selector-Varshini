import { Gearbox } from '../types/Gearbox';
import { StageDetail } from '../types/CalculationResult';
import { gearboxDatabase } from '../data/gearboxDatabase';

export interface DerivedParameter<T> {
  name: string;
  value: T;
  isSuggested: boolean;
  confidence: 'High' | 'Medium' | 'Low';
  calculationPath: string;
  reasoning: string;
}

export interface ReasoningResult {
  projectName: string;
  applicationType: string;
  powerKW: DerivedParameter<number>;
  inputRPM: DerivedParameter<number>;
  outputRPM: DerivedParameter<number>;
  totalRatio: DerivedParameter<number>;
  stages: DerivedParameter<number>;
  serviceFactor: DerivedParameter<number>;
  
  stageAnalysis: {
    possibleStageCounts: number[];
    minAchievableRatio: number;
    maxAchievableRatio: number;
    mostSuitableStageCombination: string[];
    details: {
      stages: number;
      min: number;
      max: number;
      series: string[];
    }[];
  };

  stageDetails: StageDetail[];
  
  torqueCalculations: {
    inputTorque: number;
    outputTorque: number;
    maxTorque: number;
    overallEfficiency: number;
  };

  recommendationText: string;
}

// Gearbox Series Databases and limits
export const seriesLimits: Record<string, { min: number; max: number; name: string }> = {
  s1: { min: 3.75, max: 10.26, name: 'S1' },
  s2: { min: 4.71, max: 7.58, name: 'S2' },
  s3: { min: 4.76, max: 5.06, name: 'S3' },
  s4: { min: 4.00, max: 4.50, name: 'S4' }
};

// Selection helper (local sync copy of selector for reasoning flow)
export function selectGearboxSync(
  seriesVal: string,
  nominalTorque: number,
  maxTorque: number,
  stageIndex: number,
  stageRatio: number
): Gearbox {
  const seriesNum = parseInt(seriesVal.replace('s', ''));
  let filteredGearboxes = gearboxDatabase.filter(g => g.series === seriesNum);

  // Restrict first stage S1 gearboxes by ratio
  if (stageIndex === 0 && seriesVal === 's1') {
    if (stageRatio <= 5.05) {
      filteredGearboxes = filteredGearboxes.filter(g => g.size.startsWith('L'));
    } else if (stageRatio > 5.05 && stageRatio <= 7.6) {
      filteredGearboxes = filteredGearboxes.filter(g => g.size.startsWith('M'));
    } else {
      filteredGearboxes = filteredGearboxes.filter(g => g.size.startsWith('H'));
    }
  }

  // Rule 1 (Ideal): Gearbox Nominal >= nominal && Gearbox Rated >= max
  let selected = filteredGearboxes
    .filter(g => g.nominal >= nominalTorque && g.rated >= maxTorque)
    .sort((a, b) => a.nominal - b.nominal);
  if (selected.length > 0) return selected[0];

  // Rule 2 (Fallback): Gearbox Rated >= max
  selected = filteredGearboxes
    .filter(g => g.rated >= maxTorque)
    .sort((a, b) => a.rated - b.rated);
  if (selected.length > 0) return selected[0];

  // Rule 3 (Final fallback): return largest capacity gearbox in the series
  if (filteredGearboxes.length > 0) {
    return filteredGearboxes.sort((a, b) => b.nominal - a.nominal)[0];
  }

  // Final fallback of database
  return gearboxDatabase[gearboxDatabase.length - 1];
}

/**
 * Distributes a target ratio across N stages based on the series limits
 */
export function distributeRatios(targetRatio: number, stages: number): { ratios: number[]; series: string[] } {
  const series = [];
  for (let i = 0; i < stages; i++) {
    series.push(`s${i + 1}`);
  }

  // Equal distribution base
  const ratios = Array(stages).fill(Math.pow(targetRatio, 1 / stages));

  // Iteratively adjust ratios to fit series bounds
  for (let iter = 0; iter < 10; iter++) {
    let redistributionFactor = 1;
    let activeStagesCount = 0;

    for (let i = 0; i < stages; i++) {
      const limit = seriesLimits[series[i]];
      if (!limit) continue;

      if (ratios[i] < limit.min) {
        redistributionFactor *= ratios[i] / limit.min;
        ratios[i] = limit.min;
      } else if (ratios[i] > limit.max) {
        redistributionFactor *= ratios[i] / limit.max;
        ratios[i] = limit.max;
      } else {
        activeStagesCount++;
      }
    }

    if (Math.abs(redistributionFactor - 1) < 1e-5 || activeStagesCount === 0) {
      break;
    }

    // Multiply the un-bounded stages by the redistribution factor
    const multiplyFactor = Math.pow(redistributionFactor, 1 / activeStagesCount);
    for (let i = 0; i < stages; i++) {
      const limit = seriesLimits[series[i]];
      if (ratios[i] > limit.min && ratios[i] < limit.max) {
        ratios[i] *= multiplyFactor;
      }
    }
  }

  // Return formatted ratios
  return { ratios: ratios.map(r => parseFloat(r.toFixed(2))), series };
}

/**
 * Run the core engineering reasoning engine.
 */
export function runEngineeringReasoning(
  rawText: string,
  extracted: {
    projectName?: string | null;
    powerKW?: number | null;
    inputRPM?: number | null;
    outputRPM?: number | null;
    targetRatio?: number | null;
    applicationType?: string | null;
    serviceFactor?: number | null;
    numberOfStages?: number | null;
  }
): ReasoningResult {
  const normText = rawText.toLowerCase();

  // ---------------- LOCAL REGEX FALLBACKS ----------------
  // If the server didn't extract a value, try to find it locally via regex
  let localPower = extracted.powerKW;
  if (localPower === null || localPower === undefined) {
    const powerMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:kW|kilowatt|kilowatts)/i);
    if (powerMatch) {
      localPower = parseFloat(powerMatch[1]);
    }
  }

  let localInputRPM = extracted.inputRPM;
  if (localInputRPM === null || localInputRPM === undefined) {
    const inputSpeedMatch = rawText.match(/(?:input|motor|inlet)\s+speed\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*RPM/i);
    if (inputSpeedMatch) {
      localInputRPM = parseFloat(inputSpeedMatch[1]);
    } else {
      const rpmMatches = [...rawText.matchAll(/(\d+(?:\.\d+)?)\s*RPM/gi)];
      if (rpmMatches.length > 0) {
        localInputRPM = parseFloat(rpmMatches[0][1]);
      }
    }
  }

  let localOutputRPM = extracted.outputRPM;
  if (localOutputRPM === null || localOutputRPM === undefined) {
    const outputSpeedMatch = rawText.match(/(?:output|target|final|required|conveyor)\s+speed\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*RPM/i);
    if (outputSpeedMatch) {
      localOutputRPM = parseFloat(outputSpeedMatch[1]);
    }
  }

  let localRatio = extracted.targetRatio;
  if (localRatio === null || localRatio === undefined) {
    const ratioMatch = rawText.match(/(?:gear\s+)?ratio\s+(?:of|is|target)?\s*(\d+(?:\.\d+)?)/i);
    if (ratioMatch) {
      localRatio = parseFloat(ratioMatch[1]);
    }
  }

  let localSF = extracted.serviceFactor;
  if (localSF === null || localSF === undefined) {
    const sfMatch = rawText.match(/(?:service\s+factor|SF|factor)\s+(?:of|is\s+)?(\d+(?:\.\d+)?)/i);
    if (sfMatch) {
      localSF = parseFloat(sfMatch[1]);
    }
  }

  let localStages = extracted.numberOfStages;
  if (localStages === null || localStages === undefined) {
    const stageMatch = rawText.match(/(\d+)\s*(?:stage|reduction)/i);
    if (stageMatch) {
      localStages = parseInt(stageMatch[1], 10);
    }
  }

  // ---------------- PROJECT NAME & APPLICATION TYPE ----------------
  const projectName = extracted.projectName || 'MAGTORQ Design Project';
  let applicationType = extracted.applicationType || 'Conveyor';
  if (!extracted.applicationType) {
    if (normText.includes('conveyor') || normText.includes('belt')) applicationType = 'Conveyor';
    else if (normText.includes('mixer') || normText.includes('agitator')) applicationType = 'Mixer';
    else if (normText.includes('crusher') || normText.includes('shredder')) applicationType = 'Crusher';
    else if (normText.includes('fan') || normText.includes('blower')) applicationType = 'Fan';
    else if (normText.includes('pump')) applicationType = 'Pump';
  }

  // ---------------- POWER KW ----------------
  let powerKW: DerivedParameter<number>;
  if (localPower !== null && localPower !== undefined && localPower > 0) {
    powerKW = {
      name: 'Power (kW)',
      value: localPower,
      isSuggested: false,
      confidence: 'High',
      calculationPath: 'Directly extracted from specifications',
      reasoning: `Extracted explicit power value of ${localPower} kW.`
    };
  } else {
    // Check for HP in raw text
    const hpMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:HP|horsepower|horse-power)/i);
    if (hpMatch) {
      const hp = parseFloat(hpMatch[1]);
      const kw = parseFloat((hp * 0.7457).toFixed(2));
      powerKW = {
        name: 'Power (kW)',
        value: kw,
        isSuggested: true,
        confidence: 'High',
        calculationPath: 'P_kW = P_HP × 0.7457',
        reasoning: `Found mention of ${hp} HP in text. Converted to kW using standard mechanical equivalence.`
      };
    } else {
      // Suggest standard value
      powerKW = {
        name: 'Power (kW)',
        value: 15.0,
        isSuggested: true,
        confidence: 'Low',
        calculationPath: 'Assumed standard industrial drive baseline',
        reasoning: 'No power rating specified. Suggested standard 15.0 kW (20 HP) baseline, typical for medium-duty industrial applications.'
      };
    }
  }

  // ---------------- INPUT RPM ----------------
  let inputRPM: DerivedParameter<number>;
  if (localInputRPM !== null && localInputRPM !== undefined && localInputRPM > 0) {
    inputRPM = {
      name: 'Input Speed (RPM)',
      value: localInputRPM,
      isSuggested: false,
      confidence: 'High',
      calculationPath: 'Directly extracted from specifications',
      reasoning: `Extracted explicit motor input speed of ${localInputRPM} RPM.`
    };
  } else {
    // Check for motor pole count
    const polesMatch = rawText.match(/(\d+)\s*(?:pole|poles|-pole)/i);
    if (polesMatch) {
      const poles = parseInt(polesMatch[1], 10);
      let derivedRPM = 1440;
      let sync = 1500;
      if (poles === 2) { derivedRPM = 2850; sync = 3000; }
      else if (poles === 4) { derivedRPM = 1440; sync = 1500; }
      else if (poles === 6) { derivedRPM = 960; sync = 1000; }
      else if (poles === 8) { derivedRPM = 720; sync = 750; }

      inputRPM = {
        name: 'Input Speed (RPM)',
        value: derivedRPM,
        isSuggested: true,
        confidence: 'High',
        calculationPath: 'Derived from synchronous AC motor formulas for 50Hz grid',
        reasoning: `Detected a ${poles}-pole motor specification. A standard ${poles}-pole AC motor at 50Hz has a synchronous speed of ${sync} RPM and operates under load at approximately ${derivedRPM} RPM due to motor slip.`
      };
    } else {
      inputRPM = {
        name: 'Input Speed (RPM)',
        value: 1440,
        isSuggested: true,
        confidence: 'Medium',
        calculationPath: 'Assumed standard 4-pole AC induction motor speed at 50Hz',
        reasoning: 'No motor speed or pole count specified. Assumed standard 4-pole industrial motor speed of 1440 RPM, which is the most common industry drive standard.'
      };
    }
  }

  // ---------------- CALCULATE RATIO LIMITS FOR EVERY STAGE ----------------
  const limits1 = seriesLimits.s1;
  const limits2 = seriesLimits.s2;
  const limits3 = seriesLimits.s3;
  const limits4 = seriesLimits.s4;

  const stageAnalysisDetails = [
    {
      stages: 1,
      min: parseFloat(limits1.min.toFixed(2)),
      max: parseFloat(limits1.max.toFixed(2)),
      series: ['s1']
    },
    {
      stages: 2,
      min: parseFloat((limits1.min * limits2.min).toFixed(2)),
      max: parseFloat((limits1.max * limits2.max).toFixed(2)),
      series: ['s1', 's2']
    },
    {
      stages: 3,
      min: parseFloat((limits1.min * limits2.min * limits3.min).toFixed(2)),
      max: parseFloat((limits1.max * limits2.max * limits3.max).toFixed(2)),
      series: ['s1', 's2', 's3']
    },
    {
      stages: 4,
      min: parseFloat((limits1.min * limits2.min * limits3.min * limits4.min).toFixed(2)),
      max: parseFloat((limits1.max * limits2.max * limits3.max * limits4.max).toFixed(2)),
      series: ['s1', 's2', 's3', 's4']
    }
  ];

  const possibleStageCounts = [1, 2, 3, 4];
  const minAchievableRatio = stageAnalysisDetails[0].min;
  const maxAchievableRatio = stageAnalysisDetails[3].max;

  // ---------------- TOTAL RATIO & OUTPUT RPM ----------------
  let totalRatio: DerivedParameter<number>;
  let outputRPM: DerivedParameter<number>;

  const hasExtRatio = localRatio !== null && localRatio !== undefined && localRatio > 0;
  const hasExtOutput = localOutputRPM !== null && localOutputRPM !== undefined && localOutputRPM > 0;

  if (hasExtRatio && hasExtOutput) {
    totalRatio = {
      name: 'Total Gear Ratio',
      value: localRatio!,
      isSuggested: false,
      confidence: 'High',
      calculationPath: 'Directly extracted from specifications',
      reasoning: `Extracted explicit gear ratio of ${localRatio} : 1.`
    };
    outputRPM = {
      name: 'Output Speed (RPM)',
      value: localOutputRPM!,
      isSuggested: false,
      confidence: 'High',
      calculationPath: 'Directly extracted from specifications',
      reasoning: `Extracted explicit output speed of ${localOutputRPM} RPM.`
    };
  } else if (hasExtRatio) {
    const computedOutRPM = parseFloat((inputRPM.value / localRatio!).toFixed(2));
    totalRatio = {
      name: 'Total Gear Ratio',
      value: localRatio!,
      isSuggested: false,
      confidence: 'High',
      calculationPath: 'Directly extracted from specifications',
      reasoning: `Extracted explicit gear ratio of ${localRatio} : 1.`
    };
    outputRPM = {
      name: 'Output Speed (RPM)',
      value: computedOutRPM,
      isSuggested: true,
      confidence: 'High',
      calculationPath: 'N_out = N_in / Ratio',
      reasoning: `Calculated from the motor input speed of ${inputRPM.value} RPM divided by the gear ratio of ${localRatio}.`
    };
  } else if (hasExtOutput) {
    const computedRatio = parseFloat((inputRPM.value / localOutputRPM!).toFixed(2));
    outputRPM = {
      name: 'Output Speed (RPM)',
      value: localOutputRPM!,
      isSuggested: false,
      confidence: 'High',
      calculationPath: 'Directly extracted from specifications',
      reasoning: `Extracted explicit output speed of ${localOutputRPM} RPM.`
    };
    totalRatio = {
      name: 'Total Gear Ratio',
      value: computedRatio,
      isSuggested: true,
      confidence: 'High',
      calculationPath: 'Ratio = N_in / N_out',
      reasoning: `Calculated from the motor input speed of ${inputRPM.value} RPM divided by the target output speed of ${localOutputRPM} RPM.`
    };
  } else {
    // Both ratio and output RPM missing! Let's default to standard application ratio
    let suggestedRatio = 30;
    if (applicationType === 'Conveyor') suggestedRatio = 50;
    else if (applicationType === 'Mixer') suggestedRatio = 40;
    else if (applicationType === 'Crusher') suggestedRatio = 60;
    else if (applicationType === 'Fan') suggestedRatio = 10;
    else if (applicationType === 'Pump') suggestedRatio = 15;

    const computedOutRPM = parseFloat((inputRPM.value / suggestedRatio).toFixed(2));

    totalRatio = {
      name: 'Total Gear Ratio',
      value: suggestedRatio,
      isSuggested: true,
      confidence: 'Low',
      calculationPath: 'Assumed based on typical application drivetrain profile',
      reasoning: `No ratio or output speed was found. Suggested a default ratio of ${suggestedRatio} : 1 which is standard for a typical industrial ${applicationType.toLowerCase()} drive.`
    };

    outputRPM = {
      name: 'Output Speed (RPM)',
      value: computedOutRPM,
      isSuggested: true,
      confidence: 'Low',
      calculationPath: 'N_out = N_in / Ratio',
      reasoning: `Derived from input speed ${inputRPM.value} RPM divided by suggested default ratio ${suggestedRatio}.`
    };
  }

  // ---------------- STAGES DETERMINATION ----------------
  let stages: DerivedParameter<number>;
  const R = totalRatio.value;

  if (localStages !== null && localStages !== undefined && localStages > 0) {
    stages = {
      name: 'Number of Reduction Stages',
      value: localStages,
      isSuggested: false,
      confidence: 'High',
      calculationPath: 'Directly extracted from specifications',
      reasoning: `Extracted explicit stage count of ${localStages}.`
    };
  } else {
    // Calculate from ratio limits and gearbox series
    let suggestedStages = 2;
    let path = 'Derived from ratio bounds matrix';
    let reasoningText = '';

    if (R <= 12) {
      suggestedStages = 1;
      reasoningText = `The target ratio of ${R} fits within the single-stage limit [3.75 - 10.26] of the S1 series.`;
    } else if (R > 12 && R <= 80) {
      suggestedStages = 2;
      reasoningText = `The target ratio of ${R} fits within the two-stage limit [17.66 - 77.77] of the S1 × S2 series combination.`;
    } else if (R > 80 && R <= 400) {
      suggestedStages = 3;
      reasoningText = `The target ratio of ${R} fits within the three-stage limit [84.07 - 393.52] of the S1 × S2 × S3 series combination.`;
    } else {
      suggestedStages = 4;
      reasoningText = `The target ratio of ${R} is extremely high and requires a four-stage configuration to fit within standard series limits [336.29 - 1770.84] of S1 × S2 × S3 × S4.`;
    }

    stages = {
      name: 'Number of Reduction Stages',
      value: suggestedStages,
      isSuggested: true,
      confidence: 'High',
      calculationPath: path,
      reasoning: reasoningText
    };
  }

  // ---------------- MOST SUITABLE STAGE COMBINATION ----------------
  const mostSuitableStageCombination = [];
  for (let i = 0; i < stages.value; i++) {
    mostSuitableStageCombination.push(`s${i + 1}`);
  }

  // ---------------- SERVICE FACTOR ----------------
  let serviceFactor: DerivedParameter<number>;
  if (localSF !== null && localSF !== undefined && localSF > 0) {
    serviceFactor = {
      name: 'Service Factor (SF)',
      value: localSF,
      isSuggested: false,
      confidence: 'High',
      calculationPath: 'Directly extracted from specifications',
      reasoning: `Extracted explicit service factor of ${localSF}.`
    };
  } else {
    let sf = 1.5;
    let reason = '';
    if (applicationType === 'Conveyor') {
      sf = 1.5;
      reason = 'Conveyors require a standard service factor of 1.5 to withstand moderate starting shocks and material loading fluctuations.';
    } else if (applicationType === 'Mixer') {
      sf = 1.75;
      reason = 'Mixers and agitators undergo continuous viscous shear resistance and shock load variations, demanding a 1.75 service factor.';
    } else if (applicationType === 'Crusher') {
      sf = 2.0;
      reason = 'Crushers and heavy-duty mills experience high-impact, sudden peak shock loads, requiring a minimum safety service factor of 2.0.';
    } else if (applicationType === 'Fan' || applicationType === 'Pump') {
      sf = 1.25;
      reason = 'Fans and centrifugal pumps feature steady, uniform load characteristics, permitting a lighter service factor of 1.25.';
    } else {
      sf = 1.5;
      reason = 'Assumed a standard industrial baseline service factor of 1.5 for moderate-load applications.';
    }

    serviceFactor = {
      name: 'Service Factor (SF)',
      value: sf,
      isSuggested: true,
      confidence: 'High',
      calculationPath: 'Suggested based on application type service load guidelines',
      reasoning: reason
    };
  }


  // ---------------- STEP 4 & 6: RUN ENGINEERING CALCULATIONS & SELECTION ----------------
  // 1. Calculate input torque (Tin)
  const P = powerKW.value;
  const Nin = inputRPM.value;
  const Tin = (P * 60000) / (2 * Math.PI * Nin);

  // 2. Distribute ratios and solve stage speed/torque matrix
  const { ratios, series } = distributeRatios(R, stages.value);

  let speed = Nin;
  let torque = Tin;
  const stageDetails: StageDetail[] = [];

  for (let i = 0; i < stages.value; i++) {
    const ratio = ratios[i];
    const seriesVal = series[i];

    // Speed decreases by ratio
    speed = speed / ratio;

    // Torque increases by ratio × efficiency (97% efficiency per stage)
    torque = torque * ratio * 0.97;
    const maxTorque = torque * serviceFactor.value;

    // Select the gearbox for this stage using MAGTORQ database
    const gb = selectGearboxSync(seriesVal, torque, maxTorque, i, ratio);

    // Calculate safety factor: min(GBNominal / StageNominal, GBRated / StageMaximum)
    const safety = Math.min(gb.nominal / torque, gb.rated / maxTorque);

    stageDetails.push({
      stage: i + 1,
      ratio,
      speed,
      nominalTorque: torque,
      maxTorque,
      selectedGearbox: gb,
      safetyFactor: safety
    });
  }

  const overallEfficiency = Math.pow(0.97, stages.value);
  const Tout = Tin * R * overallEfficiency;
  const Tmax = Tout * serviceFactor.value;

  const torqueCalculations = {
    inputTorque: Tin,
    outputTorque: Tout,
    maxTorque: Tmax,
    overallEfficiency
  };

  // ---------------- FINAL RECOMMENDATION NARRATIVE ----------------
  const lastGb = stageDetails[stageDetails.length - 1]?.selectedGearbox;
  const isSafe = stageDetails.every(d => d.safetyFactor >= 1.0);

  let recommendationText = `Based on the provided specification sheet, MAGTORQ's Engineering Reasoning Engine has completed a full structural analysis of the drive requirements. 

We recommend a **${stages.value}-stage reduction gearbox configuration** utilizing the **${series.map(s => s.toUpperCase()).join(' × ')}** series sequence. `;

  if (lastGb) {
    recommendationText += `The final stage is resolved to a **MAGTORQ ${lastGb.size}** model, which satisfies the output nominal torque demands of **${Math.round(Tout).toLocaleString()} N·m** and peak loads of **${Math.round(Tmax).toLocaleString()} N·m** under a service factor of **${serviceFactor.value}**. \n\n`;
  }

  recommendationText += `**Calculated Ratios Breakdown:** ${ratios.join(' × ')} yielding a total reduction ratio of **${R.toFixed(2)}:1** (Output Speed: **${speed.toFixed(1)} RPM**).
**Efficiency Analysis:** Overall mechanical efficiency is calculated at **${(overallEfficiency * 100).toFixed(1)}%** (assuming a standard transmission loss of 3% per planetary reduction stage).
**Drivetrain Status:** ${isSafe ? '⚡ Safe & Compliant. All reduction stages operate within the nominal and peak rated capacity margins.' : '⚠ Warning: Overload detected on intermediate stages. We suggest selecting a higher frame size or adjusting service factor settings.'}`;

  return {
    projectName,
    applicationType,
    powerKW,
    inputRPM,
    outputRPM,
    totalRatio,
    stages,
    serviceFactor,
    stageAnalysis: {
      possibleStageCounts,
      minAchievableRatio,
      maxAchievableRatio,
      mostSuitableStageCombination,
      details: stageAnalysisDetails
    },
    stageDetails,
    torqueCalculations,
    recommendationText
  };
}
