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

export type CalendarEventType =
  | 'feriado'
  | 'ferias_coletivas'
  | 'manutencao'
  | 'folga_parada';

export interface CalendarException {
  id: string;
  title: string;
  type: CalendarEventType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  workCenterIds?: string[]; // Empty/undefined = All work centers (Global/Factory-wide)
  impactType: 'full_closure' | 'capacity_reduction'; // 100% closed or partial reduction
  capacityReductionPercentage?: number; // e.g. 50% if partial shift/team
  description?: string;
  color?: string;
}

export interface WorkCenter {
  id: string;
  name: string;
  dailyHours: number; // e.g., 8
  daysPerWeek: number; // e.g., 5
  resourcesCount: number; // e.g., 5
  efficiencyPercentage: number; // e.g., 100%
  category?: SectorGroup | string;
  enabled?: boolean; // When false, excluded from charts & schedule calculation
  calendarExceptions?: CalendarException[]; // Specific exceptions for this work center
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
  workCenterCapacities?: Record<string, number>; // workCenterId -> effective weekly capacity (adjusted for holidays/vacations)
  projectBreakdown: Record<string, Record<string, number>>; // workCenterId -> { projectId: hours }
  activeHolidays?: CalendarException[]; // List of holidays/vacations occurring in this week
  effectiveWorkDays?: Record<string, number>; // workCenterId -> effective work days in this week (e.g. 4.0 out of 5)
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
  affectedByHolidays?: boolean;
  holidayNames?: string[];
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
  calendarExceptions?: CalendarException[];
}
