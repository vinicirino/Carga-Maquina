import {
  parseISO,
  differenceInCalendarDays,
  addWeeks,
  startOfWeek,
  endOfWeek,
  isBefore,
  isAfter,
  isSameDay,
  format,
  min as minDate,
  max as maxDate,
  addDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getWorkCenterCategory } from './categoryHelper';
import {
  WorkCenter,
  Project,
  WeeklyBucket,
  WorkCenterCapacitySummary,
  OverloadAlert,
  SystemRecommendation,
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

export function generateWeeklySchedule(
  projects: Project[],
  workCenters: WorkCenter[]
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

  if (activeProjects.length === 0 || workCenters.length === 0) {
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

  // 1. Find min start date and max end date among active projects
  let globalStart = parseISO(activeProjects[0].startDate);
  let globalEnd = parseISO(activeProjects[0].endDate);

  for (const p of activeProjects) {
    const pStart = parseISO(p.startDate);
    const pEnd = parseISO(p.endDate);
    if (isBefore(pStart, globalStart)) globalStart = pStart;
    if (isAfter(pEnd, globalEnd)) globalEnd = pEnd;
  }

  // Align globalStart to beginning of that week (Monday)
  const firstWeekStart = startOfWeek(globalStart, { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(globalEnd, { weekStartsOn: 1 });

  // 2. Build weekly buckets
  const weeklyBuckets: WeeklyBucket[] = [];
  let currWeekStart = firstWeekStart;

  while (isBefore(currWeekStart, lastWeekEnd) || isSameDay(currWeekStart, lastWeekEnd)) {
    const currWeekEnd = endOfWeek(currWeekStart, { weekStartsOn: 1 });
    const weekLabel = `Sem. ${format(currWeekStart, 'ww/yyyy')} (${format(currWeekStart, 'dd/MM/yy')} - ${format(currWeekEnd, 'dd/MM/yy')})`;
    const weekKey = format(currWeekStart, 'yyyy-MM-dd');

    weeklyBuckets.push({
      weekKey,
      startDate: currWeekStart,
      endDate: currWeekEnd,
      label: weekLabel,
      workCenterLoads: {},
      projectBreakdown: {},
    });

    currWeekStart = addWeeks(currWeekStart, 1);
  }

  // 3. Distribute project hours across weeks
  for (const project of activeProjects) {
    const pStart = parseISO(project.startDate);
    const pEnd = parseISO(project.endDate);

    for (const [wcNameOrId, totalHours] of Object.entries(project.workCenterHours)) {
      if (!totalHours || totalHours <= 0) continue;

      // Match work center by ID or Name
      const wc = workCenters.find((w) => w.id === wcNameOrId || w.name === wcNameOrId);
      if (!wc) continue;

      // 1. Check specific dates for this work center
      let customDates =
        project.workCenterDates?.[wcNameOrId] ||
        project.workCenterDates?.[wc.id] ||
        project.workCenterDates?.[wc.name];

      // 2. If no specific work center date, check for Sector Group dates (e.g. CORTE, USINAGEM, SOLDA)
      if (!customDates?.startDate && !customDates?.endDate) {
        const wcCategory = getWorkCenterCategory(wc);
        customDates =
          project.groupDates?.[wcCategory] ||
          project.workCenterDates?.[wcCategory];
      }

      let wcStart = customDates?.startDate ? parseISO(customDates.startDate) : pStart;
      let wcEnd = customDates?.endDate ? parseISO(customDates.endDate) : pEnd;

      // Ensure custom dates stay strictly within the global project timeframe [pStart, pEnd]
      if (isBefore(wcStart, pStart)) wcStart = pStart;
      if (isAfter(wcStart, pEnd)) wcStart = pEnd;
      if (isAfter(wcEnd, pEnd)) wcEnd = pEnd;
      if (isBefore(wcEnd, pStart)) wcEnd = pStart;

      if (isAfter(wcStart, wcEnd)) {
        wcEnd = wcStart;
      }

      const totalWcDays = Math.max(1, differenceInCalendarDays(wcEnd, wcStart) + 1);

      for (const bucket of weeklyBuckets) {
        // Check overlap between bucket week and work center load timeframe
        if (isAfter(bucket.startDate, wcEnd) || isBefore(bucket.endDate, wcStart)) {
          continue;
        }

        // Calculate overlap days
        const overlapStart = maxDate([bucket.startDate, wcStart]);
        const overlapEnd = minDate([bucket.endDate, wcEnd]);
        const overlapDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);

        if (overlapDays <= 0) continue;

        // Fraction of work center load executed in this week
        const weekFraction = overlapDays / totalWcDays;
        const hoursInThisWeek = totalHours * weekFraction;

        // Add to bucket load
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

  for (const wc of workCenters) {
    const weeklyCap = calculateWeeklyCapacity(wc);
    const dailyCap = calculateDailyCapacity(wc);
    totalCapacityAllCentersWeekly += weeklyCap;

    let wcTotalRequiredHours = 0;
    let peakWeeklyLoad = 0;
    let sumWeeklyUtilization = 0;
    let overloadedWeeksForThisWc = 0;

    // Sum total required hours for this work center across all active projects
    for (const proj of activeProjects) {
      const hrs = proj.workCenterHours[wc.id] || proj.workCenterHours[wc.name] || 0;
      wcTotalRequiredHours += hrs;
    }
    totalDemandAllCenters += wcTotalRequiredHours;

    // Evaluate each weekly bucket for this WC
    for (const bucket of weeklyBuckets) {
      const load = bucket.workCenterLoads[wc.id] || 0;

      if (load > peakWeeklyLoad) {
        peakWeeklyLoad = load;
      }

      const util = weeklyCap > 0 ? (load / weeklyCap) * 100 : 0;
      sumWeeklyUtilization += util;

      if (load > weeklyCap + 0.01) {
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

        overloadAlerts.push({
          workCenterId: wc.id,
          workCenterName: wc.name,
          weekKey: bucket.weekKey,
          weekLabel: bucket.label,
          capacityHours: weeklyCap,
          demandedHours: load,
          excessHours: load - weeklyCap,
          utilizationPercentage: util,
          contributingProjects: contributing,
        });
      }
    }

    const avgUtil =
      weeklyBuckets.length > 0 ? sumWeeklyUtilization / weeklyBuckets.length : 0;
    const maxUtil = weeklyCap > 0 ? (peakWeeklyLoad / weeklyCap) * 100 : 0;

    let status: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
    if (maxUtil > 120 || overloadedWeeksForThisWc > 2) {
      status = 'CRITICAL';
    } else if (maxUtil > 100 || avgUtil > 85) {
      status = 'WARNING';
    }

    workCenterSummaries.push({
      workCenter: wc,
      totalRequiredHours: wcTotalRequiredHours,
      weeklyCapacity: weeklyCap,
      dailyCapacity: dailyCap,
      peakWeeklyLoad,
      maxUtilizationPercentage: maxUtil,
      averageUtilizationPercentage: avgUtil,
      overloadedWeeksCount: overloadedWeeksForThisWc,
      status,
    });

    // Generate recommendation if overloaded
    if (peakWeeklyLoad > weeklyCap && weeklyCap > 0) {
      const singleResourceWeeklyCap = wc.dailyHours * wc.daysPerWeek * (wc.efficiencyPercentage / 100);
      const neededResources = Math.ceil(peakWeeklyLoad / singleResourceWeeklyCap);

      recommendations.push({
        workCenterId: wc.id,
        workCenterName: wc.name,
        currentResources: wc.resourcesCount,
        recommendedResources: Math.max(wc.resourcesCount + 1, neededResources),
        peakOverloadHours: peakWeeklyLoad - weeklyCap,
        maxUtilization: maxUtil,
        reason: `Carga máxima semanal de ${peakWeeklyLoad.toFixed(1)}h excede a capacidade instalada (${weeklyCap.toFixed(1)}h) em ${(
          peakWeeklyLoad - weeklyCap
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
