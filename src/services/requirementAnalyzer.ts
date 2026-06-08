import { ProjectInput } from '../types/ProjectInput';

/**
 * Service to analyze textual design specifications and extract operating and design parameters.
 * Structured asynchronously to model future AI endpoint integration.
 */
export async function analyzeRequirementText(text: string): Promise<Partial<ProjectInput>> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));

  let powerKW: number | undefined;
  let inputRPM: number | undefined;
  let totalRatio: number | undefined;
  let stages: number | undefined;
  let serviceFactor: number | undefined;

  // 1. Extract Power in kW
  const powerMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kW|kilowatt|kilowatts)/i);
  if (powerMatch) {
    powerKW = parseFloat(powerMatch[1]);
  }

  // 2. Extract Input Speed in RPM
  const inputSpeedMatch = text.match(/(?:input|motor|inlet)\s+speed\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*RPM/i);
  const rpmMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*RPM/gi)];
  
  if (inputSpeedMatch) {
    inputRPM = parseFloat(inputSpeedMatch[1]);
  } else if (rpmMatches.length > 0) {
    inputRPM = parseFloat(rpmMatches[0][1]);
  }

  // 3. Extract Output Speed / Ratio
  const outputSpeedMatch = text.match(/(?:output|target|final|required|conveyor)\s+speed\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*RPM/i);
  if (outputSpeedMatch && inputRPM) {
    const outRPM = parseFloat(outputSpeedMatch[1]);
    if (outRPM > 0) {
      totalRatio = parseFloat((inputRPM / outRPM).toFixed(2));
    }
  } else {
    // Check for direct ratio mention like "ratio of 50" or "gear ratio is 45"
    const ratioMatch = text.match(/(?:gear\s+)?ratio\s+(?:of|is|target)?\s*(\d+(?:\.\d+)?)/i);
    if (ratioMatch) {
      totalRatio = parseFloat(ratioMatch[1]);
    }
  }

  // 4. Extract Service Factor
  const sfMatch = text.match(/(?:service\s+factor|SF|factor)\s+(?:of|is\s+)?(\d+(?:\.\d+)?)/i);
  if (sfMatch) {
    serviceFactor = parseFloat(sfMatch[1]);
  }

  // 5. Extract stages if mentioned e.g. "3 stages" or "2-stage"
  const stageMatch = text.match(/(\d+)\s*(?:stage|reduction)/i);
  if (stageMatch) {
    stages = parseInt(stageMatch[1], 10);
  }

  // Fallbacks if extraction could not identify them
  return {
    projectName: "AI Analysis: " + (text.split(/[.!?]/)[0]?.substring(0, 30) || "Extracted"),
    powerKW: powerKW ?? 15,
    inputRPM: inputRPM ?? 1500,
    totalRatio: totalRatio ?? 100,
    stages: stages ?? 2,
    serviceFactor: serviceFactor ?? 1.5,
  };
}

/**
 * Service to process uploaded documents (PDF, DOCX, TXT) and run extraction.
 */
export async function analyzeRequirementFile(file: File): Promise<Partial<ProjectInput>> {
  // Simulate document upload and text parsing latency
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Mock extracted text from document structure
  const mockText = `Uploaded document: ${file.name}. Specifications details: 
  The drivetrain requires a motor power output of 30 kW. 
  The primary motor operating speed runs at 1440 RPM. 
  Our target output velocity for this stage is 24 RPM. 
  We prefer a 3 reduction stage configuration. 
  The service factor requirements call for a value of 1.35.`;
  
  return analyzeRequirementText(mockText);
}
