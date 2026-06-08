import { Gearbox } from './Gearbox';

export interface StageDetail {
  stage: number;
  ratio: number;
  speed: number;
  nominalTorque: number;
  maxTorque: number;
  selectedGearbox: Gearbox;
  safetyFactor: number;
}

export interface CalculationResult {
  ratios: number[];
  total: number;
  deviation: number;
  nominal: number;
  max: number;
  lastStageGearbox?: Gearbox;
}
