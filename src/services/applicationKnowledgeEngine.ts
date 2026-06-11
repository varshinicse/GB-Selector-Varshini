/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationKnowledgeBase, ApplicationConfig } from '../data/applicationKnowledgeBase';
import { MissingParameterResolutionEngine } from './derivationEngine';


export interface KnowledgeAnalysisResult {
  applicationId: string;
  config: ApplicationConfig;
  missingRequiredParams: string[];
  missingOptionalParams: string[];
  blockingMissingParams: string[];
  clarificationQuestions: string[];
  isBlocked: boolean;
  resolvedParameters: Record<string, any>;
  derivationResult: any;
}

export class ApplicationKnowledgeEngine {
  /**
   * Detects application type based on keyword occurrences in text.
   */
  static detectApplication(text: string): string {
    if (!text) return 'CONVEYOR';
    const lower = text.toLowerCase();

    // Check specific/multi-word ones first
    if (lower.includes('bucket elevator')) return 'BUCKET ELEVATOR';
    if (lower.includes('screw conveyor')) return 'SCREW CONVEYOR';
    if (lower.includes('stacker reclaimer') || lower.includes('reclaimer') || lower.includes('stacker')) return 'STACKER RECLAIMER';
    if (lower.includes('screw jack') || lower.includes('screwjack') || lower.includes('jack')) return 'SCREW JACK';

    // Simple keywords
    if (lower.includes('conveyor') || lower.includes('belt')) return 'CONVEYOR';
    if (lower.includes('winch')) return 'WINCH';
    if (lower.includes('hoist') || lower.includes('crane') || lower.includes('lift')) return 'HOIST';
    if (lower.includes('agitator')) return 'AGITATOR';
    if (lower.includes('mixer')) return 'MIXER';
    if (lower.includes('pump')) return 'PUMP';
    if (lower.includes('fan') || lower.includes('blower')) return 'FAN';
    if (lower.includes('crusher') || lower.includes('shredder')) return 'CRUSHER';

    // Fallback default
    return 'CONVEYOR';
  }

  /**
   * Analyzes current parameters against the Knowledge Base rules for the detected application.
   * Runs the Derivation Engine first, then identifies what required/blocking parameters are still missing.
   */
  static analyze(
    rawText: string,
    extractedParams: Record<string, any>,
    userProvidedKeys: Set<string> = new Set()
  ): KnowledgeAnalysisResult {
    const appId = this.detectApplication(rawText);
    const config = applicationKnowledgeBase[appId] || applicationKnowledgeBase.CONVEYOR;

    // Run the Derivation Engine to resolve whatever can be derived
    const derivationResult = MissingParameterResolutionEngine.resolve(extractedParams, userProvidedKeys);
    const resolved = derivationResult.derivedParameters;

    const missingRequiredParams: string[] = [];
    const missingOptionalParams: string[] = [];
    const blockingMissingParams: string[] = [];
    const clarificationQuestions: string[] = [];

    const hasRPM = resolved.outputRPM !== undefined && resolved.outputRPM !== null && !isNaN(resolved.outputRPM);
    const hasRatio = resolved.totalRatio !== undefined && resolved.totalRatio !== null && !isNaN(resolved.totalRatio);

    if (resolved.powerKW === undefined || resolved.powerKW === null || isNaN(resolved.powerKW)) {
      missingRequiredParams.push('powerKW');
    }
    if (resolved.inputRPM === undefined || resolved.inputRPM === null || isNaN(resolved.inputRPM)) {
      missingRequiredParams.push('inputRPM');
    }
    if (!hasRPM && !hasRatio) {
      missingRequiredParams.push('outputRPM');
    }


    // Optional parameters from application config
    for (const param of config.optionalParameters) {
      if (['powerKW', 'inputRPM', 'totalRatio', 'stages', 'serviceFactor', 'outputRPM'].includes(param)) continue;
      const val = resolved[param];
      if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) {
        missingOptionalParams.push(param);
      }
    }

    // Generate Clarification Questions for missing required/blocking parameters
    const getFriendlyName = (name: string) => {
      const friendlyNames: Record<string, string> = {
        beltSpeed_m_s: 'Belt Speed',
        pulleyDiameter_m: 'Pulley Diameter',
        chainSpeed_m_s: 'Chain Speed',
        sprocketPCD_m: 'Sprocket PCD',
        bucketSpeed_m_s: 'Bucket Speed',
        headPulleyDiameter_m: 'Head Pulley Diameter',
        hoistSpeed_m_s: 'Lifting Speed',
        drumDiameter_m: 'Drum Diameter',
        reevingFalls: 'Reeving Falls',
        hoistLoad_N: 'Hoist Load Force',
        linePull_N: 'Line Pull Force',
        airflow_m3_s: 'Airflow Rate',
        staticPressure_Pa: 'Static Pressure',
        fanEfficiency: 'Fan Efficiency',
        flowRate_m3_s: 'Pump Flow Rate',
        pumpHead_m: 'Pump Head',
        pumpEfficiency: 'Pump Efficiency',
        liquidDensity_kg_m3: 'Liquid Density',
        systemInertia_kg_m2: 'System Inertia',
        deltaSpeed_RPM: 'Delta Speed',
        accelTime_s: 'Acceleration Time',
        linearSpeed_m_s: 'Linear Speed',
        effectiveDiameter_m: 'Effective Diameter',
        designPower_kW: 'Design Power',
        onTime_min: 'On-Time',
        offTime_min: 'Off-Time',
        serviceYears: 'Service Years',
        hoursPerDay: 'Operating Hours per Day',
        availabilityFactor: 'Availability Factor',
        inputPower_kW: 'Input Power',
        efficiency: 'Gearbox Efficiency',
        outputRPM: 'Output Speed',
        totalRatio: 'Gearbox Ratio',
        powerKW: 'Input Power',
        stages: 'Number of Stages',
        serviceFactor: 'Service Factor'
      };
      return friendlyNames[name] || name;
    };

    const uniqueMissingForQuestions = Array.from(new Set([...blockingMissingParams, ...missingRequiredParams]));
    for (const param of uniqueMissingForQuestions) {
      const paths = derivationResult.missingInputsForTargets?.[param];
      if (paths && paths.length > 0) {
        const alternativePaths = paths
          .filter(path => !path.includes(param))
          .map(path => path.map(name => getFriendlyName(name)).join(' + '));
        
        if (alternativePaths.length > 0) {
          const defaultQ = config.clarificationQuestions[param] || `Please provide the value for ${getFriendlyName(param)}.`;
          clarificationQuestions.push(`${defaultQ} Alternatively, specify: ${alternativePaths.join(' OR ')}`);
          continue;
        }
      }

      const q = config.clarificationQuestions[param] || `Please provide the value for ${getFriendlyName(param)}.`;
      clarificationQuestions.push(q);
    }

    const isBlocked = blockingMissingParams.length > 0;

    return {
      applicationId: appId,
      config,
      missingRequiredParams,
      missingOptionalParams,
      blockingMissingParams,
      clarificationQuestions,
      isBlocked,
      resolvedParameters: resolved,
      derivationResult
    };
  }
}

