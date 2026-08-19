import {
  parseISO,
  addDays,
  addWeeks,
  differenceInCalendarDays,
  format,
  startOfWeek,
  endOfWeek,
  isBefore,
  isAfter,
  isSameDay,
  isValid,
} from 'date-fns';
import { WorkCenter, Project } from '../types';
import { TurbineType, SectorCurveConfig, TurbineProjectConfig, CurveShape } from '../types/turbine';
import { getWorkCenterCategory } from './categoryHelper';
import { calculateWeeklyCapacity } from './calculator';

export interface TurbineWeeklyPoint {
  weekIndex: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalLoad: number;
  cumulativeHours: number;
  cumulativePercentage: number;
  plannedSCurvePercentage: number;
  sectorLoads: Record<string, number>;
  turbineLoads: Record<string, number>;
}

export interface TurbineCalculationResult {
  totalHours: number;
  hoursPerTurbine: number;
  quantity: number;
  startDate: string;
  endDate: string;
  durationDays: number;
  durationWeeks: number;
  sectorSummary: {
    sectorName: string;
    percentage: number;
    hours: number;
    startDate: string;
    endDate: string;
    startPct: number;
    endPct: number;
    curveShape: CurveShape;
    volumeGain: number;
    workCenters: { id: string; name: string; hours: number; weeklyCapacity: number }[];
  }[];
  weeklyPoints: TurbineWeeklyPoint[];
  workCenterHours: Record<string, number>;
  groupDates: Record<string, { startDate: string; endDate: string }>;
  workCenterDates: Record<string, { startDate: string; endDate: string }>;
}

// Safe date parser to guarantee a valid Date is always returned
export function safeParseDate(val: string | Date | undefined, fallback: Date = new Date()): Date {
  if (!val) return fallback;
  if (val instanceof Date) return isNaN(val.getTime()) ? fallback : val;
  try {
    const parsed = typeof val === 'string' ? parseISO(val) : new Date(val);
    return isValid(parsed) && !isNaN(parsed.getTime()) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// Function to calculate mathematical curve weight at progress t in [0, 1]
export function evaluateCurveDensity(t: number, shape: CurveShape): number {
  const clampedT = Math.max(0, Math.min(1, t));
  switch (shape) {
    case 's-curve': {
      // Bell-shaped derivative of standard logistic S-Curve (peak around middle, smooth start and end)
      return 6 * clampedT * (1 - clampedT);
    }
    case 'bell': {
      // Smooth sine bell curve
      return Math.sin(Math.PI * clampedT) * 1.57;
    }
    case 'front-loaded': {
      // Heavy initial effort, tapering off
      return 2 * (1 - clampedT);
    }
    case 'back-loaded': {
      // Light start, heavy ramp up at completion
      return 2 * clampedT;
    }
    case 'linear':
    default: {
      return 1.0;
    }
  }
}

// Compute standard cumulative S-Curve theoretical percentage at progress t in [0, 1]
export function evaluateCumulativeSCurve(t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  // Smoothstep S-curve formula: 3*t^2 - 2*t^3
  return (3 * Math.pow(clampedT, 2) - 2 * Math.pow(clampedT, 3)) * 100;
}

export function calculateTurbineProject(
  config: TurbineProjectConfig,
  turbineType: TurbineType,
  workCenters: WorkCenter[]
): TurbineCalculationResult {
  const {
    quantity = 1,
    hoursPerTurbine = turbineType?.defaultHoursPerTurbine || 10000,
    startDate,
    endDate,
    staggeringMode = 'STAGGERED',
    staggerOffsetWeeks = 4,
    customSectorCurves,
  } = config;

  const totalHours = Math.max(1, (hoursPerTurbine || 10000) * Math.max(1, quantity));
  const projectStart = safeParseDate(startDate, new Date());
  let projectEnd = safeParseDate(endDate, addDays(projectStart, turbineType?.defaultDurationDays || 365));

  // Guarantee projectEnd is strictly after projectStart
  if (isBefore(projectEnd, projectStart) || isSameDay(projectEnd, projectStart)) {
    projectEnd = addDays(projectStart, Math.max(7, turbineType?.defaultDurationDays || 365));
  }

  const totalDays = Math.max(7, differenceInCalendarDays(projectEnd, projectStart) + 1);
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

  const activeSectorCurves = customSectorCurves || turbineType?.sectorCurves || {};

  // 1. Calculate normalized sector hours and calendar dates
  let rawPercentageSum = 0;
  Object.values(activeSectorCurves).forEach((cfg) => {
    rawPercentageSum += (cfg.percentage || 0) * (cfg.volumeGain || 1.0);
  });
  if (rawPercentageSum === 0) rawPercentageSum = 100;

  const sectorSummary: TurbineCalculationResult['sectorSummary'] = [];
  const groupDates: Record<string, { startDate: string; endDate: string }> = {};
  const workCenterHours: Record<string, number> = {};
  const workCenterDates: Record<string, { startDate: string; endDate: string }> = {};

  // Work centers grouped by category
  const workCentersByCategory: Record<string, WorkCenter[]> = {};
  workCenters.forEach((wc) => {
    const cat = getWorkCenterCategory(wc);
    if (!workCentersByCategory[cat]) {
      workCentersByCategory[cat] = [];
    }
    workCentersByCategory[cat].push(wc);
  });

  // Calculate sector loads
  Object.entries(activeSectorCurves).forEach(([sectorName, curveCfg]) => {
    const effectivePct = ((curveCfg.percentage * (curveCfg.volumeGain || 1.0)) / rawPercentageSum) * 100;
    const sectorTotalHours = totalHours * (effectivePct / 100);

    // Calculate dates based on startPct and endPct
    const startPctSafe = Math.max(0, Math.min(100, curveCfg.startPct || 0));
    const endPctSafe = Math.max(startPctSafe + 1, Math.min(100, curveCfg.endPct || 100));

    const startOffsetDays = Math.round((startPctSafe / 100) * (totalDays - 1));
    const endOffsetDays = Math.round((endPctSafe / 100) * (totalDays - 1));

    const sectorStartDate = addDays(projectStart, startOffsetDays);
    const sectorEndDate = addDays(projectStart, Math.max(startOffsetDays + 1, endOffsetDays));

    const sectorStartStr = format(sectorStartDate, 'yyyy-MM-dd');
    const sectorEndStr = format(isAfter(sectorEndDate, projectEnd) ? projectEnd : sectorEndDate, 'yyyy-MM-dd');

    groupDates[sectorName] = {
      startDate: sectorStartStr,
      endDate: sectorEndStr,
    };

    // Distribute among work centers in this category
    const wcsInSector = workCentersByCategory[sectorName] || [];
    const wcItems: { id: string; name: string; hours: number; weeklyCapacity: number }[] = [];

    if (wcsInSector.length > 0) {
      const customShares = curveCfg.customWorkCenterShares;
      const hasCustomShares = !!(customShares && Object.keys(customShares).length > 0);

      let customSum = 0;
      if (hasCustomShares) {
        wcsInSector.forEach((wc) => {
          const val = customShares[wc.id] ?? customShares[wc.name];
          if (typeof val === 'number' && !isNaN(val)) {
            customSum += val;
          }
        });
      }

      const totalSectorCap = wcsInSector.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);

      wcsInSector.forEach((wc) => {
        const cap = calculateWeeklyCapacity(wc);
        let share: number;

        if (hasCustomShares && customSum > 0) {
          const wcVal = customShares[wc.id] ?? customShares[wc.name] ?? 0;
          share = wcVal / customSum;
        } else {
          // Default to equal distribution across all work centers in the sector
          share = 1 / wcsInSector.length;
        }

        const wcAllocatedHours = Math.round(sectorTotalHours * share);

        workCenterHours[wc.id] = wcAllocatedHours;
        workCenterDates[wc.id] = { startDate: sectorStartStr, endDate: sectorEndStr };

        wcItems.push({
          id: wc.id,
          name: wc.name,
          hours: wcAllocatedHours,
          weeklyCapacity: cap,
        });
      });
    }

    sectorSummary.push({
      sectorName,
      percentage: Number(effectivePct.toFixed(1)),
      hours: Math.round(sectorTotalHours),
      startDate: sectorStartStr,
      endDate: sectorEndStr,
      startPct: startPctSafe,
      endPct: endPctSafe,
      curveShape: curveCfg.curveShape || 's-curve',
      volumeGain: curveCfg.volumeGain || 1.0,
      workCenters: wcItems,
    });
  });

  // 2. Build multi-turbine schedules and weekly distribution points
  const turbineInstances: { id: string; name: string; startDate: Date; endDate: Date; hours: number }[] = [];
  const turbineDurationDays = Math.max(7, Math.round(totalDays * (quantity === 1 ? 1 : 0.85)));

  for (let i = 0; i < quantity; i++) {
    let tStart = projectStart;
    if (quantity > 1) {
      if (staggeringMode === 'STAGGERED') {
        tStart = addWeeks(projectStart, i * (staggerOffsetWeeks || 4));
      } else if (staggeringMode === 'SEQUENTIAL') {
        const segDays = Math.max(1, Math.floor(totalDays / quantity));
        tStart = addDays(projectStart, i * segDays);
      }
    }
    const tEnd = isAfter(addDays(tStart, turbineDurationDays), projectEnd)
      ? projectEnd
      : addDays(tStart, turbineDurationDays);

    turbineInstances.push({
      id: `turbine-${i + 1}`,
      name: `Turbina ${i + 1}`,
      startDate: tStart,
      endDate: tEnd,
      hours: hoursPerTurbine,
    });
  }

  // Generate Weekly Schedule points with loop limit guard
  const weeklyPoints: TurbineWeeklyPoint[] = [];
  let currWeekStart = startOfWeek(projectStart, { weekStartsOn: 1 });
  const finalWeekEnd = endOfWeek(projectEnd, { weekStartsOn: 1 });

  let cumulativeRunningHours = 0;
  let weekIdx = 1;
  const maxWeeksGuard = 300; // Prevent infinite loops

  while (
    (isBefore(currWeekStart, finalWeekEnd) || isSameDay(currWeekStart, finalWeekEnd)) &&
    weekIdx <= maxWeeksGuard
  ) {
    const currWeekEnd = endOfWeek(currWeekStart, { weekStartsOn: 1 });
    const weekMid = addDays(currWeekStart, 3);
    const globalProgress = Math.max(0, Math.min(1, differenceInCalendarDays(weekMid, projectStart) / totalDays));

    const sectorLoads: Record<string, number> = {};
    const turbineLoads: Record<string, number> = {};
    let weekTotalLoad = 0;

    // Distribute hours for each turbine & sector
    turbineInstances.forEach((turbine) => {
      if (isAfter(currWeekStart, turbine.endDate) || isBefore(currWeekEnd, turbine.startDate)) {
        return;
      }

      const tTotalDays = Math.max(1, differenceInCalendarDays(turbine.endDate, turbine.startDate) + 1);
      const tProgress = Math.max(0, Math.min(1, differenceInCalendarDays(weekMid, turbine.startDate) / tTotalDays));

      let turbineWeekHours = 0;

      Object.entries(activeSectorCurves).forEach(([secName, curveCfg]) => {
        const secWeight = ((curveCfg.percentage * (curveCfg.volumeGain || 1.0)) / rawPercentageSum);
        const secHoursInTurbine = turbine.hours * secWeight;

        const secStartT = (curveCfg.startPct || 0) / 100;
        const secEndT = (curveCfg.endPct || 100) / 100;

        if (tProgress >= secStartT && tProgress <= secEndT) {
          const secDurationT = Math.max(0.04, secEndT - secStartT);
          const relativeT = (tProgress - secStartT) / secDurationT;
          const curveDensity = evaluateCurveDensity(relativeT, curveCfg.curveShape || 's-curve');

          const estimatedWeeksInSector = Math.max(1, Math.round((secDurationT * tTotalDays) / 7));
          const hoursThisWeek = (secHoursInTurbine / estimatedWeeksInSector) * (curveDensity / 1.0);

          sectorLoads[secName] = (sectorLoads[secName] || 0) + hoursThisWeek;
          turbineWeekHours += hoursThisWeek;
          weekTotalLoad += hoursThisWeek;
        }
      });

      turbineLoads[turbine.name] = (turbineLoads[turbine.name] || 0) + turbineWeekHours;
    });

    cumulativeRunningHours += weekTotalLoad;
    const plannedSCurvePct = evaluateCumulativeSCurve(globalProgress);

    weeklyPoints.push({
      weekIndex: weekIdx,
      weekLabel: `Sem. ${format(currWeekStart, 'ww')}`,
      startDate: format(currWeekStart, 'dd/MM'),
      endDate: format(currWeekEnd, 'dd/MM/yy'),
      totalLoad: Math.round(weekTotalLoad),
      cumulativeHours: Math.round(cumulativeRunningHours),
      cumulativePercentage: Math.min(100, Number(((cumulativeRunningHours / totalHours) * 100).toFixed(1))),
      plannedSCurvePercentage: Number(plannedSCurvePct.toFixed(1)),
      sectorLoads: Object.fromEntries(
        Object.entries(sectorLoads).map(([k, v]) => [k, Math.round(v)])
      ),
      turbineLoads: Object.fromEntries(
        Object.entries(turbineLoads).map(([k, v]) => [k, Math.round(v)])
      ),
    });

    currWeekStart = addWeeks(currWeekStart, 1);
    weekIdx++;
  }

  // Normalize cumulative curve end to 100%
  if (weeklyPoints.length > 0 && cumulativeRunningHours > 0) {
    const scaleFactor = totalHours / cumulativeRunningHours;
    let running = 0;
    weeklyPoints.forEach((pt, i) => {
      pt.totalLoad = Math.round(pt.totalLoad * scaleFactor);
      running += pt.totalLoad;
      pt.cumulativeHours = Math.min(totalHours, running);
      pt.cumulativePercentage = Math.min(100, Number(((pt.cumulativeHours / totalHours) * 100).toFixed(1)));
      if (i === weeklyPoints.length - 1) {
        pt.cumulativePercentage = 100;
        pt.cumulativeHours = totalHours;
      }
    });
  }

  return {
    totalHours,
    hoursPerTurbine,
    quantity,
    startDate: format(projectStart, 'yyyy-MM-dd'),
    endDate: format(projectEnd, 'yyyy-MM-dd'),
    durationDays: totalDays,
    durationWeeks: totalWeeks,
    sectorSummary,
    weeklyPoints,
    workCenterHours,
    groupDates,
    workCenterDates,
  };
}

export function buildProjectFromTurbineConfig(
  config: TurbineProjectConfig,
  calculationResult: TurbineCalculationResult,
  color?: string
): Project {
  const defaultColors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#6366f1',
    '#14b8a6',
  ];
  const chosenColor = color || defaultColors[Math.floor(Math.random() * defaultColors.length)];

  return {
    id: `proj-turbine-${Date.now()}`,
    name: config.projectName.trim().toUpperCase(),
    startDate: calculationResult.startDate,
    endDate: calculationResult.endDate,
    workCenterHours: calculationResult.workCenterHours,
    groupDates: calculationResult.groupDates,
    workCenterDates: calculationResult.workCenterDates,
    color: chosenColor,
    enabled: true,
    turbineConfig: config,
  };
}
