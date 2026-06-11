import { describe, it, expect } from 'vitest';
import { ApplicationKnowledgeEngine } from './applicationKnowledgeEngine';

describe('Application Knowledge Engine - Classification', () => {
  it('should detect CONVEYOR from conveyor keywords', () => {
    const text = 'Need a gearbox for a heavy duty belt conveyor system.';
    const app = ApplicationKnowledgeEngine.detectApplication(text);
    expect(app).toBe('CONVEYOR');
  });

  it('should detect HOIST from hoist keywords', () => {
    const text = 'Required planetary drive for overhead crane hoist lifting 15 Tons.';
    const app = ApplicationKnowledgeEngine.detectApplication(text);
    expect(app).toBe('HOIST');
  });

  it('should detect BUCKET ELEVATOR from multiword terms', () => {
    const text = 'Design speed calculation for bucket elevator head shaft.';
    const app = ApplicationKnowledgeEngine.detectApplication(text);
    expect(app).toBe('BUCKET ELEVATOR');
  });

  it('should detect PUMP from pump keywords', () => {
    const text = 'Centrifugal slurry pump drive specifications.';
    const app = ApplicationKnowledgeEngine.detectApplication(text);
    expect(app).toBe('PUMP');
  });
});

describe('Application Knowledge Engine - Parameter & Block Analysis', () => {
  it('should NOT block Conveyor if speed parameters are missing', () => {
    const rawText = 'Conveyor drive details: 30 kW motor';
    const params = { powerKW: 30 }; // speed is missing
    const res = ApplicationKnowledgeEngine.analyze(rawText, params);

    expect(res.applicationId).toBe('CONVEYOR');
    expect(res.isBlocked).toBe(false);
    expect(res.blockingMissingParams).not.toContain('outputRPM');
  });

  it('should NOT block Pump if power is missing but flow rate and head are present (as it can derive power)', () => {
    const rawText = 'Pump specifications: 1440 RPM motor, 0.05 m3/s flow rate, 45 m head, 0.70 pump efficiency';
    // inputRPM, outputRPM are present, powerKW is missing but flowRate/head/efficiency are there
    const params = {
      inputRPM: 1440,
      outputRPM: 350,
      flowRate_m3_s: 0.05,
      pumpHead_m: 45,
      pumpEfficiency: 0.70,
      liquidDensity_kg_m3: 1000
    };
    
    const res = ApplicationKnowledgeEngine.analyze(rawText, params);
    
    expect(res.applicationId).toBe('PUMP');
    expect(res.isBlocked).toBe(false); // Can derive power using DR-009!
    expect(res.resolvedParameters.powerKW).toBeCloseTo(31.521, 3);
  });

  it('should NOT block Pump if both target speed and ratio are missing', () => {
    const rawText = 'Need a pump gearbox.';
    const params = {};
    const res = ApplicationKnowledgeEngine.analyze(rawText, params);

    expect(res.applicationId).toBe('PUMP');
    expect(res.isBlocked).toBe(false);
    expect(res.blockingMissingParams).not.toContain('outputRPM');
  });

  it('should detect WINCH from winch keywords', () => {
    const text = 'Winch drive details: 25 kN line pull, 600 mm drum diameter.';
    const app = ApplicationKnowledgeEngine.detectApplication(text);
    expect(app).toBe('WINCH');
  });

  it('should derive Winch outputTorqueNm from line pull and drum diameter, and NOT block if outputRPM is missing', () => {
    const rawText = 'Winch drive details: 25 kN line pull, 600 mm drum diameter.';
    // linePull_N = 25000, drumDiameter_m = 0.6
    const params = {
      linePull_N: 25000,
      drumDiameter_m: 0.6
    };
    const res = ApplicationKnowledgeEngine.analyze(rawText, params);
    expect(res.applicationId).toBe('WINCH');
    // Derived torque: (25000 * 0.6) / 2 = 7500 Nm
    expect(res.resolvedParameters.outputTorqueNm).toBe(7500);
    expect(res.isBlocked).toBe(false);
    expect(res.blockingMissingParams).not.toContain('outputRPM');
  });
});
