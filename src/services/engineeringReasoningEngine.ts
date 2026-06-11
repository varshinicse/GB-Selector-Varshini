import { Gearbox } from '../types/Gearbox';
import { gearboxDatabase } from '../data/gearboxDatabase';
import {
  PowerTorqueEngine,
  MotorSpeedEngine,
  ServiceFactorEngine,
  ParameterExtractionEngine,
  TorquePropagationEngine,
  SafetyFactorEngine,
  MissingDataResolutionEngine,
  RatioEngine
} from './calculations';
import {
  parseInputsWithMetadata,
  derivationRules,
  DerivedTrace,
  SkipTrace,
  DerivationSessionReport
} from './derivationEngine';
import { ApplicationKnowledgeEngine } from './applicationKnowledgeEngine';


// Type Classification for parameters
export type ParameterType = 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED' | 'ENGINE_RULE';
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

  // Derivation framework additions
  outputTorqueNm?: AuditParameterNode<number | null>;
  rmsTorqueNm?: AuditParameterNode<number | null>;
  accelerationTorqueNm?: AuditParameterNode<number | null>;
  effectiveThermalPowerKW?: AuditParameterNode<number | null>;
  requiredLifeHours?: AuditParameterNode<number | null>;
  derivationTraces?: DerivedTrace[];
  derivationSkips?: SkipTrace[];
  applicationKnowledge?: {
    detectedApplication: string;
    missingRequiredParams: string[];
    missingOptionalParams: string[];
    blockingMissingParams: string[];
    clarificationQuestions: string[];
    isBlocked: boolean;
  };
  extractedEngineeringParams?: Record<string, AuditParameterNode<any>>;
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

  const isValid = !items.some(i => i.status === '❌ Invalid' || i.status === '⚠ Missing');

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
    serviceFactorCondition?: string | null;
  }
): EngineeringReport {
  const normText = rawText.toLowerCase();
  const assumptions: { parameter: string; assumption: string; reason: string }[] = [];
  const localExtracted = ParameterExtractionEngine.extract(rawText);

  // Extract motor HP, poles, and frequency early for upstream dependency resolution
  let extHP = extracted.motorHP || localExtracted.power_hp;
  if (extHP === null || extHP === undefined) {
    const hpMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:HP|horsepower|horse-power)/i);
    if (hpMatch) {
      extHP = parseFloat(hpMatch[1]);
    }
  }

  let extPoles = extracted.motorPoles;
  if (extPoles === null || extPoles === undefined) {
    const polesMatch = rawText.match(/(\d+)\s*(?:pole|poles|-pole)/i);
    if (polesMatch) {
      extPoles = parseInt(polesMatch[1], 10);
    }
  }

  const frequencyHz = localExtracted.frequency_hz || 50;

  // ─── DERIVATION ENGINE (Phase 1 upstream parameter enrichment) ───
  const userProvidedKeys = new Set<string>();
  const parserResult = parseInputsWithMetadata(rawText);
  const initialParams = parserResult.values;

  // Populate early extractions into initialParams so they are available in the dependency graph
  if (extHP !== null && extHP !== undefined && extHP > 0) {
    initialParams.motorHP = extHP;
  }
  if (extPoles !== null && extPoles !== undefined && extPoles > 0) {
    initialParams.motorPoles = extPoles;
  }
  initialParams.frequencyHz = frequencyHz;

  // Map explicitly provided/extracted values to initialParams, and register them as user/handbook provided
  if (extracted.powerKW !== null && extracted.powerKW !== undefined && extracted.powerKW > 0) {
    initialParams.powerKW = extracted.powerKW;
    userProvidedKeys.add('powerKW');
  } else if (localExtracted.power_kw !== undefined && localExtracted.power_kw > 0) {
    initialParams.powerKW = localExtracted.power_kw;
  }

  if (extracted.inputRPM !== null && extracted.inputRPM !== undefined && extracted.inputRPM > 0) {
    initialParams.inputRPM = extracted.inputRPM;
    userProvidedKeys.add('inputRPM');
  } else if (localExtracted.input_rpm !== undefined && localExtracted.input_rpm > 0) {
    initialParams.inputRPM = localExtracted.input_rpm;
  }

  if (extracted.outputRPM !== null && extracted.outputRPM !== undefined && extracted.outputRPM > 0) {
    initialParams.outputRPM = extracted.outputRPM;
    userProvidedKeys.add('outputRPM');
  } else if (localExtracted.output_rpm !== undefined && localExtracted.output_rpm > 0) {
    initialParams.outputRPM = localExtracted.output_rpm;
  }

  if (extracted.targetRatio !== null && extracted.targetRatio !== undefined && extracted.targetRatio > 0) {
    initialParams.totalRatio = extracted.targetRatio;
    userProvidedKeys.add('totalRatio');
  } else if (localExtracted.ratio !== undefined && localExtracted.ratio > 0) {
    initialParams.totalRatio = localExtracted.ratio;
  }

  if (extracted.serviceFactor !== null && extracted.serviceFactor !== undefined && extracted.serviceFactor > 0) {
    initialParams.serviceFactor = extracted.serviceFactor;
    userProvidedKeys.add('serviceFactor');
  }

  if (extracted.numberOfStages !== null && extracted.numberOfStages !== undefined && extracted.numberOfStages > 0) {
    initialParams.stages = extracted.numberOfStages;
    userProvidedKeys.add('stages');
  }

  // Execute the Application Knowledge Engine analysis
  const knowledgeAnalysis = ApplicationKnowledgeEngine.analyze(rawText, initialParams, userProvidedKeys);
  const derivationResult = knowledgeAnalysis.derivationResult as DerivationSessionReport;
  const resolved = derivationResult.derivedParameters;

  // 1. PROJECT DETAILS
  const projectName = extracted.projectName || 'MAGTORQ Design Project';
  
  const applicationType = extracted.applicationType || knowledgeAnalysis.config.displayName;
  if (!extracted.applicationType) {
    assumptions.push({
      parameter: 'Application Type',
      assumption: applicationType,
      reason: `Detected application from raw text matching classification: ${knowledgeAnalysis.applicationId}`
    });
  }

  let dutyType = extracted.dutyType || 'Continuous';
  if (!extracted.dutyType) {
    if (normText.includes('intermittent') || normText.includes('batch')) dutyType = 'Intermittent';
    else if (normText.includes('continuous') || normText.includes('24/7')) dutyType = 'Continuous';
  }

  let operatingHours = extracted.operatingHours || '10-12 hours/day';
  let dutyHours = 12; // baseline for service factor
  if (!extracted.operatingHours) {
    if (normText.includes('24 hours') || normText.includes('24h') || normText.includes('day and night')) {
      operatingHours = '24 hours/day';
      dutyHours = 24;
    } else if (normText.includes('8 hours') || normText.includes('1 shift')) {
      operatingHours = '8 hours/day';
      dutyHours = 8;
    } else {
      const match = normText.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|hour)\s*(?:per\s*day|\/day)/i);
      if (match) {
        dutyHours = parseFloat(match[1]);
        operatingHours = `${dutyHours} hours/day`;
      }
    }
  } else {
    const match = extracted.operatingHours.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      dutyHours = parseFloat(match[1]);
    }
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

  const gearboxPreferences = extracted.gearboxPreferences || 'Standard Planetary';

  // 5. SOLVE SPEEDS & RATIO
  let resolvedInputRPM: number | null = null;
  let inputRPMType: ParameterType = 'EXTRACTED';
  let inputRPMSource = 'Customer Requirement Document';
  let inputRPMFormula = 'N/A';
  let inputRPMSteps = '';
  let inputRPMReasoning = '';

  const derivedInputRPMTrace = derivationResult.traces.find(t => t.outputProduced.startsWith('inputRPM'));
  if (derivedInputRPMTrace) {
    resolvedInputRPM = derivedInputRPMTrace.value;
    inputRPMType = 'ENGINE_RULE';
    inputRPMSource = derivedInputRPMTrace.ruleName;
    inputRPMFormula = derivedInputRPMTrace.formulaUsed;
    inputRPMSteps = derivedInputRPMTrace.outputProduced;
    const rule = derivationRules.find(r => r.id === derivedInputRPMTrace.ruleId);
    inputRPMReasoning = rule ? rule.auditDescription : 'Resolved via engineering derivation rules.';
  } else if (resolved.inputRPM !== undefined && resolved.inputRPM !== null) {
    resolvedInputRPM = resolved.inputRPM;
    inputRPMReasoning = `Resolved input motor speed of ${resolvedInputRPM} RPM.`;
  } else if (extracted.inputRPM !== null && extracted.inputRPM !== undefined && extracted.inputRPM > 0) {
    resolvedInputRPM = extracted.inputRPM;
    inputRPMReasoning = `Customer specified explicit motor speed of ${resolvedInputRPM} RPM.`;
  } else if (localExtracted.input_rpm !== undefined && localExtracted.input_rpm > 0) {
    resolvedInputRPM = localExtracted.input_rpm;
    inputRPMReasoning = `Extracted speed of ${resolvedInputRPM} RPM from raw text.`;
  } else if (extPoles !== undefined && extPoles !== null && extPoles > 0) {
    const speed = MotorSpeedEngine.actualSpeed(extPoles, frequencyHz);
    resolvedInputRPM = parseFloat(speed.toFixed(1));
    inputRPMType = 'DERIVED';
    inputRPMSource = 'Motor Poles Rule Engine';
    inputRPMFormula = 'Poles-to-Speed Table Mapping';
    inputRPMSteps = `${extPoles}-Pole Motor → ${resolvedInputRPM} RPM`;
    inputRPMReasoning = `Derived from detected motor pole count of ${extPoles}. Synchronous speed at ${frequencyHz}Hz is ${(120 * frequencyHz) / extPoles} RPM, operating slip results in approx ${resolvedInputRPM} RPM.`;
  }

  // Output RPM
  let resolvedOutputRPM: number | null = null;
  let outputRPMType: ParameterType = 'EXTRACTED';
  let outputRPMSource = 'Customer Requirement Document';
  let outputRPMFormula = 'N/A';
  let outputRPMSteps = '';
  let outputRPMReasoning = '';

  const derivedOutputRPMTrace = derivationResult.traces.find(t => t.outputProduced.startsWith('outputRPM'));
  if (derivedOutputRPMTrace) {
    resolvedOutputRPM = derivedOutputRPMTrace.value;
    outputRPMType = 'ENGINE_RULE';
    outputRPMSource = derivedOutputRPMTrace.ruleName;
    outputRPMFormula = derivedOutputRPMTrace.formulaUsed;
    outputRPMSteps = derivedOutputRPMTrace.outputProduced;
    const rule = derivationRules.find(r => r.id === derivedOutputRPMTrace.ruleId);
    outputRPMReasoning = rule ? rule.auditDescription : 'Resolved via engineering derivation rules.';
  } else if (resolved.outputRPM !== undefined && resolved.outputRPM !== null) {
    resolvedOutputRPM = resolved.outputRPM;
    outputRPMReasoning = `Resolved output speed of ${resolvedOutputRPM} RPM.`;
  } else if (extracted.outputRPM !== null && extracted.outputRPM !== undefined && extracted.outputRPM > 0) {
    resolvedOutputRPM = extracted.outputRPM;
    outputRPMReasoning = `Extracted explicit target output speed of ${resolvedOutputRPM} RPM.`;
  } else if (localExtracted.output_rpm !== undefined && localExtracted.output_rpm > 0) {
    resolvedOutputRPM = localExtracted.output_rpm;
    outputRPMReasoning = `Extracted target output speed of ${resolvedOutputRPM} RPM from text.`;
  }

  // Gear Ratio
  let resolvedRatio: number | null = null;
  let ratioType: ParameterType = 'EXTRACTED';
  let ratioSource = 'Customer Requirement Document';
  let ratioFormula = 'N/A';
  let ratioSteps = '';
  let ratioReasoning = '';

  const derivedRatioTrace = derivationResult.traces.find(t => t.outputProduced.startsWith('totalRatio'));
  if (derivedRatioTrace) {
    resolvedRatio = derivedRatioTrace.value;
    ratioType = 'ENGINE_RULE';
    ratioSource = derivedRatioTrace.ruleName;
    ratioFormula = derivedRatioTrace.formulaUsed;
    ratioSteps = derivedRatioTrace.outputProduced;
    const rule = derivationRules.find(r => r.id === derivedRatioTrace.ruleId);
    ratioReasoning = rule ? rule.auditDescription : 'Resolved via engineering derivation rules.';
  } else if (resolved.totalRatio !== undefined && resolved.totalRatio !== null) {
    resolvedRatio = resolved.totalRatio;
    ratioReasoning = `Resolved target gear ratio of ${resolvedRatio}:1.`;
  } else if (extracted.targetRatio !== null && extracted.targetRatio !== undefined && extracted.targetRatio > 0) {
    resolvedRatio = extracted.targetRatio;
    ratioReasoning = `Extracted explicit target gear ratio of ${resolvedRatio}:1.`;
  } else if (localExtracted.ratio !== undefined && localExtracted.ratio > 0) {
    resolvedRatio = localExtracted.ratio;
    ratioReasoning = `Extracted target gear ratio of ${resolvedRatio}:1 from text.`;
  }

  // 6. SOLVE POWER
  let resolvedPower: number | null = null;
  let powerType: ParameterType = 'EXTRACTED';
  let powerSource = 'Customer Requirement Document';
  let powerFormula = 'N/A';
  let powerSteps = '';
  let powerReasoning = '';

  const extPower = extracted.powerKW || localExtracted.power_kw;
  const derivedPowerTrace = derivationResult.traces.find(t => t.outputProduced.startsWith('powerKW'));
  if (derivedPowerTrace) {
    resolvedPower = derivedPowerTrace.value;
    powerType = 'ENGINE_RULE';
    powerSource = derivedPowerTrace.ruleName;
    powerFormula = derivedPowerTrace.formulaUsed;
    powerSteps = derivedPowerTrace.outputProduced;
    const rule = derivationRules.find(r => r.id === derivedPowerTrace.ruleId);
    powerReasoning = rule ? rule.auditDescription : 'Resolved via engineering derivation rules.';
  } else if (resolved.powerKW !== undefined && resolved.powerKW !== null) {
    resolvedPower = resolved.powerKW;
    powerReasoning = `Resolved input power of ${resolvedPower} kW.`;
  } else if (extPower !== null && extPower !== undefined && extPower > 0) {
    resolvedPower = extPower;
    powerReasoning = `The customer directly requested a power rating of ${resolvedPower} kW.`;
  }

  // ─── FORMULA-BASED RESOLUTION ───
  // Construct a temporary GearboxInput parameter mapping object
  const gearboxInput: any = {
    power_kw: resolvedPower || undefined,
    power_hp: extHP || undefined,
    input_rpm: resolvedInputRPM || undefined,
    output_rpm: resolvedOutputRPM || undefined,
    total_ratio: resolvedRatio || undefined,
    input_torque_nm: localExtracted.torque_nm || undefined,
    axial_load_kn: localExtracted.axial_load_kn || undefined,
    linear_velocity_mm_min: localExtracted.linear_speed_mm_min || undefined,
    screw_pitch_mm: localExtracted.pitch_mm || undefined,
  };

  // 1. Resolve HP to kW using PowerTorqueEngine
  if (!gearboxInput.power_kw && gearboxInput.power_hp) {
    gearboxInput.power_kw = PowerTorqueEngine.hpToKw(gearboxInput.power_hp);
    resolvedPower = gearboxInput.power_kw;
    powerType = 'CALCULATED';
    powerSource = 'PowerTorqueEngine.hpToKw';
    powerFormula = 'P_kw = HP * 0.7457';
    powerSteps = `${gearboxInput.power_hp} HP * 0.7457 = ${resolvedPower.toFixed(2)} kW`;
    powerReasoning = `Calculated power of ${resolvedPower.toFixed(2)} kW from HP input (${gearboxInput.power_hp} HP) using conversion factor 0.7457.`;
  }

  // 2. Resolve input speed using MotorSpeedEngine.deriveRPM formula
  if (!gearboxInput.input_rpm) {
    gearboxInput.input_rpm = MotorSpeedEngine.deriveRPM(extPoles || undefined, frequencyHz);
    resolvedInputRPM = gearboxInput.input_rpm;
    inputRPMType = 'DERIVED';
    inputRPMSource = 'MotorSpeedEngine.deriveRPM';
    inputRPMFormula = 'N_in = deriveRPM(poles, hz)';
    inputRPMSteps = `deriveRPM(${extPoles || 'null'}, ${frequencyHz}) = ${resolvedInputRPM} RPM`;
    inputRPMReasoning = `Derived input motor speed of ${resolvedInputRPM} RPM using MotorSpeedEngine.deriveRPM formula from calculations.ts.`;
  }

  // 3. Call MissingDataResolutionEngine to resolve power, output speed, and ratio
  const resolvedPowerByEngine = MissingDataResolutionEngine.resolvePower(gearboxInput);
  if (resolvedPower === null && resolvedPowerByEngine !== undefined) {
    resolvedPower = resolvedPowerByEngine;
    gearboxInput.power_kw = resolvedPower;
    powerType = 'CALCULATED';
    powerSource = 'MissingDataResolutionEngine.resolvePower';
    powerFormula = 'P = (T_in * 2π * N_in) / 60000';
    powerSteps = `P = (${gearboxInput.input_torque_nm} Nm * 2π * ${gearboxInput.input_rpm} RPM) / 60000 = ${resolvedPower.toFixed(2)} kW`;
    powerReasoning = `Derived input power of ${resolvedPower.toFixed(2)} kW from torque (${gearboxInput.input_torque_nm} Nm) and input speed (${gearboxInput.input_rpm} RPM).`;
  }

  const resolvedOutputRPMByEngine = MissingDataResolutionEngine.resolveOutputRPM(gearboxInput);
  if (resolvedOutputRPM === null && resolvedOutputRPMByEngine !== undefined) {
    resolvedOutputRPM = resolvedOutputRPMByEngine;
    gearboxInput.output_rpm = resolvedOutputRPM;
    outputRPMType = 'CALCULATED';
    outputRPMSource = 'MissingDataResolutionEngine.resolveOutputRPM';
    if (gearboxInput.linear_velocity_mm_min && gearboxInput.screw_pitch_mm) {
      outputRPMFormula = 'N_out = v_linear / p_screw';
      outputRPMSteps = `N_out = ${gearboxInput.linear_velocity_mm_min} / ${gearboxInput.screw_pitch_mm} = ${resolvedOutputRPM.toFixed(1)} RPM`;
      outputRPMReasoning = `Calculated target screw output speed of ${resolvedOutputRPM.toFixed(1)} RPM from linear travel velocity (${gearboxInput.linear_velocity_mm_min} mm/min) and screw pitch (${gearboxInput.screw_pitch_mm} mm).`;
    } else {
      outputRPMFormula = 'N_out = N_in / Ratio';
      outputRPMSteps = `N_out = ${gearboxInput.input_rpm} / ${gearboxInput.total_ratio} = ${resolvedOutputRPM.toFixed(1)} RPM`;
      outputRPMReasoning = `Calculated target output speed of ${resolvedOutputRPM.toFixed(1)} RPM from input speed (${gearboxInput.input_rpm} RPM) and gear ratio (${gearboxInput.total_ratio}:1).`;
    }
  }

  const resolvedRatioByEngine = MissingDataResolutionEngine.resolveRatio(gearboxInput);
  if (resolvedRatio === null && resolvedRatioByEngine !== undefined) {
    resolvedRatio = resolvedRatioByEngine;
    gearboxInput.total_ratio = resolvedRatio;
    ratioType = 'CALCULATED';
    ratioSource = 'MissingDataResolutionEngine.resolveRatio';
    ratioFormula = 'Ratio = N_in / N_out';
    ratioSteps = `Ratio = ${gearboxInput.input_rpm} / ${gearboxInput.output_rpm?.toFixed(1)} = ${resolvedRatio.toFixed(2)}`;
    ratioReasoning = `Calculated target gear ratio of ${resolvedRatio.toFixed(2)}:1 from input speed (${gearboxInput.input_rpm} RPM) and output speed (${gearboxInput.output_rpm?.toFixed(1)} RPM).`;
  }

  // 4. Fallback ratio cross-resolution using RatioEngine
  if (resolvedRatio === null && resolvedInputRPM !== null && resolvedOutputRPM !== null && resolvedOutputRPM > 0) {
    resolvedRatio = RatioEngine.calculateRatio(resolvedInputRPM, resolvedOutputRPM);
    ratioType = 'CALCULATED';
    ratioSource = 'RatioEngine.calculateRatio';
    ratioFormula = 'Ratio = N_in / N_out';
    ratioSteps = `Ratio = ${resolvedInputRPM} / ${resolvedOutputRPM.toFixed(1)} = ${resolvedRatio.toFixed(2)}`;
    ratioReasoning = `Calculated total gear ratio of ${resolvedRatio.toFixed(2)}:1 from input speed (${resolvedInputRPM} RPM) and target output speed (${resolvedOutputRPM.toFixed(1)} RPM).`;
  }

  if (resolvedOutputRPM === null && resolvedInputRPM !== null && resolvedRatio !== null && resolvedRatio > 0) {
    resolvedOutputRPM = RatioEngine.outputRPM(resolvedInputRPM, resolvedRatio);
    outputRPMType = 'CALCULATED';
    outputRPMSource = 'RatioEngine.outputRPM';
    outputRPMFormula = 'N_out = N_in / Ratio';
    outputRPMSteps = `N_out = ${resolvedInputRPM} / ${resolvedRatio.toFixed(2)} = ${resolvedOutputRPM.toFixed(1)}`;
    outputRPMReasoning = `Calculated target output speed of ${resolvedOutputRPM.toFixed(1)} RPM from input speed (${resolvedInputRPM} RPM) and gear ratio (${resolvedRatio.toFixed(2)}:1).`;
  }

  if (resolvedInputRPM === null && resolvedOutputRPM !== null && resolvedRatio !== null && resolvedRatio > 0) {
    resolvedInputRPM = RatioEngine.inputRPM(resolvedOutputRPM, resolvedRatio);
    inputRPMType = 'CALCULATED';
    inputRPMSource = 'RatioEngine.inputRPM';
    inputRPMFormula = 'N_in = N_out * Ratio';
    inputRPMSteps = `N_in = ${resolvedOutputRPM.toFixed(1)} * ${resolvedRatio.toFixed(2)} = ${resolvedInputRPM.toFixed(1)}`;
    inputRPMReasoning = `Calculated required input speed of ${resolvedInputRPM.toFixed(1)} RPM from target output speed (${resolvedOutputRPM.toFixed(1)} RPM) and gear ratio (${resolvedRatio.toFixed(2)}:1).`;
  }

  // 7. SERVICE FACTOR
  let resolvedSF: number | null = null;
  let sfType: ParameterType = 'EXTRACTED';
  let sfSource = 'Customer Requirement Document';
  let sfFormula = 'N/A';
  let sfSteps = '';
  let sfReasoning = '';

  let startsPerHour = 4;
  const startsMatch = rawText.match(/(\d+)\s*(?:starts|start-ups)\s*(?:per\s*hour|\/hr)/i);
  if (startsMatch) {
    startsPerHour = parseInt(startsMatch[1], 10);
  }

  const sfTargetVal = localExtracted.service_factor !== undefined ? localExtracted.service_factor : (extracted.serviceFactor !== null && extracted.serviceFactor !== undefined ? extracted.serviceFactor : null);
  const sfCondition = localExtracted.service_factor_condition !== undefined ? localExtracted.service_factor_condition : (extracted.serviceFactorCondition || null);

  if (sfTargetVal !== null && sfCondition) {
    let baseSF = 1.5;
    let baseSFFormula = 'N/A';
    let baseSFSteps = '';

    if (resolved.serviceFactor !== undefined && resolved.serviceFactor !== null) {
      baseSF = resolved.serviceFactor;
      const trace = derivationResult.traces.find(t => t.outputProduced.startsWith('serviceFactor'));
      if (trace) {
        baseSFFormula = trace.formulaUsed;
        baseSFSteps = trace.outputProduced;
      }
    } else {
      baseSF = ServiceFactorEngine.calculate(
        applicationType,
        dutyHours,
        startsPerHour,
        localExtracted.temperature_c !== undefined ? `temp-${localExtracted.temperature_c}` : undefined
      );
      baseSFFormula = `ServiceFactorEngine.calculate(${applicationType}, ${dutyHours} hrs, ${startsPerHour} starts)`;
      baseSFSteps = `Calculated SF = ${baseSF}`;
    }

    resolvedSF = baseSF;
    sfType = 'CALCULATED';
    sfSource = 'Service Factor Condition Resolver';

    if (sfCondition === 'greater than' || sfCondition === 'minimum') {
      if (baseSF < sfTargetVal) {
        resolvedSF = sfTargetVal;
        sfFormula = `SF = max(Calculated SF ${baseSF}, Minimum Target ${sfTargetVal})`;
        sfSteps = `max(${baseSF}, ${sfTargetVal}) = ${resolvedSF}`;
        sfReasoning = `Standard calculated service factor of ${baseSF} was increased to ${resolvedSF} to satisfy the '${sfCondition} ${sfTargetVal}' condition specified in requirements.`;
      } else {
        sfFormula = `SF = max(Calculated SF ${baseSF}, Minimum Target ${sfTargetVal})`;
        sfSteps = `max(${baseSF}, ${sfTargetVal}) = ${resolvedSF}`;
        sfReasoning = `Standard calculated service factor of ${baseSF} was kept because it already satisfies the '${sfCondition} ${sfTargetVal}' condition.`;
      }
    } else if (sfCondition === 'less than' || sfCondition === 'maximum') {
      if (baseSF > sfTargetVal) {
        resolvedSF = sfTargetVal;
        sfFormula = `SF = min(Calculated SF ${baseSF}, Maximum Target ${sfTargetVal})`;
        sfSteps = `min(${baseSF}, ${sfTargetVal}) = ${resolvedSF}`;
        sfReasoning = `Standard calculated service factor of ${baseSF} was capped to ${resolvedSF} to satisfy the '${sfCondition} ${sfTargetVal}' condition specified in requirements.`;
      } else {
        sfFormula = `SF = min(Calculated SF ${baseSF}, Maximum Target ${sfTargetVal})`;
        sfSteps = `min(${baseSF}, ${sfTargetVal}) = ${resolvedSF}`;
        sfReasoning = `Standard calculated service factor of ${baseSF} was kept because it already satisfies the '${sfCondition} ${sfTargetVal}' condition.`;
      }
    } else if (sfCondition === 'equal to') {
      resolvedSF = sfTargetVal;
      sfFormula = `SF = ${sfTargetVal}`;
      sfSteps = `SF = ${resolvedSF}`;
      sfReasoning = `Service factor set to ${resolvedSF} to satisfy the 'equal to ${sfTargetVal}' condition specified in requirements.`;
    }
  } else if (resolved.serviceFactor !== undefined && resolved.serviceFactor !== null) {
    resolvedSF = resolved.serviceFactor;
    sfReasoning = `Resolved service factor of ${resolvedSF}.`;
    const trace = derivationResult.traces.find(t => t.outputProduced.startsWith('serviceFactor'));
    if (trace) {
      sfType = 'ENGINE_RULE';
      sfSource = trace.ruleName;
      sfFormula = trace.formulaUsed;
      sfSteps = trace.outputProduced;
    }
  } else if (extracted.serviceFactor !== null && extracted.serviceFactor !== undefined && extracted.serviceFactor > 0) {
    resolvedSF = extracted.serviceFactor;
    sfReasoning = `Directly extracted explicit service factor safety coefficient of ${resolvedSF}.`;
  } else {
    resolvedSF = ServiceFactorEngine.calculate(
      applicationType,
      dutyHours,
      startsPerHour,
      localExtracted.temperature_c !== undefined ? `temp-${localExtracted.temperature_c}` : undefined
    );
    sfType = 'SUGGESTED';
    sfSource = 'MAGTORQ Service Factor Engine';
    sfFormula = `ServiceFactorEngine.calculate(${applicationType}, ${dutyHours} hrs, ${startsPerHour} starts)`;
    sfSteps = `Resulting SF = ${resolvedSF}`;
    sfReasoning = `Calculated Service Factor of ${resolvedSF} based on application type (${applicationType}), duty cycle (${dutyHours} hours/day), and frequency of starts (${startsPerHour}/hour).`;
    assumptions.push({ parameter: 'Service Factor', assumption: `${resolvedSF}`, reason: `Suggested based on detected application type (${applicationType}).` });
  }

  // 8. STAGE COUNT
  let resolvedStages: number | null = null;
  let stagesType: ParameterType = 'EXTRACTED';
  let stagesSource = 'Customer Requirement Document';
  let stagesFormula = 'N/A';
  let stagesSteps = '';
  let stagesReasoning = '';

  if (resolved.stages !== undefined && resolved.stages !== null) {
    resolvedStages = resolved.stages;
    stagesReasoning = `Resolved stage count of ${resolvedStages} stages.`;
    const trace = derivationResult.traces.find(t => t.outputProduced.startsWith('stages'));
    if (trace) {
      stagesType = 'ENGINE_RULE';
      stagesSource = trace.ruleName;
      stagesFormula = trace.formulaUsed;
      stagesSteps = trace.outputProduced;
    }
  } else if (extracted.numberOfStages !== null && extracted.numberOfStages !== undefined && extracted.numberOfStages > 0) {
    resolvedStages = extracted.numberOfStages;
    stagesReasoning = `Customer requested ${resolvedStages} stages.`;
  }

  // Setup Stage Evaluation Bounds
  const R_req = resolvedRatio || 1.0;
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

  let minStages = 1;
  for (const item of stageEvaluationDetails) {
    if (R_req <= item.maxRatio) {
      minStages = item.stages;
      break;
    }
  }

  if (resolvedStages === null) {
    resolvedStages = minStages;
    stagesType = 'CALCULATED';
    stagesSource = 'Stage Evaluation Engine';
    stagesFormula = 'Minimum Stage Count = first(stages where Ratio <= MaxRatio)';
    stagesSteps = `Required Ratio = ${R_req.toFixed(2)} → Recommended Stages = ${resolvedStages}`;
    stagesReasoning = `Calculated required stage count of ${resolvedStages} stages based on target gear ratio (${R_req.toFixed(2)}:1) limits.`;
  }


  const stageEvaluationTrace = {
    targetRatio: R_req,
    details: stageEvaluationDetails,
    minimumStagesRequired: minStages,
    recommendedStages: resolvedStages,
    reasoning: stagesReasoning
  };

  // Build parameter nodes
  const powerNode: AuditParameterNode<number> = {
    name: 'Power (kW)',
    value: resolvedPower!,
    type: powerType,
    source: powerSource,
    formula: powerFormula,
    calculationSteps: powerSteps || `${resolvedPower} kW`,
    confidence: resolvedPower !== null ? 'High' : 'Low',
    reasoning: powerReasoning || 'Power rating could not be resolved.'
  };

  const motorHPNode: AuditParameterNode<number | null> = {
    name: 'Motor HP',
    value: extHP || (resolvedPower ? parseFloat((resolvedPower / 0.7457).toFixed(1)) : null),
    type: extHP ? 'EXTRACTED' : 'CALCULATED',
    source: extHP ? 'Customer Requirement Document' : 'Derived from Power (kW)',
    formula: extHP ? 'N/A' : 'HP = Power (kW) / 0.7457',
    calculationSteps: extHP ? `${extHP} HP` : `HP = ${resolvedPower} / 0.7457`,
    confidence: resolvedPower ? 'High' : 'Low',
    reasoning: extHP ? 'Directly extracted HP rating.' : 'Derived HP capacity from verified kW parameter.'
  };

  const motorPolesNode: AuditParameterNode<number | null> = {
    name: 'Motor Pole Count',
    value: extPoles || null,
    type: extPoles ? 'EXTRACTED' : 'ASSUMED',
    source: extPoles ? 'Customer Requirement Document' : 'N/A',
    formula: 'N/A',
    calculationSteps: extPoles ? `${extPoles} Poles` : 'N/A',
    confidence: extPoles ? 'High' : 'Low',
    reasoning: extPoles ? `Found explicit poles mention: ${extPoles} poles.` : 'No pole count specified.'
  };

  const inputRPMNode: AuditParameterNode<number> = {
    name: 'Input Speed (RPM)',
    value: resolvedInputRPM!,
    type: inputRPMType,
    source: inputRPMSource,
    formula: inputRPMFormula,
    calculationSteps: inputRPMSteps || `${resolvedInputRPM} RPM`,
    confidence: resolvedInputRPM !== null ? 'High' : 'Low',
    reasoning: inputRPMReasoning || 'Input speed could not be resolved.'
  };

  const outputRPMNode: AuditParameterNode<number> = {
    name: 'Output Speed (RPM)',
    value: resolvedOutputRPM!,
    type: outputRPMType,
    source: outputRPMSource,
    formula: outputRPMFormula,
    calculationSteps: outputRPMSteps || `${resolvedOutputRPM} RPM`,
    confidence: resolvedOutputRPM !== null ? 'High' : 'Low',
    reasoning: outputRPMReasoning || 'Output speed could not be resolved.'
  };

  const ratioNode: AuditParameterNode<number> = {
    name: 'Total Gear Ratio',
    value: resolvedRatio!,
    type: ratioType,
    source: ratioSource,
    formula: ratioFormula,
    calculationSteps: ratioSteps || `${resolvedRatio}:1`,
    confidence: resolvedRatio !== null ? 'High' : 'Low',
    reasoning: resolvedRatio !== null ? ratioReasoning || 'Total gear ratio resolved.' : 'Total gear ratio could not be resolved.'
  };

  const stagesNode: AuditParameterNode<number> = {
    name: 'Stages',
    value: resolvedStages!,
    type: stagesType,
    source: stagesSource,
    formula: stagesFormula,
    calculationSteps: stagesSteps || `${resolvedStages}`,
    confidence: resolvedStages !== null ? 'High' : 'Low',
    reasoning: stagesReasoning || 'Gearbox stages could not be resolved.'
  };

  const serviceFactorNode: AuditParameterNode<number> = {
    name: 'Service Factor',
    value: resolvedSF!,
    type: sfType,
    source: sfSource,
    formula: sfFormula,
    calculationSteps: sfSteps || `${resolvedSF}`,
    confidence: resolvedSF !== null ? 'High' : 'Low',
    reasoning: sfReasoning || 'Service factor could not be resolved.'
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

  const hasAllCriticalInputs =
    powerNode.value !== null && powerNode.value !== undefined && !isNaN(powerNode.value) &&
    inputRPMNode.value !== null && inputRPMNode.value !== undefined && !isNaN(inputRPMNode.value) &&
    ratioNode.value !== null && ratioNode.value !== undefined && !isNaN(ratioNode.value) &&
    stagesNode.value !== null && stagesNode.value !== undefined && !isNaN(stagesNode.value) &&
    serviceFactorNode.value !== null && serviceFactorNode.value !== undefined && !isNaN(serviceFactorNode.value);

  if (validation.isValid && hasAllCriticalInputs) {
    const P = powerNode.value;
    const Nin = inputRPMNode.value;

    // Calculate Input Torque: Tin = (P * 60000) / (2 * pi * Nin)
    const Tin = PowerTorqueEngine.calcTorque(P, Nin);
    inputTorqueTrace = {
      formula: 'Tin = (Power × 60000) / (2 × π × InputRPM)',
      calculationSteps: `Tin = (${P} × 60000) / (2 × π × ${Nin}) = ${Tin.toFixed(2)} N·m`,
      result: Tin
    };

    // Distribute ratios
    const { ratios, series } = distributeRatios(R_req, stagesNode.value);
    overallEfficiency = TorquePropagationEngine.overallEfficiency(stagesNode.value);

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
      const safetyVal = SafetyFactorEngine.calculate(gb.nominal, gb.rated, torqueAfter, maxTorqueAfter);

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
  const isSafe = stageTraces.length > 0 && stageTraces.every(d => d.safetyFactor >= 1.0);

  let recommendationText = `Based on the provided specification sheet, MAGTORQ's Engineering Reasoning Engine has completed a full structural analysis of the drive requirements. \n\n`;

  if (hasAllCriticalInputs) {
    recommendationText += `We recommend a **${stagesNode.value}-stage reduction gearbox configuration** utilizing the **${stagesNode.value === 1 ? 'S1' : stagesNode.value === 2 ? 'S1 × S2' : stagesNode.value === 3 ? 'S1 × S2 × S3' : 'S1 × S2 × S3 × S4'}** series sequence. `;

    if (lastGb) {
      recommendationText += `The final stage is resolved to a **MAGTORQ ${lastGb.size}** model, which satisfies the output nominal torque demands of **${Math.round(overallOutputTorque).toLocaleString()} N·m** and peak loads of **${Math.round(overallMaxTorque).toLocaleString()} N·m** under a service factor of **${serviceFactorNode.value}**. \n\n`;
    }

    recommendationText += `**Calculated Ratios Breakdown:** ${stageTraces.map(t => t.ratio).join(' × ')} yielding a total reduction ratio of **${R_req.toFixed(2)}:1** (Output Speed: **${outputRPMNode.value.toFixed(1)} RPM**).
**Efficiency Analysis:** Overall mechanical efficiency is calculated at **${(overallEfficiency * 100).toFixed(1)}%** (assuming a standard transmission loss of 3% per planetary reduction stage).
**Drivetrain Status:** ${isSafe ? '⚡ Safe & Compliant. All reduction stages operate within the nominal and peak rated capacity margins.' : '⚠ Warning: Overload detected on intermediate stages. We suggest selecting a higher frame size or adjusting service factor settings.'}`;
  } else {
    recommendationText += `**Drivetrain Status:** Additional design parameters must be entered to resolve the calculations.`;
  }

  const createDerivationNodeOptional = <T>(
    paramName: string,
    displayName: string,
    unit: string
  ): AuditParameterNode<T | null> | undefined => {
    const trace = derivationResult.traces.find(t => t.outputProduced.startsWith(paramName));
    if (trace) {
      const rule = derivationRules.find(r => r.id === trace.ruleId);
      return {
        name: displayName,
        value: trace.value as T,
        type: 'ENGINE_RULE',
        source: trace.ruleName,
        formula: trace.formulaUsed,
        calculationSteps: trace.outputProduced,
        confidence: trace.confidence === 'HIGH' ? 'High' : trace.confidence === 'MEDIUM' ? 'Medium' : 'Low',
        reasoning: (rule ? rule.auditDescription : 'Resolved via engineering derivation rules.') + (unit ? ` (Unit: ${unit})` : '')
      };
    }
    return undefined;
  };

  const outputTorqueNmNode = createDerivationNodeOptional<number>('outputTorqueNm', 'Output Torque', 'N·m');
  const rmsTorqueNmNode = createDerivationNodeOptional<number>('rmsTorqueNm', 'RMS Torque', 'N·m');
  const accelerationTorqueNmNode = createDerivationNodeOptional<number>('accelerationTorqueNm', 'Acceleration Torque', 'N·m');
  const effectiveThermalPowerKWNode = createDerivationNodeOptional<number>('effectiveThermalPowerKW', 'Effective Thermal Power', 'kW');
  const requiredLifeHoursNode = createDerivationNodeOptional<number>('requiredLifeHours', 'Required Life Hours', 'hrs');

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
    assumptions,
    outputTorqueNm: outputTorqueNmNode,
    rmsTorqueNm: rmsTorqueNmNode,
    accelerationTorqueNm: accelerationTorqueNmNode,
    effectiveThermalPowerKW: effectiveThermalPowerKWNode,
    requiredLifeHours: requiredLifeHoursNode,
    derivationTraces: derivationResult.traces,
    derivationSkips: derivationResult.skips,
    applicationKnowledge: {
      detectedApplication: knowledgeAnalysis.config.displayName,
      missingRequiredParams: knowledgeAnalysis.missingRequiredParams,
      missingOptionalParams: knowledgeAnalysis.missingOptionalParams,
      blockingMissingParams: knowledgeAnalysis.blockingMissingParams,
      clarificationQuestions: knowledgeAnalysis.clarificationQuestions,
      isBlocked: knowledgeAnalysis.isBlocked
    },
    extractedEngineeringParams: parserResult.nodes as Record<string, AuditParameterNode<any>>
  };
}
