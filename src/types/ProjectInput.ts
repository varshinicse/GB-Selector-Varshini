import { MechanicalFilters, DEFAULT_MECHANICAL_FILTERS } from './Gearbox';

export interface ProjectInput {
  projectName: string;
  totalRatio: number | '';
  powerKW: number | '';
  inputRPM: number | '';
  stages: number;
  stageSeries: string[]; // e.g. ["s1", "s2", "s3", "s4"]
  serviceFactor: number | '';
  mechanicalFilters: MechanicalFilters;
}

export { DEFAULT_MECHANICAL_FILTERS };

