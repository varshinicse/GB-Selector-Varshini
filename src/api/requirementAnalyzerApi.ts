export interface ExtractionResult {
  projectName: string | null;
  powerKW: number | null;
  inputRPM: number | null;
  outputRPM: number | null;
  targetRatio: number | null;
  applicationType: string | null;
  serviceFactor: number | null;
  numberOfStages: number | null;
  serviceFactorCondition?: string | null;
}

/**
 * Sends extracted specifications text to the backend proxy for AI analysis.
 * This is decoupled from the UI to support future integrations with ERP/CRM.
 */
export async function analyzeRequirement(
  text: string,
  fileData?: string | null,
  mimeType?: string | null
): Promise<ExtractionResult> {
  const response = await fetch('/api/analyze-requirement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, fileData, mimeType }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
  }

  const result: ExtractionResult = await response.json();
  return result;
}
