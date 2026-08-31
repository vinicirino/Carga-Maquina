import {
  parseISO,
  differenceInCalendarDays,
  addWeeks,
  addDays,
  startOfWeek,
  endOfWeek,
  format,
} from 'date-fns';
import { getWorkCenterCategory } from './categoryHelper';
import {
  WorkCenter,
  Project,
  WeeklyBucket,
  WorkCenterCapacitySummary,
  OverloadAlert,
  SystemRecommendation,
  CalendarException,
} from '../types';

export function calculateWeeklyCapacity(wc: WorkCenter): number {
  return (
    wc.dailyHours *
    wc.daysPerWeek *
    wc.resourcesCount *
    (wc.efficiencyPercentage / 100)
  );
}

export function calculateDailyCapacity(wc: WorkCenter): number {
  return wc.dailyHours * wc.resourcesCount * (wc.efficiencyPercentage / 100);
}

/**
 * Calculates effective weekly capacity for a specific work center during a specific week bucket,
 * taking into account holidays, vacations, and maintenance downtimes.
 */
export function calculateEffectiveWeeklyCapacityForBucket(
  wc: WorkCenter,
  bucketStart: Date,
  calendarExceptions: CalendarException[] = []
): {
  effectiveCapacity: number;
  effectiveWorkDays: number;
  activeExceptions: CalendarException[];
} {
  const dailyCap = calculateDailyCapacity(wc);
  const workDaysPerWeek = Math.max(1, Math.min(7, wc.daysPerWeek || 5));
  let effectiveWorkDays = 0;
  const activeExceptionsSet = new Map<string, CalendarException>();

  // Gather all exceptions relevant to this work center (both scenario-wide and WC-specific)
  const allExceptions = [
    ...calendarExceptions,
    ...(wc.calendarExceptions || []),
  ];

  for (let dayOffset = 0; dayOffset < workDaysPerWeek; dayOffset++) {
    const currentDay = addDays(bucketStart, dayOffset);
    const dayStr = format(currentDay, 'yyyy-MM-dd');
    let dayFactor = 1.0;

    for (const ex of allExceptions) {
      if (!ex.startDate || !ex.endDate) continue;

      // Check if exception applies to this work center (empty/undefined = global)
      const appliesToWc =
        !ex.workCenterIds ||
        ex.workCenterIds.length === 0 ||
        ex.workCenterIds.includes(wc.id) ||
        ex.workCenterIds.includes(wc.name);

      if (!appliesToWc) continue;

      if (dayStr >= ex.startDate && dayStr <= ex.endDate) {
        activeExceptionsSet.set(ex.id, ex);
        if (ex.impactType === 'full_closure') {
          dayFactor = 0;
          break; // Day completely closed
        } else if (ex.impactType === 'capacity_reduction') {
          const reduction = (ex.capacityReductionPercentage || 0) / 100;
          const factor = Math.max(0, 1 - reduction);
          if (factor < dayFactor) {
            dayFactor = factor;
          }
        }
      }
    }

    effectiveWorkDays += dayFactor;
  }

  const effectiveCapacity = effectiveWorkDays * dailyCap;

  return {
    effectiveCapacity,
    effectiveWorkDays,
    activeExceptions: Array.from(activeExceptionsSet.values()),
  };
}

/**
 * Calculates total allocated hours for a specific work center across active projects.
 * Returns 0 if the work center has no hours assigned in any active project.
 */
export function getWorkCenterAllocatedHours(wc: WorkCenter, projects: Project[]): number {
  const activeProjects = projects.filter((p) => p.enabled !== false);
  let totalHours = 0;
  const wcNorm = wc.name.trim().toUpperCase();

  for (const proj of activeProjects) {
    if (!proj.workCenterHours) continue;
    let hrs = 0;
    if (typeof proj.workCenterHours[wc.id] === 'number' && !isNaN(proj.workCenterHours[wc.id])) {
      hrs = proj.workCenterHours[wc.id];
    } else if (typeof proj.workCenterHours[wc.name] === 'number' && !isNaN(proj.workCenterHours[wc.name])) {
      hrs = proj.workCenterHours[wc.name];
    } else {
      for (const [k, v] of Object.entries(proj.workCenterHours)) {
        if (typeof v === 'number' && !isNaN(v) && k.trim().toUpperCase() === wcNorm) {
          hrs = v;
          break;
        }
      }
    }
    if (hrs > 0) {
      totalHours += hrs;
    }
  }

  return totalHours;
}

const MS_PER_DAY = 86400000;

export function generateWeeklySchedule(
  projects: Project[],
  workCenters: WorkCenter[],
  calendarExceptions: CalendarException[] = []
): {
  weeklyBuckets: WeeklyBucket[];
  workCenterSummaries: WorkCenterCapacitySummary[];
  overloadAlerts: OverloadAlert[];
  recommendations: SystemRecommendation[];
  kpis: {
    totalRequiredHours: number;
    totalWeeklyCapacity: number;
    overloadedWorkCentersCount: number;
    overallUtilizationPercentage: number;
    overloadedWeeksCount: number;
    timeframeStart: string;
    timeframeEnd: string;
  };
} {
  const activeProjects = projects.filter((p) => p.enabled !== false);
  const enabledWorkCenters = workCenters.filter((wc) => wc.enabled !== false);

  // Filter: In this scenario, only work centers that are actively utilized in projects (hours > 0)
  // are accounted for, listed and displayed in charts & sector groupers.
  const activeWorkCenters = enabledWorkCenters.filter(
    (wc) => getWorkCenterAllocatedHours(wc, activeProjects) > 0
  );

  if (activeProjects.length === 0 || activeWorkCenters.length === 0) {
    return {
      weeklyBuckets: [],
      workCenterSummaries: [],
      overloadAlerts: [],
      recommendations: [],
      kpis: {
        totalRequiredHours: 0,
        totalWeeklyCapacity: 0,
        overloadedWorkCentersCount: 0,
        overallUtilizationPercentage: 0,
        overloadedWeeksCount: 0,
        timeframeStart: '-',
        timeframeEnd: '-',
      },
    };
  }

  // Pre-index active work centers for O(1) lookup
  const wcById = new Map<string, WorkCenter>();
  const wcByName = new Map<string, WorkCenter>();
  const wcCategoryMap = new Map<string, string>();
  const wcWeeklyCapMap = new Map<string, number>();
  const wcDailyCapMap = new Map<string, number>();

  for (const wc of activeWorkCenters) {
    wcById.set(wc.id, wc);
    wcByName.set(wc.name, wc);
    wcCategoryMap.set(wc.id, getWorkCenterCategory(wc));
    wcWeeklyCapMap.set(wc.id, calculateWeeklyCapacity(wc));
    wcDailyCapMap.set(wc.id, calculateDailyCapacity(wc));
  }

  // 1. Find min start date and max end date among active projects (including groupDates & workCenterDates)
  let minStartMs = Number.MAX_SAFE_INTEGER;
  let maxEndMs = Number.MIN_SAFE_INTEGER;
  let globalStart = parseISO(activeProjects[0].startDate);
  let globalEnd = parseISO(activeProjects[0].endDate);

  // Pre-parse project dates
  const parsedProjects = activeProjects.map((p) => {
    let pStart = parseISO(p.startDate);
    let pEnd = parseISO(p.endDate);
    let pStartMs = pStart.getTime();
    let pEndMs = pEnd.getTime();

    // Account for any customized groupDates or workCenterDates expanding the schedule window
    if (p.groupDates) {
      for (const val of Object.values(p.groupDates)) {
        if (!val) continue;
        if (val.startDate) {
          const s = parseISO(val.startDate);
          const sMs = s.getTime();
          if (!isNaN(sMs) && sMs < pStartMs) {
            pStartMs = sMs;
            pStart = s;
          }
        }
        if (val.endDate) {
          const e = parseISO(val.endDate);
          const eMs = e.getTime();
          if (!isNaN(eMs) && eMs > pEndMs) {
            pEndMs = eMs;
            pEnd = e;
          }
        }
      }
    }

    if (p.workCenterDates) {
      for (const val of Object.values(p.workCenterDates)) {
        if (!val) continue;
        if (val.startDate) {
          const s = parseISO(val.startDate);
          const sMs = s.getTime();
          if (!isNaN(sMs) && sMs < pStartMs) {
            pStartMs = sMs;
            pStart = s;
          }
        }
        if (val.endDate) {
          const e = parseISO(val.endDate);
          const eMs = e.getTime();
          if (!isNaN(eMs) && eMs > pEndMs) {
            pEndMs = eMs;
            pEnd = e;
          }
        }
      }
    }

    if (pStartMs < minStartMs) {
      minStartMs = pStartMs;
      globalStart = pStart;
    }
    if (pEndMs > maxEndMs) {
      maxEndMs = pEndMs;
      globalEnd = pEnd;
    }

    return {
      project: p,
      pStart,
      pEnd,
      pStartMs,
      pEndMs,
    };
  });

  // Align globalStart to beginning of that week (Monday)
  const firstWeekStart = startOfWeek(globalStart, { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(globalEnd, { weekStartsOn: 1 });

  // 2. Build weekly buckets with precalculated timestamp ranges and effective capacities
  interface FastBucket extends WeeklyBucket {
    startMs: number;
    endMs: number;
  }

  const weeklyBuckets: FastBucket[] = [];
  let currWeekStart = firstWeekStart;
  const lastWeekEndMs = lastWeekEnd.getTime();

  while (currWeekStart.getTime() <= lastWeekEndMs) {
    const currWeekEnd = endOfWeek(currWeekStart, { weekStartsOn: 1 });
    const weekLabel = `Sem. ${format(currWeekStart, 'ww/yyyy')} (${format(currWeekStart, 'dd/MM/yy')} - ${format(currWeekEnd, 'dd/MM/yy')})`;
    const weekKey = format(currWeekStart, 'yyyy-MM-dd');

    const bucketCapacities: Record<string, number> = {};
    const bucketWorkDays: Record<string, number> = {};
    const bucketActiveExceptions: CalendarException[] = [];
    const seenExceptionIds = new Set<string>();

    for (const wc of activeWorkCenters) {
      const { effectiveCapacity, effectiveWorkDays, activeExceptions } =
        calculateEffectiveWeeklyCapacityForBucket(wc, currWeekStart, calendarExceptions);

      bucketCapacities[wc.id] = effectiveCapacity;
      bucketWorkDays[wc.id] = effectiveWorkDays;

      for (const ex of activeExceptions) {
        if (!seenExceptionIds.has(ex.id)) {
          seenExceptionIds.add(ex.id);
          bucketActiveExceptions.push(ex);
        }
      }
    }

    weeklyBuckets.push({
      weekKey,
      startDate: currWeekStart,
      endDate: currWeekEnd,
      startMs: currWeekStart.getTime(),
      endMs: currWeekEnd.getTime(),
      label: weekLabel,
      workCenterLoads: {},
      workCenterCapacities: bucketCapacities,
      effectiveWorkDays: bucketWorkDays,
      activeHolidays: bucketActiveExceptions,
      projectBreakdown: {},
    });

    currWeekStart = addWeeks(currWeekStart, 1);
  }

  // 3. Distribute project hours across weeks using fast timestamp math
  for (const { project, pStart, pEnd, pStartMs, pEndMs } of parsedProjects) {
    if (!project.workCenterHours) continue;

    // Build canonical map of work center -> hours for this project (strict O(N) with NO double counting)
    const canonicalWcHours = new Map<string, { wc: WorkCenter; hours: number }>();
    const seenWcIds = new Set<string>();

    // Pass 1: Match by exact WC ID
    for (const wc of activeWorkCenters) {
      const valById = project.workCenterHours[wc.id];
      if (typeof valById === 'number' && !isNaN(valById) && valById > 0) {
        canonicalWcHours.set(wc.id, { wc, hours: valById });
        seenWcIds.add(wc.id);
      }
    }

    // Pass 2: Match by exact WC Name (only if not already found by ID)
    for (const wc of activeWorkCenters) {
      if (seenWcIds.has(wc.id)) continue;
      const valByName = project.workCenterHours[wc.name];
      if (typeof valByName === 'number' && !isNaN(valByName) && valByName > 0) {
        canonicalWcHours.set(wc.id, { wc, hours: valByName });
        seenWcIds.add(wc.id);
      }
    }

    // Pass 3: Case-insensitive / Trim match for any remaining active work centers
    for (const wc of activeWorkCenters) {
      if (seenWcIds.has(wc.id)) continue;
      const wcNorm = wc.name.trim().toUpperCase();
      for (const [key, hrs] of Object.entries(project.workCenterHours)) {
        if (typeof hrs === 'number' && !isNaN(hrs) && hrs > 0 && key.trim().toUpperCase() === wcNorm) {
          canonicalWcHours.set(wc.id, { wc, hours: hrs });
          seenWcIds.add(wc.id);
          break;
        }
      }
    }

    if (canonicalWcHours.size === 0) continue;

    for (const { wc, hours: totalHours } of canonicalWcHours.values()) {
      // 1. Check specific dates for this work center
      let customDates =
        project.workCenterDates?.[wc.id] ||
        project.workCenterDates?.[wc.name];

      // 2. If no specific work center date, check for Sector Group dates
      if (!customDates?.startDate && !customDates?.endDate) {
        const wcCategory = wcCategoryMap.get(wc.id) || getWorkCenterCategory(wc);
        customDates =
          project.groupDates?.[wcCategory] ||
          project.workCenterDates?.[wcCategory];
      }

      let wcStartMs = pStartMs;
      let wcEndMs = pEndMs;

      if (customDates?.startDate) {
        const parsed = parseISO(customDates.startDate).getTime();
        if (!isNaN(parsed)) {
          wcStartMs = parsed;
        }
      }
      if (customDates?.endDate) {
        const parsed = parseISO(customDates.endDate).getTime();
        if (!isNaN(parsed)) {
          wcEndMs = parsed;
        }
      }

      if (wcStartMs > wcEndMs) {
        wcEndMs = wcStartMs;
      }

      const totalWcDays = Math.max(1, Math.round((wcEndMs - wcStartMs) / MS_PER_DAY) + 1);

      // Gather all calendar exceptions relevant to this work center
      const allWcExceptions = [
        ...calendarExceptions,
        ...(wc.calendarExceptions || []),
      ];

      const workDaysPerWeek = Math.max(1, Math.min(7, wc.daysPerWeek || 5));

      // Calculate effective working day factor for each day in [wcStart, wcEnd]
      // Days on full_closure or holidays or weekends receive 0 work weight
      let totalEffectiveWorkWeight = 0;
      const bucketWorkWeights: number[] = new Array(weeklyBuckets.length).fill(0);

      const wcStartDateObj = new Date(wcStartMs);

      for (let dayIdx = 0; dayIdx < totalWcDays; dayIdx++) {
        const curDay = addDays(wcStartDateObj, dayIdx);
        const curDayMs = curDay.getTime();
        const curDayStr = format(curDay, 'yyyy-MM-dd');
        const dayOfWeek = curDay.getDay(); // 0 = Sunday, 1 = Mon, ..., 6 = Sat

        // Check if working day based on daysPerWeek (1=Mon..5=Fri, 6=Sat, 7=Sun)
        let isStandardWorkDay = false;
        if (workDaysPerWeek <= 5) {
          isStandardWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;
        } else if (workDaysPerWeek === 6) {
          isStandardWorkDay = dayOfWeek >= 1 && dayOfWeek <= 6;
        } else {
          isStandardWorkDay = true;
        }

        let dayFactor = isStandardWorkDay ? 1.0 : 0;

        if (dayFactor > 0) {
          for (const ex of allWcExceptions) {
            if (!ex.startDate || !ex.endDate) continue;
            const appliesToWc =
              !ex.workCenterIds ||
              ex.workCenterIds.length === 0 ||
              ex.workCenterIds.includes(wc.id) ||
              ex.workCenterIds.includes(wc.name);

            if (!appliesToWc) continue;

            if (curDayStr >= ex.startDate && curDayStr <= ex.endDate) {
              if (ex.impactType === 'full_closure') {
                dayFactor = 0;
                break; // Completely stopped day
              } else if (ex.impactType === 'capacity_reduction') {
                const reduction = (ex.capacityReductionPercentage || 0) / 100;
                const factor = Math.max(0, 1 - reduction);
                if (factor < dayFactor) {
                  dayFactor = factor;
                }
              }
            }
          }
        }

        totalEffectiveWorkWeight += dayFactor;

        // Find which weekly bucket this day falls into
        for (let b = 0; b < weeklyBuckets.length; b++) {
          const bkt = weeklyBuckets[b];
          if (curDayMs >= bkt.startMs && curDayMs <= bkt.endMs + 86399999) {
            bucketWorkWeights[b] += dayFactor;
            break;
          }
        }
      }

      for (let b = 0; b < weeklyBuckets.length; b++) {
        const bucket = weeklyBuckets[b];
        // Fast bounds check
        if (bucket.startMs > wcEndMs || bucket.endMs < wcStartMs) {
          continue;
        }

        let hoursInThisWeek = 0;
        if (totalEffectiveWorkWeight > 0) {
          const weekWeight = bucketWorkWeights[b] || 0;
          if (weekWeight <= 0) continue; // 0 hours in holiday / vacation full closure weeks!
          hoursInThisWeek = totalHours * (weekWeight / totalEffectiveWorkWeight);
        } else {
          // Fallback if entire project was scheduled during 100% shutdown
          const overlapStart = Math.max(bucket.startMs, wcStartMs);
          const overlapEnd = Math.min(bucket.endMs, wcEndMs);
          const overlapDays = Math.max(0, Math.round((overlapEnd - overlapStart) / MS_PER_DAY) + 1);
          if (overlapDays <= 0) continue;
          hoursInThisWeek = totalHours * (overlapDays / totalWcDays);
        }

        if (hoursInThisWeek <= 0) continue;

        bucket.workCenterLoads[wc.id] = (bucket.workCenterLoads[wc.id] || 0) + hoursInThisWeek;

        if (!bucket.projectBreakdown[wc.id]) {
          bucket.projectBreakdown[wc.id] = {};
        }
        bucket.projectBreakdown[wc.id][project.id] =
          (bucket.projectBreakdown[wc.id][project.id] || 0) + hoursInThisWeek;
      }
    }
  }

  // 4. Analyze Work Center Capacity, Overloads and Recommendations
  const workCenterSummaries: WorkCenterCapacitySummary[] = [];
  const overloadAlerts: OverloadAlert[] = [];
  const recommendations: SystemRecommendation[] = [];

  let totalDemandAllCenters = 0;
  let totalCapacityAllCentersWeekly = 0;
  const overloadedWorkCenterSet = new Set<string>();
  const overloadedWeekSet = new Set<string>();

  for (const wc of activeWorkCenters) {
    const standardWeeklyCap = calculateWeeklyCapacity(wc);
    const dailyCap = calculateDailyCapacity(wc);
    totalCapacityAllCentersWeekly += standardWeeklyCap;

    let wcTotalRequiredHours = 0;
    let peakWeeklyLoad = 0;
    let sumWeeklyUtilization = 0;
    let overloadedWeeksForThisWc = 0;

    // Sum total required hours for this work center across all active projects with exact deduplication
    for (const proj of activeProjects) {
      if (!proj.workCenterHours) continue;
      let hrs = 0;
      if (typeof proj.workCenterHours[wc.id] === 'number' && !isNaN(proj.workCenterHours[wc.id])) {
        hrs = proj.workCenterHours[wc.id];
      } else if (typeof proj.workCenterHours[wc.name] === 'number' && !isNaN(proj.workCenterHours[wc.name])) {
        hrs = proj.workCenterHours[wc.name];
      } else {
        const wcNorm = wc.name.trim().toUpperCase();
        for (const [k, v] of Object.entries(proj.workCenterHours)) {
          if (typeof v === 'number' && !isNaN(v) && k.trim().toUpperCase() === wcNorm) {
            hrs = v;
            break;
          }
        }
      }
      if (hrs > 0) {
        wcTotalRequiredHours += hrs;
      }
    }
    totalDemandAllCenters += wcTotalRequiredHours;

    // Evaluate each weekly bucket for this WC
    for (const bucket of weeklyBuckets) {
      const load = bucket.workCenterLoads[wc.id] || 0;
      const effectiveCap = bucket.workCenterCapacities?.[wc.id] ?? standardWeeklyCap;

      if (load > peakWeeklyLoad) {
        peakWeeklyLoad = load;
      }

      const util = effectiveCap > 0 ? (load / effectiveCap) * 100 : (load > 0 ? 999 : 0);
      sumWeeklyUtilization += util;

      if (load > effectiveCap + 0.01) {
        overloadedWeeksForThisWc++;
        overloadedWorkCenterSet.add(wc.id);
        overloadedWeekSet.add(bucket.weekKey);

        // Contributing projects breakdown for alert detail
        const contributing = Object.entries(bucket.projectBreakdown[wc.id] || {}).map(
          ([pId, pCost]) => {
            const p = activeProjects.find((p) => p.id === pId);
            return {
              projectId: pId,
              projectName: p ? p.name : pId,
              hours: pCost,
            };
          }
        );

        const affectedByHolidays = effectiveCap < standardWeeklyCap;
        const holidayNames = (bucket.activeHolidays || []).map((h) => h.title);

        overloadAlerts.push({
          workCenterId: wc.id,
          workCenterName: wc.name,
          weekKey: bucket.weekKey,
          weekLabel: bucket.label,
          capacityHours: effectiveCap,
          demandedHours: load,
          excessHours: load - effectiveCap,
          utilizationPercentage: util,
          contributingProjects: contributing,
          affectedByHolidays,
          holidayNames: holidayNames.length > 0 ? holidayNames : undefined,
        });
      }
    }

    const avgUtil =
      weeklyBuckets.length > 0 ? sumWeeklyUtilization / weeklyBuckets.length : 0;
    const maxUtil = standardWeeklyCap > 0 ? (peakWeeklyLoad / standardWeeklyCap) * 100 : 0;

    let status: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
    if (maxUtil > 120 || overloadedWeeksForThisWc > 2) {
      status = 'CRITICAL';
    } else if (maxUtil > 100 || avgUtil > 85) {
      status = 'WARNING';
    }

    workCenterSummaries.push({
      workCenter: wc,
      totalRequiredHours: wcTotalRequiredHours,
      weeklyCapacity: standardWeeklyCap,
      dailyCapacity: dailyCap,
      peakWeeklyLoad,
      maxUtilizationPercentage: maxUtil,
      averageUtilizationPercentage: avgUtil,
      overloadedWeeksCount: overloadedWeeksForThisWc,
      status,
    });

    // Generate recommendation if overloaded
    if (peakWeeklyLoad > standardWeeklyCap && standardWeeklyCap > 0) {
      const singleResourceWeeklyCap = wc.dailyHours * wc.daysPerWeek * (wc.efficiencyPercentage / 100);
      const neededResources = Math.ceil(peakWeeklyLoad / singleResourceWeeklyCap);

      recommendations.push({
        workCenterId: wc.id,
        workCenterName: wc.name,
        currentResources: wc.resourcesCount,
        recommendedResources: Math.max(wc.resourcesCount + 1, neededResources),
        peakOverloadHours: peakWeeklyLoad - standardWeeklyCap,
        maxUtilization: maxUtil,
        reason: `Carga máxima semanal de ${peakWeeklyLoad.toFixed(1)}h excede a capacidade instalada padrão (${standardWeeklyCap.toFixed(1)}h) em ${(
          peakWeeklyLoad - standardWeeklyCap
        ).toFixed(1)}h.`,
      });
    }
  }

  const overallUtilization =
    weeklyBuckets.length > 0 && totalCapacityAllCentersWeekly > 0
      ? (totalDemandAllCenters / (totalCapacityAllCentersWeekly * weeklyBuckets.length)) * 100
      : 0;

  return {
    weeklyBuckets,
    workCenterSummaries,
    overloadAlerts,
    recommendations,
    kpis: {
      totalRequiredHours: totalDemandAllCenters,
      totalWeeklyCapacity: totalCapacityAllCentersWeekly,
      overloadedWorkCentersCount: overloadedWorkCenterSet.size,
      overallUtilizationPercentage: overallUtilization,
      overloadedWeeksCount: overloadedWeekSet.size,
      timeframeStart: format(globalStart, 'dd/MM/yyyy'),
      timeframeEnd: format(globalEnd, 'dd/MM/yyyy'),
    },
  };
}

