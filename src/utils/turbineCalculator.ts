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
    customWorkCenterHours,
  } = config;

  const hasCustomWcHours = Boolean(
    customWorkCenterHours && Object.keys(customWorkCenterHours).length > 0
  );

  let totalHours = 0;
  if (hasCustomWcHours) {
    totalHours = Object.values(customWorkCenterHours!).reduce((sum, h) => {
      const num = typeof h === 'number' && !isNaN(h) ? h : 0;
      return sum + num;
    }, 0);
    if (totalHours <= 0) {
      totalHours = Math.max(1, (hoursPerTurbine || 10000) * Math.max(1, quantity));
    }
  } else {
    totalHours = Math.max(1, (hoursPerTurbine || 10000) * Math.max(1, quantity));
  }

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

  const allSectorNames = Array.from(
    new Set<string>([
      ...Object.keys(activeSectorCurves),
      ...Object.keys(workCentersByCategory),
    ])
  );

  // Calculate sector loads and timeline dates
  allSectorNames.forEach((sectorName) => {
    const curveCfg = activeSectorCurves[sectorName] || {
      sectorName,
      percentage: 10,
      startPct: 0,
      endPct: 100,
      curveShape: 's-curve' as const,
      volumeGain: 1.0,
    };

    const wcsInSector = workCentersByCategory[sectorName] || [];

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

    let sectorTotalHours = 0;
    const wcItems: { id: string; name: string; hours: number; weeklyCapacity: number }[] = [];

    if (hasCustomWcHours) {
      // PRESERVE EXACT HOURS FROM FILE/CUSTOM INPUT - DO NOT REDISTRIBUTE
      wcsInSector.forEach((wc) => {
        const cap = calculateWeeklyCapacity(wc);
        const allocated =
          customWorkCenterHours![wc.id] ??
          customWorkCenterHours![wc.name] ??
          0;

        workCenterHours[wc.id] = allocated;
        workCenterDates[wc.id] = { startDate: sectorStartStr, endDate: sectorEndStr };
        sectorTotalHours += allocated;

        wcItems.push({
          id: wc.id,
          name: wc.name,
          hours: allocated,
          weeklyCapacity: cap,
        });
      });
    } else {
      // Standard parametric generation from turbine model
      const effectivePct = ((curveCfg.percentage * (curveCfg.volumeGain || 1.0)) / rawPercentageSum) * 100;
      sectorTotalHours = totalHours * (effectivePct / 100);

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
    }

    const effectivePct = totalHours > 0 ? (sectorTotalHours / totalHours) * 100 : (curveCfg.percentage || 0);

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

  // Preserve any remaining custom work center hours not mapped into standard categories
  if (hasCustomWcHours) {
    Object.entries(customWorkCenterHours!).forEach(([key, val]) => {
      if (typeof val === 'number' && val > 0 && workCenterHours[key] === undefined) {
        workCenterHours[key] = val;
      }
    });
  }

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
      hours: quantity > 1 ? totalHours / quantity : totalHours,
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
        let secHoursInTurbine: number;
        if (hasCustomWcHours) {
          const summarySec = sectorSummary.find((s) => s.sectorName === secName);
          const secHours = summarySec ? summarySec.hours : 0;
          secHoursInTurbine = quantity > 1 ? secHours / quantity : secHours;
        } else {
          const secWeight = ((curveCfg.percentage * (curveCfg.volumeGain || 1.0)) / rawPercentageSum);
          secHoursInTurbine = turbine.hours * secWeight;
        }

        if (secHoursInTurbine <= 0) return;

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

export interface RecalculateSectorParams {
  sectorName: string;
  updatedConfig: SectorCurveConfig;
  currentConfig: TurbineProjectConfig;
  workCenters: WorkCenter[];
  defaultTurbineType?: TurbineType;
}

/**
 * Recalculates sector hours and work center allocations dynamically when
 * base weight (% Peso Base), workload volume (Volume de Carga), or work center shares change.
 * Specifically solves the issue where sectors starting with 0h would not update.
 */
export function recalculateSectorWorkCenterHours({
  sectorName,
  updatedConfig,
  currentConfig,
  workCenters,
  defaultTurbineType,
}: RecalculateSectorParams): {
  updatedSectorConfig: SectorCurveConfig;
  updatedWorkCenterHours: Record<string, number>;
  newTotalHours: number;
} {
  const normSector = sectorName.trim().toUpperCase();
  const wcsInSector = workCenters.filter(
    (wc) => getWorkCenterCategory(wc) === normSector
  );

  const existingWcHours: Record<string, number> = currentConfig.customWorkCenterHours
    ? { ...currentConfig.customWorkCenterHours }
    : {};

  const prevConfig = currentConfig.customSectorCurves?.[sectorName];

  // Reference base hours for the project
  const sumExistingHours = Object.entries(existingWcHours).reduce((sum, [k, h]) => {
    const isWcId = workCenters.some((wc) => wc.id === k);
    if (isWcId) {
      return sum + (typeof h === 'number' && !isNaN(h) ? h : 0);
    }
    return sum;
  }, 0);

  const projectRefHours = Math.max(
    1000,
    currentConfig.totalHours ||
      sumExistingHours ||
      (currentConfig.hoursPerTurbine || 10000) * (currentConfig.quantity || 1)
  );

  // Detect whether hours-driving parameters changed:
  const prevPct = prevConfig?.percentage;
  const newPct = updatedConfig.percentage;
  const pctChanged = prevPct !== undefined && newPct !== undefined && Math.abs(prevPct - newPct) > 0.001;

  const prevGain = prevConfig?.volumeGain ?? 1.0;
  const newGain = typeof updatedConfig.volumeGain === 'number' ? updatedConfig.volumeGain : prevGain;
  const gainChanged = Math.abs(prevGain - newGain) > 0.001;

  let sharesChanged = false;
  const prevShares = prevConfig?.customWorkCenterShares;
  const newShares = updatedConfig.customWorkCenterShares;
  if (prevShares && newShares) {
    const allKeys = new Set([...Object.keys(prevShares), ...Object.keys(newShares)]);
    for (const k of allKeys) {
      if (Math.abs((prevShares[k] ?? 0) - (newShares[k] ?? 0)) > 0.001) {
        sharesChanged = true;
        break;
      }
    }
  } else if (!prevShares !== !newShares) {
    sharesChanged = true;
  }

  // 1. TIMELINE-ONLY GUARD:
  // If only timeline scheduling parameters (startPct, endPct, curveShape) changed:
  // Strictly PRESERVE all existing work center hours and project total hours without any recalculation!
  if (!pctChanged && !gainChanged && !sharesChanged && prevConfig) {
    const finalSectorConfig: SectorCurveConfig = {
      ...prevConfig,
      startPct: updatedConfig.startPct ?? prevConfig.startPct,
      endPct: updatedConfig.endPct ?? prevConfig.endPct,
      curveShape: updatedConfig.curveShape ?? prevConfig.curveShape,
    };

    return {
      updatedSectorConfig: finalSectorConfig,
      updatedWorkCenterHours: existingWcHours,
      newTotalHours: currentConfig.totalHours || sumExistingHours || projectRefHours,
    };
  }

  let pct = typeof updatedConfig.percentage === 'number' ? Math.max(0, Math.min(100, updatedConfig.percentage)) : (prevPct ?? 0);
  let gain = typeof updatedConfig.volumeGain === 'number' ? Math.max(0.1, Math.min(3.0, updatedConfig.volumeGain)) : (prevGain ?? 1.0);

  // Check previous sector hours in customWorkCenterHours
  const prevSectorHours = wcsInSector.reduce(
    (sum, wc) => sum + (existingWcHours[wc.id] ?? existingWcHours[wc.name] ?? 0),
    0
  );

  // If sector was previously 0% and 0h, and user moved volumeGain slider, assign template default percentage so calculation responds
  if (pct === 0 && gain !== 1.0 && prevSectorHours === 0) {
    const fallbackTemplatePct = defaultTurbineType?.sectorCurves?.[sectorName]?.percentage || 10;
    pct = fallbackTemplatePct;
  }

  // Calculate sector target hours:
  // - If only shares changed, preserve the exact existing sector hours and just redistribute among centers
  // - If only gain changed and sector already has custom hours, scale existing hours by ratio
  // - Otherwise, calculate from percentage and gain
  let targetSectorHours: number;
  if (sharesChanged && !pctChanged && !gainChanged && prevSectorHours > 0) {
    targetSectorHours = prevSectorHours;
  } else if (gainChanged && !pctChanged && prevSectorHours > 0) {
    targetSectorHours = Math.max(0, Math.round(prevSectorHours * (gain / (prevGain || 1.0))));
  } else {
    targetSectorHours = Math.max(0, Math.round((projectRefHours * (pct * gain)) / 100));
  }

  // Determine work center shares
  const shares: Record<string, number> = { ...(updatedConfig.customWorkCenterShares || {}) };
  let sumShares = 0;
  if (wcsInSector.length > 0) {
    wcsInSector.forEach((wc) => {
      const s = shares[wc.id] ?? shares[wc.name];
      if (typeof s === 'number' && !isNaN(s) && s > 0) {
        sumShares += s;
      }
    });
  }

  const updatedShares: Record<string, number> = {};

  if (wcsInSector.length > 0) {
    if (sumShares > 0 && targetSectorHours > 0) {
      // Normalize existing non-zero proportional shares
      wcsInSector.forEach((wc) => {
        const rawShare = shares[wc.id] ?? shares[wc.name] ?? 0;
        const normShare = Math.round((rawShare / sumShares) * 100);
        updatedShares[wc.id] = normShare;
      });
    } else if (targetSectorHours > 0) {
      // Distribute equally among sector work centers (e.g. 50%/50% or 100%)
      const n = wcsInSector.length;
      const baseShare = Math.floor(100 / n);
      const rem = 100 % n;
      wcsInSector.forEach((wc, i) => {
        updatedShares[wc.id] = baseShare + (i < rem ? 1 : 0);
      });
    } else {
      // Zero hours: preserve default equal share configuration
      const n = wcsInSector.length;
      const baseShare = Math.floor(100 / n);
      const rem = 100 % n;
      wcsInSector.forEach((wc, i) => {
        updatedShares[wc.id] = baseShare + (i < rem ? 1 : 0);
      });
    }

    // Allocate hours to individual work centers
    let sumAllocated = 0;
    const totalShareSum = wcsInSector.reduce((sum, wc) => sum + (updatedShares[wc.id] || 0), 0) || 100;

    wcsInSector.forEach((wc, i) => {
      let wcHours: number;
      if (i === wcsInSector.length - 1) {
        wcHours = Math.max(0, targetSectorHours - sumAllocated);
      } else {
        const sh = updatedShares[wc.id] || 0;
        wcHours = Math.round(targetSectorHours * (sh / totalShareSum));
        sumAllocated += wcHours;
      }

      existingWcHours[wc.id] = wcHours;
      existingWcHours[wc.name] = wcHours;
    });
  }

  // Calculate new total project hours
  const newTotalHours = Object.entries(existingWcHours).reduce((sum, [k, h]) => {
    const isWcId = workCenters.some((wc) => wc.id === k);
    if (isWcId) {
      return sum + (typeof h === 'number' && !isNaN(h) ? h : 0);
    }
    return sum;
  }, 0) || targetSectorHours || projectRefHours;

  const finalSectorConfig: SectorCurveConfig = {
    ...updatedConfig,
    percentage: pct,
    volumeGain: gain,
    customWorkCenterShares: updatedShares,
  };

  return {
    updatedSectorConfig: finalSectorConfig,
    updatedWorkCenterHours: existingWcHours,
    newTotalHours,
  };
}

/**
 * Recalculates sector configuration and work center hours when hours are edited directly.
 */
export function recalculateSectorDirectHours({
  sectorName,
  newHours,
  currentConfig,
  workCenters,
}: {
  sectorName: string;
  newHours: number;
  currentConfig: TurbineProjectConfig;
  workCenters: WorkCenter[];
}): {
  updatedSectorConfig: SectorCurveConfig;
  updatedWorkCenterHours: Record<string, number>;
  newTotalHours: number;
} {
  const normSector = sectorName.trim().toUpperCase();
  const wcsInSector = workCenters.filter(
    (wc) => getWorkCenterCategory(wc) === normSector
  );

  const existingWcHours: Record<string, number> = currentConfig.customWorkCenterHours
    ? { ...currentConfig.customWorkCenterHours }
    : {};

  const currentSectorCfg = currentConfig.customSectorCurves?.[sectorName] || {
    sectorName,
    percentage: 10,
    startPct: 10,
    endPct: 60,
    curveShape: 's-curve' as const,
    volumeGain: 1.0,
  };

  const gain = currentSectorCfg.volumeGain || 1.0;
  const safeHours = Math.max(0, isNaN(newHours) ? 0 : newHours);

  // Project reference hours
  const sumExistingHours = Object.entries(existingWcHours).reduce((sum, [k, h]) => {
    const isWcId = workCenters.some((wc) => wc.id === k);
    if (isWcId) {
      return sum + (typeof h === 'number' && !isNaN(h) ? h : 0);
    }
    return sum;
  }, 0);

  const projectRefHours = Math.max(
    1000,
    currentConfig.totalHours ||
      sumExistingHours ||
      (currentConfig.hoursPerTurbine || 10000) * (currentConfig.quantity || 1)
  );

  const newPct = projectRefHours > 0 ? Math.round((safeHours * 100) / (projectRefHours * gain)) : 0;

  // Determine shares
  const shares = { ...(currentSectorCfg.customWorkCenterShares || {}) };
  let sumShares = 0;
  wcsInSector.forEach((wc) => {
    const s = shares[wc.id] ?? shares[wc.name];
    if (typeof s === 'number' && !isNaN(s) && s > 0) sumShares += s;
  });

  const updatedShares: Record<string, number> = {};
  if (wcsInSector.length > 0) {
    if (sumShares > 0 && safeHours > 0) {
      wcsInSector.forEach((wc) => {
        const rawShare = shares[wc.id] ?? shares[wc.name] ?? 0;
        updatedShares[wc.id] = Math.round((rawShare / sumShares) * 100);
      });
    } else {
      const n = wcsInSector.length;
      const base = Math.floor(100 / n);
      const rem = 100 % n;
      wcsInSector.forEach((wc, i) => {
        updatedShares[wc.id] = base + (i < rem ? 1 : 0);
      });
    }

    let sumAllocated = 0;
    const totalShareSum = wcsInSector.reduce((sum, wc) => sum + (updatedShares[wc.id] || 0), 0) || 100;

    wcsInSector.forEach((wc, i) => {
      let wcHours: number;
      if (i === wcsInSector.length - 1) {
        wcHours = Math.max(0, safeHours - sumAllocated);
      } else {
        const sh = updatedShares[wc.id] || 0;
        wcHours = Math.round(safeHours * (sh / totalShareSum));
        sumAllocated += wcHours;
      }
      existingWcHours[wc.id] = wcHours;
      existingWcHours[wc.name] = wcHours;
    });
  }

  const newTotalHours = Object.entries(existingWcHours).reduce((sum, [k, h]) => {
    const isWcId = workCenters.some((wc) => wc.id === k);
    if (isWcId) return sum + (typeof h === 'number' && !isNaN(h) ? h : 0);
    return sum;
  }, 0) || safeHours || projectRefHours;

  const updatedSectorConfig: SectorCurveConfig = {
    ...currentSectorCfg,
    percentage: Math.min(100, Math.max(0, newPct)),
    customWorkCenterShares: updatedShares,
  };

  return {
    updatedSectorConfig,
    updatedWorkCenterHours: existingWcHours,
    newTotalHours,
  };
}
