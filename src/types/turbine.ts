export type CurveShape = 's-curve' | 'bell' | 'linear' | 'front-loaded' | 'back-loaded';

export interface SectorCurveConfig {
  sectorName: string;
  percentage: number; // 0 - 100% of total project hours
  startPct: number; // 0 - 100% of project timeframe
  endPct: number; // 0 - 100% of project timeframe
  curveShape: CurveShape;
  volumeGain: number; // 0.5 to 2.0 (volume dial / multiplier)
  customWorkCenterShares?: Record<string, number>; // wcId -> percentage within sector
}

export interface TurbineType {
  id: string;
  name: string;
  category: 'HYDRO' | 'STEAM' | 'WIND' | 'CUSTOM';
  description: string;
  defaultHoursPerTurbine: number;
  defaultDurationDays: number;
  sectorCurves: Record<string, SectorCurveConfig>;
  isCustom?: boolean;
}

export interface TurbineProjectConfig {
  projectName: string;
  turbineTypeId: string;
  quantity: number;
  hoursPerTurbine: number;
  totalHours: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  staggeringMode: 'PARALLEL' | 'SEQUENTIAL' | 'STAGGERED';
  staggerOffsetWeeks: number;
  customSectorCurves?: Record<string, SectorCurveConfig>;
}
