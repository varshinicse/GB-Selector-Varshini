/**
 * MAGTORQ GB-Selector
 * Application Knowledge Base
 * Predefined requirements, optional parameters, rules, and questions for industrial gearbox applications.
 */

export interface ApplicationConfig {
  id: string;
  displayName: string;
  requiredParameters: string[];
  optionalParameters: string[];
  derivationRules: string[];
  blockingParameters: string[];
  clarificationQuestions: Record<string, string>;
}

export const applicationKnowledgeBase: Record<string, ApplicationConfig> = {
  CONVEYOR: {
    id: 'CONVEYOR',
    displayName: 'Conveyor',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages', 'beltSpeed_m_s', 'pulleyDiameter_m', 'beltPull_N'],
    derivationRules: ['DR-001', 'DR-005', 'DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the required motor/input power rating (in kW or HP)?',
      inputRPM: 'What is the input motor speed (RPM)?',
      outputRPM: 'What is the target output pulley/drive speed (RPM)?',
      serviceFactor: 'What is the requested application service factor? (MAGTORQ recommends 1.50 for standard conveyors.)',
      beltSpeed_m_s: 'What is the linear belt travel velocity (m/s)?',
      pulleyDiameter_m: 'What is the conveyor pulley drum outer diameter (mm or meters)?',
      beltPull_N: 'What is the effective tension/belt pull force (N or kN)?'
    }
  },
  HOIST: {
    id: 'HOIST',
    displayName: 'Hoist',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages', 'hoistSpeed_m_s', 'drumDiameter_m', 'reevingFalls', 'hoistLoad_N'],
    derivationRules: ['DR-004', 'DR-006', 'DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the motor/input power rating (kW or HP)?',
      inputRPM: 'What is the motor operating input speed (RPM)?',
      outputRPM: 'What is the target drum shaft rotational speed (RPM)?',
      serviceFactor: 'What is the service factor required for safety classification?',
      hoistSpeed_m_s: 'What is the required linear hoist lifting velocity (m/s)?',
      drumDiameter_m: 'What is the drum diameter (mm or meters)?',
      reevingFalls: 'What is the number of reeving falls/ropes in the hoisting block? (Defaults to 1 if unspecified.)',
      hoistLoad_N: 'What is the total mass/weight to lift (kg, Tons, N or kN)?'
    }
  },
  WINCH: {
    id: 'WINCH',
    displayName: 'Winch',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages', 'linePull_N', 'drumDiameter_m'],
    derivationRules: ['DR-007', 'DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the required motor/input power rating (in kW or HP)?',
      inputRPM: 'What is the input motor speed (RPM)?',
      outputRPM: 'What is the required speed? Please provide the Drum RPM, Line Speed (m/min), or Gearbox Ratio.',
      serviceFactor: 'What is the service factor required for safety classification?',
      linePull_N: 'What is the line pull force (N or kN)?',
      drumDiameter_m: 'What is the drum diameter (mm or meters)?'
    }
  },
  'BUCKET ELEVATOR': {
    id: 'BUCKET ELEVATOR',
    displayName: 'Bucket Elevator',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages', 'bucketSpeed_m_s', 'headPulleyDiameter_m'],
    derivationRules: ['DR-003', 'DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the design elevator drive power in kW?',
      inputRPM: 'What is the input motor speed (RPM)?',
      outputRPM: 'What is the target elevator head shaft speed (RPM)?',
      bucketSpeed_m_s: 'What is the target linear bucket travel speed (m/s)?',
      headPulleyDiameter_m: 'What is the head shaft pulley outer diameter (mm or meters)?'
    }
  },
  'SCREW CONVEYOR': {
    id: 'SCREW CONVEYOR',
    displayName: 'Screw Conveyor',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages'],
    derivationRules: ['DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the motor input power rating in kW?',
      inputRPM: 'What is the input drive speed (RPM)?',
      outputRPM: 'What is the required screw shaft speed (RPM)?'
    }
  },
  MIXER: {
    id: 'MIXER',
    displayName: 'Mixer',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages'],
    derivationRules: ['DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the mixer drive motor power rating (kW)?',
      inputRPM: 'What is the input shaft rotational speed (RPM)?',
      outputRPM: 'What is the target mixing impeller speed (RPM)?'
    }
  },
  AGITATOR: {
    id: 'AGITATOR',
    displayName: 'Agitator',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages'],
    derivationRules: ['DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the drive motor power rating (kW)?',
      inputRPM: 'What is the input shaft speed (RPM)?',
      outputRPM: 'What is the target agitator shaft speed (RPM)?'
    }
  },
  PUMP: {
    id: 'PUMP',
    displayName: 'Pump',
    requiredParameters: ['inputRPM', 'outputRPM'],
    optionalParameters: ['powerKW', 'serviceFactor', 'stages', 'flowRate_m3_s', 'pumpHead_m', 'pumpEfficiency', 'liquidDensity_kg_m3'],
    derivationRules: ['DR-009', 'DR-015'],
    blockingParameters: ['inputRPM', 'outputRPM'],
    clarificationQuestions: {
      inputRPM: 'What is the input drive motor speed (RPM)?',
      outputRPM: 'What is the target pump operating speed (RPM)?',
      powerKW: 'What is the required pump shaft power rating (kW)? (Can be derived from flow rate, head, and efficiency.)',
      flowRate_m3_s: 'What is the pump capacity/flow rate in m³/s?',
      pumpHead_m: 'What is the total head capacity of the pump in meters?',
      pumpEfficiency: 'What is the hydraulic pump design efficiency? (Defaults to 0.75 if unspecified.)',
      liquidDensity_kg_m3: 'What is the liquid density in kg/m³? (Defaults to 1000 for water if unspecified.)'
    }
  },
  FAN: {
    id: 'FAN',
    displayName: 'Fan',
    requiredParameters: ['inputRPM', 'outputRPM'],
    optionalParameters: ['powerKW', 'serviceFactor', 'stages', 'airflow_m3_s', 'staticPressure_Pa', 'fanEfficiency'],
    derivationRules: ['DR-008', 'DR-015'],
    blockingParameters: ['inputRPM', 'outputRPM'],
    clarificationQuestions: {
      inputRPM: 'What is the input motor speed (RPM)?',
      outputRPM: 'What is the required fan impeller speed (RPM)?',
      powerKW: 'What is the required fan shaft power rating (kW)? (Can be derived from airflow, static pressure, and efficiency.)',
      airflow_m3_s: 'What is the design airflow rate (in m³/s or CFM)?',
      staticPressure_Pa: 'What is the static pressure rise in Pa?',
      fanEfficiency: 'What is the fan mechanical efficiency? (Defaults to 0.70 if unspecified.)'
    }
  },
  CRUSHER: {
    id: 'CRUSHER',
    displayName: 'Crusher',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages'],
    derivationRules: ['DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the crusher heavy-duty motor power (kW)?',
      inputRPM: 'What is the motor input speed (RPM)?',
      outputRPM: 'What is the target crusher shaft speed (RPM)?'
    }
  },
  'STACKER RECLAIMER': {
    id: 'STACKER RECLAIMER',
    displayName: 'Stacker Reclaimer',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages'],
    derivationRules: ['DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the bucket wheel or travel motor power rating (kW)?',
      inputRPM: 'What is the input motor speed (RPM)?',
      outputRPM: 'What is the target output bucket wheel shaft speed (RPM)?'
    }
  },
  'SCREW JACK': {
    id: 'SCREW JACK',
    displayName: 'Screw Jack',
    requiredParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    optionalParameters: ['serviceFactor', 'stages'],
    derivationRules: ['DR-015'],
    blockingParameters: ['powerKW', 'inputRPM', 'outputRPM'],
    clarificationQuestions: {
      powerKW: 'What is the motor power rating (kW)?',
      inputRPM: 'What is the input speed (RPM)?',
      outputRPM: 'What is the target output lift screw speed (RPM)?'
    }
  }
};
