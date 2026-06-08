import { Gearbox } from '../types/Gearbox';
import { gearboxDatabase } from '../data/gearboxDatabase';


// Type Classification for parameters
export type ParameterType = 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';
export type ValidationStatus = '✓ Valid' | '⚠ Missing' | '❌ Invalid';

export interface AuditParameterNode<T> {
  name: string;
  value: T;
  type: ParameterType;
  source: string;
  formula: string;
  calculationSteps: string;
  confidence: ConfidenceLevel;
  reasoning: string;
  ruleApplied?: string;
  detectedText?: string;
}

export interface ValidationItem {
  name: string;
  status: ValidationStatus;
  message: string;
}

export interface StageTrace {
  stage: number;
  ratio: number;
  speed: number;
  nominalTorque: number;
  maxTorque: number;
  selectedGearbox: Gearbox;
  safetyFactor: number;
  
  // Trace audit details
  speedFormula: string;
  speedSteps: string;
  torqueFormula: string;
  torqueSteps: string;
  gbNominalCheck: string;
  gbRatedCheck: string;
  safetyFormula: string;
  safetySteps: string;
  selectionReason: string;
  selectionRuleApplied: string;
}

export interface EngineeringReport {
  projectName: string;
  applicationType: string;
  dutyType: string;
  operatingHours: string;
  loadType: string;
  environment: string;
  gearboxPreferences: string;
  
  // Validation Panel
  validation: {
    isValid: boolean;
    items: ValidationItem[];
  };

  // Parameters Audit Trail
  powerKW: AuditParameterNode<number>;
  motorHP: AuditParameterNode<number | null>;
  motorPoles: AuditParameterNode<number | null>;
  inputRPM: AuditParameterNode<number>;
  outputRPM: AuditParameterNode<number>;
  totalRatio: AuditParameterNode<number>;
  stages: AuditParameterNode<number>;
  serviceFactor: AuditParameterNode<number>;

  // Stage evaluation bounds analysis
  stageEvaluationTrace: {
    targetRatio: number;
    details: {
      stages: number;
      maxRatio: number;
      calculationSteps: string;
      isSufficient: boolean;
    }[];
    minimumStagesRequired: number;
    recommendedStages: number;
    reasoning: string;
  };

  // Torque audit details
  inputTorque: {
    formula: string;
    calculationSteps: string;
    result: number;
  };
  
  stageTraces: StageTrace[];
  
  overallEfficiency: number;
  overallOutputTorque: number;
  overallMaxTorque: number;
  finalRecommendation: string;
  assumptions: { parameter: string; assumption: string; reason: string }[];
}

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

  return gearboxDatabase[gearboxDatabase.length - 1];
}

export const seriesLimits: Record<string, { min: number; max: number; name: string }> = {
  s1: { min: 3.75, max: 10.26, name: 'S1' },
  s2: { min: 4.71, max: 7.58, name: 'S2' },
  s3: { min: 4.76, max: 5.06, name: 'S3' },
  s4: { min: 4.00, max: 4.50, name: 'S4' }
};

/**
 * Distributes a target ratio across N stages based on series limits
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

  return { ratios: ratios.map(r => parseFloat(r.toFixed(2))), series };
}

/**
 * Validates inputs and compiles errors
 */
export function validateInputs(
  powerKW: number | undefined | null,
  inputRPM: number | undefined | null,
  totalRatio: number | undefined | null,
  stages: number | undefined | null,
  serviceFactor: number | undefined | null
): { isValid: boolean; items: ValidationItem[] } {
  const items: ValidationItem[] = [];

  // Validate Power
  if (powerKW === undefined || powerKW === null) {
    items.push({ name: 'Power (kW)', status: '⚠ Missing', message: 'Power rating could not be extracted.' });
  } else if (powerKW <= 0) {
    items.push({ name: 'Power (kW)', status: '❌ Invalid', message: 'Power must be greater than 0.' });
  } else {
    items.push({ name: 'Power (kW)', status: '✓ Valid', message: `Validated at ${powerKW} kW.` });
  }

  // Validate RPM
  if (inputRPM === undefined || inputRPM === null) {
    items.push({ name: 'Input RPM', status: '⚠ Missing', message: 'Input motor speed could not be extracted.' });
  } else if (inputRPM <= 0 || inputRPM > 10000) {
    items.push({ name: 'Input RPM', status: '❌ Invalid', message: 'Input speed must be between 1 and 10,000 RPM.' });
  } else {
    items.push({ name: 'Input RPM', status: '✓ Valid', message: `Validated at ${inputRPM} RPM.` });
  }

  // Validate Ratio
  if (totalRatio === undefined || totalRatio === null) {
    items.push({ name: 'Total Ratio', status: '⚠ Missing', message: 'Total gearbox reduction ratio is missing.' });
  } else if (totalRatio < 1 || totalRatio > 5000) {
    items.push({ name: 'Total Ratio', status: '❌ Invalid', message: 'Reduction ratio must be between 1 and 5,000.' });
  } else {
    items.push({ name: 'Total Ratio', status: '✓ Valid', message: `Validated at ${totalRatio.toFixed(2)}:1.` });
  }

  // Validate Stages
  if (stages === undefined || stages === null) {
    items.push({ name: 'Stages', status: '⚠ Missing', message: 'Stages configuration is not defined.' });
  } else if (stages < 1 || stages > 4) {
    items.push({ name: 'Stages', status: '❌ Invalid', message: 'MAGTORQ supports only 1 to 4 planetary reduction stages.' });
  } else {
    items.push({ name: 'Stages', status: '✓ Valid', message: `Validated at ${stages} reduction stage(s).` });
  }

  // Validate Service Factor
  if (serviceFactor === undefined || serviceFactor === null) {
    items.push({ name: 'Service Factor', status: '⚠ Missing', message: 'Service factor safety coefficient is missing.' });
  } else if (serviceFactor < 0.5 || serviceFactor > 5.0) {
    items.push({ name: 'Service Factor', status: '❌ Invalid', message: 'Service factor must be between 0.5 and 5.0.' });
  } else {
    items.push({ name: 'Service Factor', status: '✓ Valid', message: `Validated at ${serviceFactor.toFixed(2)}.` });
  }

  const isValid = !items.some(i => i.status === '❌ Invalid');

  return { isValid, items };
}

/**
 * Runs the deterministic calculations, tracing every step mathematically.
 */
export function generateAuditReport(
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
    motorHP?: number | null;
    motorPoles?: number | null;
    dutyType?: string | null;
    operatingHours?: string | null;
    loadType?: string | null;
    environment?: string | null;
    gearboxPreferences?: string | null;
  }
): EngineeringReport {
  const normText = rawText.toLowerCase();
  const assumptions: { parameter: string; assumption: string; reason: string }[] = [];

  // 1. PROJECT DETAILS
  const projectName = extracted.projectName || 'MAGTORQ Design Project';
  let applicationType = extracted.applicationType || 'Conveyor';
  if (!extracted.applicationType) {
    if (normText.includes('conveyor') || normText.includes('belt')) {
      applicationType = 'Conveyor';
      assumptions.push({ parameter: 'Application Type', assumption: 'Conveyor', reason: 'Detected keyword "conveyor" / "belt" in source text.' });
    } else if (normText.includes('mixer') || normText.includes('agitator')) {
      applicationType = 'Mixer';
      assumptions.push({ parameter: 'Application Type', assumption: 'Mixer', reason: 'Detected keyword "mixer" / "agitator" in source text.' });
    } else if (normText.includes('crusher') || normText.includes('shredder')) {
      applicationType = 'Crusher';
      assumptions.push({ parameter: 'Application Type', assumption: 'Crusher', reason: 'Detected keyword "crusher" / "shredder" in source text.' });
    } else if (normText.includes('fan') || normText.includes('blower')) {
      applicationType = 'Fan';
      assumptions.push({ parameter: 'Application Type', assumption: 'Fan', reason: 'Detected keyword "fan" / "blower" in source text.' });
    } else if (normText.includes('pump')) {
      applicationType = 'Pump';
      assumptions.push({ parameter: 'Application Type', assumption: 'Pump', reason: 'Detected keyword "pump" in source text.' });
    } else {
      applicationType = 'Conveyor';
      assumptions.push({ parameter: 'Application Type', assumption: 'Conveyor (Default)', reason: 'No clear application type identified. Conveyor assigned as MAGTORQ standard baseline.' });
    }
  }

  // Duty cycle, load characteristics, env extraction
  let dutyType = extracted.dutyType || 'Continuous';
  if (!extracted.dutyType) {
    if (normText.includes('intermittent') || normText.includes('batch')) dutyType = 'Intermittent';
    else if (normText.includes('continuous') || normText.includes('24/7')) dutyType = 'Continuous';
  }

  let operatingHours = extracted.operatingHours || '10-12 hours/day';
  if (!extracted.operatingHours) {
    if (normText.includes('24 hours') || normText.includes('24h') || normText.includes('day and night')) operatingHours = '24 hours/day';
    else if (normText.includes('8 hours') || normText.includes('1 shift')) operatingHours = '8 hours/day';
  }

  let loadType = extracted.loadType || 'Moderate Shock';
  if (!extracted.loadType) {
    if (normText.includes('heavy shock') || normText.includes('crushing')) loadType = 'Heavy Shock';
    else if (normText.includes('uniform') || normText.includes('smooth')) loadType = 'Uniform';
  }

  let environment = extracted.environment || 'Standard Industrial';
  if (!extracted.environment) {
    if (normText.includes('dusty') || normText.includes('cement')) environment = 'Dusty / Abrasive';
    else if (normText.includes('wet') || normText.includes('outdoor')) environment = 'Outdoor Humid';
  }

  let gearboxPreferences = extracted.gearboxPreferences || 'Standard Planetary';

  // 2. PARSE MOTOR HP
  let extHP = extracted.motorHP;
  let hpDetectedText = '';
  if (extHP === null || extHP === undefined) {
    const hpMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:HP|horsepower|horse-power)/i);
    if (hpMatch) {
      extHP = parseFloat(hpMatch[1]);
      hpDetectedText = hpMatch[0];
    }
  }

  // 3. PARSE POWER KW (Rule 1: HP to kW Conversion)
  let extPower = extracted.powerKW;
  let powerNode: AuditParameterNode<number>;

  if (extPower !== null && extPower !== undefined && extPower > 0) {
    powerNode = {
      name: 'Power (kW)',
      value: extPower,
      type: 'EXTRACTED',
      source: 'Customer Requirement Document',
      formula: 'N/A (Explicitly Provided)',
      calculationSteps: `${extPower} kW`,
      confidence: 'High',
      reasoning: `The customer directly requested a power rating of ${extPower} kW.`
    };
  } else if (extHP && extHP > 0) {
    const computedKW = parseFloat((extHP * 0.7457).toFixed(2));
    powerNode = {
      name: 'Power (kW)',
      value: computedKW,
      type: 'CALCULATED',
      source: 'Derived from Motor HP',
      formula: 'Power (kW) = HP × 0.7457',
      calculationSteps: `Power = ${extHP} × 0.7457 = ${computedKW} kW`,
      confidence: 'High',
      reasoning: `Extracted HP rating of ${extHP} HP from text: "${hpDetectedText}". Converted to kW using standard industrial equivalence.`,
      detectedText: hpDetectedText
    };
  } else {
    // Regex kW check
    const powerMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:kW|kilowatt|kilowatts)/i);
    if (powerMatch) {
      const p = parseFloat(powerMatch[1]);
      powerNode = {
        name: 'Power (kW)',
        value: p,
        type: 'EXTRACTED',
        source: 'Regex Document Match',
        formula: 'N/A',
        calculationSteps: `${p} kW`,
        confidence: 'High',
        reasoning: `Found mention of ${p} kW in the document: "${powerMatch[0]}".`,
        detectedText: powerMatch[0]
      };
    } else {
      // Suggestion
      powerNode = {
        name: 'Power (kW)',
        value: 15.0,
        type: 'ASSUMED',
        source: 'MAGTORQ Industrial Baseline Recommendation',
        formula: 'P = 15 kW (Default)',
        calculationSteps: 'No power rating found. Defaulting to 15.0 kW',
        confidence: 'Low',
        reasoning: 'No power rating specified in raw text or files. Assumed 15.0 kW (20 HP) as it is the most common planetary gearbox design load.'
      };
      assumptions.push({ parameter: 'Power (kW)', assumption: '15 kW', reason: 'No power constraints identified. Assumed 15.0 kW standard benchmark.' });
    }
  }

  // Set motor HP node
  const motorHPNode: AuditParameterNode<number | null> = {
    name: 'Motor HP',
    value: extHP || (powerNode.value ? parseFloat((powerNode.value / 0.7457).toFixed(1)) : null),
    type: extHP ? 'EXTRACTED' : 'CALCULATED',
    source: extHP ? 'Customer Requirement Document' : 'Derived from Power (kW)',
    formula: extHP ? 'N/A' : 'HP = Power (kW) / 0.7457',
    calculationSteps: extHP ? `${extHP} HP` : `HP = ${powerNode.value} / 0.7457`,
    confidence: extHP ? 'High' : 'Medium',
    reasoning: extHP ? 'Directly extracted HP rating.' : 'Derived HP capacity from verified kW parameter.'
  };

  // 4. PARSE MOTOR POLE COUNT
  let extPoles = extracted.motorPoles;
  let polesDetectedText = '';
  if (extPoles === null || extPoles === undefined) {
    const polesMatch = rawText.match(/(\d+)\s*(?:pole|poles|-pole)/i);
    if (polesMatch) {
      extPoles = parseInt(polesMatch[1], 10);
      polesDetectedText = polesMatch[0];
    }
  }
  const motorPolesNode: AuditParameterNode<number | null> = {
    name: 'Motor Pole Count',
    value: extPoles || 4,
    type: extPoles ? 'EXTRACTED' : 'ASSUMED',
    source: extPoles ? 'Customer Requirement Document' : 'MAGTORQ Industrial Default',
    formula: 'N/A',
    calculationSteps: extPoles ? `${extPoles} Poles` : '4 Poles (Default)',
    confidence: extPoles ? 'High' : 'Medium',
    reasoning: extPoles ? `Found explicit poles mention in document: "${polesDetectedText}".` : 'Assumed standard 4-pole motor configuration, standard for 90% of induction motor drive architectures.',
    detectedText: polesDetectedText || undefined
  };
  if (!extPoles) {
    assumptions.push({ parameter: 'Motor Pole Count', assumption: '4 Poles', reason: 'No pole count specified. Standard 4-pole assigned.' });
  }

  // 5. PARSE INPUT RPM (Rule 2: Speed from Poles)
  let extInputRPM = extracted.inputRPM;
  let inputRPMNode: AuditParameterNode<number>;

  if (extInputRPM !== null && extInputRPM !== undefined && extInputRPM > 0) {
    inputRPMNode = {
      name: 'Input Speed (RPM)',
      value: extInputRPM,
      type: 'EXTRACTED',
      source: 'Customer Requirement Document',
      formula: 'N/A (Explicitly Provided)',
      calculationSteps: `${extInputRPM} RPM`,
      confidence: 'High',
      reasoning: `Customer specified explicit motor speed of ${extInputRPM} RPM.`
    };
  } else if (extPoles) {
    let speed = 1440;
    if (extPoles === 2) speed = 2850;
    else if (extPoles === 4) speed = 1440;
    else if (extPoles === 6) speed = 960;
    else if (extPoles === 8) speed = 720;

    inputRPMNode = {
      name: 'Input Speed (RPM)',
      value: speed,
      type: 'DERIVED',
      source: 'Motor Poles Rule Engine',
      formula: 'Poles-to-Speed Table Mapping',
      calculationSteps: `${extPoles}-Pole Motor → ${speed} RPM`,
      confidence: 'High',
      reasoning: `Derived from detected motor pole count of ${extPoles}. Synchronous speed at 50Hz is ${120 * 50 / extPoles} RPM, operating slip results in approx ${speed} RPM.`,
      ruleApplied: `${extPoles} Pole → ${speed} RPM`
    };
  } else {
    // Check regex speed
    const inputSpeedMatch = rawText.match(/(?:input|motor|inlet)\s+speed\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*RPM/i);
    const rpmMatches = [...rawText.matchAll(/(\d+(?:\.\d+)?)\s*RPM/gi)];
    let rpmVal = 1440;
    let textSrc = 'MAGTORQ Industrial Default';
    let isSuggested: ParameterType = 'ASSUMED';
    let conf: ConfidenceLevel = 'Medium';
    let detected = '';

    if (inputSpeedMatch) {
      rpmVal = parseFloat(inputSpeedMatch[1]);
      textSrc = 'Regex Input Speed Match';
      isSuggested = 'EXTRACTED';
      conf = 'High';
      detected = inputSpeedMatch[0];
    } else if (rpmMatches.length > 0) {
      rpmVal = parseFloat(rpmMatches[0][1]);
      textSrc = 'Regex RPM Match';
      isSuggested = 'EXTRACTED';
      conf = 'High';
      detected = rpmMatches[0][0];
    }

    inputRPMNode = {
      name: 'Input Speed (RPM)',
      value: rpmVal,
      type: isSuggested,
      source: textSrc,
      formula: isSuggested === 'EXTRACTED' ? 'N/A' : 'Default Mapping',
      calculationSteps: `${rpmVal} RPM`,
      confidence: conf,
      reasoning: isSuggested === 'EXTRACTED'
        ? `Found speed mention of ${rpmVal} RPM in text: "${detected}".`
        : 'No motor input speed or pole count was defined. Standard 4-pole AC motor operating speed of 1440 RPM was assigned.',
      detectedText: detected || undefined
    };
    if (isSuggested === 'ASSUMED') {
      assumptions.push({ parameter: 'Input Speed (RPM)', assumption: '1440 RPM', reason: 'No motor speed constraints found. Assigned standard slip speed.' });
    }
  }

  // 6. TARGET RATIO & OUTPUT RPM
  let extRatio = extracted.targetRatio;
  let extOutputRPM = extracted.outputRPM;

  // Check regex defaults for speed and ratios
  if (extRatio === null || extRatio === undefined) {
    const ratioMatch = rawText.match(/(?:gear\s+)?ratio\s+(?:of|is|target)?\s*(\d+(?:\.\d+)?)/i);
    if (ratioMatch) {
      extRatio = parseFloat(ratioMatch[1]);
    }
  }
  if (extOutputRPM === null || extOutputRPM === undefined) {
    const outputSpeedMatch = rawText.match(/(?:output|target|final|required|conveyor)\s+speed\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*RPM/i);
    if (outputSpeedMatch) {
      extOutputRPM = parseFloat(outputSpeedMatch[1]);
    }
  }

  let ratioNode: AuditParameterNode<number>;
  let outputRPMNode: AuditParameterNode<number>;

  const hasRatio = extRatio !== null && extRatio !== undefined && extRatio > 0;
  const hasOutput = extOutputRPM !== null && extOutputRPM !== undefined && extOutputRPM > 0;

  if (hasRatio && hasOutput) {
    ratioNode = {
      name: 'Total Gear Ratio',
      value: extRatio!,
      type: 'EXTRACTED',
      source: 'Customer Requirement Document',
      formula: 'N/A',
      calculationSteps: `${extRatio}:1`,
      confidence: 'High',
      reasoning: `Extracted explicit target gear ratio of ${extRatio}:1.`
    };
    outputRPMNode = {
      name: 'Output Speed (RPM)',
      value: extOutputRPM!,
      type: 'EXTRACTED',
      source: 'Customer Requirement Document',
      formula: 'N/A',
      calculationSteps: `${extOutputRPM} RPM`,
      confidence: 'High',
      reasoning: `Extracted explicit target output speed of ${extOutputRPM} RPM.`
    };
  } else if (hasRatio) {
    const computedOutRPM = parseFloat((inputRPMNode.value / extRatio!).toFixed(2));
    ratioNode = {
      name: 'Total Gear Ratio',
      value: extRatio!,
      type: 'EXTRACTED',
      source: 'Customer Requirement Document',
      formula: 'N/A',
      calculationSteps: `${extRatio}:1`,
      confidence: 'High',
      reasoning: `Extracted explicit target gear ratio of ${extRatio}:1.`
    };
    outputRPMNode = {
      name: 'Output Speed (RPM)',
      value: computedOutRPM,
      type: 'CALCULATED',
      source: 'Derived from Ratio and Input Speed',
      formula: 'OutputRPM = InputRPM / Ratio',
      calculationSteps: `OutputRPM = ${inputRPMNode.value} / ${extRatio} = ${computedOutRPM} RPM`,
      confidence: 'High',
      reasoning: `Calculated from motor input speed (${inputRPMNode.value} RPM) and target reduction ratio (${extRatio}:1).`
    };
  } else if (hasOutput) {
    const computedRatio = parseFloat((inputRPMNode.value / extOutputRPM!).toFixed(2));
    outputRPMNode = {
      name: 'Output Speed (RPM)',
      value: extOutputRPM!,
      type: 'EXTRACTED',
      source: 'Customer Requirement Document',
      formula: 'N/A',
      calculationSteps: `${extOutputRPM} RPM`,
      confidence: 'High',
      reasoning: `Extracted explicit target output speed of ${extOutputRPM} RPM.`
    };
    ratioNode = {
      name: 'Total Gear Ratio',
      value: computedRatio,
      type: 'CALCULATED',
      source: 'Derived from Input Speed and Output Speed',
      formula: 'Ratio = InputRPM / OutputRPM',
      calculationSteps: `Ratio = ${inputRPMNode.value} / ${extOutputRPM} = ${computedRatio}`,
      confidence: 'High',
      reasoning: `Derived reduction ratio from motor input speed (${inputRPMNode.value} RPM) and target conveyor/application speed (${extOutputRPM} RPM).`
    };
  } else {
    // Suggest standard ratio based on application type
    let suggestedRatio = 50;
    if (applicationType === 'Conveyor') suggestedRatio = 50;
    else if (applicationType === 'Mixer') suggestedRatio = 40;
    else if (applicationType === 'Agitator') suggestedRatio = 40;
    else if (applicationType === 'Crusher') suggestedRatio = 60;
    else if (applicationType === 'Fan') suggestedRatio = 10;
    else if (applicationType === 'Pump') suggestedRatio = 15;
    else if (applicationType === 'Elevator') suggestedRatio = 80;

    const computedOutRPM = parseFloat((inputRPMNode.value / suggestedRatio).toFixed(2));

    ratioNode = {
      name: 'Total Gear Ratio',
      value: suggestedRatio,
      type: 'SUGGESTED',
      source: 'MAGTORQ Application Standard Mapping',
      formula: 'Ratio = Default (Application Driven)',
      calculationSteps: `Suggested Ratio = ${suggestedRatio}:1`,
      confidence: 'Low',
      reasoning: `No ratio or output RPM found. Suggested standard ${suggestedRatio}:1 ratio baseline for typical industrial ${applicationType.toLowerCase()} drivetrains.`
    };

    outputRPMNode = {
      name: 'Output Speed (RPM)',
      value: computedOutRPM,
      type: 'CALCULATED',
      source: 'Derived from Suggested Ratio',
      formula: 'OutputRPM = InputRPM / Ratio',
      calculationSteps: `OutputRPM = ${inputRPMNode.value} / ${suggestedRatio} = ${computedOutRPM} RPM`,
      confidence: 'Low',
      reasoning: `Derived output speed using standard 1440 RPM speed and suggested ratio of ${suggestedRatio}:1.`
    };
    assumptions.push({ parameter: 'Total Ratio', assumption: `${suggestedRatio}:1`, reason: `No reduction constraints found. Suggested default ${suggestedRatio}:1 ratio for ${applicationType}.` });
  }

  // 7. SERVICE FACTOR RECOMMENDATION (Rule 5)
  let extSF = extracted.serviceFactor;
  let serviceFactorNode: AuditParameterNode<number>;

  if (extSF !== null && extSF !== undefined && extSF > 0) {
    serviceFactorNode = {
      name: 'Service Factor',
      value: extSF,
      type: 'EXTRACTED',
      source: 'Customer Requirement Document',
      formula: 'N/A',
      calculationSteps: `${extSF}`,
      confidence: 'High',
      reasoning: `Directly extracted explicit service factor safety coefficient of ${extSF}.`
    };
  } else {
    let sf = 1.5;
    let ruleDesc = 'Conveyor → SF 1.5';


    if (applicationType === 'Conveyor') {
      sf = 1.5;
      ruleDesc = 'Conveyor → Service Factor 1.5';
    } else if (applicationType === 'Pump') {
      sf = 1.25;
      ruleDesc = 'Pump → Service Factor 1.25';
    } else if (applicationType === 'Fan') {
      sf = 1.25;
      ruleDesc = 'Fan → Service Factor 1.25';
    } else if (applicationType === 'Mixer' || applicationType === 'Agitator') {
      sf = 1.75;
      ruleDesc = 'Mixer/Agitator → Service Factor 1.75';
    } else if (applicationType === 'Elevator') {
      sf = 1.75;
      ruleDesc = 'Elevator → Service Factor 1.75';
    } else if (applicationType === 'Crusher') {
      sf = 2.0;
      ruleDesc = 'Crusher → Service Factor 2.0';
    } else if (normText.includes('heavy shock') || normText.includes('impact')) {
      sf = 3.0;
      ruleDesc = 'Heavy Shock Load → Service Factor 3.0';
    }

    serviceFactorNode = {
      name: 'Service Factor',
      value: sf,
      type: 'SUGGESTED',
      source: 'MAGTORQ Engineering Recommendations Database',
      formula: ruleDesc,
      calculationSteps: `Resulting SF = ${sf}`,
      confidence: 'Medium',
      reasoning: `Suggested Service Factor of ${sf} for ${applicationType} applications. Matches recommended standard to absorb cyclic shocks and fluctuations.`,
      ruleApplied: ruleDesc
    };
    assumptions.push({ parameter: 'Service Factor', assumption: `${sf}`, reason: `Suggested based on detected application type (${applicationType}).` });
  }

  // 8. STAGE EVALUATION ENGINE & AUTOMATIC RECOMMENDATION
  const R_req = ratioNode.value;
  const l1 = seriesLimits.s1;
  const l2 = seriesLimits.s2;
  const l3 = seriesLimits.s3;
  const l4 = seriesLimits.s4;

  const max1 = l1.max;
  const max2 = l1.max * l2.max;
  const max3 = l1.max * l2.max * l3.max;
  const max4 = l1.max * l2.max * l3.max * l4.max;

  const stageEvaluationDetails = [
    { stages: 1, maxRatio: parseFloat(max1.toFixed(2)), calculationSteps: `${l1.max.toFixed(2)}`, isSufficient: R_req <= max1 },
    { stages: 2, maxRatio: parseFloat(max2.toFixed(2)), calculationSteps: `${l1.max.toFixed(2)} × ${l2.max.toFixed(2)} = ${max2.toFixed(2)}`, isSufficient: R_req <= max2 },
    { stages: 3, maxRatio: parseFloat(max3.toFixed(2)), calculationSteps: `${l1.max.toFixed(2)} × ${l2.max.toFixed(2)} × ${l3.max.toFixed(2)} = ${max3.toFixed(2)}`, isSufficient: R_req <= max3 },
    { stages: 4, maxRatio: parseFloat(max4.toFixed(2)), calculationSteps: `${l1.max.toFixed(2)} × ${l2.max.toFixed(2)} × ${l3.max.toFixed(2)} × ${l4.max.toFixed(2)} = ${max4.toFixed(2)}`, isSufficient: R_req <= max4 }
  ];

  // Determine minimum stage count
  let minStages = 1;
  for (const item of stageEvaluationDetails) {
    if (R_req <= item.maxRatio) {
      minStages = item.stages;
      break;
    }
  }

  // Override stages if explicitly requested
  let resolvedStages = minStages;
  let extStages = extracted.numberOfStages;
  if (extStages === null || extStages === undefined) {
    // Check regex stages
    const stageMatch = rawText.match(/(\d+)\s*(?:stage|reduction)/i);
    if (stageMatch) {
      extStages = parseInt(stageMatch[1], 10);
    }
  }

  let stagesReasoning = `The target gear ratio of ${R_req.toFixed(2)}:1 requires a minimum of ${minStages} planetary stages. `;
  if (minStages === 1) {
    stagesReasoning += `This ratio fits inside the single-stage limit (${max1.toFixed(2)}) using series S1.`;
  } else {
    const lowerMax = stageEvaluationDetails[minStages - 2].maxRatio;
    stagesReasoning += `A ${minStages - 1}-stage config is insufficient (Max Ratio limit: ${lowerMax.toFixed(2)}), whereas a ${minStages}-stage configuration safely extends capacity to ${stageEvaluationDetails[minStages - 1].maxRatio.toFixed(2)}.`;
  }

  if (extStages && extStages !== minStages) {
    stagesReasoning += ` Customer requested ${extStages} stages, which overrides the recommended ${minStages} stage configuration.`;
    resolvedStages = extStages;
  }

  const stagesNode: AuditParameterNode<number> = {
    name: 'Stages',
    value: resolvedStages,
    type: extStages ? 'EXTRACTED' : 'CALCULATED',
    source: extStages ? 'Customer Requirement Document' : 'Stage Evaluation Engine',
    formula: 'Minimum Stage Count = first(stages where Ratio <= MaxRatio)',
    calculationSteps: `Required Ratio = ${R_req.toFixed(2)} → Recommended Stages = ${resolvedStages}`,
    confidence: 'High',
    reasoning: stagesReasoning
  };

  const stageEvaluationTrace = {
    targetRatio: R_req,
    details: stageEvaluationDetails,
    minimumStagesRequired: minStages,
    recommendedStages: resolvedStages,
    reasoning: stagesReasoning
  };

  // 9. VALIDATION
  const validation = validateInputs(
    powerNode.value,
    inputRPMNode.value,
    ratioNode.value,
    stagesNode.value,
    serviceFactorNode.value
  );

  // 10. DETERMINE DRIVETRAIN SPEEDS, TORQUES, AND SELECT GEARBOXES
  const stageTraces: StageTrace[] = [];
  let inputTorqueTrace = { formula: '', calculationSteps: '', result: 0 };
  let overallOutputTorque = 0;
  let overallMaxTorque = 0;
  let overallEfficiency = 1;

  if (validation.isValid) {
    const P = powerNode.value;
    const Nin = inputRPMNode.value;

    // Calculate Input Torque: T = (P * 60000) / (2 * pi * N)
    const Tin = (P * 60000) / (2 * Math.PI * Nin);
    inputTorqueTrace = {
      formula: 'Tin = (Power × 60000) / (2 × π × InputRPM)',
      calculationSteps: `Tin = (${P} × 60000) / (2 × π × ${Nin}) = ${Tin.toFixed(2)} N·m`,
      result: Tin
    };

    // Distribute ratios
    const { ratios, series } = distributeRatios(R_req, stagesNode.value);
    overallEfficiency = Math.pow(0.97, stagesNode.value);

    let speed = Nin;
    let torque = Tin;

    for (let i = 0; i < stagesNode.value; i++) {
      const ratio = ratios[i];
      const seriesVal = series[i];

      const speedBefore = speed;
      const speedAfter = speed / ratio;
      const torqueBefore = torque;
      const torqueAfter = torque * ratio * 0.97;
      const maxTorqueAfter = torqueAfter * serviceFactorNode.value;

      // Select Gearbox
      const gb = selectGearboxSync(seriesVal, torqueAfter, maxTorqueAfter, i, ratio);

      // Selection traceability details
      const seriesNum = parseInt(seriesVal.replace('s', ''));
      const filtered = gearboxDatabase.filter(g => g.series === seriesNum);
      const rule1List = filtered.filter(g => g.nominal >= torqueAfter && g.rated >= maxTorqueAfter).sort((a, b) => a.nominal - b.nominal);
      const rule2List = filtered.filter(g => g.rated >= maxTorqueAfter).sort((a, b) => a.rated - b.rated);

      let selectionRuleApplied = 'Rule 3 (Final fallback)';
      let selectionReason = 'Select largest gearbox in the series due to extreme loading capacity constraints.';

      if (rule1List.length > 0) {
        selectionRuleApplied = 'Rule 1 (Ideal)';
        selectionReason = `Smallest gearbox satisfying both Nominal torque (${Math.round(torqueAfter).toLocaleString()} N·m) and peak load (${Math.round(maxTorqueAfter).toLocaleString()} N·m) requirements.`;
      } else if (rule2List.length > 0) {
        selectionRuleApplied = 'Rule 2 (Fallback)';
        selectionReason = `Smallest gearbox satisfying peak overload torque (${Math.round(maxTorqueAfter).toLocaleString()} N·m). Flagged for moderate slip operation.`;
      }

      // Safety Factor
      const safetyVal = Math.min(gb.nominal / torqueAfter, gb.rated / maxTorqueAfter);

      stageTraces.push({
        stage: i + 1,
        ratio,
        speed: speedAfter,
        nominalTorque: torqueAfter,
        maxTorque: maxTorqueAfter,
        selectedGearbox: gb,
        safetyFactor: safetyVal,
        
        speedFormula: 'N_out = N_in / Ratio',
        speedSteps: `N_out = ${speedBefore.toFixed(1)} / ${ratio} = ${speedAfter.toFixed(1)} RPM`,
        torqueFormula: 'Tout = Tin × Ratio × 0.97',
        torqueSteps: `Tout = ${torqueBefore.toFixed(2)} × ${ratio} × 0.97 = ${torqueAfter.toFixed(2)} N·m`,
        gbNominalCheck: `GB Nominal Capacity = ${gb.nominal} N·m vs Stage Nominal = ${Math.round(torqueAfter)} N·m (Ratio: ${(gb.nominal / torqueAfter).toFixed(2)})`,
        gbRatedCheck: `GB Rated Capacity = ${gb.rated} N·m vs Stage Maximum = ${Math.round(maxTorqueAfter)} N·m (Ratio: ${(gb.rated / maxTorqueAfter).toFixed(2)})`,
        safetyFormula: 'SF = min(GBNominal / StageNominal, GBRated / StageMaximum)',
        safetySteps: `SF = min(${gb.nominal} / ${torqueAfter.toFixed(1)}, ${gb.rated} / ${maxTorqueAfter.toFixed(1)}) = ${safetyVal.toFixed(2)}`,
        selectionReason,
        selectionRuleApplied
      });

      speed = speedAfter;
      torque = torqueAfter;
    }

    overallOutputTorque = torque;
    overallMaxTorque = torque * serviceFactorNode.value;
  }

  // 11. FINAL RECOMMENDATION TEXT
  const lastGb = stageTraces[stageTraces.length - 1]?.selectedGearbox;
  const isSafe = stageTraces.every(d => d.safetyFactor >= 1.0);

  let recommendationText = `Based on the provided specification sheet, MAGTORQ's Engineering Reasoning Engine has completed a full structural analysis of the drive requirements. 

We recommend a **${stagesNode.value}-stage reduction gearbox configuration** utilizing the **${stagesNode.value === 1 ? 'S1' : stagesNode.value === 2 ? 'S1 × S2' : stagesNode.value === 3 ? 'S1 × S2 × S3' : 'S1 × S2 × S3 × S4'}** series sequence. `;

  if (lastGb) {
    recommendationText += `The final stage is resolved to a **MAGTORQ ${lastGb.size}** model, which satisfies the output nominal torque demands of **${Math.round(overallOutputTorque).toLocaleString()} N·m** and peak loads of **${Math.round(overallMaxTorque).toLocaleString()} N·m** under a service factor of **${serviceFactorNode.value}**. \n\n`;
  }

  recommendationText += `**Calculated Ratios Breakdown:** ${stageTraces.map(t => t.ratio).join(' × ')} yielding a total reduction ratio of **${R_req.toFixed(2)}:1** (Output Speed: **${outputRPMNode.value.toFixed(1)} RPM**).
**Efficiency Analysis:** Overall mechanical efficiency is calculated at **${(overallEfficiency * 100).toFixed(1)}%** (assuming a standard transmission loss of 3% per planetary reduction stage).
**Drivetrain Status:** ${isSafe ? '⚡ Safe & Compliant. All reduction stages operate within the nominal and peak rated capacity margins.' : '⚠ Warning: Overload detected on intermediate stages. We suggest selecting a higher frame size or adjusting service factor settings.'}`;

  return {
    projectName,
    applicationType,
    dutyType,
    operatingHours,
    loadType,
    environment,
    gearboxPreferences,
    validation,
    powerKW: powerNode,
    motorHP: motorHPNode,
    motorPoles: motorPolesNode,
    inputRPM: inputRPMNode,
    outputRPM: outputRPMNode,
    totalRatio: ratioNode,
    stages: stagesNode,
    serviceFactor: serviceFactorNode,
    stageEvaluationTrace,
    inputTorque: inputTorqueTrace,
    stageTraces,
    overallEfficiency,
    overallOutputTorque,
    overallMaxTorque,
    finalRecommendation: recommendationText,
    assumptions
  };
}
