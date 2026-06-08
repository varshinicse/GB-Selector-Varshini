import { Gearbox } from '../types/Gearbox';
import { gearboxDatabase } from '../data/gearboxDatabase';

/**
 * Selects the optimal gearbox model for a given stage based on torque capacity requirements.
 * This is structured asynchronously as a service layer abstraction (API-ready).
 */
export async function selectGearbox(
  seriesVal: string,
  nominalTorque: number,
  maxTorque: number,
  stageIndex: number,
  stageRatio: number
): Promise<Gearbox> {
  const seriesNum = parseInt(seriesVal.replace('s', ''));
  let filteredGearboxes = gearboxDatabase.filter(g => g.series === seriesNum);

  // ----- Restrict first stage gearboxes by ratio -----
  if (stageIndex === 0 && seriesVal === 's1') { // first stage
    if (stageRatio === 3.75 || stageRatio === 4.25 || stageRatio === 4.5 || stageRatio === 4.71 || stageRatio === 5.05) {
      filteredGearboxes = filteredGearboxes.filter(g => g.size.startsWith('L'));
    } else if (stageRatio === 5.67 || stageRatio === 5.71 || stageRatio === 6.25 || stageRatio === 6.68 || stageRatio === 7.2 || stageRatio === 7.58 || stageRatio === 7.6) {
      filteredGearboxes = filteredGearboxes.filter(g => g.size.startsWith('M'));
    } else if (stageRatio === 8.04 || stageRatio === 8.65 || stageRatio === 8.74 || stageRatio === 9.4 || stageRatio === 9.43 || stageRatio === 10.125 || stageRatio === 10.26) {
      filteredGearboxes = filteredGearboxes.filter(g => g.size.startsWith('H'));
    }
  }

  // ----- Existing selection logic -----
  // Rule 1 (Ideal): Gearbox Nominal >= nominal && Gearbox Rated >= max
  let selected = filteredGearboxes
    .filter(g => g.nominal >= nominalTorque && g.rated >= maxTorque)
    .sort((a, b) => a.nominal - b.nominal);
  if (selected.length > 0) return selected[0];

  // Rule 2 (Fallback): Gearbox Rated >= max
  selected = filteredGearboxes
    .filter(g => g.rated >= maxTorque)
    .sort((a, b) => a.rated - b.rated);
  if (selected.length > 0) return selected[0];

  // Rule 3 (Final fallback): return largest capacity gearbox in the series
  if (filteredGearboxes.length > 0) {
    return filteredGearboxes.sort((a, b) => b.nominal - a.nominal)[0];
  }

  return gearboxDatabase[gearboxDatabase.length - 1];
}
