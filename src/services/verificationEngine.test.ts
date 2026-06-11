/**
 * MAGTORQ GB-Selector
 * Regression Test Suite — Verification Engine
 * VE-1: Formula deviation ≤ 0.1%
 * VE-2: Database integrity yields 0 criticals
 * VE-3: Safety factor audit passes for a compliant selection
 */

import { describe, it, expect } from 'vitest';
import { verifyDatabaseIntegrity, verifyEngineeringReport } from './verificationEngine';
import { generateAuditReport } from './engineeringReasoningEngine';

// ───────────────────────────────────────────────────
// VE-2: Database Integrity
// ───────────────────────────────────────────────────
describe('VE-2: Database Integrity Scan', () => {
  it('should return zero critical errors for the production gearbox database', () => {
    const result = verifyDatabaseIntegrity();
    expect(result.critical).toHaveLength(0);
  });

  it('should have a non-empty gearbox database', () => {
    const { critical } = verifyDatabaseIntegrity();
    // If the DB were empty the scanner would flag a critical
    const hasDbEmptyFlag = critical.some(c => c.includes('empty'));
    expect(hasDbEmptyFlag).toBe(false);
  });
});

// ───────────────────────────────────────────────────
// VE-1: Formula Re-computation Accuracy (≤ 0.1% dev)
// ───────────────────────────────────────────────────
describe('VE-1: Formula Verification — Calculation Re-computation', () => {
  it('should have zero formula deviation beyond tolerance for a Belt Conveyor case', () => {
    const rawText = '15 kW belt conveyor motor. Input speed 1440 RPM. Output speed 20 RPM. Service factor 1.5.';
    const extracted = {
      projectName: 'Test Conveyor',
      powerKW: 15,
      inputRPM: 1440,
      outputRPM: 20,
      targetRatio: null,
      applicationType: 'Conveyor',
      serviceFactor: 1.5,
      numberOfStages: null,
      motorHP: null,
      motorPoles: null,
      dutyType: 'Continuous',
      operatingHours: '12 hours/day',
      loadType: 'Uniform',
      environment: 'Standard Industrial',
      gearboxPreferences: null
    };

    const report = generateAuditReport(rawText, extracted);
    const verification = verifyEngineeringReport(report, extracted);

    // All audited calculations should pass (deviation ≤ 0.1%)
    const failedCalcs = verification.calculationsAudited.filter(c => !c.passed);
    expect(failedCalcs).toHaveLength(0);
  });

  it('should have zero formula deviation for a Stacker Reclaimer case', () => {
    const rawText = '30 kW stacker reclaimer. Input speed 1480 RPM. Gear ratio 82.22:1. Service factor 1.75.';
    const extracted = {
      projectName: 'Test Stacker',
      powerKW: 30,
      inputRPM: 1480,
      outputRPM: null,
      targetRatio: 82.22,
      applicationType: 'Stacker Reclaimer',
      serviceFactor: 1.75,
      numberOfStages: null,
      motorHP: null,
      motorPoles: null,
      dutyType: 'Continuous',
      operatingHours: '12 hours/day',
      loadType: 'Variable',
      environment: 'Standard Industrial',
      gearboxPreferences: null
    };

    const report = generateAuditReport(rawText, extracted);
    const verification = verifyEngineeringReport(report, extracted);

    const failedCalcs = verification.calculationsAudited.filter(c => !c.passed);
    expect(failedCalcs).toHaveLength(0);
  });

  it('should correctly audit input torque formula: T = P*60000/(2*pi*N)', () => {
    const rawText = '75 kW crusher motor. Input speed 1480 RPM. Output speed 180 RPM.';
    const extracted = {
      projectName: 'Test Crusher',
      powerKW: 75,
      inputRPM: 1480,
      outputRPM: 180,
      targetRatio: null,
      applicationType: 'Crusher',
      serviceFactor: null,
      numberOfStages: null,
      motorHP: null,
      motorPoles: null,
      dutyType: 'Continuous',
      operatingHours: '20 hours/day',
      loadType: 'Heavy Shock',
      environment: 'Standard Industrial',
      gearboxPreferences: null
    };

    const report = generateAuditReport(rawText, extracted);
    const verification = verifyEngineeringReport(report, extracted);

    // Motor Input Torque should be audited and pass
    const torqueAudit = verification.calculationsAudited.find(c => c.name === 'Motor Input Torque');
    expect(torqueAudit).toBeDefined();
    expect(torqueAudit!.passed).toBe(true);
    // Expected: T = 75*60000/(2*pi*1480) ≈ 483.9 N·m
    expect(parseFloat(torqueAudit!.original)).toBeCloseTo(483.9, 0);
  });
});

// ───────────────────────────────────────────────────
// VE-3: Safety Factor Audit
// ───────────────────────────────────────────────────
describe('VE-3: Safety Factor Audit — Compliant Selection', () => {
  it('should have no critical failures for a well-specified belt conveyor', () => {
    const rawText = '15 kW belt conveyor. Input speed 1440 RPM. Output speed 20 RPM.';
    const extracted = {
      projectName: 'Test SF Conveyor',
      powerKW: 15,
      inputRPM: 1440,
      outputRPM: 20,
      targetRatio: null,
      applicationType: 'Conveyor',
      serviceFactor: 1.5,
      numberOfStages: null,
      motorHP: null,
      motorPoles: null,
      dutyType: 'Continuous',
      operatingHours: '12 hours/day',
      loadType: 'Uniform',
      environment: 'Standard Industrial',
      gearboxPreferences: null
    };

    const report = generateAuditReport(rawText, extracted);
    const verification = verifyEngineeringReport(report, extracted);

    // No safety factor critical failures
    const sfCriticals = verification.criticalFailures.filter(f =>
      f.toLowerCase().includes('safety factor')
    );
    expect(sfCriticals).toHaveLength(0);
    expect(verification.safetyFactorVerification.passed).toBe(true);
  });

  it('should produce a passing overall verification score ≥ 75 for a well-specified input', () => {
    const rawText = '30 kW stacker reclaimer drive. Input speed 1480 RPM. Gear ratio 82.22. Service factor 1.75.';
    const extracted = {
      projectName: 'Test Score',
      powerKW: 30,
      inputRPM: 1480,
      outputRPM: null,
      targetRatio: 82.22,
      applicationType: 'Stacker Reclaimer',
      serviceFactor: 1.75,
      numberOfStages: null,
      motorHP: null,
      motorPoles: null,
      dutyType: 'Continuous',
      operatingHours: '12 hours/day',
      loadType: 'Variable',
      environment: 'Standard Industrial',
      gearboxPreferences: null
    };

    const report = generateAuditReport(rawText, extracted);
    const verification = verifyEngineeringReport(report, extracted);

    expect(verification.overallScore).toBeGreaterThanOrEqual(75);
  });

  it('should pass database integrity check node', () => {
    const rawText = '15 kW conveyor. 1440 RPM. Ratio 72.';
    const extracted = {
      projectName: 'DB Check',
      powerKW: 15,
      inputRPM: 1440,
      outputRPM: null,
      targetRatio: 72,
      applicationType: 'Conveyor',
      serviceFactor: 1.5,
      numberOfStages: null,
      motorHP: null,
      motorPoles: null,
      dutyType: null,
      operatingHours: null,
      loadType: null,
      environment: null,
      gearboxPreferences: null
    };

    const report = generateAuditReport(rawText, extracted);
    const verification = verifyEngineeringReport(report, extracted);

    expect(verification.databaseVerification.passed).toBe(true);
  });
});

// ───────────────────────────────────────────────────
// Service Factor Conditional Extractions and Audits
// ───────────────────────────────────────────────────
describe('Service Factor Condition parsing and calculations', () => {
  it('should parse and apply "service factor minimum 1.8" and increase the resolved SF', () => {
    const rawText = '15 kW conveyor. 1440 RPM. Ratio 72. Service factor minimum 1.8.';
    const report = generateAuditReport(rawText, {
      projectName: 'SF Condition Min',
      powerKW: 15,
      inputRPM: 1440,
      targetRatio: 72,
      serviceFactor: null,
      serviceFactorCondition: null
    });
    // Standard conveyor SF is 1.5. A minimum of 1.8 should raise it to 1.8.
    expect(report.serviceFactor.value).toBe(1.8);
    expect(report.serviceFactor.reasoning).toContain('increased to 1.8');
  });

  it('should parse and apply "service factor maximum 1.2" and cap the resolved SF', () => {
    const rawText = '15 kW conveyor. 1440 RPM. Ratio 72. Service factor maximum 1.2.';
    const report = generateAuditReport(rawText, {
      projectName: 'SF Condition Max',
      powerKW: 15,
      inputRPM: 1440,
      targetRatio: 72,
      serviceFactor: null,
      serviceFactorCondition: null
    });
    // Standard conveyor SF is 1.5. A maximum of 1.2 should cap it at 1.2.
    expect(report.serviceFactor.value).toBe(1.2);
    expect(report.serviceFactor.reasoning).toContain('capped to 1.2');
  });

  it('should parse and apply "service factor less than 1.6" and not cap if Calculated SF is 1.5', () => {
    const rawText = '15 kW conveyor. 1440 RPM. Ratio 72. Service factor less than 1.6.';
    const report = generateAuditReport(rawText, {
      projectName: 'SF Condition Less Than',
      powerKW: 15,
      inputRPM: 1440,
      targetRatio: 72,
      serviceFactor: null,
      serviceFactorCondition: null
    });
    // Standard conveyor SF is 1.5. Since 1.5 < 1.6, it should remain 1.5.
    expect(report.serviceFactor.value).toBe(1.5);
    expect(report.serviceFactor.reasoning).toContain('already satisfies the \'less than 1.6\' condition');
  });
});
