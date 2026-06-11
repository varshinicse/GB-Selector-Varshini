/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * COMPLETE ENGINEERING CALCULATION ENGINE
 * PART 1
 *
 * Sections Implemented:
 * - Interfaces
 * - Constants Database
 * - Validation Engine
 * - Power/Torque Conversion
 * - Motor RPM Derivation
 * - Ratio Engine
 * - Stage Count Engine
 *
 ***********************************************************************/

///////////////////////////////
// ENUMS & TYPES
///////////////////////////////

export type LoadType = "uniform" | "variable" | "heavy_shock";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type Recommendation = "PREFERRED" | "ACCEPTABLE" | "MARGINAL" | "REJECT";

export type ValidationSeverity = "ERROR" | "WARNING" | "INFO";

export type DerivationMethod = "provided" | "calculated" | "lookup" | "default";

///////////////////////////////
// INPUT INTERFACE
///////////////////////////////

export interface GearboxInput {
  power_kw?: number;

  power_hp?: number;

  input_rpm?: number;

  output_rpm?: number;

  input_torque_nm?: number;

  output_torque_nm?: number;

  total_ratio?: number;

  service_factor?: number;

  application_type: string;

  load_type: LoadType;

  duty_hours_per_day: number;

  starts_per_hour: number;

  frequency_hz?: 50 | 60;

  motor_poles?: 2 | 4 | 6 | 8 | 10 | 12;

  linear_velocity_mm_min?: number;

  screw_pitch_mm?: number;

  axial_load_kn?: number;

  stroke_mm?: number;
}

///////////////////////////////
// DERIVATION LOG
///////////////////////////////

export interface DerivationEntry {
  parameter: string;

  method: DerivationMethod;

  value: number | string;

  formula?: string;

  confidence: ConfidenceLevel;

  source?: string;
}

///////////////////////////////
// VALIDATION FLAG
///////////////////////////////

export interface ValidationFlag {
  severity: ValidationSeverity;

  parameter: string;

  message: string;

  action: string;
}

///////////////////////////////
// CALCULATION RESULT
///////////////////////////////

export interface CalculationResult {
  input_torque_nm: number;

  output_torque_nm: number;

  total_ratio: number;

  stage_count: number;

  stage_ratios: number[];

  stage_torques: number[];

  stage_speeds: number[];

  service_factor: number;

  required_nominal_nm: number;

  required_maximum_nm: number;

  overall_efficiency: number;

  derivation_log: DerivationEntry[];

  flags: ValidationFlag[];

  confidence: ConfidenceLevel;
}

///////////////////////////////
// GEARBOX CANDIDATE
///////////////////////////////

export interface GearboxCandidate {
  model_id: string;

  nominal_torque: number;

  max_torque: number;

  actual_ratio: number;

  max_input_rpm: number;

  safety_factor: number;

  recommendation: Recommendation;
}

///////////////////////////////
// AUDIT TRAIL
///////////////////////////////

export interface AuditTrail {
  session_id: string;

  timestamp: string;

  input_raw: GearboxInput;

  input_resolved: GearboxInput;

  derivations: DerivationEntry[];

  calculations: CalculationResult;

  candidates: GearboxCandidate[];

  recommendation: GearboxCandidate;

  flags: ValidationFlag[];

  engineer_review_required: boolean;

  confidence_score: number;
}

//////////////////////////////////////////////////////////////////
// ENGINEERING CONSTANTS
//////////////////////////////////////////////////////////////////

export const ENGINEERING_CONSTANTS = {
  PI: Math.PI,

  HP_TO_KW: 0.7457,

  KW_TO_HP: 1 / 0.7457,

  TORQUE_CONSTANT: 9549.3,

  PLANETARY_STAGE_EFFICIENCY: 0.97,

  AVG_MOTOR_SLIP: 0.033,

  DEFAULT_SERVICE_FACTOR: 1.5,

  MAX_SERVICE_FACTOR: 3.0,
};

//////////////////////////////////////////////////////////////////
// STAGE LIMIT DATABASE
//////////////////////////////////////////////////////////////////

export const STAGE_LIMITS = [
  {
    stage: 1,
    min: 3.75,
    max: 10.26,
  },

  {
    stage: 2,
    min: 4.71,
    max: 7.58,
  },

  {
    stage: 3,
    min: 4.76,
    max: 5.06,
  },

  {
    stage: 4,
    min: 4.0,
    max: 4.5,
  },
];

//////////////////////////////////////////////////////////////////
// STAGE MAX RATIOS
//////////////////////////////////////////////////////////////////

export const STAGE_MAX_RATIO = {
  ONE_STAGE: 10.26,

  TWO_STAGE: 77.77,

  THREE_STAGE: 393.52,

  FOUR_STAGE: 1770.84,
};

//////////////////////////////////////////////////////////////////
// VALIDATION LIMITS
//////////////////////////////////////////////////////////////////

export const VALIDATION_LIMITS = {
  POWER_KW: {
    min: 0.1,
    max: 10000,
  },

  INPUT_RPM: {
    min: 100,
    max: 10000,
  },

  OUTPUT_RPM: {
    min: 0.1,
    max: 5000,
  },

  RATIO: {
    min: 1,
    max: 2000,
  },

  TORQUE: {
    min: 1,
    max: 5000000,
  },

  SERVICE_FACTOR: {
    min: 1,
    max: 3,
  },

  PITCH: {
    min: 1,
    max: 100,
  },

  AXIAL_LOAD: {
    min: 0.1,
    max: 10000,
  },
};

//////////////////////////////////////////////////////////////////
// VALIDATION ENGINE
//////////////////////////////////////////////////////////////////

export class ValidationEngine {
  static validateInput(input: GearboxInput): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    if (
      input.power_kw &&
      (input.power_kw < VALIDATION_LIMITS.POWER_KW.min ||
        input.power_kw > VALIDATION_LIMITS.POWER_KW.max)
    ) {
      flags.push({
        severity: "WARNING",
        parameter: "power_kw",
        message: "Power outside valid engineering range",
        action: "Verify units or motor specification",
      });
    }

    if (
      input.input_rpm &&
      (input.input_rpm < VALIDATION_LIMITS.INPUT_RPM.min ||
        input.input_rpm > VALIDATION_LIMITS.INPUT_RPM.max)
    ) {
      flags.push({
        severity: "WARNING",
        parameter: "input_rpm",
        message: "Input RPM outside normal motor range",
        action: "Verify motor speed",
      });
    }

    if (
      input.total_ratio &&
      (input.total_ratio < VALIDATION_LIMITS.RATIO.min ||
        input.total_ratio > VALIDATION_LIMITS.RATIO.max)
    ) {
      flags.push({
        severity: "ERROR",
        parameter: "ratio",
        message: "Ratio outside planetary gearbox range",
        action: "Review gearbox architecture",
      });
    }

    return flags;
  }
}

//////////////////////////////////////////////////////////////////
// POWER / TORQUE ENGINE
//////////////////////////////////////////////////////////////////

export class PowerTorqueEngine {
  ////////////////////////////////////
  // Torque from kW & RPM
  ////////////////////////////////////

  static calcTorque(kw: number, rpm: number): number {
    return (kw * 60000) / (2 * Math.PI * rpm);
  }

  ////////////////////////////////////
  // Power from Torque & RPM
  ////////////////////////////////////

  static calcPower(torqueNm: number, rpm: number): number {
    return (torqueNm * 2 * Math.PI * rpm) / 60000;
  }

  ////////////////////////////////////
  // HP → kW
  ////////////////////////////////////

  static hpToKw(hp: number): number {
    return hp * ENGINEERING_CONSTANTS.HP_TO_KW;
  }

  ////////////////////////////////////
  // kW → HP
  ////////////////////////////////////

  static kwToHp(kw: number): number {
    return kw * ENGINEERING_CONSTANTS.KW_TO_HP;
  }
}

//////////////////////////////////////////////////////////////////
// MOTOR RPM DERIVATION
//////////////////////////////////////////////////////////////////

export class MotorSpeedEngine {
  ////////////////////////////////////
  // Synchronous RPM
  ////////////////////////////////////

  static synchronousSpeed(poles: number, hz: number): number {
    return (120 * hz) / poles;
  }

  ////////////////////////////////////
  // Actual RPM
  ////////////////////////////////////

  static actualSpeed(poles: number, hz: number): number {
    const sync = this.synchronousSpeed(poles, hz);

    return sync * (1 - ENGINEERING_CONSTANTS.AVG_MOTOR_SLIP);
  }

  ////////////////////////////////////
  // AI Derivation Rule
  ////////////////////////////////////

  static deriveRPM(poles?: number, hz?: number): number {
    if (poles && hz) {
      return this.actualSpeed(poles, hz);
    }

    return 1440;
  }
}

//////////////////////////////////////////////////////////////////
// RATIO ENGINE
//////////////////////////////////////////////////////////////////

export class RatioEngine {
  static calculateRatio(inputRPM: number, outputRPM: number): number {
    return inputRPM / outputRPM;
  }

  static outputRPM(inputRPM: number, ratio: number): number {
    return inputRPM / ratio;
  }

  static inputRPM(outputRPM: number, ratio: number): number {
    return outputRPM * ratio;
  }
}

//////////////////////////////////////////////////////////////////
// STAGE COUNT ENGINE
//////////////////////////////////////////////////////////////////

export class StageCountEngine {
  static determineStageCount(ratio: number): number {
    if (ratio <= 10) {
      return 1;
    }

    if (ratio <= 80) {
      return 2;
    }

    if (ratio <= 500) {
      return 3;
    }

    return 4;
  }
}


//////////////////////////////////////////////////////////////////
// QUICK TESTS
//////////////////////////////////////////////////////////////////

console.log("Torque:", PowerTorqueEngine.calcTorque(15, 1440));

console.log("Power:", PowerTorqueEngine.calcPower(99.47, 1440));

console.log("RPM:", MotorSpeedEngine.actualSpeed(4, 50));

console.log("Ratio:", RatioEngine.calculateRatio(1440, 20));

console.log("Stages:", StageCountEngine.determineStageCount(72));

/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * PART 2
 *
 * Sections Implemented:
 * - Stage Ratio Distribution Engine
 * - Torque Propagation Engine
 * - Screw Jack Calculations
 * - Service Factor Engine
 * - Safety Factor Engine
 ***********************************************************************/

//////////////////////////////////////////////////////////////
// EFFICIENCY TABLES
//////////////////////////////////////////////////////////////

export const EFFICIENCY = {
  PER_STAGE: 0.97,

  ONE_STAGE: Math.pow(0.97, 1),
  TWO_STAGE: Math.pow(0.97, 2),
  THREE_STAGE: Math.pow(0.97, 3),
  FOUR_STAGE: Math.pow(0.97, 4),
};

//////////////////////////////////////////////////////////////
// SERVICE FACTOR DATABASE
//////////////////////////////////////////////////////////////

export const SERVICE_FACTOR_DATABASE = {
  centrifugal_pump: {
    base: 1.25,
    duty24: 1.5,
    starts10: 1.75,
  },

  agitator: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.0,
  },

  mixer: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.0,
  },

  conveyor_belt: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.0,
  },

  conveyor_chain: {
    base: 1.75,
    duty24: 2.0,
    starts10: 2.25,
  },

  screw_jack: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.0,
  },

  compressor: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.25,
  },

  crusher_primary: {
    base: 2.0,
    duty24: 2.5,
    starts10: 3.0,
  },

  crusher_secondary: {
    base: 2.25,
    duty24: 2.75,
    starts10: 3.0,
  },

  mining_hoist: {
    base: 2.0,
    duty24: 2.5,
    starts10: 2.5,
  },

  stacker_reclaimer: {
    base: 1.75,
    duty24: 2.0,
    starts10: 2.25,
  },

  heavy_shock: {
    base: 3.0,
    duty24: 3.0,
    starts10: 3.0,
  },

  test_bench: {
    base: 1.0,
    duty24: 1.25,
    starts10: 1.5,
  },
};

//////////////////////////////////////////////////////////////
// STAGE DISTRIBUTION ENGINE
//////////////////////////////////////////////////////////////

export class StageDistributionEngine {
  static distributeRatio(totalRatio: number, stageCount: number): number[] {
    const limits = [
      { min: 3.75, max: 10.26 },
      { min: 4.71, max: 7.58 },
      { min: 4.76, max: 5.06 },
      { min: 4.0, max: 4.5 },
    ];

    const ratios = Array(stageCount).fill(Math.pow(totalRatio, 1 / stageCount));

    let residual = totalRatio;

    for (let i = stageCount - 1; i >= 0; i--) {
      ratios[i] = Math.max(limits[i].min, Math.min(limits[i].max, ratios[i]));

      residual = residual / ratios[i];

      if (i > 0) {
        const remaining = Math.pow(residual, 1 / i);

        for (let j = 0; j < i; j++) {
          ratios[j] = remaining;
        }
      }
    }

    return ratios.map((r) => Number(r.toFixed(3)));
  }
}

//////////////////////////////////////////////////////////////
// TORQUE PROPAGATION ENGINE
//////////////////////////////////////////////////////////////

export class TorquePropagationEngine {
  static propagateTorques(
    inputTorque: number,
    stageRatios: number[],
    efficiency = 0.97,
  ): number[] {
    const torques = [inputTorque];

    for (const ratio of stageRatios) {
      const nextTorque = torques[torques.length - 1] * ratio * efficiency;

      torques.push(nextTorque);
    }

    return torques;
  }

  static propagateSpeeds(inputRPM: number, stageRatios: number[]): number[] {
    const speeds = [inputRPM];

    for (const ratio of stageRatios) {
      const nextSpeed = speeds[speeds.length - 1] / ratio;

      speeds.push(nextSpeed);
    }

    return speeds;
  }

  static overallEfficiency(stageCount: number): number {
    return Math.pow(0.97, stageCount);
  }
}

//////////////////////////////////////////////////////////////
// SCREW JACK ENGINE
//////////////////////////////////////////////////////////////

export class ScrewJackEngine {
  //////////////////////////////////////////////////
  // Output RPM from Linear Velocity
  //////////////////////////////////////////////////

  static outputRPM(velocity_mm_min: number, pitch_mm_rev: number): number {
    return velocity_mm_min / pitch_mm_rev;
  }

  //////////////////////////////////////////////////
  // Travel Time
  //////////////////////////////////////////////////

  static travelTimeMinutes(stroke_mm: number, velocity_mm_min: number): number {
    return stroke_mm / velocity_mm_min;
  }

  //////////////////////////////////////////////////
  // Revolutions for Stroke
  //////////////////////////////////////////////////

  static revolutionsForStroke(stroke_mm: number, pitch_mm_rev: number): number {
    return stroke_mm / pitch_mm_rev;
  }

  //////////////////////////////////////////////////
  // Lifting Torque
  //////////////////////////////////////////////////

  static liftingTorque(
    axialLoadN: number,
    pitch_mm: number,
    screwEfficiency: number,
  ): number {
    return (axialLoadN * pitch_mm) / (2000 * Math.PI * screwEfficiency);
  }

  //////////////////////////////////////////////////
  // Lowering Torque
  //////////////////////////////////////////////////

  static loweringTorque(
    axialLoadN: number,
    pitch_mm: number,
    screwEfficiency: number,
  ): number {
    return (axialLoadN * pitch_mm * screwEfficiency) / (2000 * Math.PI);
  }
}

//////////////////////////////////////////////////////////////
// SERVICE FACTOR ENGINE
//////////////////////////////////////////////////////////////

export class ServiceFactorEngine {
  static calculate(
    application: string,
    dutyHours: number,
    startsPerHour: number,
    environment?: string,
  ): number {
    let sf = 1.5;

    const app = application.toLowerCase();

    if (app.includes("pump")) sf = 1.25;
    else if (app.includes("conveyor")) sf = 1.5;
    else if (app.includes("jack")) sf = 1.5;
    else if (app.includes("agitator")) sf = 1.75;
    else if (app.includes("mixer")) sf = 1.75;
    else if (app.includes("crusher")) sf = 2.0;
    else if (app.includes("impact")) sf = 3.0;

    //////////////////////////////////////

    if (dutyHours > 16) {
      sf += 0.25;
    }

    if (startsPerHour > 10) {
      sf += 0.25;
    }

    if (
      environment &&
      (environment.includes("dust") ||
        environment.includes("humid") ||
        environment.includes("outdoor"))
    ) {
      sf += 0.25;
    }

    return Math.min(sf, 3.0);
  }
}

//////////////////////////////////////////////////////////////
// PEAK FACTOR ENGINE
//////////////////////////////////////////////////////////////

export class PeakFactorEngine {
  static getPeakFactor(application: string): number {
    const app = application.toLowerCase();

    if (app.includes("crusher")) {
      return 2.0;
    }

    if (app.includes("emergency")) {
      return 2.5;
    }

    return 1.5;
  }
}

//////////////////////////////////////////////////////////////
// SAFETY FACTOR ENGINE
//////////////////////////////////////////////////////////////

export class SafetyFactorEngine {
  static calculate(
    gearboxNominal: number,
    gearboxRated: number,
    requiredNominal: number,
    requiredMaximum: number,
  ): number {
    const sfNominal = gearboxNominal / requiredNominal;

    const sfRated = gearboxRated / requiredMaximum;

    return Math.min(sfNominal, sfRated);
  }

  static assessment(sf: number): string {
    if (sf < 1.0) return "FAIL";

    if (sf < 1.1) return "MARGINAL";

    if (sf < 1.25) return "ACCEPTABLE";

    if (sf < 1.5) return "GOOD";

    if (sf < 2.0) return "CONSERVATIVE";

    return "OVER_DESIGNED";
  }
}

//////////////////////////////////////////////////////////////
// REQUIRED TORQUE ENGINE
//////////////////////////////////////////////////////////////

export class RequiredTorqueEngine {
  static requiredNominal(outputTorque: number, serviceFactor: number): number {
    return outputTorque * serviceFactor;
  }

  static requiredMaximum(
    outputTorque: number,
    serviceFactor: number,
    peakFactor: number,
  ): number {
    return outputTorque * serviceFactor * peakFactor;
  }
}

//////////////////////////////////////////////////////////////
// TEST EXAMPLES
//////////////////////////////////////////////////////////////

const screwTorque = ScrewJackEngine.liftingTorque(35500, 6, 0.4);

console.log("Screw Torque:", screwTorque);

const sf = ServiceFactorEngine.calculate("belt conveyor", 12, 5);

console.log("Service Factor:", sf);

const ratios = StageDistributionEngine.distributeRatio(88.5, 3);

console.log("Ratios:", ratios);

const torques = TorquePropagationEngine.propagateTorques(99.47, ratios);

console.log("Stage Torques:", torques);

const safety = SafetyFactorEngine.calculate(15000, 22000, 14042, 21063);

console.log("Safety Factor:", safety);

/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * PART 3
 *
 * Sections Implemented:
 * - Missing Data Resolution Engine
 * - Parameter Extraction Engine
 * - Application Detection Engine
 * - OCR Validation Engine
 * - Multi Source Resolution Logic
 ***********************************************************************/

//////////////////////////////////////////////////////////////
// APPLICATION TYPES
//////////////////////////////////////////////////////////////

export const ApplicationType = {
  CONVEYOR: "CONVEYOR",
  CRUSHER: "CRUSHER",
  PUMP: "PUMP",
  SCREW_JACK: "SCREW_JACK",
  MIXER: "MIXER",
  STACKER_RECLAIMER: "STACKER_RECLAIMER",
  HOIST: "HOIST",
  WINCH: "WINCH",
  TEST_BENCH: "TEST_BENCH",
  UNKNOWN: "UNKNOWN",
} as const;

export type ApplicationType = (typeof ApplicationType)[keyof typeof ApplicationType];

//////////////////////////////////////////////////////////////
// EXTRACTED PARAMETERS
//////////////////////////////////////////////////////////////

export interface ExtractedParameters {
  power_kw?: number;

  power_hp?: number;

  input_rpm?: number;

  output_rpm?: number;

  torque_nm?: number;

  ratio?: number;

  axial_load_kn?: number;

  linear_speed_mm_min?: number;

  pitch_mm?: number;

  stroke_mm?: number;

  temperature_c?: number;

  frequency_hz?: number;

  application?: ApplicationType;

  service_factor?: number;

  service_factor_condition?: 'less than' | 'greater than' | 'equal to' | 'minimum' | 'maximum' | null;

  raw_text: string;
}

//////////////////////////////////////////////////////////////
// REGEX EXTRACTION ENGINE
//////////////////////////////////////////////////////////////

export class ParameterExtractionEngine {
  static extract(text: string): ExtractedParameters {
    const result: ExtractedParameters = {
      raw_text: text,
    };

    //////////////////////////////////////////////////
    // POWER KW
    //////////////////////////////////////////////////

    const kwMatch = text.match(/(\d+\.?\d*)\s*kW/i);

    if (kwMatch) {
      result.power_kw = parseFloat(kwMatch[1]);
    }

    //////////////////////////////////////////////////
    // POWER HP
    //////////////////////////////////////////////////

    const hpMatch = text.match(/(\d+\.?\d*)\s*(HP|hp|h\.p\.)/i);

    if (hpMatch) {
      result.power_hp = parseFloat(hpMatch[1]);
    }

    //////////////////////////////////////////////////
    // RPM (Input/Output distinction)
    //////////////////////////////////////////////////

    const outRpmPatterns = [
      /output.*?(\d+)\s*rpm/i,
      /(?:drop\s+to|final|pulley|shaft|operating|drum|reduced)\s+(\d+)\s*rpm/i,
      /(\d+)\s*rpm\s*(?:output|pulley|operating|shaft|final|drum)/i,
      /speed\s+needs\s+to\s+drop\s+to\s+(\d+)\s*rpm/i
    ];

    for (const p of outRpmPatterns) {
      const m = text.match(p);
      if (m) {
        result.output_rpm = parseFloat(m[1]);
        break;
      }
    }

    const inRpmPatterns = [
      /input.*?(\d+)\s*rpm/i,
      /(?:motor|input|drive)\s+(\d+)\s*rpm/i,
      /(\d+)\s*rpm\s*(?:motor|input|drive)/i,
      /runs\s+at\s+(\d+)\s*rpm/i
    ];

    for (const p of inRpmPatterns) {
      const m = text.match(p);
      if (m) {
        result.input_rpm = parseFloat(m[1]);
        break;
      }
    }

    if (!result.input_rpm && !result.output_rpm) {
      const genericRpmMatch = text.match(/(\d+)\s*(?:RPM|rpm|r\/min)/i);
      if (genericRpmMatch) {
        const val = parseFloat(genericRpmMatch[1]);
        if (val >= 500) {
          result.input_rpm = val;
        } else {
          result.output_rpm = val;
        }
      }
    }

    //////////////////////////////////////////////////
    // TORQUE
    //////////////////////////////////////////////////

    const torque = text.match(/(\d+\.?\d*)\s*Nm/i);

    if (torque) {
      result.torque_nm = parseFloat(torque[1]);
    }

    //////////////////////////////////////////////////
    // RATIO
    //////////////////////////////////////////////////

    const ratio = text.match(/ratio[:\s]+(\d+\.?\d*)/i);

    if (ratio) {
      result.ratio = parseFloat(ratio[1]);
    }

    //////////////////////////////////////////////////
    // AXIAL LOAD
    //////////////////////////////////////////////////

    const axial = text.match(/(\d+\.?\d*)\s*(kN|KN)/i);

    if (axial) {
      result.axial_load_kn = parseFloat(axial[1]);
    }

    //////////////////////////////////////////////////
    // LINEAR SPEED
    //////////////////////////////////////////////////

    const speed = text.match(/(\d+\.?\d*)\s*(mm\/min|mm\/s)/i);

    if (speed) {
      result.linear_speed_mm_min = parseFloat(speed[1]);
    }

    //////////////////////////////////////////////////
    // PITCH
    //////////////////////////////////////////////////

    const pitch = text.match(/pitch[:\s]*(\d+\.?\d*)\s*mm/i);

    if (pitch) {
      result.pitch_mm = parseFloat(pitch[1]);
    }

    //////////////////////////////////////////////////
    // STROKE
    //////////////////////////////////////////////////

    const stroke = text.match(/stroke[:\s]*(\d+\.?\d*)\s*mm/i);

    if (stroke) {
      result.stroke_mm = parseFloat(stroke[1]);
    }

    //////////////////////////////////////////////////
    // TEMPERATURE
    //////////////////////////////////////////////////

    const temp = text.match(/(\d+)\s*°?\s*C/i);

    if (temp) {
      result.temperature_c = parseFloat(temp[1]);
    }

    //////////////////////////////////////////////////
    // FREQUENCY
    //////////////////////////////////////////////////

    const hz = text.match(/(50|60)\s*Hz/i);

    if (hz) {
      result.frequency_hz = parseFloat(hz[1]);
    }

    //////////////////////////////////////////////////
    // APPLICATION
    //////////////////////////////////////////////////

    const sfCondRegex = /(?:service\s+factor|SF|factor)\s+(?:is\s+|of\s+)?(less\s+than|greater\s+than|equal\s+to|minimum|maximum|min\b|max\b|<=|>=|<|>|=)\s*(?:is\s+|of\s+)?(\d+(?:\.\d+)?)/i;
    const sfCondMatch = text.match(sfCondRegex);

    if (sfCondMatch) {
      const condRaw = sfCondMatch[1].toLowerCase();
      let condition: 'less than' | 'greater than' | 'equal to' | 'minimum' | 'maximum' | null = null;
      if (condRaw === 'less than' || condRaw === '<' || condRaw === '<=') {
        condition = 'less than';
      } else if (condRaw === 'greater than' || condRaw === '>' || condRaw === '>=') {
        condition = 'greater than';
      } else if (condRaw === 'equal to' || condRaw === '=') {
        condition = 'equal to';
      } else if (condRaw === 'minimum' || condRaw === 'min') {
        condition = 'minimum';
      } else if (condRaw === 'maximum' || condRaw === 'max') {
        condition = 'maximum';
      }
      result.service_factor_condition = condition;
      result.service_factor = parseFloat(sfCondMatch[2]);
    } else {
      const sfSimpleRegex = /(?:service\s+factor|SF|factor)\s+(?:of|is\s+)?(\d+(?:\.\d+)?)/i;
      const sfSimpleMatch = text.match(sfSimpleRegex);
      if (sfSimpleMatch) {
        result.service_factor = parseFloat(sfSimpleMatch[1]);
        result.service_factor_condition = null;
      }
    }

    result.application = ApplicationDetectionEngine.detect(text);

    return result;
  }
}

//////////////////////////////////////////////////////////////
// APPLICATION DETECTION ENGINE
//////////////////////////////////////////////////////////////

export class ApplicationDetectionEngine {
  static detect(text: string): ApplicationType {
    const value = text.toLowerCase();

    if (
      value.includes("conveyor") ||
      value.includes("belt") ||
      value.includes("bucket elevator") ||
      value.includes("flight")
    ) {
      return ApplicationType.CONVEYOR;
    }

    if (
      value.includes("crusher") ||
      value.includes("jaw") ||
      value.includes("cone") ||
      value.includes("mill") ||
      value.includes("grinder")
    ) {
      return ApplicationType.CRUSHER;
    }

    if (
      value.includes("pump") ||
      value.includes("centrifugal") ||
      value.includes("submersible")
    ) {
      return ApplicationType.PUMP;
    }

    if (
      value.includes("screw jack") ||
      value.includes("linear actuator") ||
      value.includes("lift")
    ) {
      return ApplicationType.SCREW_JACK;
    }

    if (
      value.includes("agitator") ||
      value.includes("mixer") ||
      value.includes("ribbon")
    ) {
      return ApplicationType.MIXER;
    }

    if (
      value.includes("stacker") ||
      value.includes("reclaimer") ||
      value.includes("slew")
    ) {
      return ApplicationType.STACKER_RECLAIMER;
    }

    if (
      value.includes("winch")
    ) {
      return ApplicationType.WINCH;
    }

    if (
      value.includes("hoist") ||
      value.includes("crane")
    ) {
      return ApplicationType.HOIST;
    }

    if (value.includes("test bench") || value.includes("dynamometer")) {
      return ApplicationType.TEST_BENCH;
    }

    return ApplicationType.UNKNOWN;
  }
}

//////////////////////////////////////////////////////////////
// OCR VALIDATION ENGINE
//////////////////////////////////////////////////////////////

export class OCRValidationEngine {
  static validate(params: ExtractedParameters): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    if (
      params.input_rpm &&
      (params.input_rpm < 100 || params.input_rpm > 10000)
    ) {
      flags.push({
        severity: "WARNING",
        parameter: "RPM",
        message: "RPM outside expected range",
        action: "Check OCR interpretation",
      });
    }

    if (params.power_kw && (params.power_kw < 0.1 || params.power_kw > 10000)) {
      flags.push({
        severity: "WARNING",
        parameter: "Power",
        message: "Power outside valid range",
        action: "Verify OCR result",
      });
    }

    if (params.ratio && (params.ratio < 1 || params.ratio > 2000)) {
      flags.push({
        severity: "WARNING",
        parameter: "Ratio",
        message: "Ratio outside planetary range",
        action: "Verify extracted value",
      });
    }

    return flags;
  }
}

//////////////////////////////////////////////////////////////
// MULTI SOURCE RESOLUTION ENGINE
//////////////////////////////////////////////////////////////

export interface SourceValue<T> {
  value: T;

  source: "nameplate" | "datasheet" | "email" | "calculated" | "default";
}

export class MultiSourceResolutionEngine {
  static resolve<T>(values: SourceValue<T>[]): T {
    const priority = {
      nameplate: 1,

      datasheet: 2,

      email: 3,

      calculated: 4,

      default: 5,
    };

    values.sort((a, b) => priority[a.source] - priority[b.source]);

    return values[0].value;
  }
}

//////////////////////////////////////////////////////////////
// MISSING DATA RESOLUTION ENGINE
//////////////////////////////////////////////////////////////

export class MissingDataResolutionEngine {
  static resolvePower(input: GearboxInput): number | undefined {
    if (input.power_kw) {
      return input.power_kw;
    }

    if (input.input_torque_nm && input.input_rpm) {
      return (input.input_torque_nm * 2 * Math.PI * input.input_rpm) / 60000;
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolveTorque(input: GearboxInput): number | undefined {
    if (input.input_torque_nm) {
      return input.input_torque_nm;
    }

    if (input.power_kw && input.input_rpm) {
      return (input.power_kw * 60000) / (2 * Math.PI * input.input_rpm);
    }

    if (input.axial_load_kn && input.screw_pitch_mm) {
      return (
        (input.axial_load_kn * 1000 * input.screw_pitch_mm) /
        (2000 * Math.PI * 0.4)
      );
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolveRatio(input: GearboxInput): number | undefined {
    if (input.total_ratio) {
      return input.total_ratio;
    }

    const outputRpm = MissingDataResolutionEngine.resolveOutputRPM(input);
    if (input.input_rpm && outputRpm) {
      return input.input_rpm / outputRpm;
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolveOutputRPM(input: GearboxInput): number | undefined {
    if (input.output_rpm) {
      return input.output_rpm;
    }

    if (input.input_rpm && input.total_ratio) {
      return input.input_rpm / input.total_ratio;
    }

    if (input.linear_velocity_mm_min && input.screw_pitch_mm) {
      return input.linear_velocity_mm_min / input.screw_pitch_mm;
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolveServiceFactor(input: GearboxInput): number {
    if (input.service_factor) {
      return input.service_factor;
    }

    return ServiceFactorEngine.calculate(
      input.application_type,
      input.duty_hours_per_day,
      input.starts_per_hour,
    );
  }
}

//////////////////////////////////////////////////////////////
// EXTRACTION TEST
//////////////////////////////////////////////////////////////

const sample = `
15 kW motor
1440 RPM
ratio 72
belt conveyor
`;

const extracted = ParameterExtractionEngine.extract(sample);

console.log(extracted);

/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * PART 4
 *
 * Sections Implemented:
 * - Gearbox Selection Engine
 * - Candidate Ranking Engine
 * - Confidence Scoring Engine
 * - Audit Trail Engine
 * - Engineering Decision Logic
 ***********************************************************************/

//////////////////////////////////////////////////////////////
// GEARBOX DATABASE MODEL
//////////////////////////////////////////////////////////////

import { gearboxDatabase } from "../data/gearboxDatabase";

export interface GearboxDatabaseRecord {
  model_id: string;

  nominal_torque: number;

  max_torque: number;

  ratio: number;

  max_input_rpm: number;
}

//////////////////////////////////////////////////////////////
// GEARBOX SELECTION ENGINE
//////////////////////////////////////////////////////////////

export class GearboxSelectionEngine {
  static selectCandidates(
    requiredNominal: number,
    requiredMaximum: number,
    targetRatio: number,
    motorRPM: number,
  ): GearboxCandidate[] {
    const candidates: GearboxCandidate[] = [];

    // Determine the required stage count for the target ratio
    const stageCount = StageCountEngine.determineStageCount(targetRatio);

    // Filter actual MAGTORQ gearbox database by series matching stage count
    const filtered = gearboxDatabase.filter((g) => g.series === stageCount);

    for (const gb of filtered) {
      // Check nominal torque and rated torque capacities
      const nominalCheck = gb.nominal >= requiredNominal;

      const maxCheck = gb.rated >= requiredMaximum;

      // Speed check: standard MAGTORQ input speed limit is 3000 RPM
      const maxInputRPM = 3000;

      const speedCheck = maxInputRPM >= motorRPM;

      if (nominalCheck && maxCheck && speedCheck) {
        const sf = SafetyFactorEngine.calculate(
          gb.nominal,
          gb.rated,
          requiredNominal,
          requiredMaximum,
        );

        candidates.push({
          model_id: gb.size,

          nominal_torque: gb.nominal,

          max_torque: gb.rated,

          actual_ratio: targetRatio,

          max_input_rpm: maxInputRPM,

          safety_factor: sf,

          recommendation: CandidateRankingEngine.recommendation(sf),
        });
      }
    }

    return candidates;
  }
}

//////////////////////////////////////////////////////////////
// CANDIDATE RANKING ENGINE
//////////////////////////////////////////////////////////////

export class CandidateRankingEngine {
  static recommendation(
    sf: number,
  ): "PREFERRED" | "ACCEPTABLE" | "MARGINAL" | "REJECT" {
    if (sf < 1.0) return "REJECT";

    if (sf < 1.1) return "MARGINAL";

    if (sf <= 1.5) return "PREFERRED";

    return "ACCEPTABLE";
  }

  static rank(candidates: GearboxCandidate[]): GearboxCandidate[] {
    return candidates.sort((a, b) => {
      const target = 1.3;

      const da = Math.abs(a.safety_factor - target);

      const db = Math.abs(b.safety_factor - target);

      return da - db;
    });
  }
}

//////////////////////////////////////////////////////////////
// CONFIDENCE SCORING ENGINE
//////////////////////////////////////////////////////////////

export class ConfidenceScoringEngine {
  static calculate(options: {
    powerDerived?: boolean;

    rpmDerived?: boolean;

    serviceFactorDerived?: boolean;

    ratioCalculated?: boolean;

    applicationInferred?: boolean;

    multipleMissing?: boolean;

    noValidationData?: boolean;
  }): number {
    let score = 1.0;

    if (options.powerDerived) score -= 0.1;

    if (options.rpmDerived) score -= 0.05;

    if (options.serviceFactorDerived) score -= 0.1;

    if (options.ratioCalculated) score -= 0.05;

    if (options.applicationInferred) score -= 0.15;

    if (options.multipleMissing) score -= 0.2;

    if (options.noValidationData) score -= 0.1;

    return Math.max(0, Number(score.toFixed(2)));
  }

  static confidenceLevel(score: number): "HIGH" | "MEDIUM" | "LOW" {
    if (score >= 0.85) return "HIGH";

    if (score >= 0.6) return "MEDIUM";

    return "LOW";
  }

  static requiresEngineerReview(score: number): boolean {
    return score < 0.6;
  }
}

//////////////////////////////////////////////////////////////
// AUDIT TRAIL ENGINE
//////////////////////////////////////////////////////////////

export class AuditTrailEngine {
  static createAuditTrail(
    inputRaw: GearboxInput,
    inputResolved: GearboxInput,
    derivations: DerivationEntry[],
    calculations: CalculationResult,
    candidates: GearboxCandidate[],
    recommendation: GearboxCandidate,
    flags: ValidationFlag[],
    confidenceScore: number,
  ): AuditTrail {
    return {
      session_id: crypto.randomUUID(),

      timestamp: new Date().toISOString(),

      input_raw: inputRaw,

      input_resolved: inputResolved,

      derivations,

      calculations,

      candidates,

      recommendation,

      flags,

      engineer_review_required:
        ConfidenceScoringEngine.requiresEngineerReview(confidenceScore),

      confidence_score: confidenceScore,
    };
  }
}

//////////////////////////////////////////////////////////////
// DECISION ENGINE
//////////////////////////////////////////////////////////////

export class DecisionEngine {
  static evaluate(candidate: GearboxCandidate): string {
    if (candidate.safety_factor < 1) {
      return "REJECTED";
    }

    if (candidate.safety_factor < 1.1) {
      return "MARGINAL";
    }

    if (candidate.safety_factor < 1.25) {
      return "ACCEPTABLE";
    }

    if (candidate.safety_factor < 1.5) {
      return "GOOD";
    }

    if (candidate.safety_factor < 2.0) {
      return "CONSERVATIVE";
    }

    return "OVER_DESIGNED";
  }
}

//////////////////////////////////////////////////////////////
// ENGINEERING VALIDATION RULES
//////////////////////////////////////////////////////////////

export class EngineeringValidationEngine {
  static validateSelection(
    candidate: GearboxCandidate,
    requiredNominal: number,
    requiredMaximum: number,
    targetRatio: number,
    motorRPM: number,
  ): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    if (candidate.nominal_torque < requiredNominal) {
      flags.push({
        severity: "ERROR",
        parameter: "Nominal Torque",
        message: "Nominal torque insufficient",
        action: "Select larger gearbox",
      });
    }

    if (candidate.max_torque < requiredMaximum) {
      flags.push({
        severity: "ERROR",
        parameter: "Maximum Torque",
        message: "Maximum torque insufficient",
        action: "Increase gearbox size",
      });
    }

    const ratioError =
      Math.abs(candidate.actual_ratio - targetRatio) / targetRatio;

    if (ratioError > 0.03) {
      flags.push({
        severity: "WARNING",
        parameter: "Ratio",
        message: "Ratio outside ±3%",
        action: "Review stage selection",
      });
    }

    if (candidate.max_input_rpm < motorRPM) {
      flags.push({
        severity: "ERROR",
        parameter: "RPM",
        message: "Input RPM exceeds gearbox limit",
        action: "Select higher speed gearbox",
      });
    }

    return flags;
  }
}

//////////////////////////////////////////////////////////////
// TEST CASE
//////////////////////////////////////////////////////////////

const confidence = ConfidenceScoringEngine.calculate({
  powerDerived: false,

  rpmDerived: true,

  serviceFactorDerived: true,

  ratioCalculated: true,

  applicationInferred: false,

  multipleMissing: false,

  noValidationData: false,
});

console.log("Confidence Score:", confidence);

console.log(
  "Confidence Level:",
  ConfidenceScoringEngine.confidenceLevel(confidence),
);

const candidates = GearboxSelectionEngine.selectCandidates(
  14042,
  21063,
  88.5,
  1440,
);

console.log("Candidates:", candidates);

console.log("Ranked:", CandidateRankingEngine.rank(candidates));

/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * PART 5
 *
 * Sections Implemented:
 * - Report Generator
 * - Workflow Pipeline
 * - Candidate Evaluation
 * - Audit Generation
 * - End-to-End Execution
 * - runGearboxSelector()
 ***********************************************************************/

//////////////////////////////////////////////////////////////
// REPORT INTERFACES
//////////////////////////////////////////////////////////////

export interface EngineeringReport {
  summary: {
    application: string;

    selected_gearbox: string;

    safety_factor: number;

    confidence: string;
  };

  input_parameters: GearboxInput;

  calculations: CalculationResult;

  stage_analysis: {
    stage_count: number;
    stage_ratios: number[];
    stage_torques: number[];
    stage_speeds: number[];
    efficiency: number;
  };

  gearbox_options: GearboxCandidate[];

  warnings: ValidationFlag[];

  audit: AuditTrail;
}

//////////////////////////////////////////////////////////////
// REPORT GENERATOR
//////////////////////////////////////////////////////////////

export class ReportGenerator {
  static generate(
    application: string,
    candidate: GearboxCandidate,
    calculations: CalculationResult,
    audit: AuditTrail,
    warnings: ValidationFlag[],
  ): EngineeringReport {
    return {
      summary: {
        application,

        selected_gearbox: candidate.model_id,

        safety_factor: candidate.safety_factor,

        confidence: calculations.confidence,
      },

      input_parameters: audit.input_resolved,

      calculations,

      stage_analysis: {
        stage_count: calculations.stage_count,

        stage_ratios: calculations.stage_ratios,

        stage_torques: calculations.stage_torques,

        stage_speeds: calculations.stage_speeds,

        efficiency: calculations.overall_efficiency,
      },

      gearbox_options: audit.candidates,

      warnings,

      audit,
    };
  }
}

//////////////////////////////////////////////////////////////
// CALCULATION PIPELINE
//////////////////////////////////////////////////////////////

export class GearboxCalculationPipeline {
  static execute(input: GearboxInput): CalculationResult {
    //////////////////////////////////////////////////////
    // RESOLVE DATA
    //////////////////////////////////////////////////////

    const power = MissingDataResolutionEngine.resolvePower(input);

    const torque = MissingDataResolutionEngine.resolveTorque(input);

    const ratio = MissingDataResolutionEngine.resolveRatio(input)!;

    const serviceFactor =
      MissingDataResolutionEngine.resolveServiceFactor(input);

    //////////////////////////////////////////////////////
    // STAGE COUNT
    //////////////////////////////////////////////////////

    const stageCount = StageCountEngine.determineStageCount(ratio);

    //////////////////////////////////////////////////////
    // DISTRIBUTE RATIOS
    //////////////////////////////////////////////////////

    const stageRatios = StageDistributionEngine.distributeRatio(
      ratio,
      stageCount,
    );

    //////////////////////////////////////////////////////
    // INPUT/OUTPUT TORQUE RESOLUTION
    //////////////////////////////////////////////////////

    let inputTorque: number;
    const isScrewJack =
      input.application_type?.toUpperCase().replace("_", " ") === "SCREW JACK";

    if (isScrewJack) {
      const outputTorqueTarget = torque!;
      const efficiency = Math.pow(0.97, stageCount);
      inputTorque = outputTorqueTarget / (ratio * efficiency);
    } else {
      inputTorque =
        torque ?? PowerTorqueEngine.calcTorque(power!, input.input_rpm!);
    }

    //////////////////////////////////////////////////////
    // TORQUE PROPAGATION
    //////////////////////////////////////////////////////

    const stageTorques = TorquePropagationEngine.propagateTorques(
      inputTorque,
      stageRatios,
    );

    //////////////////////////////////////////////////////
    // SPEED PROPAGATION
    //////////////////////////////////////////////////////

    const stageSpeeds = TorquePropagationEngine.propagateSpeeds(
      input.input_rpm!,
      stageRatios,
    );

    //////////////////////////////////////////////////////
    // OUTPUT TORQUE
    //////////////////////////////////////////////////////

    const outputTorque = stageTorques[stageTorques.length - 1];

    //////////////////////////////////////////////////////
    // PEAK FACTOR
    //////////////////////////////////////////////////////

    const peakFactor = PeakFactorEngine.getPeakFactor(input.application_type);

    //////////////////////////////////////////////////////
    // REQUIRED TORQUES
    //////////////////////////////////////////////////////

    const requiredNominal = RequiredTorqueEngine.requiredNominal(
      outputTorque,
      serviceFactor,
    );

    const requiredMaximum = RequiredTorqueEngine.requiredMaximum(
      outputTorque,
      serviceFactor,
      peakFactor,
    );

    //////////////////////////////////////////////////////
    // CONFIDENCE
    //////////////////////////////////////////////////////

    const confidenceScore = ConfidenceScoringEngine.calculate({
      powerDerived: !input.power_kw,

      rpmDerived: !input.input_rpm,

      serviceFactorDerived: !input.service_factor,

      ratioCalculated: !input.total_ratio,

      applicationInferred: false,

      multipleMissing: false,

      noValidationData: false,
    });

    return {
      input_torque_nm: inputTorque,

      output_torque_nm: outputTorque,

      total_ratio: ratio,

      stage_count: stageCount,

      stage_ratios: stageRatios,

      stage_torques: stageTorques,

      stage_speeds: stageSpeeds,

      service_factor: serviceFactor,

      required_nominal_nm: requiredNominal,

      required_maximum_nm: requiredMaximum,

      overall_efficiency: TorquePropagationEngine.overallEfficiency(stageCount),

      derivation_log: [],

      flags: [],

      confidence: ConfidenceScoringEngine.confidenceLevel(confidenceScore),
    };
  }
}

//////////////////////////////////////////////////////////////
// COMPLETE SELECTOR ENGINE
//////////////////////////////////////////////////////////////

export class GearboxSelectorEngine {
  static run(input: GearboxInput): EngineeringReport {
    //////////////////////////////////////////////////////
    // VALIDATION
    //////////////////////////////////////////////////////

    const validationFlags = ValidationEngine.validateInput(input);

    //////////////////////////////////////////////////////
    // CALCULATIONS
    //////////////////////////////////////////////////////

    const calculations = GearboxCalculationPipeline.execute(input);

    //////////////////////////////////////////////////////
    // GEARBOX SEARCH
    //////////////////////////////////////////////////////

    const candidates = GearboxSelectionEngine.selectCandidates(
      calculations.required_nominal_nm,

      calculations.required_maximum_nm,

      calculations.total_ratio,

      input.input_rpm!,
    );

    //////////////////////////////////////////////////////
    // RANK
    //////////////////////////////////////////////////////

    const ranked = CandidateRankingEngine.rank(candidates);

    if (ranked.length === 0) {
      throw new Error("No gearbox satisfies requirements.");
    }

    //////////////////////////////////////////////////////
    // BEST CANDIDATE
    //////////////////////////////////////////////////////

    const best = ranked[0];

    //////////////////////////////////////////////////////
    // CONFIDENCE
    //////////////////////////////////////////////////////

    const confidence = ConfidenceScoringEngine.calculate({
      powerDerived: !input.power_kw,

      rpmDerived: !input.input_rpm,

      serviceFactorDerived: !input.service_factor,

      ratioCalculated: !input.total_ratio,
    });

    //////////////////////////////////////////////////////
    // AUDIT
    //////////////////////////////////////////////////////

    const audit = AuditTrailEngine.createAuditTrail(
      input,

      input,

      [],

      calculations,

      ranked,

      best,

      validationFlags,

      confidence,
    );

    //////////////////////////////////////////////////////
    // REPORT
    //////////////////////////////////////////////////////

    return ReportGenerator.generate(
      input.application_type,

      best,

      calculations,

      audit,

      validationFlags,
    );
  }
}

//////////////////////////////////////////////////////////////
// MASTER FUNCTION
//////////////////////////////////////////////////////////////

export function runGearboxSelector(input: GearboxInput): EngineeringReport {
  return GearboxSelectorEngine.run(input);
}

try {
  const conveyorExample = runGearboxSelector({
    application_type: "belt conveyor",

    load_type: "variable",

    power_kw: 15,

    input_rpm: 1440,

    output_rpm: 20,

    duty_hours_per_day: 12,

    starts_per_hour: 4,
  });

  console.log("Conveyor Example Selected Gearbox:", conveyorExample.summary.selected_gearbox);
} catch (e) {
  console.error("Conveyor Example failed:", e);
}

try {
  const screwJackExample = runGearboxSelector({
    application_type: "screw jack",

    load_type: "uniform",

    axial_load_kn: 35.5,

    screw_pitch_mm: 6,

    input_rpm: 910,

    linear_velocity_mm_min: 300,

    duty_hours_per_day: 8,

    starts_per_hour: 2,
  });

  console.log("Screw Jack Example Selected Gearbox:", screwJackExample.summary.selected_gearbox);
} catch (e) {
  console.error("Screw Jack Example failed:", e);
}
