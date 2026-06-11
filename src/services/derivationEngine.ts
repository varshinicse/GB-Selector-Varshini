/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MAGTORQ GB-Selector
 * Phase 1 Engineering Derivation Framework
 * Resolves missing parameter inputs from deterministic formulas.
 */

export interface DerivationRule {
  id: string;
  name: string;
  category: string;
  requiredInputs: string[];
  outputParameter: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  autoCalculate: boolean;
  formula: (inputs: Record<string, any>) => any;
  auditDescription: string;
  formulaString: string;
}

export interface DerivedTrace {
  ruleId: string;
  ruleName: string;
  inputsUsed: Record<string, any>;
  formulaUsed: string;
  outputProduced: string;
  value: any;
  timestamp: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SkipTrace {
  ruleId: string;
  ruleName: string;
  reason: string;
  valueIgnored: any;
}

export interface DerivationSessionReport {
  derivedParameters: Record<string, any>;
  traces: DerivedTrace[];
  skips: SkipTrace[];
}

// Helper: safe float parsing
function parseFloatsList(str: string): number[] {
  return str.split(/[\s,]+/).map(s => parseFloat(s)).filter(n => !isNaN(n));
}

// ─── Regex Parser from Raw Text ──────────────────────────────────────────────
export interface ExtractedParamMetadata {
  name: string;
  value: any;
  type: 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED' | 'ENGINE_RULE';
  source: string;
  formula: string;
  calculationSteps: string;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
  detectedText?: string;
}

export interface ParserResult {
  values: Record<string, any>;
  nodes: Record<string, ExtractedParamMetadata>;
}

export function parseInputsWithMetadata(text: string): ParserResult {
  const values: Record<string, any> = {};
  const nodes: Record<string, ExtractedParamMetadata> = {};

  const matchValue = (
    regexes: RegExp[],
    modifier?: (v: number, match: RegExpMatchArray) => number,
    fieldName: string = 'unknown',
    displayName: string = 'Parameter'
  ) => {
    for (const regex of regexes) {
      const match = text.match(regex);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) {
          const finalVal = modifier ? modifier(val, match) : val;
          
          // Debug Logging showing: Raw Text -> Extracted Entity -> Normalized Parameter -> Final Internal Field
          console.log(`[EXTRACTION DEBUG]
  Raw Text Segment: "${match[0].trim()}"
  Extracted Entity: "${match[1]}" (Unit: "${match[2] || 'none'}")
  Normalized Parameter: "${val}"
  Final Internal Field: "${fieldName}: ${finalVal}"`);

          values[fieldName] = finalVal;
          nodes[fieldName] = {
            name: displayName,
            value: finalVal,
            type: 'EXTRACTED',
            source: 'Customer RFQ Description',
            formula: 'N/A',
            calculationSteps: `Extracted from text: "${match[0].trim()}"`,
            confidence: 'High',
            reasoning: `Extracted value ${finalVal} directly from text matching pattern.`,
            detectedText: match[0].trim()
          };
          return finalVal;
        }
      }
    }
    return null;
  };

  // Convert mm to meters if the value is large (e.g. > 10)
  const diameterModifier = (v: number, match: RegExpMatchArray) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'mm') return v / 1000;
    if (unit === 'm') return v;
    return v > 10 ? v / 1000 : v;
  };

  // 1. Conveyor & General Speed Inputs
  matchValue([
    /(?:belt\s+speed|beltSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min)\s+(?:belt)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('min')) return v / 60;
    return v;
  }, 'beltSpeed_m_s', 'Belt Speed');

  matchValue([
    /(?:pulley\s+diameter|pulleyDia|pulleyDiameter|pulley\s+dia)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i,
    /(\d+\.?\d*)\s*(mm|m)\s+(?:pulley\s+diameter|pulley)/i
  ], diameterModifier, 'pulleyDiameter_m', 'Pulley Diameter');

  // 2. Chain Conveyor Speed Inputs
  matchValue([
    /(?:chain\s+speed|chainSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min)\s+(?:chain)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('min')) return v / 60;
    return v;
  }, 'chainSpeed_m_s', 'Chain Speed');

  matchValue([
    /(?:sprocket\s+PCD|sprocketPcd|sprocketDiameter|sprocket\s+dia)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i,
    /(\d+\.?\d*)\s*(mm|m)\s+(?:sprocket)/i
  ], diameterModifier, 'sprocketPCD_m', 'Sprocket PCD');

  // 3. Bucket Elevator Speed Inputs
  matchValue([
    /(?:bucket\s+speed|bucketSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min)\s+(?:bucket)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('min')) return v / 60;
    return v;
  }, 'bucketSpeed_m_s', 'Bucket Speed');

  matchValue([
    /(?:head\s+pulley\s+diameter|headPulleyDia|headPulleyDiameter)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i,
    /(\d+\.?\d*)\s*(mm|m)\s+(?:head\s+pulley)/i
  ], diameterModifier, 'headPulleyDiameter_m', 'Head Pulley Diameter');

  // 4. Hoist & Winch Inputs
  matchValue([
    /(?:hoist\s+speed|lifting\s+speed|liftingSpeed|hoistSpeed|lift\s+speed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min|meters\/min|meters\/minute)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min|meters\/min|meters\/minute)\s+(?:hoist|lift|lifting)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('min')) {
      return v / 60;
    }
    return v;
  }, 'hoistSpeed_m_s', 'Lifting Speed');

  matchValue([
    /(?:drum\s+diameter|drumDiameter|drum\s+dia)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i,
    /(\d+\.?\d*)\s*(mm|m)\s+(?:drum)/i
  ], diameterModifier, 'drumDiameter_m', 'Drum Diameter');

  const reevingVal = matchValue([
    /(?:reeving\s+falls|reeving|rope\s+falls|falls)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+)/i
  ], undefined, 'reevingFalls', 'Reeving Falls');
  if (reevingVal === null) {
    values.reevingFalls = 1;
    nodes.reevingFalls = {
      name: 'Reeving Falls',
      value: 1,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed default single fall reeving',
      confidence: 'Medium',
      reasoning: 'Default single fall (1) reeving assumed for hoisting drivetrain.'
    };
  }

  // Loads / Forces
  matchValue([
    /(?:belt\s+pull|effective\s+(?:pull\s+)?tension|pull\s+tension|beltPull|F_eff|pull)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    return v;
  }, 'beltPull_N', 'Belt Pull Force');

  matchValue([
    /(?:hoist\s+load|lifting\s+load|load\s+to\s+be\s+lifted|hoistLoad|F_load|load|weight)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N|kg|t|tons|ton|tonnes)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    if (unit === 'ton' || unit === 'tonne' || unit === 't' || unit === 'tons' || unit === 'tonnes') return v * 9806.65;
    if (unit === 'kg') return v * 9.80665;
    return v;
  }, 'hoistLoad_N', 'Hoist Load Force');

  matchValue([
    /(?:line\s+pull|linePull|tension|F_line)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    return v;
  }, 'linePull_N', 'Line Pull Force');

  // 5. Fan & Pump Inputs
  matchValue([
    /(?:airflow|air\s+flow|flow\s+rate|flow)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m3\/s|m³\/s|cfm)?/i
  ], undefined, 'airflow_m3_s', 'Airflow Rate');

  matchValue([
    /(?:static\s+pressure|staticPressure|pressure|ΔP_static)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(Pa|pa)?/i
  ], undefined, 'staticPressure_Pa', 'Static Pressure');

  const fanEff = matchValue([
    /(?:fan\s+efficiency|fanEfficiency|efficiency|η_fan)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'fanEfficiency', 'Fan Efficiency');
  if (fanEff === null) {
    values.fanEfficiency = 0.70;
    nodes.fanEfficiency = {
      name: 'Fan Efficiency',
      value: 0.70,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed standard fan efficiency',
      confidence: 'Medium',
      reasoning: 'Standard default 70% efficiency assumed for airflow calculations.'
    };
  }

  matchValue([
    /(?:flow\s+rate|liquid\s+flow|flow|Q)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m3\/s|m³\/s)?/i
  ], undefined, 'flowRate_m3_s', 'Pump Flow Rate');

  matchValue([
    /(?:pump\s+head|pumpHead|head|H)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:m|meters)?/i
  ], undefined, 'pumpHead_m', 'Pump Head');

  const pumpEff = matchValue([
    /(?:pump\s+efficiency|pumpEfficiency|η_pump)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'pumpEfficiency', 'Pump Efficiency');
  if (pumpEff === null) {
    values.pumpEfficiency = 0.75;
    nodes.pumpEfficiency = {
      name: 'Pump Efficiency',
      value: 0.75,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed standard pump efficiency',
      confidence: 'Medium',
      reasoning: 'Standard default 75% efficiency assumed for hydraulic calculations.'
    };
  }

  const density = matchValue([
    /(?:liquid\s+density|density|ρ)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:kg\/m3|kg\/m³)?/i
  ], undefined, 'liquidDensity_kg_m3', 'Liquid Density');
  if (density === null) {
    values.liquidDensity_kg_m3 = 1000;
    nodes.liquidDensity_kg_m3 = {
      name: 'Liquid Density',
      value: 1000,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed water density 1000 kg/m³',
      confidence: 'Medium',
      reasoning: 'Standard default 1000 kg/m³ water density assumed for fluid pumping.'
    };
  }

  // 6. Acceleration & RMS
  matchValue([
    /(?:system\s+inertia|inertia|J_total|J)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:kg\s*m2|kg\s*m²|kgm2)?/i
  ], undefined, 'systemInertia_kg_m2', 'System Inertia');

  matchValue([
    /(?:delta\s+speed|speed\s+change|ΔN)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:RPM|rpm)?/i
  ], undefined, 'deltaSpeed_RPM', 'Delta Speed');

  matchValue([
    /(?:acceleration\s+time|accel\s+time|t_accel|time)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:s|sec|seconds)?/i
  ], undefined, 'accelTime_s', 'Acceleration Time');

  // Load arrays for RMS
  const torquesMatch = text.match(/(?:loadTorques|torques)\s*(?:is|of|was)?\s*[:\s=]*\s*\[([\d\s,.]+)\]/i);
  if (torquesMatch) {
    values.loadTorques_Nm = parseFloatsList(torquesMatch[1]);
    nodes.loadTorques_Nm = {
      name: 'Load Torques Profile',
      value: values.loadTorques_Nm,
      type: 'EXTRACTED',
      source: 'Customer RFQ Description',
      formula: 'N/A',
      calculationSteps: `Extracted torques profile: [${values.loadTorques_Nm.join(', ')}]`,
      confidence: 'High',
      reasoning: 'Extracted variable load step profile for RMS torque check.'
    };
  }
  const durationsMatch = text.match(/(?:loadDurations|durations)\s*(?:is|of|was)?\s*[:\s=]*\s*\[([\d\s,.]+)\]/i);
  if (durationsMatch) {
    values.loadDurations_s = parseFloatsList(durationsMatch[1]);
    nodes.loadDurations_s = {
      name: 'Load Durations Profile',
      value: values.loadDurations_s,
      type: 'EXTRACTED',
      source: 'Customer RFQ Description',
      formula: 'N/A',
      calculationSteps: `Extracted durations profile: [${values.loadDurations_s.join(', ')}]`,
      confidence: 'High',
      reasoning: 'Extracted step duration profile for RMS torque check.'
    };
  }

  // 7. Generic Motion & Thermal / Life
  matchValue([
    /(?:linear\s+speed|linearSpeed|velocity|travelSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:m\/s)?/i
  ], undefined, 'linearSpeed_m_s', 'Linear Speed');

  matchValue([
    /(?:effective\s+diameter|effectiveDiameter|D_effective)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i
  ], diameterModifier, 'effectiveDiameter_m', 'Effective Diameter');

  matchValue([
    /(?:design\s+power|designPower|P_design)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:kW|kw)?/i
  ], undefined, 'designPower_kW', 'Design Power');

  matchValue([
    /(?:on\s+time|onTime|t_on)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:min|minutes)?/i
  ], undefined, 'onTime_min', 'On-Time');

  matchValue([
    /(?:off\s+time|offTime|t_off)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:min|minutes)?/i
  ], undefined, 'offTime_min', 'Off-Time');

  matchValue([
    /(?:service\s+years|serviceYears|lifespan|years|Y)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'serviceYears', 'Service Years');

  matchValue([
    /(?:hours\s+per\s+day|hours\/day|operatingHours|H_per_day)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'hoursPerDay', 'Hours per Day');

  const avail = matchValue([
    /(?:availability\s+factor|availability|U_availability)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'availabilityFactor', 'Availability Factor');
  if (avail === null) {
    values.availabilityFactor = 1.0;
    nodes.availabilityFactor = {
      name: 'Availability Factor',
      value: 1.0,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed standard availability coefficient',
      confidence: 'Medium',
      reasoning: 'Standard 100% duty availability assumed for service life calculations.'
    };
  }

  matchValue([
    /(?:input\s+power|inputPower|power|P_in)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:kW|kw)?/i
  ], undefined, 'inputPower_kW', 'Input Power');

  const eff = matchValue([
    /(?:efficiency|gearboxEfficiency|η)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'efficiency', 'Gearbox Efficiency');
  if (eff === null) {
    values.efficiency = 0.97;
    nodes.efficiency = {
      name: 'Gearbox Efficiency',
      value: 0.97,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed 97% stage efficiency',
      confidence: 'Medium',
      reasoning: 'Standard default 97% planetary stage efficiency assumed.'
    };
  }

  return { values, nodes };
}

export function parseInputsFromText(text: string): Record<string, any> {
  return parseInputsWithMetadata(text).values;
}

// ─── Rule Implementations ───────────────────────────────────────────────────
export const derivationRules: DerivationRule[] = [
  {
    id: 'DR-001',
    name: 'Conveyor Belt Speed to Output RPM',
    category: 'Speed',
    requiredInputs: ['beltSpeed_m_s', 'pulleyDiameter_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = (v_belt × 60) / (π × D_pulley)',
    auditDescription: 'Derives the target output speed of a conveyor pulley from the required linear belt speed and pulley diameter.',
    formula: (inputs) => {
      const { beltSpeed_m_s, pulleyDiameter_m } = inputs;
      if (pulleyDiameter_m <= 0) return null;
      return (beltSpeed_m_s * 60) / (Math.PI * pulleyDiameter_m);
    }
  },
  {
    id: 'DR-002',
    name: 'Chain Conveyor Speed to Output RPM',
    category: 'Speed',
    requiredInputs: ['chainSpeed_m_s', 'sprocketPCD_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = (v_chain × 60) / (π × D_sprocket_PCD)',
    auditDescription: 'Derives the target output speed of a chain conveyor from the chain speed and sprocket pitch circle diameter.',
    formula: (inputs) => {
      const { chainSpeed_m_s, sprocketPCD_m } = inputs;
      if (sprocketPCD_m <= 0) return null;
      return (chainSpeed_m_s * 60) / (Math.PI * sprocketPCD_m);
    }
  },
  {
    id: 'DR-003',
    name: 'Bucket Elevator Speed to Output RPM',
    category: 'Speed',
    requiredInputs: ['bucketSpeed_m_s', 'headPulleyDiameter_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = (v_bucket × 60) / (π × D_head_pulley)',
    auditDescription: 'Derives target head shaft speed of a bucket elevator from bucket speed and head pulley diameter.',
    formula: (inputs) => {
      const { bucketSpeed_m_s, headPulleyDiameter_m } = inputs;
      if (headPulleyDiameter_m <= 0) return null;
      return (bucketSpeed_m_s * 60) / (Math.PI * headPulleyDiameter_m);
    }
  },
  {
    id: 'DR-004',
    name: 'Hoist Speed to Drum RPM',
    category: 'Speed',
    requiredInputs: ['hoistSpeed_m_s', 'drumDiameter_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_drum = (v_lift × 60) / (π × D_drum)',
    auditDescription: 'Derives hoist drum speed from required lifting velocity and drum diameter.',
    formula: (inputs) => {
      const { hoistSpeed_m_s, drumDiameter_m } = inputs;
      if (drumDiameter_m <= 0) return null;
      return (hoistSpeed_m_s * 60) / (Math.PI * drumDiameter_m);
    }
  },
  {
    id: 'DR-005',
    name: 'Belt Pull to Torque',
    category: 'Torque',
    requiredInputs: ['beltPull_N', 'pulleyDiameter_m'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Tout = (F_eff × D_pulley) / 2',
    auditDescription: 'Calculates the output drive torque of a belt conveyor pulley from effective belt pull tension and pulley diameter.',
    formula: (inputs) => {
      const { beltPull_N, pulleyDiameter_m } = inputs;
      return (beltPull_N * pulleyDiameter_m) / 2;
    }
  },
  {
    id: 'DR-006',
    name: 'Hoist Torque',
    category: 'Torque',
    requiredInputs: ['hoistLoad_N', 'drumDiameter_m', 'reevingFalls'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_drum = (F_load × D_drum) / (2 × n_falls)',
    auditDescription: 'Calculates hoist drum shaft torque from lifting load, drum diameter, and reeving configuration.',
    formula: (inputs) => {
      const { hoistLoad_N, drumDiameter_m, reevingFalls } = inputs;
      if (reevingFalls <= 0) return null;
      return (hoistLoad_N * drumDiameter_m) / (2 * reevingFalls);
    }
  },
  {
    id: 'DR-007',
    name: 'Winch Torque',
    category: 'Torque',
    requiredInputs: ['linePull_N', 'drumDiameter_m'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_drum = F_line × D_drum / 2',
    auditDescription: 'Calculates winch drum output torque from line tension pull and drum diameter.',
    formula: (inputs) => {
      const { linePull_N, drumDiameter_m } = inputs;
      return (linePull_N * drumDiameter_m) / 2;
    }
  },
  {
    id: 'DR-008',
    name: 'Fan Power',
    category: 'Power',
    requiredInputs: ['airflow_m3_s', 'staticPressure_Pa', 'fanEfficiency'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_shaft = (Q_flow × ΔP_static) / (1000 × η_fan)',
    auditDescription: 'Determines fan shaft power requirements from design static pressure rise, flow rate, and fan efficiency.',
    formula: (inputs) => {
      const { airflow_m3_s, staticPressure_Pa, fanEfficiency } = inputs;
      if (fanEfficiency <= 0) return null;
      return (airflow_m3_s * staticPressure_Pa) / (1000 * fanEfficiency);
    }
  },
  {
    id: 'DR-009',
    name: 'Pump Power',
    category: 'Power',
    requiredInputs: ['flowRate_m3_s', 'pumpHead_m', 'pumpEfficiency', 'liquidDensity_kg_m3'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_shaft = (ρ × g × Q × H) / (1000 × η_pump)',
    auditDescription: 'Derives pump shaft power demand from liquid density, flow rate, head capacity, and pump efficiency.',
    formula: (inputs) => {
      const { flowRate_m3_s, pumpHead_m, pumpEfficiency, liquidDensity_kg_m3 } = inputs;
      if (pumpEfficiency <= 0) return null;
      return (liquidDensity_kg_m3 * 9.80665 * flowRate_m3_s * pumpHead_m) / (1000 * pumpEfficiency);
    }
  },
  {
    id: 'DR-010',
    name: 'Acceleration Torque',
    category: 'Torque',
    requiredInputs: ['systemInertia_kg_m2', 'deltaSpeed_RPM', 'accelTime_s'],
    outputParameter: 'accelerationTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_accel = J_total × (ΔN × 2π / 60) / t_accel',
    auditDescription: 'Calculates torque needed to accelerate inertia loads to operational speed within target time window.',
    formula: (inputs) => {
      const { systemInertia_kg_m2, deltaSpeed_RPM, accelTime_s } = inputs;
      if (accelTime_s <= 0) return null;
      const alpha = (deltaSpeed_RPM * 2 * Math.PI) / (60 * accelTime_s);
      return systemInertia_kg_m2 * alpha;
    }
  },
  {
    id: 'DR-011',
    name: 'RMS Torque from Load Steps',
    category: 'Torque',
    requiredInputs: ['loadTorques_Nm', 'loadDurations_s'],
    outputParameter: 'rmsTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_rms = √ ( ∑(T_i² × t_i) / ∑(t_i) )',
    auditDescription: 'Calculates equivalent root-mean-square torque across variable load/time step profile blocks.',
    formula: (inputs) => {
      const { loadTorques_Nm, loadDurations_s } = inputs;
      if (!Array.isArray(loadTorques_Nm) || !Array.isArray(loadDurations_s) || loadTorques_Nm.length === 0 || loadTorques_Nm.length !== loadDurations_s.length) return null;
      let weightedSum = 0;
      let totalTime = 0;
      for (let i = 0; i < loadTorques_Nm.length; i++) {
        weightedSum += loadTorques_Nm[i] * loadTorques_Nm[i] * loadDurations_s[i];
        totalTime += loadDurations_s[i];
      }
      if (totalTime <= 0) return null;
      return Math.sqrt(weightedSum / totalTime);
    }
  },
  {
    id: 'DR-012',
    name: 'Linear Speed to RPM',
    category: 'Speed',
    requiredInputs: ['linearSpeed_m_s', 'effectiveDiameter_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N = v_linear × 60 / (π × D_effective)',
    auditDescription: 'Converts target linear travel velocity to equivalent shaft rotational speed based on drum/pinion diameter.',
    formula: (inputs) => {
      const { linearSpeed_m_s, effectiveDiameter_m } = inputs;
      if (effectiveDiameter_m <= 0) return null;
      return (linearSpeed_m_s * 60) / (Math.PI * effectiveDiameter_m);
    }
  },
  {
    id: 'DR-013',
    name: 'Thermal Duty Cycle Power',
    category: 'Power',
    requiredInputs: ['designPower_kW', 'onTime_min', 'offTime_min'],
    outputParameter: 'effectiveThermalPowerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_thermal_eff = P_design × √ ( t_on / (t_on + t_off) )',
    auditDescription: 'Calculates equivalent continuous thermal power dissipation factor for periodic on/off cycles.',
    formula: (inputs) => {
      const { designPower_kW, onTime_min, offTime_min } = inputs;
      const totalTime = onTime_min + offTime_min;
      if (totalTime <= 0) return null;
      return designPower_kW * Math.sqrt(onTime_min / totalTime);
    }
  },
  {
    id: 'DR-014',
    name: 'Service Life Hours',
    category: 'Duty',
    requiredInputs: ['serviceYears', 'hoursPerDay', 'availabilityFactor'],
    outputParameter: 'requiredLifeHours',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'L_hours = Y_years × 365 × H_per_day × U_availability',
    auditDescription: 'Computes total target operating hours over the specified gearbox service lifespan.',
    formula: (inputs) => {
      const { serviceYears, hoursPerDay, availabilityFactor } = inputs;
      return serviceYears * 365 * hoursPerDay * availabilityFactor;
    }
  },
  {
    id: 'DR-015',
    name: 'Efficiency Corrected Torque',
    category: 'Torque',
    requiredInputs: ['powerKW', 'efficiency', 'outputRPM'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Tout = (Pin × η_gearbox × 9549.3) / N_out',
    auditDescription: 'Calculates mechanical output shaft torque adjusted for losses across planetary stages.',
    formula: (inputs) => {
      const { powerKW, efficiency, outputRPM } = inputs;
      if (outputRPM <= 0) return null;
      return (powerKW * efficiency * 9549.3) / outputRPM;
    }
  },
  {
    id: 'DR-016',
    name: 'Input Speed and Ratio to Output RPM',
    category: 'Speed',
    requiredInputs: ['inputRPM', 'totalRatio'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = N_in / Ratio',
    auditDescription: 'Calculates target output speed from input speed and ratio.',
    formula: (inputs) => {
      const { inputRPM, totalRatio } = inputs;
      if (totalRatio <= 0) return null;
      return inputRPM / totalRatio;
    }
  },
  {
    id: 'DR-017',
    name: 'Input Speed and Output Speed to Ratio',
    category: 'Speed',
    requiredInputs: ['inputRPM', 'outputRPM'],
    outputParameter: 'totalRatio',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Ratio = N_in / N_out',
    auditDescription: 'Calculates overall gear ratio from input speed and output speed.',
    formula: (inputs) => {
      const { inputRPM, outputRPM } = inputs;
      if (outputRPM <= 0) return null;
      return inputRPM / outputRPM;
    }
  },
  {
    id: 'DR-018',
    name: 'Output Speed and Ratio to Input RPM',
    category: 'Speed',
    requiredInputs: ['outputRPM', 'totalRatio'],
    outputParameter: 'inputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_in = N_out × Ratio',
    auditDescription: 'Calculates required input motor speed from output speed and ratio.',
    formula: (inputs) => {
      const { outputRPM, totalRatio } = inputs;
      return outputRPM * totalRatio;
    }
  },
  {
    id: 'DR-019',
    name: 'Motor Pole Count and Frequency to Input Speed',
    category: 'Speed',
    requiredInputs: ['motorPoles', 'frequencyHz'],
    outputParameter: 'inputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_in = (120 × f / Poles) × (1 - Slip)',
    auditDescription: 'Calculates actual input motor speed from pole count and frequency, accounting for average motor slip.',
    formula: (inputs) => {
      const { motorPoles, frequencyHz } = inputs;
      if (motorPoles <= 0) return null;
      const sync = (120 * frequencyHz) / motorPoles;
      return sync * (1 - 0.033);
    }
  },
  {
    id: 'DR-020',
    name: 'Output Torque and Output Speed to Power',
    category: 'Power',
    requiredInputs: ['outputTorqueNm', 'outputRPM', 'efficiency'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_in = (Tout × Nout) / (9549.3 × η)',
    auditDescription: 'Derives required input shaft power from output load torque, speed, and efficiency.',
    formula: (inputs) => {
      const { outputTorqueNm, outputRPM, efficiency } = inputs;
      if (efficiency <= 0 || outputRPM <= 0) return null;
      return (outputTorqueNm * outputRPM) / (9549.3 * efficiency);
    }
  },
  {
    id: 'DR-021',
    name: 'Motor HP to kW',
    category: 'Power',
    requiredInputs: ['motorHP'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_kw = HP × 0.7457',
    auditDescription: 'Converts motor HP rating to kW.',
    formula: (inputs) => {
      return inputs.motorHP * 0.7457;
    }
  },
  {
    id: 'DR-022',
    name: 'Screw Jack Linear Speed to Output RPM',
    category: 'Speed',
    requiredInputs: ['linearSpeed_mm_min', 'screwPitch_mm'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = v_linear / p_screw',
    auditDescription: 'Derives output speed for screw jack from linear travel velocity and screw pitch.',
    formula: (inputs) => {
      const { linearSpeed_mm_min, screwPitch_mm } = inputs;
      if (screwPitch_mm <= 0) return null;
      return linearSpeed_mm_min / screwPitch_mm;
    }
  },
  {
    id: 'DR-023',
    name: 'Stage Selection Rule',
    category: 'Stages',
    requiredInputs: ['totalRatio'],
    outputParameter: 'stages',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Stages = f(Ratio)',
    auditDescription: 'Selects the number of planetary reduction stages based on overall target gear ratio limits.',
    formula: (inputs) => {
      const r = inputs.totalRatio;
      if (r <= 10) return 1;
      if (r <= 80) return 2;
      if (r <= 500) return 3;
      return 4;
    }
  },
  {
    id: 'DR-024',
    name: 'Belt Power',
    category: 'Power',
    requiredInputs: ['beltPull_N', 'beltSpeed_m_s'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_eff × v_belt / 1000',
    auditDescription: 'Calculates design power from belt pull tension and linear travel speed.',
    formula: (inputs) => {
      return (inputs.beltPull_N * inputs.beltSpeed_m_s) / 1000;
    }
  },
  {
    id: 'DR-025',
    name: 'Hoist Load Power',
    category: 'Power',
    requiredInputs: ['hoistLoad_N', 'hoistSpeed_m_s'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_load × v_hoist / 1000',
    auditDescription: 'Calculates design power from hoist load force and linear hoist speed.',
    formula: (inputs) => {
      return (inputs.hoistLoad_N * inputs.hoistSpeed_m_s) / 1000;
    }
  },
  {
    id: 'DR-026',
    name: 'Line Pull Power',
    category: 'Power',
    requiredInputs: ['linePull_N', 'hoistSpeed_m_s'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_line × v_hoist / 1000',
    auditDescription: 'Calculates design power from winch line pull and hoist/winch speed.',
    formula: (inputs) => {
      return (inputs.linePull_N * inputs.hoistSpeed_m_s) / 1000;
    }
  }

];

// ─── backward-chaining resolution solver ────────────────────────────────────
export class MissingParameterResolutionEngine {
  /**
   * Resolves missing parameters from a set of known inputs using backward-chaining.
   * Priority: USER INPUT / HANDBOOK CALCULATION > ENGINE_RULE
   * Values already provided will NOT be overwritten.
   */
  static resolve(
    knownParameters: Record<string, any>,
    userProvidedKeys: Set<string> = new Set()
  ): DerivationSessionReport & { missingInputsForTargets?: Record<string, string[][]> } {
    const derivedParameters = { ...knownParameters };
    const traces: DerivedTrace[] = [];
    const skips: SkipTrace[] = [];
    const missingInputsForTargets: Record<string, string[][]> = {};

    const resolveParameter = (
      param: string,
      visited: Set<string>
    ): { value: any } => {
      // 2. Cycle detection
      if (visited.has(param)) {
        return { value: null };
      }

      const nextVisited = new Set(visited);
      nextVisited.add(param);

      // 3. Find all rules capable of producing this parameter
      const rules = derivationRules.filter((r) => r.outputParameter === param).sort((a, b) => {
        const confMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return confMap[b.confidence] - confMap[a.confidence];
      });


      // 4. If parameter is already resolved, return it (but record skips if inputs are available)
      const isAlreadyResolved =
        derivedParameters[param] !== undefined &&
        derivedParameters[param] !== null &&
        (typeof derivedParameters[param] !== 'number' || !isNaN(derivedParameters[param]));

      if (isAlreadyResolved) {
        for (const rule of rules) {
          const inputsMap: Record<string, any> = {};
          let allInputsAvailable = true;
          for (const input of rule.requiredInputs) {
            const val = derivedParameters[input];
            if (val !== null && val !== undefined && (typeof val !== 'number' || !isNaN(val))) {
              inputsMap[input] = val;
            } else {
              allInputsAvailable = false;
              break;
            }
          }
          if (allInputsAvailable) {
            if (!skips.some((s) => s.ruleId === rule.id)) {
              skips.push({
                ruleId: rule.id,
                ruleName: rule.name,
                reason: 'Output parameter is already defined by user input or handbook calculations.',
                valueIgnored: rule.formula(inputsMap)
              });
            }
          }
        }
        return { value: derivedParameters[param] };
      }

      if (rules.length === 0) {
        return { value: null };
      }

      for (const rule of rules) {
        const inputsMap: Record<string, any> = {};
        let missingForThisRule = false;

        for (const input of rule.requiredInputs) {
          const res = resolveParameter(input, nextVisited);
          if (res.value !== null && res.value !== undefined) {
            inputsMap[input] = res.value;
          } else {
            missingForThisRule = true;
            break;
          }
        }

        if (!missingForThisRule) {
          // Check if output is already resolved by User Input or Handbook Calculation
          const isUserOrHandbook =
            userProvidedKeys.has(rule.outputParameter) ||
            (knownParameters[rule.outputParameter] !== undefined &&
              knownParameters[rule.outputParameter] !== null);

          if (isUserOrHandbook) {
            if (!skips.some((s) => s.ruleId === rule.id)) {
              skips.push({
                ruleId: rule.id,
                ruleName: rule.name,
                reason: 'Output parameter is already defined by user input or handbook calculations.',
                valueIgnored: rule.formula(inputsMap)
              });
            }
            return { value: knownParameters[rule.outputParameter] };
          }

          // Evaluate formula
          try {
            const result = rule.formula(inputsMap);
            if (result !== null && result !== undefined && !isNaN(result)) {
              derivedParameters[param] = result;
              
              if (!traces.some((t) => t.ruleId === rule.id)) {
                traces.push({
                  ruleId: rule.id,
                  ruleName: rule.name,
                  inputsUsed: inputsMap,
                  formulaUsed: rule.formulaString,
                  outputProduced: `${rule.outputParameter} = ${typeof result === 'number' ? result.toFixed(3) : result}`,
                  value: result,
                  timestamp: new Date().toISOString(),
                  confidence: rule.confidence
                });
              }
              return { value: result };
            }
          } catch (err) {
            console.error(`Error resolving rule ${rule.id}:`, err);
          }
        }
      }

      return { value: null };
    };

    const getMissingPaths = (param: string, visited: Set<string>): string[][] => {
      if (visited.has(param)) {
        return [[param]];
      }
      const nextVisited = new Set(visited);
      nextVisited.add(param);

      const isAlreadyResolved =
        derivedParameters[param] !== undefined &&
        derivedParameters[param] !== null &&
        (typeof derivedParameters[param] !== 'number' || !isNaN(derivedParameters[param]));

      if (isAlreadyResolved) {
        return [];
      }

      const allPaths: string[][] = [[param]];

      const rules = derivationRules.filter((r) => r.outputParameter === param);
      for (const rule of rules) {
        let ruleInputPaths: string[][] = [[]];
        for (const input of rule.requiredInputs) {
          const inputPaths = getMissingPaths(input, nextVisited);
          if (inputPaths.length === 0) {
            continue;
          }
          const nextRuleInputPaths: string[][] = [];
          for (const p1 of ruleInputPaths) {
            for (const p2 of inputPaths) {
              nextRuleInputPaths.push([...p1, ...p2]);
            }
          }
          ruleInputPaths = nextRuleInputPaths;
        }
        for (const path of ruleInputPaths) {
          const sortedUnique = Array.from(new Set(path)).sort();
          if (!allPaths.some(p => p.length === sortedUnique.length && p.every((val, idx) => val === sortedUnique[idx]))) {
            allPaths.push(sortedUnique);
          }
        }
      }

      return allPaths;
    };


    // Try resolving all possible target output parameters
    const allTargets = Array.from(new Set(derivationRules.map((r) => r.outputParameter)));
    for (const target of allTargets) {
      resolveParameter(target, new Set());
    }

    // Now calculate the missing paths for each target
    for (const target of allTargets) {
      const paths = getMissingPaths(target, new Set());
      if (paths.length > 0 && paths[0].length > 0) {
        missingInputsForTargets[target] = paths;
      }
    }

    return { derivedParameters, traces, skips, missingInputsForTargets };
  }
}

