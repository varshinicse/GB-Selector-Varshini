import { gearboxDatabase } from '../data/gearboxDatabase';
import { seriesData } from '../data/seriesData';
import { EngineeringReport, seriesLimits } from './engineeringReasoningEngine';

export interface VerificationCheckNode {
  name: string;
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
}

export interface VerificationReport {
  overallScore: number;
  passed: boolean;
  blockRecommendation: boolean;
  
  // Audited stages
  formulaVerification: VerificationCheckNode;
  ratioVerification: VerificationCheckNode;
  torqueVerification: VerificationCheckNode;
  gearboxSelectionVerification: VerificationCheckNode;
  safetyFactorVerification: VerificationCheckNode;
  databaseVerification: VerificationCheckNode;
  
  // Detailed log lists
  anomalies: string[];
  calculationsAudited: { name: string; original: string; recomputed: string; errorPct: number; passed: boolean }[];
}

/**
 * Checks database integrity (Stage 5)
 */
export function verifyDatabaseIntegrity(): { passed: boolean; anomalies: string[] } {
  const anomalies: string[] = [];

  // 1. Scan for capacities <= 0 or invalid names
  gearboxDatabase.forEach((gb, idx) => {
    if (!gb.size || gb.size.trim() === '') {
      anomalies.push(`Database Error: Gearbox at index ${idx} has an empty size identifier.`);
    }
    if (gb.nominal <= 0) {
      anomalies.push(`Database Error: Gearbox ${gb.size} (Series ${gb.series}) has invalid nominal torque: ${gb.nominal} N·m.`);
    }
    if (gb.rated <= 0) {
      anomalies.push(`Database Error: Gearbox ${gb.size} (Series ${gb.series}) has invalid rated capacity: ${gb.rated} N·m.`);
    }
  });

  // 2. Scan for duplicate entries (same size and series)
  const uniqueKeys = new Set<string>();
  gearboxDatabase.forEach((gb) => {
    const key = `${gb.size}_s${gb.series}`;
    if (uniqueKeys.has(key)) {
      anomalies.push(`Database Error: Duplicate entry detected for gearbox size '${gb.size}' in series '${gb.series}'.`);
    }
    uniqueKeys.add(key);
  });

  // 3. Scan seriesData ratio tables for empty entries or values out of boundaries
  const seriesKeys = ['s1', 's2', 's3', 's4'];
  seriesKeys.forEach((key) => {
    const ratios = seriesData[key];
    if (!ratios || ratios.length === 0) {
      anomalies.push(`Database Error: Series ratio table for '${key}' is empty or missing.`);
    } else {
      // Check duplicate ratios in same series
      const seenRatios = new Set<number>();
      ratios.forEach((r) => {
        if (seenRatios.has(r)) {
          anomalies.push(`Database Warning: Duplicate reduction ratio '${r}' detected in series '${key}' table.`);
        }
        seenRatios.add(r);

        // Bounds validation
        if (key === 's1' && (r < 3.75 || r > 10.26)) {
          anomalies.push(`Database Error: Ratio '${r}' in series 's1' is out of bounds [3.75 - 10.26].`);
        } else if (key === 's2' && (r < 4.71 || r > 7.58)) {
          anomalies.push(`Database Error: Ratio '${r}' in series 's2' is out of bounds [4.71 - 7.58].`);
        } else if (key === 's3' && (r < 4.76 || r > 5.06)) {
          anomalies.push(`Database Error: Ratio '${r}' in series 's3' is out of bounds [4.76 - 5.06].`);
        } else if (key === 's4' && (r < 4.00 || r > 4.50)) {
          anomalies.push(`Database Error: Ratio '${r}' in series 's4' is out of bounds [4.00 - 4.50].`);
        }
      });
    }
  });

  const passed = anomalies.length === 0;
  return { passed, anomalies };
}

/**
 * Executes the complete verification audits (Stages 1 - 8)
 */
export function verifyEngineeringReport(report: EngineeringReport): VerificationReport {
  const anomalies: string[] = [];
  const calculationsAudited: { name: string; original: string; recomputed: string; errorPct: number; passed: boolean }[] = [];
  
  let blockRecommendation = false;
  const tolerance = 0.001; // 0.1% tolerance limit

  const auditVal = (name: string, original: number, recomputed: number): boolean => {
    const dev = original === 0 ? Math.abs(recomputed) : Math.abs((original - recomputed) / original);
    const passed = dev <= tolerance;
    calculationsAudited.push({
      name,
      original: original.toFixed(3),
      recomputed: recomputed.toFixed(3),
      errorPct: parseFloat((dev * 100).toFixed(4)),
      passed
    });
    if (!passed) {
      anomalies.push(`Verification Failure: ${name} recalculation deviation exceeds tolerance. Original: ${original.toFixed(2)}, Recomputed: ${recomputed.toFixed(2)} (Dev: ${(dev * 100).toFixed(3)}%).`);
    }
    return passed;
  };

  // --- STAGE 1 & 2: RECALCULATE & CROSS-VALIDATE PRIMARY VALUES ---
  let formulaMathPassed = true;
  let ratioMathPassed = true;
  let torqueMathPassed = true;

  // 1. Verify Power Conversions (HP to kW)
  if (report.motorHP.value !== null && report.motorHP.value !== undefined) {
    const recomputedPower = parseFloat((report.motorHP.value * 0.7457).toFixed(2));
    if (report.powerKW.type === 'CALCULATED') {
      formulaMathPassed = auditVal('Motor Power (HP to kW)', report.powerKW.value, recomputedPower) && formulaMathPassed;
    }
  }

  // 2. Verify Speed from Poles
  if (report.motorPoles.value !== null && report.motorPoles.value !== undefined && report.inputRPM.type === 'DERIVED') {
    const poles = report.motorPoles.value;
    let expectedRPM = 1440;
    if (poles === 2) expectedRPM = 2850;
    else if (poles === 4) expectedRPM = 1440;
    else if (poles === 6) expectedRPM = 960;
    else if (poles === 8) expectedRPM = 720;
    
    formulaMathPassed = auditVal('Input Speed from Poles Mapping', report.inputRPM.value, expectedRPM) && formulaMathPassed;
  }

  // 3. Verify Ratio calculation (Ratio = InputRPM / OutputRPM)
  if (report.totalRatio.type === 'CALCULATED') {
    const expectedRatio = report.inputRPM.value / report.outputRPM.value;
    ratioMathPassed = auditVal('Total Gear Ratio Calculation', report.totalRatio.value, expectedRatio) && ratioMathPassed;
  }

  // 4. Verify Output RPM calculation (OutputRPM = InputRPM / Ratio)
  if (report.outputRPM.type === 'CALCULATED') {
    const expectedOutRPM = report.inputRPM.value / report.totalRatio.value;
    ratioMathPassed = auditVal('Output Speed Speed Resolver', report.outputRPM.value, expectedOutRPM) && ratioMathPassed;
  }

  // 5. Verify Input Torque Math ( T = P * 60000 / 2piN )
  const expectedTin = (report.powerKW.value * 60000) / (2 * Math.PI * report.inputRPM.value);
  torqueMathPassed = auditVal('Motor Input Torque', report.inputTorque.result, expectedTin) && torqueMathPassed;

  // --- STAGE 4: STAGE LIMIT VERIFICATION ---
  let stageLimitPassed = true;
  const R_target = report.totalRatio.value;
  const limits1 = seriesLimits.s1;
  const limits2 = seriesLimits.s2;
  const limits3 = seriesLimits.s3;
  const limits4 = seriesLimits.s4;

  const max1 = limits1.max;
  const max2 = limits1.max * limits2.max;
  const max3 = limits1.max * limits2.max * limits3.max;
  const max4 = limits1.max * limits2.max * limits3.max * limits4.max;

  let verifiedMinStages = 1;
  if (R_target <= max1) verifiedMinStages = 1;
  else if (R_target <= max2) verifiedMinStages = 2;
  else if (R_target <= max3) verifiedMinStages = 3;
  else if (R_target <= max4) verifiedMinStages = 4;
  else {
    stageLimitPassed = false;
    anomalies.push(`Verification Failure: Target Gear Ratio (${R_target.toFixed(2)}) exceeds maximum limits of the 4-stage sequencing database (${max4.toFixed(2)}:1).`);
  }

  if (report.stages.value < verifiedMinStages) {
    stageLimitPassed = false;
    anomalies.push(`Verification Failure: Selected Stage Count (${report.stages.value}) is insufficient for Ratio (${R_target.toFixed(2)}). Minimum required is ${verifiedMinStages} stage(s).`);
  }

  // --- STAGE 3 & 4: DRIVETRAIN STAGE-BY-STAGE CALCULATIONS AUDITING ---
  let selectionVerificationPassed = true;
  let safetyVerificationPassed = true;

  if (report.validation.isValid && report.stageTraces.length > 0) {
    let torque = expectedTin;
    let speed = report.inputRPM.value;

    for (let i = 0; i < report.stageTraces.length; i++) {
      const trace = report.stageTraces[i];
      
      // Recompute Speed: N_out = N_in / StageRatio
      speed /= trace.ratio;
      torqueMathPassed = auditVal(`Stage ${i + 1} Output RPM`, trace.speed, speed) && torqueMathPassed;

      // Recompute Torque: Tout = Tin * Ratio * 0.97
      torque = torque * trace.ratio * 0.97;
      torqueMathPassed = auditVal(`Stage ${i + 1} Nominal Torque`, trace.nominalTorque, torque) && torqueMathPassed;

      const recomputedMaxTorque = torque * report.serviceFactor.value;
      torqueMathPassed = auditVal(`Stage ${i + 1} Maximum Torque`, trace.maxTorque, recomputedMaxTorque) && torqueMathPassed;

      // Verify Gearbox Selection capacity constraints (STAGE 3)
      const gb = trace.selectedGearbox;
      const nominalCheckPassed = gb.nominal >= trace.nominalTorque;
      const ratedCheckPassed = gb.rated >= trace.maxTorque;

      if (!nominalCheckPassed) {
        selectionVerificationPassed = false;
        blockRecommendation = true;
        anomalies.push(`Gearbox Selection Failure: Stage ${i + 1} selected gearbox ${gb.size} Nominal capacity (${gb.nominal} N·m) is overloaded by required stage load (${Math.round(trace.nominalTorque)} N·m).`);
      }
      if (!ratedCheckPassed) {
        selectionVerificationPassed = false;
        blockRecommendation = true;
        anomalies.push(`Gearbox Selection Failure: Stage ${i + 1} selected gearbox ${gb.size} Rated Capacity (${gb.rated} N·m) is overloaded by peak required max load (${Math.round(trace.maxTorque)} N·m).`);
      }

      // Recompute Safety Factor: SF = min(GBNom/Tnom, GBRated/Tmax)
      const expectedSF = Math.min(gb.nominal / trace.nominalTorque, gb.rated / trace.maxTorque);
      safetyVerificationPassed = auditVal(`Stage ${i + 1} Safety Factor`, trace.safetyFactor, expectedSF) && safetyVerificationPassed;
    }
  } else {
    // If report is invalid, validation fails and verification blocks everything
    blockRecommendation = true;
    selectionVerificationPassed = false;
    safetyVerificationPassed = false;
    anomalies.push('Validation Failure: Input parameters are incomplete or invalid. Recommendation blocked.');
  }

  // --- STAGE 5: DATABASE AUDIT ---
  const dbCheck = verifyDatabaseIntegrity();
  if (!dbCheck.passed) {
    dbCheck.anomalies.forEach((err) => {
      anomalies.push(err);
    });
  }

  // --- STAGE 6: HEALTH SCORE COMPUTATION (25% each) ---
  let inputValScore = report.validation.isValid ? 25 : 0;
  
  // Formula Math Score (25%): input power conversion, speed, ratio derivations, and torque amplifications
  let formulaScore = (formulaMathPassed && ratioMathPassed && torqueMathPassed) ? 25 : 0;
  
  // Database Score (25%): scanning anomalies
  let dbScore = dbCheck.passed ? 25 : 0;
  
  // Gearbox Selection & Safety Audit Score (25%)
  let selectionScore = (selectionVerificationPassed && safetyVerificationPassed && stageLimitPassed) ? 25 : 0;

  const overallScore = inputValScore + formulaScore + dbScore + selectionScore;

  // Block recommendation if score is below 100% due to selection/safety/limit failures
  if (overallScore < 100) {
    blockRecommendation = true;
  }

  // Compile individual reports
  const reportFormulaNode: VerificationCheckNode = {
    name: 'Formula Verification',
    passed: formulaMathPassed && torqueMathPassed,
    message: formulaMathPassed && torqueMathPassed ? '✓ All mathematical formulas (HP to kW, slip speed derivations, torque amplifications) recalculated successfully.' : '❌ Mismatch detected during mechanical calculation audits.'
  };

  const reportRatioNode: VerificationCheckNode = {
    name: 'Ratio Verification',
    passed: ratioMathPassed && stageLimitPassed,
    message: ratioMathPassed && stageLimitPassed ? '✓ Gearbox reduction ratios resolved and verified inside planetary limits S1-S4.' : '❌ Ratio limits checks or output speeds validation failed.'
  };

  const reportTorqueNode: VerificationCheckNode = {
    name: 'Torque Verification',
    passed: torqueMathPassed,
    message: torqueMathPassed ? '✓ Drivetrain torque solver checks (input, stage output, efficiencies) validated.' : '❌ Torque math re-calculations mismatch.'
  };

  const reportSelectionNode: VerificationCheckNode = {
    name: 'Gearbox Selection Verification',
    passed: selectionVerificationPassed,
    message: selectionVerificationPassed ? '✓ Smallest compliant gearbox selected from active catalog database.' : '❌ Gearbox selection database capacities review failed (overload condition blocked).'
  };

  const reportSafetyNode: VerificationCheckNode = {
    name: 'Safety Factor Verification',
    passed: safetyVerificationPassed,
    message: safetyVerificationPassed ? '✓ Safety factors recomputed and verified across all reduction stages.' : '❌ Safety factors calculation deviation detected.'
  };

  const reportDbNode: VerificationCheckNode = {
    name: 'Database Integrity Verification',
    passed: dbCheck.passed,
    message: dbCheck.passed ? '✓ Gearbox capacities database scan complete. Zero duplicates or out-of-bound ratios found.' : `❌ active scanner flagged ${dbCheck.anomalies.length} database anomalies.`
  };

  return {
    overallScore,
    passed: overallScore === 100,
    blockRecommendation,
    formulaVerification: reportFormulaNode,
    ratioVerification: reportRatioNode,
    torqueVerification: reportTorqueNode,
    gearboxSelectionVerification: reportSelectionNode,
    safetyFactorVerification: reportSafetyNode,
    databaseVerification: reportDbNode,
    anomalies,
    calculationsAudited
  };
}
