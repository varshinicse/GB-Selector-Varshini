import { describe, it, expect } from 'vitest';
import { MissingParameterResolutionEngine, parseInputsFromText, parseInputsWithMetadata, derivationRules } from './derivationEngine';

describe('Phase 1 Derivation Rules Formula Accuracy', () => {
  it('should verify DR-001: Conveyor Belt Speed to Output RPM', () => {
    const rule = derivationRules.find(r => r.id === 'DR-001')!;
    const res = rule.formula({ beltSpeed_m_s: 2.5, pulleyDiameter_m: 0.8 });
    // N = (2.5 * 60) / (pi * 0.8) = 150 / 2.51327 = 59.683
    expect(res).toBeCloseTo(59.683, 3);
  });

  it('should verify DR-002: Chain Conveyor Speed to Output RPM', () => {
    const rule = derivationRules.find(r => r.id === 'DR-002')!;
    const res = rule.formula({ chainSpeed_m_s: 0.5, sprocketPCD_m: 0.4 });
    // N = (0.5 * 60) / (pi * 0.4) = 30 / 1.2566 = 23.873
    expect(res).toBeCloseTo(23.873, 3);
  });

  it('should verify DR-005: Belt Pull to Torque', () => {
    const rule = derivationRules.find(r => r.id === 'DR-005')!;
    const res = rule.formula({ beltPull_N: 12000, pulleyDiameter_m: 0.8 });
    // T = (12000 * 0.8) / 2 = 4800 Nm
    expect(res).toBe(4800);
  });

  it('should verify DR-006: Hoist Torque', () => {
    const rule = derivationRules.find(r => r.id === 'DR-006')!;
    const res = rule.formula({ hoistLoad_N: 25000, drumDiameter_m: 0.6, reevingFalls: 2 });
    // T = (25000 * 0.6) / (2 * 2) = 15000 / 4 = 3750 Nm
    expect(res).toBe(3750);
  });

  it('should verify DR-008: Fan Power', () => {
    const rule = derivationRules.find(r => r.id === 'DR-008')!;
    const res = rule.formula({ airflow_m3_s: 8.5, staticPressure_Pa: 1200, fanEfficiency: 0.75 });
    // P = (8.5 * 1200) / (1000 * 0.75) = 10200 / 750 = 13.6 kW
    expect(res).toBeCloseTo(13.6, 2);
  });

  it('should verify DR-009: Pump Power', () => {
    const rule = derivationRules.find(r => r.id === 'DR-009')!;
    const res = rule.formula({
      flowRate_m3_s: 0.05,
      pumpHead_m: 45,
      pumpEfficiency: 0.70,
      liquidDensity_kg_m3: 1000
    });
    // P = (1000 * 9.80665 * 0.05 * 45) / (1000 * 0.7) = 22064.96 / 700 = 31.521 kW
    expect(res).toBeCloseTo(31.521, 3);
  });

  it('should verify DR-010: Acceleration Torque', () => {
    const rule = derivationRules.find(r => r.id === 'DR-010')!;
    const res = rule.formula({ systemInertia_kg_m2: 5.2, deltaSpeed_RPM: 1440, accelTime_s: 3.5 });
    // alpha = (1440 * 2pi) / (60 * 3.5) = 9047.78 / 210 = 43.085 rad/s2
    // T = 5.2 * 43.085 = 224.043 Nm
    expect(res).toBeCloseTo(224.04, 2);
  });

  it('should verify DR-011: RMS Torque from Load Steps', () => {
    const rule = derivationRules.find(r => r.id === 'DR-011')!;
    const res = rule.formula({
      loadTorques_Nm: [100, 200, 150],
      loadDurations_s: [10, 20, 15]
    });
    // weightedSum = 100^2 * 10 + 200^2 * 20 + 150^2 * 15 = 100000 + 800000 + 337500 = 1,237,500
    // totalTime = 45
    // RMS = sqrt(1,237,500 / 45) = sqrt(27500) = 165.83
    expect(res).toBeCloseTo(165.83, 2);
  });

  it('should verify DR-013: Thermal Duty Cycle Power', () => {
    const rule = derivationRules.find(r => r.id === 'DR-013')!;
    const res = rule.formula({ designPower_kW: 45, onTime_min: 15, offTime_min: 45 });
    // P_eff = 45 * sqrt(15 / 60) = 45 * sqrt(0.25) = 22.5 kW
    expect(res).toBe(22.5);
  });

  it('should verify DR-014: Service Life Hours', () => {
    const rule = derivationRules.find(r => r.id === 'DR-014')!;
    const res = rule.formula({ serviceYears: 10, hoursPerDay: 16, availabilityFactor: 0.95 });
    // Life = 10 * 365 * 16 * 0.95 = 55480 hours
    expect(res).toBe(55480);
  });

  it('should verify DR-015: Efficiency Corrected Torque', () => {
    const rule = derivationRules.find(r => r.id === 'DR-015')!;
    const res = rule.formula({ powerKW: 15, efficiency: 0.94, outputRPM: 20 });
    // T = (15 * 0.94 * 9549.3) / 20 = 6732.2565 Nm
    expect(res).toBeCloseTo(6732.26, 2);
  });
});

describe('Topological Dependency Resolution Engine', () => {
  it('should recursively resolve downstream parameters', () => {
    const known = {
      beltSpeed_m_s: 2.5,
      pulleyDiameter_m: 0.8,
      beltPull_N: 12000
    };

    const res = MissingParameterResolutionEngine.resolve(known);
    // Should resolve outputRPM (DR-001) and outputTorqueNm (DR-005)
    expect(res.derivedParameters.outputRPM).toBeCloseTo(59.683, 2);
    expect(res.derivedParameters.outputTorqueNm).toBe(4800);
    expect(res.traces).toHaveLength(3);
    expect(res.traces.some(t => t.ruleId === 'DR-001')).toBe(true);
    expect(res.traces.some(t => t.ruleId === 'DR-005')).toBe(true);
    expect(res.traces.some(t => t.ruleId === 'DR-024')).toBe(true);
    expect(res.derivedParameters.powerKW).toBe(30);
  });

  it('should NEVER overwrite user provided parameters', () => {
    const known = {
      beltSpeed_m_s: 2.5,
      pulleyDiameter_m: 0.8,
      outputRPM: 120 // User-entered value
    };
    const userKeys = new Set(['outputRPM']);

    const res = MissingParameterResolutionEngine.resolve(known, userKeys);
    // outputRPM should remain 120
    expect(res.derivedParameters.outputRPM).toBe(120);
    expect(res.traces).toHaveLength(0); // DR-001 should be skipped
    expect(res.skips).toHaveLength(1);
    expect(res.skips[0].ruleId).toBe('DR-001');
    expect(res.skips[0].reason).toContain('already defined');
  });
});

describe('Raw Text Engineering Value Extraction', () => {
  it('should parse conveyor parameters from raw RFQ text block', () => {
    const text = `
      Required a planetary gearbox for a heavy-duty conveyor:
      - Belt speed: 2.5 m/s
      - Pulley diameter is 800 mm
      - Effective pull tension is 15 kN
    `;
    const parsed = parseInputsFromText(text);
    expect(parsed.beltSpeed_m_s).toBe(2.5);
    expect(parsed.pulleyDiameter_m).toBe(0.8); // 800mm converted to 0.8m
    expect(parsed.beltPull_N).toBe(15000); // 15kN converted to 15000N
  });

  it('should parse hoist parameters from raw RFQ text block correctly converting units', () => {
    const text = `
      Need gearbox for lifting arrangement.
      Load to be lifted: 5 Ton
      Lifting speed: 12 m/min
      Drum diameter: 400 mm
      Motor available:
      11 kW
      1450 RPM
    `;
    const result = parseInputsWithMetadata(text);
    const parsed = result.values;
    
    // Ton to N conversion: 5 * 9806.65 = 49033.25
    expect(parsed.hoistLoad_N).toBeCloseTo(49033.25, 2);
    // m/min to m/s conversion: 12 / 60 = 0.2
    expect(parsed.hoistSpeed_m_s).toBeCloseTo(0.2, 2);
    // mm to m conversion: 400 / 1000 = 0.4
    expect(parsed.drumDiameter_m).toBeCloseTo(0.4, 2);
    
    expect(result.nodes.hoistLoad_N.name).toBe('Hoist Load Force');
    expect(result.nodes.hoistSpeed_m_s.name).toBe('Lifting Speed');
    expect(result.nodes.drumDiameter_m.name).toBe('Drum Diameter');
  });
});

describe('Dependency-Based Engineering Reasoning Engine', () => {
  it('should resolve Output RPM from inputRPM and totalRatio', () => {
    const known = {
      inputRPM: 1440,
      totalRatio: 60
    };
    const res = MissingParameterResolutionEngine.resolve(known);
    expect(res.derivedParameters.outputRPM).toBe(24);
    expect(res.traces.some(t => t.ruleId === 'DR-016')).toBe(true);
  });

  it('should identify multiple alternative missing paths for outputRPM', () => {
    const known = {
      inputRPM: 1440
    };
    const res = MissingParameterResolutionEngine.resolve(known);
    // outputRPM should have paths like ['totalRatio'] (since inputRPM is known)
    // and application specific paths like ['beltSpeed_m_s', 'pulleyDiameter_m'], etc.
    const paths = res.missingInputsForTargets?.['outputRPM'];
    expect(paths).toBeDefined();
    
    // Check totalRatio path
    expect(paths?.some(p => p.includes('totalRatio') && p.length === 1)).toBe(true);
    
    // Check beltSpeed path
    expect(paths?.some(p => p.includes('beltSpeed_m_s') && p.includes('pulleyDiameter_m') && p.length === 2)).toBe(true);
  });

  it('should resolve the 5 mandatory outputs universally', () => {
    const known = {
      inputRPM: 1500,
      outputRPM: 13,
      powerKW: 160
    };
    const res = MissingParameterResolutionEngine.resolve(known);
    // Ratio = 1500 / 13 = 115.38
    expect(res.derivedParameters.totalRatio).toBeCloseTo(115.385, 2);
    // Stages derived from Ratio = 115.38 -> 3 stages
    expect(res.derivedParameters.stages).toBe(3);
    // Core parameters present
    expect(res.derivedParameters.powerKW).toBe(160);
    expect(res.derivedParameters.inputRPM).toBe(1500);
  });
});


