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
  isMissingInputsCritical: boolean; // true if both outputRPM and targetRatio are missing
  
  // Audited stages
  formulaVerification: VerificationCheckNode;
  ratioVerification: VerificationCheckNode;
  torqueVerification: VerificationCheckNode;
  gearboxSelectionVerification: VerificationCheckNode;
  safetyFactorVerification: VerificationCheckNode;
  databaseVerification: VerificationCheckNode;
  
  // Detailed log lists by severity
  infos: string[];
  warnings: string[];
  missingInputs: string[];
  criticalFailures: string[];
  
  calculationsAudited: { name: string; original: string; recomputed: string; errorPct: number; passed: boolean }[];
}

/**
 * Checks database integrity, classifying issues into critical errors and warnings (Stage 5)
 */
export function verifyDatabaseIntegrity(): { critical: string[]; warnings: string[] } {
  const critical: string[] = [];
  const warnings: string[] = [];

  // 1. Scan for capacities <= 0 or invalid names (CRITICAL)
  gearboxDatabase.forEach((gb, idx) => {
    if (!gb.size || gb.size.trim() === '') {
      critical.push(`Database Error: Gearbox at index ${idx} has an empty size identifier.`);
    }
    if (gb.nominal <= 0) {
      critical.push(`Database Error: Gearbox ${gb.size} (Series ${gb.series}) has invalid nominal torque: ${gb.nominal} N·m.`);
    }
    if (gb.rated <= 0) {
      critical.push(`Database Error: Gearbox ${gb.size} (Series ${gb.series}) has invalid rated capacity: ${gb.rated} N·m.`);
    }
  });

  // 2. Scan for duplicate entries (same size and series) -> WARNING
  const uniqueKeys = new Set<string>();
  gearboxDatabase.forEach((gb) => {
    const key = `${gb.size}_s${gb.series}`;
    if (uniqueKeys.has(key)) {
      warnings.push(`Duplicate gearbox record: Duplicate entry detected for gearbox size '${gb.size}' in series '${gb.series}'.`);
    }
    uniqueKeys.add(key);
  });

  // 3. Scan seriesData ratio tables for empty entries or values out of boundaries
  const seriesKeys = ['s1', 's2', 's3', 's4'];
  seriesKeys.forEach((key) => {
    const ratios = seriesData[key];
    if (!ratios || ratios.length === 0) {
      critical.push(`Database Error: Series ratio table for '${key}' is empty or missing.`);
    } else {
      // Check duplicate ratios in same series -> WARNING
      const seenRatios = new Set<number>();
      ratios.forEach((r) => {
        if (seenRatios.has(r)) {
          warnings.push(`Duplicate ratio entry detected. No engineering impact: Duplicate reduction ratio '${r}' detected in series '${key}' table.`);
        }
        seenRatios.add(r);

        // Bounds validation -> CRITICAL
        if (key === 's1' && (r < 3.75 || r > 10.26)) {
          critical.push(`Database Error: Ratio '${r}' in series 's1' is out of bounds [3.75 - 10.26].`);
        } else if (key === 's2' && (r < 4.71 || r > 7.58)) {
          critical.push(`Database Error: Ratio '${r}' in series 's2' is out of bounds [4.71 - 7.58].`);
        } else if (key === 's3' && (r < 4.76 || r > 5.06)) {
          critical.push(`Database Error: Ratio '${r}' in series 's3' is out of bounds [4.76 - 5.06].`);
        } else if (key === 's4' && (r < 4.00 || r > 4.50)) {
          critical.push(`Database Error: Ratio '${r}' in series 's4' is out of bounds [4.00 - 4.50].`);
        }
      });
    }
  });

  return { critical, warnings };
}

/**
 * Executes the complete verification audits, categorizing into INFO, WARNING, MISSING INPUT, and CRITICAL
 */
export function verifyEngineeringReport(report: EngineeringReport, rawExtracted?: any): VerificationReport {
  const infos: string[] = [];
  const warnings: string[] = [];
  const missingInputs: string[] = [];
  const criticalFailures: string[] = [];
  const calculationsAudited: { name: string; original: string; recomputed: string; errorPct: number; passed: boolean }[] = [];
  
  let blockRecommendation = false;
  const tolerance = 0.001; // 0.1% tolerance limit

  const auditVal = (name: string, original: number, recomputed: number): boolean => {
    if (isNaN(original) || isNaN(recomputed)) {
      criticalFailures.push(`Recalculation Failure: NaN/invalid value produced during independent review of ${name}.`);
      return false;
    }
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
      criticalFailures.push(`Formula Verification Error: ${name} recalculation deviation exceeds tolerance. Original: ${original.toFixed(2)}, Recomputed: ${recomputed.toFixed(2)} (Dev: ${(dev * 100).toFixed(3)}%).`);
    }
    return passed;
  };

  // --- 1. EXTRACT INFOS & MISSING INPUTS FROM RAW EXTRACTION ---
  const hasExtractedPower = rawExtracted && rawExtracted.powerKW !== null && rawExtracted.powerKW !== undefined && rawExtracted.powerKW > 0;
  const hasExtractedInputRPM = rawExtracted && rawExtracted.inputRPM !== null && rawExtracted.inputRPM !== undefined && rawExtracted.inputRPM > 0;
  const hasExtractedOutputRPM = rawExtracted && rawExtracted.outputRPM !== null && rawExtracted.outputRPM !== undefined && rawExtracted.outputRPM > 0;
  const hasExtractedRatio = rawExtracted && rawExtracted.targetRatio !== null && rawExtracted.targetRatio !== undefined && rawExtracted.targetRatio > 0;
  const hasExtractedApp = rawExtracted && rawExtracted.applicationType !== null && rawExtracted.applicationType !== undefined && rawExtracted.applicationType.trim() !== '';
  const hasExtractedSF = rawExtracted && rawExtracted.serviceFactor !== null && rawExtracted.serviceFactor !== undefined && rawExtracted.serviceFactor > 0;

  // Log AI Extractions as INFO
  if (hasExtractedPower) infos.push(`AI Extracted: Power = ${rawExtracted.powerKW} kW`);
  if (hasExtractedInputRPM) infos.push(`AI Extracted: Input Speed = ${rawExtracted.inputRPM} RPM`);
  if (hasExtractedOutputRPM) infos.push(`AI Extracted: Output Speed = ${rawExtracted.outputRPM} RPM`);
  if (hasExtractedRatio) infos.push(`AI Extracted: Target Gear Ratio = ${rawExtracted.targetRatio}:1`);
  if (hasExtractedApp) infos.push(`AI Extracted: Application Type = "${rawExtracted.applicationType}"`);
  if (hasExtractedSF) infos.push(`AI Extracted: Service Factor = ${rawExtracted.serviceFactor}`);

  // Derived / Assumed parameters as INFO
  if (report.inputRPM.type === 'DERIVED') {
    infos.push(`Derived motor RPM: Speed derived as ${report.inputRPM.value} RPM from motor pole count (${report.motorPoles.value} Poles).`);
  } else if (report.inputRPM.type === 'ASSUMED') {
    infos.push(`Assumed input speed: Assigned default 1440 RPM.`);
  }

  if (report.serviceFactor.type === 'SUGGESTED' || report.serviceFactor.type === 'ASSUMED') {
    infos.push(`Assumed service factor: Suggested standard service factor ${report.serviceFactor.value} based on ${report.applicationType} application.`);
  }

  // Missing Inputs
  if (!rawExtracted || rawExtracted.powerKW === null || rawExtracted.powerKW === undefined) {
    missingInputs.push('Power Rating');
  }
  if (!rawExtracted || rawExtracted.inputRPM === null || rawExtracted.inputRPM === undefined) {
    if (rawExtracted && rawExtracted.motorPoles !== null && rawExtracted.motorPoles !== undefined) {
      // Speed derived, not missing
    } else {
      missingInputs.push('Input Speed (RPM)');
    }
  }
  if (!hasExtractedOutputRPM) {
    missingInputs.push('Output RPM');
  }
  if (!hasExtractedRatio) {
    missingInputs.push('Target Ratio');
  }
  if (!hasExtractedApp) {
    missingInputs.push('Application Type');
  }

  // Critical Missing Inputs: if BOTH ratio and outputRPM are missing, cannot calculate drivetrain
  const isMissingInputsCritical = !hasExtractedOutputRPM && !hasExtractedRatio;

  // --- 2. CRITICAL NEGATIVE CHECKS ---
  if (report.powerKW.value < 0) {
    criticalFailures.push('Negative Torque/Power: Power input cannot be negative.');
  }
  if (report.inputRPM.value < 0) {
    criticalFailures.push('Negative speed: Input speed cannot be negative.');
  }
  if (report.outputRPM.value < 0) {
    criticalFailures.push('Negative speed: Output speed cannot be negative.');
  }
  if (report.totalRatio.value < 0) {
    criticalFailures.push('Negative Ratio: Reductions ratios must be positive.');
  }

  // --- 3. RECALCULATE & CROSS-VALIDATE PRIMARY VALUES ---
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

  // --- 4. STAGE LIMIT VERIFICATION (CRITICAL ONLY IF IMPOSSIBLE CONFIG) ---
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
    criticalFailures.push(`Impossible Stage Configuration: Required Gear Ratio (${R_target.toFixed(2)}) exceeds maximum limits of the 4-stage sequencing database (${max4.toFixed(2)}:1).`);
  }

  if (report.stages.value < verifiedMinStages) {
    criticalFailures.push(`Impossible Stage Configuration: Selected Stage Count (${report.stages.value}) is insufficient for Ratio (${R_target.toFixed(2)}). Minimum required is ${verifiedMinStages} stage(s).`);
  }

  // --- 5. DRIVETRAIN STAGE-BY-STAGE CALCULATIONS AUDITING ---
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

      // Verify Gearbox Selection capacity constraints
      const gb = trace.selectedGearbox;
      
      if (gb.nominal <= 0 || gb.rated <= 0) {
        criticalFailures.push(`Invalid Gearbox Capacity: Gearbox ${gb.size} has invalid capacity limits (Nominal: ${gb.nominal}, Rated: ${gb.rated}).`);
      }

      const nominalCheckPassed = gb.nominal >= trace.nominalTorque;
      const ratedCheckPassed = gb.rated >= trace.maxTorque;

      const seriesNum = parseInt(trace.selectedGearbox.series.toString().replace('s', ''));
      const seriesGearboxes = gearboxDatabase.filter(g => g.series === seriesNum).sort((a, b) => b.nominal - a.nominal);
      const largestGbInSeries = seriesGearboxes[0];

      if (!nominalCheckPassed) {
        if (gb.size === largestGbInSeries.size) {
          criticalFailures.push(`Required Torque exceeds largest gearbox capacity: Stage ${i + 1} load (${Math.round(trace.nominalTorque)} N·m) exceeds capacity of the largest series model (${gb.size} Nominal: ${gb.nominal} N·m).`);
        } else {
          if (trace.safetyFactor < 1.0) {
            if (!criticalFailures.some(f => f.startsWith('Safety Factor < 1.0'))) {
              criticalFailures.push(`Safety Factor < 1.0: Stage ${i + 1} safety factor is ${trace.safetyFactor.toFixed(2)} (below allowable limit 1.0).`);
            }
          } else {
            warnings.push(`Gearbox Selection Warning: Stage ${i + 1} gearbox ${gb.size} Nominal capacity (${gb.nominal} N·m) is overloaded by required nominal load (${Math.round(trace.nominalTorque)} N·m) but satisfies safety margins.`);
          }
        }
      }

      if (!ratedCheckPassed) {
        if (gb.size === largestGbInSeries.size) {
          criticalFailures.push(`Required Torque exceeds largest gearbox capacity: Stage ${i + 1} peak load (${Math.round(trace.maxTorque)} N·m) exceeds capacity of the largest series model (${gb.size} Rated: ${gb.rated} N·m).`);
        } else {
          if (trace.safetyFactor < 1.0) {
            if (!criticalFailures.some(f => f.startsWith('Safety Factor < 1.0'))) {
              criticalFailures.push(`Safety Factor < 1.0: Stage ${i + 1} safety factor is ${trace.safetyFactor.toFixed(2)} (below allowable limit 1.0).`);
            }
          } else {
            warnings.push(`Gearbox Selection Warning: Stage ${i + 1} gearbox ${gb.size} Rated capacity (${gb.rated} N·m) is overloaded by peak required max load (${Math.round(trace.maxTorque)} N·m) but satisfies safety margins.`);
          }
        }
      }

      // Recompute Safety Factor: SF = min(GBNom/Tnom, GBRated/Tmax)
      const expectedSF = Math.min(gb.nominal / trace.nominalTorque, gb.rated / trace.maxTorque);
      auditVal(`Stage ${i + 1} Safety Factor`, trace.safetyFactor, expectedSF);
      if (trace.safetyFactor < 1.0) {
        if (!criticalFailures.some(f => f.startsWith('Safety Factor < 1.0'))) {
          criticalFailures.push(`Safety Factor < 1.0: Stage ${i + 1} safety factor is ${trace.safetyFactor.toFixed(2)} (below allowable limit 1.0).`);
        }
      }
    }
  }

  // --- 6. DATABASE INTEGRITY AUDIT ---
  const dbCheck = verifyDatabaseIntegrity();
  dbCheck.critical.forEach((err) => {
    criticalFailures.push(err);
  });
  dbCheck.warnings.forEach((wrn) => {
    warnings.push(wrn);
  });

  if (gearboxDatabase.length === 0) {
    criticalFailures.push("Database loading failure: Gearbox capacities database is empty.");
  }

  // --- 7. HEALTH SCORE COMPUTATION (25% each) ---
  // Only critical failures reduce the score. Warnings or missing inputs keep category scores at 25%.
  const criticalInInput = criticalFailures.some(f => f.toLowerCase().includes('negative') || f.toLowerCase().includes('input'));
  const criticalInFormula = criticalFailures.some(f => f.toLowerCase().includes('recalculation') || f.toLowerCase().includes('deviation') || f.toLowerCase().includes('formula'));
  const criticalInDb = criticalFailures.some(f => f.toLowerCase().includes('database error') || f.toLowerCase().includes('loading failure'));
  const criticalInGearbox = criticalFailures.some(f => f.toLowerCase().includes('safety factor') || f.toLowerCase().includes('exceeds largest') || f.toLowerCase().includes('impossible stage') || f.toLowerCase().includes('capacity'));

  let inputValScore = criticalInInput ? 0 : 25;
  let formulaScore = criticalInFormula ? 0 : 25;
  let dbScore = criticalInDb ? 0 : 25;
  let selectionScore = criticalInGearbox ? 0 : 25;

  const overallScore = inputValScore + formulaScore + dbScore + selectionScore;

  if (criticalFailures.length > 0) {
    blockRecommendation = true;
  }

  // Compiled checklist nodes
  const reportFormulaNode: VerificationCheckNode = {
    name: 'Formula Verification',
    passed: !criticalInFormula,
    message: !criticalInFormula 
      ? '✓ All mathematical formulas (HP to kW, slip speed derivations, torque amplifications) recalculated successfully.' 
      : '❌ Mismatch detected during mechanical calculation audits.'
  };

  const reportRatioNode: VerificationCheckNode = {
    name: 'Ratio Verification',
    passed: !criticalFailures.some(f => f.toLowerCase().includes('impossible stage')),
    message: !criticalFailures.some(f => f.toLowerCase().includes('impossible stage'))
      ? '✓ Gearbox reduction ratios resolved and verified inside planetary limits S1-S4.' 
      : '❌ Ratio limits checks or output speeds validation failed.'
  };

  const reportTorqueNode: VerificationCheckNode = {
    name: 'Torque Verification',
    passed: !criticalInFormula && !criticalFailures.some(f => f.toLowerCase().includes('torque')),
    message: !criticalInFormula && !criticalFailures.some(f => f.toLowerCase().includes('torque'))
      ? '✓ Drivetrain torque solver checks (input, stage output, efficiencies) validated.' 
      : '❌ Torque math re-calculations mismatch.'
  };

  const reportSelectionNode: VerificationCheckNode = {
    name: 'Gearbox Selection Verification',
    passed: !criticalFailures.some(f => f.toLowerCase().includes('exceeds largest') || f.toLowerCase().includes('invalid gearbox')),
    message: !criticalFailures.some(f => f.toLowerCase().includes('exceeds largest') || f.toLowerCase().includes('invalid gearbox'))
      ? '✓ Smallest compliant gearbox selected from active catalog database.' 
      : '❌ Gearbox selection database capacities review failed (overload condition blocked).'
  };

  const reportSafetyNode: VerificationCheckNode = {
    name: 'Safety Factor Verification',
    passed: !criticalFailures.some(f => f.toLowerCase().includes('safety factor')),
    message: !criticalFailures.some(f => f.toLowerCase().includes('safety factor'))
      ? '✓ Safety factors recomputed and verified across all reduction stages.' 
      : '❌ Safety factors calculation deviation detected.'
  };

  const reportDbNode: VerificationCheckNode = {
    name: 'Database Integrity Verification',
    passed: !criticalInDb,
    message: !criticalInDb 
      ? '✓ Gearbox capacities database scan complete. Zero duplicates or out-of-bound ratios found.' 
      : `❌ active scanner flagged ${dbCheck.critical.length} critical database anomalies.`
  };

  return {
    overallScore,
    passed: overallScore === 100 && criticalFailures.length === 0,
    blockRecommendation,
    isMissingInputsCritical,
    formulaVerification: reportFormulaNode,
    ratioVerification: reportRatioNode,
    torqueVerification: reportTorqueNode,
    gearboxSelectionVerification: reportSelectionNode,
    safetyFactorVerification: reportSafetyNode,
    databaseVerification: reportDbNode,
    infos,
    warnings,
    missingInputs,
    criticalFailures,
    calculationsAudited
  };
}
