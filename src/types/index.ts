import { TurbineProjectConfig } from './turbine';

export type SectorGroup = string;

export const DEFAULT_SECTOR_GROUPS: string[] = [
  'CORTE',
  'CALDEIRARIA',
  'SOLDA',
  'USINAGEM',
  'MONTAGENS',
  'ACABAMENTOS',
  'OUTROS',
];

export interface WorkCenter {
  id: string;
  name: string;
  dailyHours: number; // e.g., 8
  daysPerWeek: number; // e.g., 5
  resourcesCount: number; // e.g., 5
  efficiencyPercentage: number; // e.g., 100%
  category?: SectorGroup | string;
}

export interface Project {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  workCenterHours: Record<string, number>; // name or ID -> hours
  workCenterDates?: Record<string, { startDate?: string; endDate?: string }>; // name or ID -> custom start/end dates
  groupDates?: Record<string, { startDate?: string; endDate?: string }>; // sector group -> custom start/end dates
  color: string;
  enabled?: boolean;
  turbineConfig?: TurbineProjectConfig;
}

export interface WeeklyBucket {
  weekKey: string; // e.g. "2027-W33" or "13/08/2027"
  startDate: Date;
  endDate: Date;
  label: string; // "Semana 33 (13/08 - 19/08/2027)"
  workCenterLoads: Record<string, number>; // workCenterId -> hours demanded in this week
  projectBreakdown: Record<string, Record<string, number>>; // workCenterId -> { projectId: hours }
}

export interface WorkCenterCapacitySummary {
  workCenter: WorkCenter;
  totalRequiredHours: number;
  weeklyCapacity: number;
  dailyCapacity: number;
  peakWeeklyLoad: number;
  maxUtilizationPercentage: number;
  averageUtilizationPercentage: number;
  overloadedWeeksCount: number;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

export interface SectorGroupSummary {
  groupName: string;
  workCenterCount: number;
  totalResources: number;
  weeklyCapacity: number;
  totalRequiredHours: number;
  peakWeeklyLoad: number;
  maxUtilizationPercentage: number;
  averageUtilizationPercentage: number;
  overloadedWeeksCount: number;
  workCenters: WorkCenter[];
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

export interface OverloadAlert {
  workCenterId: string;
  workCenterName: string;
  weekKey: string;
  weekLabel: string;
  capacityHours: number;
  demandedHours: number;
  excessHours: number;
  utilizationPercentage: number;
  contributingProjects: { projectId: string; projectName: string; hours: number }[];
}

export interface SystemRecommendation {
  workCenterId: string;
  workCenterName: string;
  currentResources: number;
  recommendedResources: number;
  peakOverloadHours: number;
  maxUtilization: number;
  reason: string;
}

export interface PlanningScenario {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isBaseline?: boolean;
  workCenters: WorkCenter[];
  projects: Project[];
  sectorGroups: string[];
}
