import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  WorkCenter,
  WorkCenterCapacitySummary,
  SectorGroupSummary,
  WeeklyBucket,
  Project,
  DEFAULT_SECTOR_GROUPS,
} from '../types';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import { calculateWeeklyCapacity, generateWeeklySchedule } from '../utils/calculator';
import { getProjectTotalHours } from '../utils/dateValidation';
import { parseISO, format, addDays, differenceInCalendarDays, isAfter } from 'date-fns';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Users,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  BarChart3,
  FolderTree,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Calendar,
  MoveHorizontal,
  RotateCcw,
  Save,
  Check,
  TrendingDown,
  TrendingUp,
  Printer,
  Cpu,
  Factory,
  X,
  Sliders,
  Flame,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts';

interface WorkCenterAnalysisProps {
  workCenters: WorkCenter[];
  summaries: WorkCenterCapacitySummary[];
  weeklyBuckets: WeeklyBucket[];
  projects: Project[];
  sectorGroups?: string[];
  initialSectorFilter?: string;
  initialWcId?: string;
  onUpdateWorkCenter: (updated: WorkCenter) => void;
  onUpdateProject?: (updated: Project) => void;
  onSelectWorkCenterForSimulation?: (wcId: string) => void;
  onOpenPrintReportModal?: () => void;
}

/**
 * Helper to shift an entire project's timeline (including work center and sector group custom dates)
 */
function shiftProjectDates(project: Project, offsetDays: number): Project {
  if (!offsetDays || offsetDays === 0) return project;
  try {
    const sDate = parseISO(project.startDate);
    const eDate = parseISO(project.endDate);
    const newStartDate = format(addDays(sDate, offsetDays), 'yyyy-MM-dd');
    const newEndDate = format(addDays(eDate, offsetDays), 'yyyy-MM-dd');

    let newWcDates: Record<string, { startDate?: string; endDate?: string }> | undefined = undefined;
    if (project.workCenterDates) {
      newWcDates = {};
      for (const [key, val] of Object.entries(project.workCenterDates)) {
        if (!val) continue;
        newWcDates[key] = {
          startDate: val.startDate ? format(addDays(parseISO(val.startDate), offsetDays), 'yyyy-MM-dd') : undefined,
          endDate: val.endDate ? format(addDays(parseISO(val.endDate), offsetDays), 'yyyy-MM-dd') : undefined,
        };
      }
    }

    let newGroupDates: Record<string, { startDate?: string; endDate?: string }> | undefined = undefined;
    if (project.groupDates) {
      newGroupDates = {};
      for (const [key, val] of Object.entries(project.groupDates)) {
        if (!val) continue;
        newGroupDates[key] = {
          startDate: val.startDate ? format(addDays(parseISO(val.startDate), offsetDays), 'yyyy-MM-dd') : undefined,
          endDate: val.endDate ? format(addDays(parseISO(val.endDate), offsetDays), 'yyyy-MM-dd') : undefined,
        };
      }
    }

    let newTurbineConfig = project.turbineConfig ? { ...project.turbineConfig } : undefined;
    if (newTurbineConfig) {
      newTurbineConfig.startDate = newStartDate;
      newTurbineConfig.endDate = newEndDate;
    }

    return {
      ...project,
      startDate: newStartDate,
      endDate: newEndDate,
      workCenterDates: newWcDates,
      groupDates: newGroupDates,
      turbineConfig: newTurbineConfig,
    };
  } catch (e) {
    console.error('Error shifting project dates:', e);
    return project;
  }
}

/**
 * Helper to get the effective original start and end dates for a specific sector group in a project
 */
function getProjectGroupOriginalDates(
  project: Project,
  groupName: string,
  workCenters: WorkCenter[]
): { startDate: string; endDate: string } {
  try {
    // 1. Direct groupDates on project
    if (project.groupDates?.[groupName]?.startDate && project.groupDates?.[groupName]?.endDate) {
      return {
        startDate: project.groupDates[groupName].startDate!,
        endDate: project.groupDates[groupName].endDate!,
      };
    }

    // 2. Turbine customSectorCurves
    if (project.turbineConfig?.customSectorCurves?.[groupName]) {
      const curveCfg = project.turbineConfig.customSectorCurves[groupName];
      const pStart = parseISO(project.startDate);
      const pEnd = parseISO(project.endDate);
      const totalDays = Math.max(1, differenceInCalendarDays(pEnd, pStart) + 1);
      const startPctSafe = Math.max(0, Math.min(100, curveCfg.startPct || 0));
      const endPctSafe = Math.max(startPctSafe + 1, Math.min(100, curveCfg.endPct || 100));

      const startOffsetDays = Math.round((startPctSafe / 100) * (totalDays - 1));
      const endOffsetDays = Math.round((endPctSafe / 100) * (totalDays - 1));

      const gStart = addDays(pStart, startOffsetDays);
      const gEnd = addDays(pStart, Math.max(startOffsetDays + 1, endOffsetDays));

      return {
        startDate: format(gStart, 'yyyy-MM-dd'),
        endDate: format(isAfter(gEnd, pEnd) ? pEnd : gEnd, 'yyyy-MM-dd'),
      };
    }

    // 3. WorkCenterDates matching this group
    if (project.workCenterDates) {
      const groupWcIds = new Set(
        workCenters
          .filter((wc) => getWorkCenterCategory(wc) === groupName)
          .map((wc) => wc.id)
      );

      let foundStart: string | null = null;
      let foundEnd: string | null = null;

      for (const [key, val] of Object.entries(project.workCenterDates)) {
        if (!val) continue;
        if (groupWcIds.has(key) || key.trim().toUpperCase() === groupName.trim().toUpperCase()) {
          if (val.startDate && (!foundStart || val.startDate < foundStart)) {
            foundStart = val.startDate;
          }
          if (val.endDate && (!foundEnd || val.endDate > foundEnd)) {
            foundEnd = val.endDate;
          }
        }
      }

      if (foundStart && foundEnd) {
        return { startDate: foundStart, endDate: foundEnd };
      }
    }

    // Fallback: overall project dates
    return {
      startDate: project.startDate,
      endDate: project.endDate,
    };
  } catch (e) {
    console.error('Error getting group dates:', e);
    return {
      startDate: project.startDate,
      endDate: project.endDate,
    };
  }
}

/**
 * Helper to shift a project's timeline and/or individual sector groups within the project
 */
function shiftProjectAndGroups(
  project: Project,
  projectOffsetDays: number,
  groupOffsets: Record<string, number>,
  workCenters: WorkCenter[]
): Project {
  let updatedProject = project;

  // Step 1: Shift entire project dates if requested
  if (projectOffsetDays && projectOffsetDays !== 0) {
    updatedProject = shiftProjectDates(updatedProject, projectOffsetDays);
  }

  // Step 2: Apply individual sector group offsets if any
  const hasGroupOffsets = Object.values(groupOffsets).some((val) => typeof val === 'number' && val !== 0);
  if (!hasGroupOffsets) {
    return updatedProject;
  }

  try {
    const newGroupDates: Record<string, { startDate?: string; endDate?: string }> = {
      ...(updatedProject.groupDates || {}),
    };
    const newWcDates: Record<string, { startDate?: string; endDate?: string }> = {
      ...(updatedProject.workCenterDates || {}),
    };

    let minGroupStart = updatedProject.startDate;
    let maxGroupEnd = updatedProject.endDate;

    for (const [grpName, offsetDays] of Object.entries(groupOffsets)) {
      if (!offsetDays || offsetDays === 0) continue;

      const baseGroupDates = getProjectGroupOriginalDates(updatedProject, grpName, workCenters);
      const sDate = parseISO(baseGroupDates.startDate);
      const eDate = parseISO(baseGroupDates.endDate);
      const newStartDate = format(addDays(sDate, offsetDays), 'yyyy-MM-dd');
      const newEndDate = format(addDays(eDate, offsetDays), 'yyyy-MM-dd');

      newGroupDates[grpName] = {
        startDate: newStartDate,
        endDate: newEndDate,
      };

      // Also assign specific work center dates for all work centers in this group
      workCenters.forEach((wc) => {
        if (getWorkCenterCategory(wc) === grpName) {
          newWcDates[wc.id] = { startDate: newStartDate, endDate: newEndDate };
          newWcDates[wc.name] = { startDate: newStartDate, endDate: newEndDate };
        }
      });

      if (newStartDate < minGroupStart) minGroupStart = newStartDate;
      if (newEndDate > maxGroupEnd) maxGroupEnd = newEndDate;
    }

    return {
      ...updatedProject,
      startDate: minGroupStart < updatedProject.startDate ? minGroupStart : updatedProject.startDate,
      endDate: maxGroupEnd > updatedProject.endDate ? maxGroupEnd : updatedProject.endDate,
      groupDates: newGroupDates,
      workCenterDates: newWcDates,
    };
  } catch (e) {
    console.error('Error shifting project groups:', e);
    return updatedProject;
  }
}

export const WorkCenterAnalysis: React.FC<WorkCenterAnalysisProps> = ({
  workCenters,
  summaries,
  weeklyBuckets,
  projects,
  sectorGroups = DEFAULT_SECTOR_GROUPS,
  initialSectorFilter,
  initialWcId,
  onUpdateWorkCenter,
  onUpdateProject,
  onOpenPrintReportModal,
}) => {
  // Mode: 'GROUP' (Consolidado por Agrupador de Setor) or 'INDIVIDUAL' (Por Centro de Trabalho)
  const [viewMode, setViewMode] = useState<'GROUP' | 'INDIVIDUAL'>('GROUP');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OVERLOADED' | 'OK'>('ALL');

  // Selected Group for GROUP mode: 'ALL' means "Todos os Agrupadores (Fábrica Completa)" or specific group name
  const [selectedGroup, setSelectedGroup] = useState<string>(initialSectorFilter || 'ALL');

  // Selected specific WorkCenter (CT) within the selected group (or 'ALL' for consolidated group chart)
  const [selectedSubWcId, setSelectedSubWcId] = useState<string>(initialWcId || 'ALL');

  // Filter by sector group in INDIVIDUAL mode ('ALL' or specific group name)
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>(initialSectorFilter || 'ALL');

  // Selected WorkCenter for INDIVIDUAL mode chart
  const [selectedWcId, setSelectedWcId] = useState<string>(
    initialWcId || (summaries.length > 0 ? summaries[0].workCenter.id : '')
  );

  // Expanded groups in the grouped table
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    SOLDA: true,
  });

  // --- INTERACTIVE PROJECT & GROUP SHIFTING SIMULATION STATE ---
  const activeProjects = useMemo(() => projects.filter((p) => p.enabled !== false), [projects]);
  const [selectedSimProjectId, setSelectedSimProjectId] = useState<string>('');
  const [selectedSimScope, setSelectedSimScope] = useState<string>('ALL'); // 'ALL' = whole project, or specific group name (e.g. 'SOLDA')
  const [projectShiftDays, setProjectShiftDays] = useState<number>(0);
  const [groupShifts, setGroupShifts] = useState<Record<string, number>>({});
  const deferredProjectShiftDays = useDeferredValue(projectShiftDays);
  const deferredGroupShifts = useDeferredValue(groupShifts);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [showAllLegends, setShowAllLegends] = useState(false);

  // Derived current simulated project ID (safe fallback without setState inside effect)
  const currentSimProjectId = useMemo(() => {
    if (selectedSimProjectId && activeProjects.some((p) => p.id === selectedSimProjectId)) {
      return selectedSimProjectId;
    }
    return activeProjects.length > 0 ? activeProjects[0].id : '';
  }, [selectedSimProjectId, activeProjects]);

  // Selected project for simulation
  const selectedSimProject = useMemo(() => {
    return activeProjects.find((p) => p.id === currentSimProjectId) || null;
  }, [activeProjects, currentSimProjectId]);

  // Check if simulation has active non-zero shifts
  const hasActiveSimulation = useMemo(() => {
    return (
      deferredProjectShiftDays !== 0 ||
      Object.values(deferredGroupShifts).some((v) => typeof v === 'number' && v !== 0)
    );
  }, [deferredProjectShiftDays, deferredGroupShifts]);

  // Dynamically calculate effective projects with shift simulation applied (both project and group level)
  const effectiveProjects = useMemo(() => {
    if (!hasActiveSimulation || !currentSimProjectId) {
      return projects;
    }
    return projects.map((p) => {
      if (p.id === currentSimProjectId) {
        return shiftProjectAndGroups(p, deferredProjectShiftDays, deferredGroupShifts, workCenters);
      }
      return p;
    });
  }, [projects, currentSimProjectId, hasActiveSimulation, deferredProjectShiftDays, deferredGroupShifts, workCenters]);

  // Effective simulated project object
  const effectiveSimProject = useMemo(() => {
    return effectiveProjects.find((p) => p.id === currentSimProjectId) || selectedSimProject;
  }, [effectiveProjects, currentSimProjectId, selectedSimProject]);

  // Dynamically recalculate weekly schedule in real time during simulation
  const effectiveSchedule = useMemo(() => {
    if (!hasActiveSimulation) {
      return {
        weeklyBuckets,
        workCenterSummaries: summaries,
      };
    }
    const result = generateWeeklySchedule(effectiveProjects, workCenters);
    return {
      weeklyBuckets: result.weeklyBuckets,
      workCenterSummaries: result.workCenterSummaries,
    };
  }, [effectiveProjects, workCenters, hasActiveSimulation, weeklyBuckets, summaries]);

  const currentWeeklyBuckets = effectiveSchedule.weeklyBuckets;
  const currentSummaries = effectiveSchedule.workCenterSummaries;

  const usedWcIds = useMemo(
    () => new Set(currentSummaries.map((s) => s.workCenter.id)),
    [currentSummaries]
  );

  const activeWorkCenters = useMemo(
    () => workCenters.filter((wc) => wc.enabled !== false && usedWcIds.has(wc.id)),
    [workCenters, usedWcIds]
  );

  // Calculate sector group summaries (Aggregated) with fast index - only for groups with active work centers in use
  const sectorSummaries: SectorGroupSummary[] = useMemo(() => {
    const allGroups = Array.from(
      new Set([...sectorGroups, ...activeWorkCenters.map((wc) => getWorkCenterCategory(wc))])
    );

    const summariesByWcId = new Map<string, WorkCenterCapacitySummary>();
    for (const s of currentSummaries) {
      summariesByWcId.set(s.workCenter.id, s);
    }

    return allGroups
      .map((grp) => {
        const groupWcs = activeWorkCenters.filter((wc) => getWorkCenterCategory(wc) === grp);
        if (groupWcs.length === 0) return null;

        const groupWcIds = groupWcs.map((wc) => wc.id);

        let totalResources = 0;
        let weeklyCapacity = 0;
        let totalRequiredHours = 0;

        for (let i = 0; i < groupWcs.length; i++) {
          const wc = groupWcs[i];
          totalResources += wc.resourcesCount || 0;
          weeklyCapacity += calculateWeeklyCapacity(wc);
          const s = summariesByWcId.get(wc.id);
          if (s) totalRequiredHours += s.totalRequiredHours || 0;
        }

        if (totalRequiredHours === 0) return null;

        let peakWeeklyLoad = 0;
        let overloadedWeeksCount = 0;
        let totalUtilizationSum = 0;
        const bucketCount = currentWeeklyBuckets.length;

        for (let b = 0; b < bucketCount; b++) {
          const loads = currentWeeklyBuckets[b].workCenterLoads;
          let weekLoad = 0;
          for (let i = 0; i < groupWcIds.length; i++) {
            weekLoad += loads[groupWcIds[i]] || 0;
          }

          if (weekLoad > peakWeeklyLoad) {
            peakWeeklyLoad = weekLoad;
          }

          if (weeklyCapacity > 0) {
            if (weekLoad > weeklyCapacity) {
              overloadedWeeksCount++;
            }
            totalUtilizationSum += (weekLoad / weeklyCapacity) * 100;
          }
        }

        const maxUtilizationPercentage =
          weeklyCapacity > 0 ? (peakWeeklyLoad / weeklyCapacity) * 100 : 0;
        const averageUtilizationPercentage =
          bucketCount > 0 && weeklyCapacity > 0
            ? totalUtilizationSum / bucketCount
            : 0;

        const status: 'OK' | 'WARNING' | 'CRITICAL' =
          maxUtilizationPercentage > 100
            ? 'CRITICAL'
            : maxUtilizationPercentage > 85
            ? 'WARNING'
            : 'OK';

        return {
          groupName: grp,
          workCenterCount: groupWcs.length,
          totalResources,
          weeklyCapacity,
          totalRequiredHours,
          peakWeeklyLoad,
          maxUtilizationPercentage,
          averageUtilizationPercentage,
          overloadedWeeksCount,
          workCenters: groupWcs,
          status,
        };
      })
      .filter((s): s is SectorGroupSummary => s !== null);
  }, [sectorGroups, activeWorkCenters, currentSummaries, currentWeeklyBuckets]);

  // Consolidated "TODOS (Fábrica Completa)" summary with fast single-pass
  const allFactorySummary: SectorGroupSummary = useMemo(() => {
    let totalResources = 0;
    let weeklyCapacity = 0;
    for (let i = 0; i < activeWorkCenters.length; i++) {
      const wc = activeWorkCenters[i];
      totalResources += wc.resourcesCount || 0;
      weeklyCapacity += calculateWeeklyCapacity(wc);
    }

    let totalRequiredHours = 0;
    for (let i = 0; i < currentSummaries.length; i++) {
      totalRequiredHours += currentSummaries[i].totalRequiredHours || 0;
    }

    let peakWeeklyLoad = 0;
    let overloadedWeeksCount = 0;
    let totalUtilizationSum = 0;
    const bucketCount = currentWeeklyBuckets.length;

    for (let b = 0; b < bucketCount; b++) {
      const loads = currentWeeklyBuckets[b].workCenterLoads;
      let weekLoad = 0;
      for (const wcId in loads) {
        weekLoad += loads[wcId] || 0;
      }

      if (weekLoad > peakWeeklyLoad) {
        peakWeeklyLoad = weekLoad;
      }

      if (weeklyCapacity > 0) {
        if (weekLoad > weeklyCapacity) {
          overloadedWeeksCount++;
        }
        totalUtilizationSum += (weekLoad / weeklyCapacity) * 100;
      }
    }

    const maxUtilizationPercentage =
      weeklyCapacity > 0 ? (peakWeeklyLoad / weeklyCapacity) * 100 : 0;
    const averageUtilizationPercentage =
      bucketCount > 0 && weeklyCapacity > 0
        ? totalUtilizationSum / bucketCount
        : 0;

    const status: 'OK' | 'WARNING' | 'CRITICAL' =
      maxUtilizationPercentage > 100
        ? 'CRITICAL'
        : maxUtilizationPercentage > 85
        ? 'WARNING'
        : 'OK';

    return {
      groupName: 'TODOS (Fábrica Completa)',
      workCenterCount: activeWorkCenters.length,
      totalResources,
      weeklyCapacity,
      totalRequiredHours,
      peakWeeklyLoad,
      maxUtilizationPercentage,
      averageUtilizationPercentage,
      overloadedWeeksCount,
      workCenters: activeWorkCenters,
      status,
    };
  }, [activeWorkCenters, currentSummaries, currentWeeklyBuckets]);

  // Current selected group for GROUP mode
  const currentGroupSummary = useMemo(() => {
    if (selectedGroup === 'ALL') {
      return allFactorySummary;
    }
    const found = sectorSummaries.find((s) => s.groupName === selectedGroup);
    return found || allFactorySummary;
  }, [sectorSummaries, selectedGroup, allFactorySummary]);

  // Work centers belonging to the current selected group in GROUP mode
  const currentGroupWorkCenters = useMemo(() => {
    if (selectedGroup === 'ALL') {
      return activeWorkCenters;
    }
    return activeWorkCenters.filter((wc) => getWorkCenterCategory(wc) === selectedGroup);
  }, [selectedGroup, activeWorkCenters]);

  // Specific work center summary if one is selected in sub-filter
  const currentSubWcSummary = useMemo(() => {
    if (selectedSubWcId === 'ALL') return null;
    return currentSummaries.find((s) => s.workCenter.id === selectedSubWcId) || null;
  }, [selectedSubWcId, currentSummaries]);

  // Flag: whether GROUP mode is currently drilled down into a specific CT
  const isShowingSpecificWcInGroup = viewMode === 'GROUP' && selectedSubWcId !== 'ALL' && currentSubWcSummary !== null;

  // Filtered list of individual summaries for INDIVIDUAL mode
  const filteredIndividualSummaries = useMemo(() => {
    return currentSummaries.filter((s) => {
      const matchesSearch =
        s.workCenter.name.toLowerCase().includes(searchTerm.toLowerCase());
      const isOverloaded = s.maxUtilizationPercentage > 100;

      const groupMatch =
        selectedSectorFilter === 'ALL' ||
        getWorkCenterCategory(s.workCenter) === selectedSectorFilter;

      if (!groupMatch) return false;

      if (filterStatus === 'OVERLOADED') return matchesSearch && isOverloaded;
      if (filterStatus === 'OK') return matchesSearch && !isOverloaded;
      return matchesSearch;
    });
  }, [currentSummaries, searchTerm, filterStatus, selectedSectorFilter]);

  // Active individual summary for chart
  const selectedIndividualSummary = useMemo(() => {
    if (selectedWcId) {
      const found = currentSummaries.find((s) => s.workCenter.id === selectedWcId);
      if (found) return found;
    }
    return filteredIndividualSummaries[0] || currentSummaries[0] || null;
  }, [currentSummaries, selectedWcId, filteredIndividualSummaries]);

  // Chart data: GROUP mode (consolidated or specific CT) or INDIVIDUAL mode
  const chartData = useMemo(() => {
    if (viewMode === 'GROUP') {
      // If user selected a specific CT under the group
      if (isShowingSpecificWcInGroup && currentSubWcSummary) {
        const wcId = currentSubWcSummary.workCenter.id;
        const nominalCap = currentSubWcSummary.weeklyCapacity;
        const wcName = currentSubWcSummary.workCenter.name;

        return currentWeeklyBuckets.map((bucket) => {
          const projectLoads = bucket.projectBreakdown[wcId] || {};
          const effectiveCap = bucket.workCenterCapacities?.[wcId] ?? nominalCap;
          const activeHolidays = (bucket.activeHolidays || []).filter(
            (h) =>
              !h.workCenterIds ||
              h.workCenterIds.length === 0 ||
              h.workCenterIds.includes(wcId) ||
              h.workCenterIds.includes(wcName)
          );

          const row: Record<string, any> = {
            weekLabel: bucket.label.split(' ')[1] || bucket.label,
            fullLabel: bucket.label,
            weekKey: bucket.weekKey,
            capacity: effectiveCap,
            nominalCapacity: nominalCap,
            activeHolidays,
            totalLoad: bucket.workCenterLoads[wcId] || 0,
          };

          for (const proj of effectiveProjects) {
            if (proj.enabled !== false) {
              row[proj.id] = projectLoads[proj.id] || 0;
            }
          }

          return row;
        });
      }

      if (!currentGroupSummary) return [];

      const groupWcs = currentGroupSummary.workCenters;
      const nominalCap = currentGroupSummary.weeklyCapacity;
      const groupWcIds = new Set(groupWcs.map((w) => w.id).concat(groupWcs.map((w) => w.name)));

      return currentWeeklyBuckets.map((bucket) => {
        let totalEffectiveCap = 0;
        for (const wc of groupWcs) {
          totalEffectiveCap += bucket.workCenterCapacities?.[wc.id] ?? calculateWeeklyCapacity(wc);
        }

        const activeHolidays = (bucket.activeHolidays || []).filter(
          (h) =>
            !h.workCenterIds ||
            h.workCenterIds.length === 0 ||
            h.workCenterIds.some((id) => groupWcIds.has(id))
        );

        const row: Record<string, any> = {
          weekLabel: bucket.label.split(' ')[1] || bucket.label,
          fullLabel: bucket.label,
          weekKey: bucket.weekKey,
          capacity: totalEffectiveCap,
          nominalCapacity: nominalCap,
          activeHolidays,
          totalLoad: 0,
        };

        let totalWeekLoad = 0;
        for (const proj of effectiveProjects) {
          if (proj.enabled !== false) {
            let projHoursInGroup = 0;
            for (const wc of groupWcs) {
              projHoursInGroup += bucket.projectBreakdown[wc.id]?.[proj.id] || 0;
            }
            row[proj.id] = projHoursInGroup;
            totalWeekLoad += projHoursInGroup;
          }
        }

        row.totalLoad = totalWeekLoad;
        return row;
      });
    } else {
      // INDIVIDUAL mode
      if (!selectedIndividualSummary) return [];

      const wcId = selectedIndividualSummary.workCenter.id;
      const nominalCap = selectedIndividualSummary.weeklyCapacity;
      const wcName = selectedIndividualSummary.workCenter.name;

      return currentWeeklyBuckets.map((bucket) => {
        const projectLoads = bucket.projectBreakdown[wcId] || {};
        const effectiveCap = bucket.workCenterCapacities?.[wcId] ?? nominalCap;
        const activeHolidays = (bucket.activeHolidays || []).filter(
          (h) =>
            !h.workCenterIds ||
            h.workCenterIds.length === 0 ||
            h.workCenterIds.includes(wcId) ||
            h.workCenterIds.includes(wcName)
        );

        const row: Record<string, any> = {
          weekLabel: bucket.label.split(' ')[1] || bucket.label,
          fullLabel: bucket.label,
          weekKey: bucket.weekKey,
          capacity: effectiveCap,
          nominalCapacity: nominalCap,
          activeHolidays,
          totalLoad: bucket.workCenterLoads[wcId] || 0,
        };

        for (const proj of effectiveProjects) {
          if (proj.enabled !== false) {
            row[proj.id] = projectLoads[proj.id] || 0;
          }
        }

        return row;
      });
    }
  }, [viewMode, isShowingSpecificWcInGroup, currentSubWcSummary, currentGroupSummary, selectedIndividualSummary, currentWeeklyBuckets, effectiveProjects]);

  // Dynamic Y domain with headroom
  const maxYValue = useMemo(() => {
    const weeklyCap =
      viewMode === 'GROUP'
        ? isShowingSpecificWcInGroup && currentSubWcSummary
          ? currentSubWcSummary.weeklyCapacity
          : currentGroupSummary?.weeklyCapacity || 0
        : selectedIndividualSummary?.weeklyCapacity || 0;

    const maxBarLoad = Math.max(...chartData.map((d) => d.totalLoad || 0), 0);
    const highest = Math.max(maxBarLoad, weeklyCap);
    if (highest === 0) return 100;
    return Math.ceil(highest * 1.2);
  }, [viewMode, isShowingSpecificWcInGroup, currentSubWcSummary, currentGroupSummary, selectedIndividualSummary, chartData]);

  // Projects that actively have hours in the current active group or work center
  const projectsInCurrentView = useMemo(() => {
    if (viewMode === 'GROUP') {
      if (isShowingSpecificWcInGroup && currentSubWcSummary) {
        const wcId = currentSubWcSummary.workCenter.id;
        return effectiveProjects.filter((p) => {
          if (p.enabled === false) return false;
          return currentWeeklyBuckets.some((bucket) => {
            return (bucket.projectBreakdown[wcId]?.[p.id] || 0) > 0;
          });
        });
      }

      if (!currentGroupSummary) return [];
      const groupWcIds = currentGroupSummary.workCenters.map((wc) => wc.id);
      return effectiveProjects.filter((p) => {
        if (p.enabled === false) return false;
        return currentWeeklyBuckets.some((bucket) => {
          for (const wcId of groupWcIds) {
            if ((bucket.projectBreakdown[wcId]?.[p.id] || 0) > 0) return true;
          }
          return false;
        });
      });
    } else {
      if (!selectedIndividualSummary) return [];
      const wcId = selectedIndividualSummary.workCenter.id;
      return effectiveProjects.filter((p) => {
        if (p.enabled === false) return false;
        return currentWeeklyBuckets.some((bucket) => {
          return (bucket.projectBreakdown[wcId]?.[p.id] || 0) > 0;
        });
      });
    }
  }, [viewMode, isShowingSpecificWcInGroup, currentSubWcSummary, currentGroupSummary, selectedIndividualSummary, currentWeeklyBuckets, effectiveProjects]);

  // Impact metrics comparison: Original baseline vs Simulated shifted state
  const simulationImpact = useMemo(() => {
    if (!hasActiveSimulation) {
      return null;
    }

    // Baseline calculation on original weeklyBuckets and summaries
    let baselinePeak = 0;
    let baselineOverloadedWeeks = 0;
    let targetCapacity = 0;

    if (viewMode === 'GROUP') {
      if (isShowingSpecificWcInGroup && currentSubWcSummary) {
        const wcId = currentSubWcSummary.workCenter.id;
        targetCapacity = currentSubWcSummary.weeklyCapacity || 0;
        for (const bucket of weeklyBuckets) {
          const wLoad = bucket.workCenterLoads[wcId] || 0;
          if (wLoad > baselinePeak) baselinePeak = wLoad;
          if (targetCapacity > 0 && wLoad > targetCapacity) baselineOverloadedWeeks++;
        }
      } else {
        const groupWcs = currentGroupSummary?.workCenters || [];
        targetCapacity = currentGroupSummary?.weeklyCapacity || 0;

        for (const bucket of weeklyBuckets) {
          let wLoad = 0;
          for (const wc of groupWcs) {
            wLoad += bucket.workCenterLoads[wc.id] || 0;
          }
          if (wLoad > baselinePeak) baselinePeak = wLoad;
          if (targetCapacity > 0 && wLoad > targetCapacity) baselineOverloadedWeeks++;
        }
      }
    } else {
      const wcId = selectedIndividualSummary?.workCenter.id;
      targetCapacity = selectedIndividualSummary?.weeklyCapacity || 0;

      if (wcId) {
        for (const bucket of weeklyBuckets) {
          const wLoad = bucket.workCenterLoads[wcId] || 0;
          if (wLoad > baselinePeak) baselinePeak = wLoad;
          if (targetCapacity > 0 && wLoad > targetCapacity) baselineOverloadedWeeks++;
        }
      }
    }

    const simulatedPeak =
      isShowingSpecificWcInGroup && currentSubWcSummary
        ? currentSubWcSummary.peakWeeklyLoad || 0
        : currentGroupSummary?.peakWeeklyLoad || 0;
    const simulatedOverloadedWeeks =
      isShowingSpecificWcInGroup && currentSubWcSummary
        ? currentSubWcSummary.overloadedWeeksCount || 0
        : currentGroupSummary?.overloadedWeeksCount || 0;
    const peakDelta = simulatedPeak - baselinePeak;
    const isRelieved = peakDelta < 0 || simulatedOverloadedWeeks < baselineOverloadedWeeks;

    return {
      baselinePeak,
      simulatedPeak,
      peakDelta,
      baselineOverloadedWeeks,
      simulatedOverloadedWeeks,
      isRelieved,
      targetCapacity,
    };
  }, [hasActiveSimulation, viewMode, isShowingSpecificWcInGroup, currentSubWcSummary, currentGroupSummary, selectedIndividualSummary, weeklyBuckets]);

  const handleResourceCountChange = (wc: WorkCenter, delta: number) => {
    const newCount = Math.max(1, wc.resourcesCount + delta);
    onUpdateWorkCenter({ ...wc, resourcesCount: newCount });
  };

  const handleDailyHoursChange = (wc: WorkCenter, hours: number) => {
    const newHours = Math.max(1, Math.min(24, hours));
    onUpdateWorkCenter({ ...wc, dailyHours: newHours });
  };

  const toggleGroupExpand = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const switchToIndividual = (wcId: string) => {
    setSelectedWcId(wcId);
    setViewMode('INDIVIDUAL');
  };

  // Extract all distinct sector groups that exist in the currently selected simulation project
  const selectedProjectGroups = useMemo(() => {
    if (!selectedSimProject) return [];
    const grpMap = new Map<string, { groupName: string; hours: number; workCenters: WorkCenter[] }>();

    for (const wc of activeWorkCenters) {
      const cat = getWorkCenterCategory(wc);
      let hrs = 0;
      if (selectedSimProject.workCenterHours) {
        hrs =
          selectedSimProject.workCenterHours[wc.id] ??
          selectedSimProject.workCenterHours[wc.name] ??
          0;
      }
      if (hrs > 0) {
        if (!grpMap.has(cat)) {
          grpMap.set(cat, { groupName: cat, hours: 0, workCenters: [] });
        }
        const item = grpMap.get(cat)!;
        item.hours += hrs;
        item.workCenters.push(wc);
      }
    }

    // Include groups configured in groupDates or turbineConfig
    if (selectedSimProject.groupDates) {
      for (const cat of Object.keys(selectedSimProject.groupDates)) {
        if (!grpMap.has(cat)) {
          grpMap.set(cat, { groupName: cat, hours: 0, workCenters: [] });
        }
      }
    }
    if (selectedSimProject.turbineConfig?.customSectorCurves) {
      for (const cat of Object.keys(selectedSimProject.turbineConfig.customSectorCurves)) {
        if (!grpMap.has(cat)) {
          grpMap.set(cat, { groupName: cat, hours: 0, workCenters: [] });
        }
      }
    }

    return Array.from(grpMap.values()).sort((a, b) => b.hours - a.hours);
  }, [selectedSimProject, activeWorkCenters]);

  // Current shift value for active target (either whole project or selected group)
  const currentSimShiftValue = useMemo(() => {
    if (selectedSimScope === 'ALL') {
      return projectShiftDays;
    }
    return groupShifts[selectedSimScope] || 0;
  }, [selectedSimScope, projectShiftDays, groupShifts]);

  const handleSetCurrentShift = (val: number) => {
    if (selectedSimScope === 'ALL') {
      setProjectShiftDays(val);
    } else {
      setGroupShifts((prev) => ({
        ...prev,
        [selectedSimScope]: val,
      }));
    }
  };

  const handleStepCurrentShift = (delta: number) => {
    if (selectedSimScope === 'ALL') {
      setProjectShiftDays((prev) => prev + delta);
    } else {
      setGroupShifts((prev) => ({
        ...prev,
        [selectedSimScope]: (prev[selectedSimScope] || 0) + delta,
      }));
    }
  };

  const handleResetCurrentShift = () => {
    if (selectedSimScope === 'ALL') {
      setProjectShiftDays(0);
    } else {
      setGroupShifts((prev) => ({
        ...prev,
        [selectedSimScope]: 0,
      }));
    }
  };

  const handleResetAllShifts = () => {
    setProjectShiftDays(0);
    setGroupShifts({});
  };

  const handleApplyShiftToProject = () => {
    if (!selectedSimProject || !hasActiveSimulation) return;
    const updated = shiftProjectAndGroups(selectedSimProject, projectShiftDays, groupShifts, workCenters);
    if (onUpdateProject) {
      onUpdateProject(updated);
    }

    const descriptions: string[] = [];
    if (projectShiftDays !== 0) {
      descriptions.push(`Projeto: ${projectShiftDays > 0 ? '+' : ''}${projectShiftDays}d`);
    }
    for (const [grp, offVal] of Object.entries(groupShifts)) {
      const off = Number(offVal) || 0;
      if (off !== 0) {
        descriptions.push(`${grp}: ${off > 0 ? '+' : ''}${off}d`);
      }
    }

    setProjectShiftDays(0);
    setGroupShifts({});
    setSaveToast(`Cronograma de "${updated.name}" atualizado (${descriptions.join(', ') || 'Salvo'})!`);
    setTimeout(() => setSaveToast(null), 4000);
  };

  // Preview dates of shifted target (project or specific group)
  const simulatedTargetDates = useMemo(() => {
    if (!selectedSimProject) {
      return {
        originalStart: '-',
        originalEnd: '-',
        simulatedStart: '-',
        simulatedEnd: '-',
      };
    }

    if (selectedSimScope === 'ALL') {
      const origStart = format(parseISO(selectedSimProject.startDate), 'dd/MM/yyyy');
      const origEnd = format(parseISO(selectedSimProject.endDate), 'dd/MM/yyyy');
      const simStart = format(parseISO(effectiveSimProject.startDate), 'dd/MM/yyyy');
      const simEnd = format(parseISO(effectiveSimProject.endDate), 'dd/MM/yyyy');
      return {
        originalStart: origStart,
        originalEnd: origEnd,
        simulatedStart: simStart,
        simulatedEnd: simEnd,
      };
    }

    const orig = getProjectGroupOriginalDates(selectedSimProject, selectedSimScope, workCenters);
    const sim = getProjectGroupOriginalDates(effectiveSimProject, selectedSimScope, workCenters);
    return {
      originalStart: format(parseISO(orig.startDate), 'dd/MM/yyyy'),
      originalEnd: format(parseISO(orig.endDate), 'dd/MM/yyyy'),
      simulatedStart: format(parseISO(sim.startDate), 'dd/MM/yyyy'),
      simulatedEnd: format(parseISO(sim.endDate), 'dd/MM/yyyy'),
    };
  }, [selectedSimProject, effectiveSimProject, selectedSimScope, workCenters]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Check className="w-5 h-5 text-white" />
          <span className="text-xs font-bold">{saveToast}</span>
        </div>
      )}

      {/* Top Filter & View Mode Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('GROUP')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'GROUP'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span>Visão Consolidada por Agrupador</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  viewMode === 'GROUP'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {sectorSummaries.length + 1}
              </span>
            </button>

            <button
              onClick={() => setViewMode('INDIVIDUAL')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'INDIVIDUAL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Visão por Centro Individual</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  viewMode === 'INDIVIDUAL'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {summaries.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  viewMode === 'GROUP'
                    ? 'Buscar agrupador (ex: SOLDA, USINAGEM)...'
                    : 'Buscar centro individual (ex: Caldeiraria, Torno)...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white"
              />
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Status:
            </span>
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                filterStatus === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todos ({summaries.length})
            </button>
            <button
              onClick={() => setFilterStatus('OVERLOADED')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                filterStatus === 'OVERLOADED'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Gargalos</span>
            </button>
            <button
              onClick={() => setFilterStatus('OK')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                filterStatus === 'OK'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Capacidade OK</span>
            </button>

            {onOpenPrintReportModal && (
              <button
                onClick={onOpenPrintReportModal}
                className="px-2.5 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors flex items-center gap-1 border border-indigo-200 cursor-pointer ml-1"
                title="Imprimir Relatório Técnico / Operacional"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Bar by Sector / Agrupador with "TODOS" option */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-2.5 border-t border-slate-100 scrollbar-thin">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
            <span>Agrupador:</span>
          </span>

          {/* "TODOS" option for GROUP mode & INDIVIDUAL mode */}
          {viewMode === 'GROUP' ? (
            <button
              onClick={() => setSelectedGroup('ALL')}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedGroup === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>🌟 Todos (Fábrica Completa)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedGroup === 'ALL'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {activeWorkCenters.length} em uso
              </span>
              {allFactorySummary.maxUtilizationPercentage > 100 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Sobrecarga fabril detectada"></span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setSelectedSectorFilter('ALL')}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedSectorFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Todos os Centros</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedSectorFilter === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {summaries.length}
              </span>
            </button>
          )}

          {sectorSummaries.map((s) => {
            const isSelected =
              viewMode === 'GROUP'
                ? selectedGroup === s.groupName
                : selectedSectorFilter === s.groupName;
            const isOverloaded = s.maxUtilizationPercentage > 100;

            return (
              <button
                key={s.groupName}
                onClick={() => {
                  if (viewMode === 'GROUP') {
                    setSelectedGroup(s.groupName);
                    setSelectedSubWcId('ALL');
                  } else {
                    setSelectedSectorFilter(s.groupName);
                    const firstWcInGroup = s.workCenters[0];
                    if (firstWcInGroup) {
                      setSelectedWcId(firstWcInGroup.id);
                    }
                  }
                }}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{s.groupName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {s.workCenterCount}
                </span>
                {isOverloaded && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Sobrecarga detectada"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Filter Bar for Specific Centro de Trabalho (CT) inside the selected group */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-2.5 border-t border-slate-100 scrollbar-thin">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span>Centro de Trabalho (CT):</span>
          </span>

          {viewMode === 'GROUP' ? (
            <>
              {/* Button to view all CTs in group (Consolidado) */}
              <button
                onClick={() => setSelectedSubWcId('ALL')}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  selectedSubWcId === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs ring-2 ring-slate-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>📊 Todos os CTs ({currentGroupWorkCenters.length})</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedSubWcId === 'ALL'
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  Consolidado
                </span>
              </button>

              {/* Individual CT buttons */}
              {currentGroupWorkCenters.map((wc) => {
                const isSelected = selectedSubWcId === wc.id;
                const wcSummary = currentSummaries.find((s) => s.workCenter.id === wc.id);
                const isOverloaded = (wcSummary?.maxUtilizationPercentage || 0) > 100;

                return (
                  <button
                    key={wc.id}
                    onClick={() => setSelectedSubWcId(wc.id)}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{wc.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? 'bg-indigo-700 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {wc.resourcesCount} rec
                    </span>
                    {isOverloaded && (
                      <span
                        className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
                        title={`Gargalo detectado: ${wcSummary?.maxUtilizationPercentage.toFixed(0)}% ocupação`}
                      ></span>
                    )}
                  </button>
                );
              })}
            </>
          ) : (
            <>
              {filteredIndividualSummaries.map((s) => {
                const isSelected = selectedWcId === s.workCenter.id;
                const isOverloaded = s.maxUtilizationPercentage > 100;

                return (
                  <button
                    key={s.workCenter.id}
                    onClick={() => setSelectedWcId(s.workCenter.id)}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{s.workCenter.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? 'bg-indigo-700 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {s.workCenter.resourcesCount} rec
                    </span>
                    {isOverloaded && (
                      <span
                        className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
                        title={`Gargalo detectado: ${s.maxUtilizationPercentage.toFixed(0)}% ocupação`}
                      ></span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Main Chart Card (GROUP MODE: Consolidado ou Centro Específico) */}
      {viewMode === 'GROUP' && currentGroupSummary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  {isShowingSpecificWcInGroup ? (
                    <Cpu className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <FolderTree className="w-5 h-5 text-indigo-600" />
                  )}
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    {isShowingSpecificWcInGroup && currentSubWcSummary
                      ? currentSubWcSummary.workCenter.name
                      : currentGroupSummary.groupName}
                  </h2>
                </div>

                {isShowingSpecificWcInGroup && currentSubWcSummary ? (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    Centro Individual • Agrupador: {getWorkCenterCategory(currentSubWcSummary.workCenter)}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    {selectedGroup === 'ALL' ? 'Visão Fabril Consolidada' : 'Agrupador Consolidado'} ({currentGroupSummary.workCenterCount} centros)
                  </span>
                )}

                {(() => {
                  const maxUtil = isShowingSpecificWcInGroup && currentSubWcSummary
                    ? currentSubWcSummary.maxUtilizationPercentage
                    : currentGroupSummary.maxUtilizationPercentage;
                  const isOver = (maxUtil ?? 0) > 100;
                  const isWarn = (maxUtil ?? 0) > 85;

                  return (
                    <span
                      className={`px-2.5 py-0.5 text-xs font-black rounded-full ${
                        isOver
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : isWarn
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {isOver
                        ? `Sobrecarga (${(maxUtil ?? 0).toFixed(0)}% Máx)`
                        : `${(maxUtil ?? 0).toFixed(0)}% Ocupação Máx`}
                    </span>
                  );
                })()}

                {projectShiftDays !== 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-700" />
                    <span>Simulação: {projectShiftDays > 0 ? `+${projectShiftDays}d` : `${projectShiftDays}d`}</span>
                  </span>
                )}
              </div>

              {isShowingSpecificWcInGroup && currentSubWcSummary ? (
                <p className="text-xs text-slate-500 mt-1.5">
                  Demanda Total: <strong className="text-slate-800">{Math.round(currentSubWcSummary.totalRequiredHours || 0).toLocaleString()}h</strong> |
                  Capacidade Semanal: <strong className="text-slate-800">{Math.round(currentSubWcSummary.weeklyCapacity || 0).toLocaleString()}h/sem</strong>
                  {' '}({currentSubWcSummary.workCenter.resourcesCount} recurso(s), {currentSubWcSummary.workCenter.dailyHours}h/dia)
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1.5">
                  Demanda Total: <strong className="text-slate-800">{Math.round(currentGroupSummary.totalRequiredHours || 0).toLocaleString()}h</strong> |
                  Capacidade Semanal Consolidada: <strong className="text-slate-800">{Math.round(currentGroupSummary.weeklyCapacity || 0).toLocaleString()}h/sem</strong>
                  {' '}({currentGroupSummary.totalResources} recursos somados em {currentGroupSummary.workCenterCount} postos)
                </p>
              )}
            </div>

            {/* Resources summary box / Adjuster */}
            {isShowingSpecificWcInGroup && currentSubWcSummary ? (
              <div className="flex items-center gap-3 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                    <button
                      onClick={() => handleResourceCountChange(currentSubWcSummary.workCenter, -1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-slate-600 rounded cursor-pointer font-black text-sm"
                      title="Reduzir recurso"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 text-xs font-black text-slate-900 min-w-16 text-center">
                      {currentSubWcSummary.workCenter.resourcesCount} rec
                    </span>
                    <button
                      onClick={() => handleResourceCountChange(currentSubWcSummary.workCenter, 1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-slate-600 rounded cursor-pointer font-black text-sm"
                      title="Aumentar recurso"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Capacidade CT
                    </span>
                    <span className="text-xs font-extrabold text-indigo-950 font-mono">
                      {Math.round(currentSubWcSummary.weeklyCapacity)}h/sem
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-indigo-200"></div>

                <button
                  onClick={() => setSelectedSubWcId('ALL')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-2xs"
                  title="Voltar para a visão consolidada do agrupador"
                >
                  Ver Agrupador
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                    {currentGroupSummary.totalResources}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Recursos Totais
                    </span>
                    <span className="text-xs font-extrabold text-indigo-950">
                      {currentGroupSummary.workCenterCount} Postos / Centros
                    </span>
                  </div>
                </div>

                {selectedGroup !== 'ALL' && (
                  <>
                    <div className="h-6 w-px bg-indigo-200"></div>

                    <button
                      onClick={() => toggleGroupExpand(currentGroupSummary.groupName)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>{expandedGroups[currentGroupSummary.groupName] ? 'Ocultar Postos' : 'Ver Postos'}</span>
                      {expandedGroups[currentGroupSummary.groupName] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recharts Stacked Weekly Demand vs Capacity Line - Dedicated Full-Height View */}
          <div className="h-[390px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 30, right: 30, left: 10, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                  angle={-90}
                  textAnchor="end"
                  dy={6}
                  dx={-2}
                  interval={0}
                  height={50}
                />
                <YAxis
                  domain={[0, maxYValue]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  unit="h"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const dataRow = payload[0]?.payload;
                    if (!dataRow) return null;

                    const totalLoad = dataRow.totalLoad || 0;
                    const capacity = dataRow.capacity || 0;
                    const util = capacity > 0 ? (totalLoad / capacity) * 100 : 0;
                    const isOver = capacity > 0 && totalLoad > capacity;

                    const activeWeekProjects: { id: string; name: string; hours: number; color: string }[] = [];
                    for (const proj of projectsInCurrentView) {
                      const val = dataRow[proj.id] || 0;
                      if (val > 0) {
                        activeWeekProjects.push({
                          id: proj.id,
                          name: proj.name,
                          hours: val,
                          color: proj.color || '#6366f1',
                        });
                      }
                    }
                    activeWeekProjects.sort((a, b) => b.hours - a.hours);

                    return (
                      <div className="bg-slate-900/95 backdrop-blur-xs border border-slate-700 rounded-xl p-3 shadow-2xl text-xs text-slate-200 min-w-[260px] max-w-sm z-50">
                        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
                          <span className="font-bold text-white text-sm">{dataRow.fullLabel || label}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-black ${
                              isOver
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            {util.toFixed(0)}% Ocupação
                          </span>
                        </div>

                        <div className="space-y-1 text-slate-300 mb-2">
                          <div className="flex justify-between">
                            <span>Demanda Total:</span>
                            <strong className="text-white font-mono">{totalLoad.toFixed(1)}h</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Capacidade Efetiva:</span>
                            <strong className="text-emerald-400 font-mono">{capacity.toFixed(0)}h</strong>
                          </div>
                          {dataRow.nominalCapacity !== undefined && dataRow.nominalCapacity !== capacity && (
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>Capacidade Nominal (s/ paradas):</span>
                              <span className="font-mono">{dataRow.nominalCapacity.toFixed(0)}h</span>
                            </div>
                          )}
                          {isOver && (
                            <div className="text-rose-400 text-[11px] font-bold pt-1 border-t border-slate-800 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>Sobrecarga de +{(totalLoad - capacity).toFixed(1)}h</span>
                            </div>
                          )}
                          {dataRow.activeHolidays && dataRow.activeHolidays.length > 0 && (
                            <div className="pt-1.5 mt-1 border-t border-slate-800 text-[11px] text-amber-300 bg-amber-950/40 p-1.5 rounded-lg">
                              <div className="font-bold flex items-center gap-1 mb-0.5">
                                <span>🏖️</span>
                                <span>Parada / Feriado na Semana:</span>
                              </div>
                              <div className="text-[10px] text-slate-300">
                                {dataRow.activeHolidays.map((h: any) => h.title).join(', ')}
                              </div>
                              {capacity === 0 && (
                                <div className="text-[10px] text-amber-400 font-black mt-0.5">
                                  ⚠️ Parada Total (0h de capacidade útil)
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {activeWeekProjects.length > 0 && (
                          <div className="pt-2 border-t border-slate-700/80">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                              Projetos na Semana ({activeWeekProjects.length}):
                            </span>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {activeWeekProjects.map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                                  <div className="flex items-center gap-1.5 truncate min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: p.color }} />
                                    <span className="truncate text-slate-300" title={p.name}>{p.name}</span>
                                  </div>
                                  <span className="font-mono font-bold text-white shrink-0">{p.hours.toFixed(1)}h</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {/* Capacity Threshold Reference Line */}
                <ReferenceLine
                  y={
                    isShowingSpecificWcInGroup && currentSubWcSummary
                      ? currentSubWcSummary.weeklyCapacity
                      : currentGroupSummary.weeklyCapacity
                  }
                  label={{
                    value: `Capacidade ${isShowingSpecificWcInGroup ? 'do CT' : 'Consolidada'}: ${Math.round(
                      (isShowingSpecificWcInGroup && currentSubWcSummary
                        ? currentSubWcSummary.weeklyCapacity
                        : currentGroupSummary.weeklyCapacity) || 0
                    ).toLocaleString()}h`,
                    fill: '#dc2626',
                    fontSize: 11,
                    fontWeight: 'bold',
                    position: 'top',
                  }}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />

                {/* Bars for each project with demand */}
                {(() => {
                  const renderList = projectsInCurrentView.length > 0 ? projectsInCurrentView : activeProjects;
                  return renderList.map((proj, idx) => {
                    const isLast = idx === renderList.length - 1;
                    const isSimulated = proj.id === currentSimProjectId && hasActiveSimulation;
                    return (
                      <Bar
                        key={proj.id}
                        dataKey={proj.id}
                        name={proj.name}
                        stackId="a"
                        fill={proj.color || `hsl(${(idx * 45) % 360}, 65%, 50%)`}
                        isAnimationActive={false}
                        stroke={isSimulated ? '#06b6d4' : undefined}
                        strokeWidth={isSimulated ? 2 : 0}
                        radius={isLast ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      >
                        {isLast && (
                          <LabelList
                            dataKey="totalLoad"
                            position="top"
                            angle={-90}
                            offset={14}
                            textAnchor="start"
                            style={{ fontSize: '10px', fontWeight: 'bold', fill: '#334155' }}
                            formatter={(val: any) =>
                              val && Number(val) > 0 ? `${Number(val).toFixed(0)}h` : ''
                            }
                          />
                        )}
                      </Bar>
                    );
                  });
                })()}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* External Legend & Reference Bar (Outside Chart to guarantee 100% chart height & visibility) */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4 text-slate-600 flex-wrap">
                {/* Capacity Reference Legend */}
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-red-600"></span>
                  <span className="font-semibold text-slate-700 text-[11px]">
                    Capacidade Consolidada:{' '}
                    <strong className="text-red-700 font-bold">
                      {Math.round(currentGroupSummary.weeklyCapacity || 0).toLocaleString()}h/sem
                    </strong>
                  </span>
                </div>

                {/* Projects Count */}
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    <strong className="text-slate-800 font-bold">{projectsInCurrentView.length}</strong> projeto(s) com carga neste agrupador
                  </span>
                </div>
              </div>

              {projectsInCurrentView.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllLegends(!showAllLegends)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/70 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors"
                >
                  <span>{showAllLegends ? 'Ocultar Legenda Detalhada' : `Ver Legenda Completa (${projectsInCurrentView.length} projetos)`}</span>
                  {showAllLegends ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Legend Chips */}
            {projectsInCurrentView.length > 0 && (
              <div
                className={`flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 transition-all ${
                  projectsInCurrentView.length > 8 && !showAllLegends
                    ? 'max-h-14 overflow-hidden'
                    : 'max-h-48 overflow-y-auto p-1.5 bg-slate-50/80 rounded-lg border border-slate-200/80'
                }`}
              >
                {(projectsInCurrentView.length > 8 && !showAllLegends
                  ? projectsInCurrentView.slice(0, 8)
                  : projectsInCurrentView
                ).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs shrink-0 max-w-[220px]"
                    title={p.name}
                  >
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
                    <span className="truncate text-slate-700 font-medium text-[11px]">{p.name}</span>
                  </div>
                ))}
                {projectsInCurrentView.length > 8 && !showAllLegends && (
                  <button
                    type="button"
                    onClick={() => setShowAllLegends(true)}
                    className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                  >
                    +{projectsInCurrentView.length - 8} mais...
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick breakdown of work centers inside the selected group */}
          {selectedGroup !== 'ALL' && expandedGroups[currentGroupSummary.groupName] && (
            <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/70 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Detalhamento dos {currentGroupSummary.workCenterCount} Centros de Trabalho de {currentGroupSummary.groupName}</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Ajuste recursos individualmente ou clique em &quot;Ver no Gráfico&quot; para analisar o centro
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {currentGroupSummary.workCenters.map((wc) => {
                  const wcSummary = currentSummaries.find((s) => s.workCenter.id === wc.id);
                  const isWcOverloaded = (wcSummary?.maxUtilizationPercentage || 0) > 100;

                  return (
                    <div
                      key={wc.id}
                      className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:border-indigo-300 transition-colors flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-black text-xs text-slate-900 block truncate">
                            {wc.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Demanda: {Math.round(wcSummary?.totalRequiredHours || 0).toLocaleString()}h | Cap: {Math.round(wcSummary?.weeklyCapacity || 0).toLocaleString()}h/sem
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                            isWcOverloaded
                              ? 'bg-rose-100 text-rose-800'
                              : (wcSummary?.maxUtilizationPercentage || 0) > 85
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {(wcSummary?.maxUtilizationPercentage || 0).toFixed(0)}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        {/* Resource Adjuster */}
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md">
                          <button
                            onClick={() => handleResourceCountChange(wc, -1)}
                            className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 rounded-l cursor-pointer font-bold text-xs"
                            title="Diminuir recurso"
                          >
                            -
                          </button>
                          <span className="px-2 text-[11px] font-black text-slate-900">
                            {wc.resourcesCount} rec
                          </span>
                          <button
                            onClick={() => handleResourceCountChange(wc, 1)}
                            className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 rounded-r cursor-pointer font-bold text-xs"
                            title="Aumentar recurso"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => setSelectedSubWcId(wc.id)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                          title="Exibir gráfico específico deste centro de trabalho"
                        >
                          <span>Ver no Gráfico</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Chart Card (INDIVIDUAL MODE: Individual Work Center) */}
      {viewMode === 'INDIVIDUAL' && selectedIndividualSummary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  {selectedIndividualSummary.workCenter.name}
                </h2>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    selectedIndividualSummary.maxUtilizationPercentage > 100
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : selectedIndividualSummary.maxUtilizationPercentage > 85
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {(selectedIndividualSummary.maxUtilizationPercentage ?? 0) > 100
                    ? `Sobrecarga (${(selectedIndividualSummary.maxUtilizationPercentage ?? 0).toFixed(0)}% Máx)`
                    : `${(selectedIndividualSummary.maxUtilizationPercentage ?? 0).toFixed(0)}% Ocupação`}
                </span>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                  Agrupador: {getWorkCenterCategory(selectedIndividualSummary.workCenter)}
                </span>
                {projectShiftDays !== 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-700" />
                    <span>Simulação: {projectShiftDays > 0 ? `+${projectShiftDays}d` : `${projectShiftDays}d`}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Demanda Total: <strong className="text-slate-800">{Math.round(selectedIndividualSummary.totalRequiredHours || 0).toLocaleString()}h</strong> |
                Capacidade Instalada: <strong className="text-slate-800">{Math.round(selectedIndividualSummary.weeklyCapacity || 0).toLocaleString()}h/semana</strong> ({selectedIndividualSummary.workCenter.resourcesCount} recursos × {selectedIndividualSummary.workCenter.dailyHours}h/dia)
              </p>
            </div>

            {/* Quick Adjustment Controls for Selected WC */}
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Recursos:
              </span>
              <div className="flex items-center bg-white border border-slate-300 rounded-md shadow-xs">
                <button
                  onClick={() => handleResourceCountChange(selectedIndividualSummary.workCenter, -1)}
                  className="p-1 hover:bg-slate-100 text-slate-600 border-r border-slate-200 cursor-pointer"
                  title="Diminuir recurso"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 text-xs font-bold text-slate-900">
                  {selectedIndividualSummary.workCenter.resourcesCount}
                </span>
                <button
                  onClick={() => handleResourceCountChange(selectedIndividualSummary.workCenter, 1)}
                  className="p-1 hover:bg-slate-100 text-slate-600 border-l border-slate-200 cursor-pointer"
                  title="Aumentar recurso"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-px bg-slate-300"></div>

              <span className="text-xs font-semibold text-slate-700">Horas/Dia:</span>
              <select
                value={selectedIndividualSummary.workCenter.dailyHours}
                onChange={(e) => handleDailyHoursChange(selectedIndividualSummary.workCenter, parseFloat(e.target.value))}
                className="text-xs bg-white border border-slate-300 rounded-md px-2 py-1 font-medium focus:ring-1 focus:ring-indigo-500"
              >
                <option value={8}>8 horas (1 turno)</option>
                <option value={8.8}>8.8 horas</option>
                <option value={16}>16 horas (2 turnos)</option>
                <option value={24}>24 horas (3 turnos)</option>
              </select>
            </div>
          </div>

          {/* Recharts Stacked Weekly Demand vs Capacity Line - Dedicated Full-Height View */}
          <div className="h-[390px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 30, right: 30, left: 10, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                  angle={-90}
                  textAnchor="end"
                  dy={6}
                  dx={-2}
                  interval={0}
                  height={50}
                />
                <YAxis
                  domain={[0, maxYValue]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  unit="h"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const dataRow = payload[0]?.payload;
                    if (!dataRow) return null;

                    const totalLoad = dataRow.totalLoad || 0;
                    const capacity = dataRow.capacity || 0;
                    const util = capacity > 0 ? (totalLoad / capacity) * 100 : 0;
                    const isOver = capacity > 0 && totalLoad > capacity;

                    const activeWeekProjects: { id: string; name: string; hours: number; color: string }[] = [];
                    for (const proj of projectsInCurrentView) {
                      const val = dataRow[proj.id] || 0;
                      if (val > 0) {
                        activeWeekProjects.push({
                          id: proj.id,
                          name: proj.name,
                          hours: val,
                          color: proj.color || '#6366f1',
                        });
                      }
                    }
                    activeWeekProjects.sort((a, b) => b.hours - a.hours);

                    return (
                      <div className="bg-slate-900/95 backdrop-blur-xs border border-slate-700 rounded-xl p-3 shadow-2xl text-xs text-slate-200 min-w-[260px] max-w-sm z-50">
                        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
                          <span className="font-bold text-white text-sm">{dataRow.fullLabel || label}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-black ${
                              isOver
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            {util.toFixed(0)}% Ocupação
                          </span>
                        </div>

                        <div className="space-y-1 text-slate-300 mb-2">
                          <div className="flex justify-between">
                            <span>Demanda Total:</span>
                            <strong className="text-white font-mono">{totalLoad.toFixed(1)}h</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Capacidade Efetiva:</span>
                            <strong className="text-emerald-400 font-mono">{capacity.toFixed(0)}h</strong>
                          </div>
                          {dataRow.nominalCapacity !== undefined && dataRow.nominalCapacity !== capacity && (
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>Capacidade Nominal (s/ paradas):</span>
                              <span className="font-mono">{dataRow.nominalCapacity.toFixed(0)}h</span>
                            </div>
                          )}
                          {isOver && (
                            <div className="text-rose-400 text-[11px] font-bold pt-1 border-t border-slate-800 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>Sobrecarga de +{(totalLoad - capacity).toFixed(1)}h</span>
                            </div>
                          )}
                          {dataRow.activeHolidays && dataRow.activeHolidays.length > 0 && (
                            <div className="pt-1.5 mt-1 border-t border-slate-800 text-[11px] text-amber-300 bg-amber-950/40 p-1.5 rounded-lg">
                              <div className="font-bold flex items-center gap-1 mb-0.5">
                                <span>🏖️</span>
                                <span>Parada / Feriado no CT:</span>
                              </div>
                              <div className="text-[10px] text-slate-300">
                                {dataRow.activeHolidays.map((h: any) => h.title).join(', ')}
                              </div>
                              {capacity === 0 && (
                                <div className="text-[10px] text-amber-400 font-black mt-0.5">
                                  ⚠️ Posto Fechado (0h de capacidade útil)
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {activeWeekProjects.length > 0 && (
                          <div className="pt-2 border-t border-slate-700/80">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                              Projetos na Semana ({activeWeekProjects.length}):
                            </span>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {activeWeekProjects.map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                                  <div className="flex items-center gap-1.5 truncate min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: p.color }} />
                                    <span className="truncate text-slate-300" title={p.name}>{p.name}</span>
                                  </div>
                                  <span className="font-mono font-bold text-white shrink-0">{p.hours.toFixed(1)}h</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {/* Capacity Threshold Reference Line */}
                <ReferenceLine
                  y={selectedIndividualSummary.weeklyCapacity}
                  label={{
                    value: `Capacidade Líquida: ${Math.round(selectedIndividualSummary.weeklyCapacity || 0).toLocaleString()}h`,
                    fill: '#dc2626',
                    fontSize: 11,
                    fontWeight: 'bold',
                    position: 'top',
                  }}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />

                {/* Bars for each project with demand */}
                {(() => {
                  const renderList = projectsInCurrentView.length > 0 ? projectsInCurrentView : activeProjects;
                  return renderList.map((proj, idx) => {
                    const isLast = idx === renderList.length - 1;
                    const isSimulated = proj.id === currentSimProjectId && hasActiveSimulation;
                    return (
                      <Bar
                        key={proj.id}
                        dataKey={proj.id}
                        name={proj.name}
                        stackId="a"
                        fill={proj.color || `hsl(${(idx * 45) % 360}, 65%, 50%)`}
                        isAnimationActive={false}
                        stroke={isSimulated ? '#06b6d4' : undefined}
                        strokeWidth={isSimulated ? 2 : 0}
                        radius={isLast ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      >
                        {isLast && (
                          <LabelList
                            dataKey="totalLoad"
                            position="top"
                            angle={-90}
                            offset={14}
                            textAnchor="start"
                            style={{ fontSize: '10px', fontWeight: 'bold', fill: '#334155' }}
                            formatter={(val: any) =>
                              val && Number(val) > 0 ? `${Number(val).toFixed(0)}h` : ''
                            }
                          />
                        )}
                      </Bar>
                    );
                  });
                })()}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* External Legend & Reference Bar (Outside Chart to guarantee 100% chart height & visibility) */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4 text-slate-600 flex-wrap">
                {/* Capacity Reference Legend */}
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-red-600"></span>
                  <span className="font-semibold text-slate-700 text-[11px]">
                    Capacidade Líquida:{' '}
                    <strong className="text-red-700 font-bold">
                      {Math.round(selectedIndividualSummary.weeklyCapacity || 0).toLocaleString()}h/sem
                    </strong>
                  </span>
                </div>

                {/* Projects Count */}
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    <strong className="text-slate-800 font-bold">{projectsInCurrentView.length}</strong> projeto(s) com carga neste posto
                  </span>
                </div>
              </div>

              {projectsInCurrentView.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllLegends(!showAllLegends)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/70 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors"
                >
                  <span>{showAllLegends ? 'Ocultar Legenda Detalhada' : `Ver Legenda Completa (${projectsInCurrentView.length} projetos)`}</span>
                  {showAllLegends ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Legend Chips */}
            {projectsInCurrentView.length > 0 && (
              <div
                className={`flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 transition-all ${
                  projectsInCurrentView.length > 8 && !showAllLegends
                    ? 'max-h-14 overflow-hidden'
                    : 'max-h-48 overflow-y-auto p-1.5 bg-slate-50/80 rounded-lg border border-slate-200/80'
                }`}
              >
                {(projectsInCurrentView.length > 8 && !showAllLegends
                  ? projectsInCurrentView.slice(0, 8)
                  : projectsInCurrentView
                ).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs shrink-0 max-w-[220px]"
                    title={p.name}
                  >
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
                    <span className="truncate text-slate-700 font-medium text-[11px]">{p.name}</span>
                  </div>
                ))}
                {projectsInCurrentView.length > 8 && !showAllLegends && (
                  <button
                    type="button"
                    onClick={() => setShowAllLegends(true)}
                    className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                  >
                    +{projectsInCurrentView.length - 8} mais...
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- INTERACTIVE PROJECT & GROUP TIMELINE SHIFTER & LOAD RELIEF CONTROLLER --- */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 border border-slate-700 shadow-xl space-y-4">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-700/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-400/30">
              <MoveHorizontal className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-wide text-white uppercase">
                  Simulador de Deslocamento de Projetos & Grupos
                </h3>
                {hasActiveSimulation && (
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 animate-pulse flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-300" />
                    <span>Simulação Ativa</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Selecione o projeto e escolha deslocar o <strong>projeto inteiro</strong> ou <strong>grupos específicos (Solda, Usinagem, etc.)</strong> para nivelar gargalos em tempo real.
              </p>
            </div>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-300">Projeto:</span>
            <select
              value={currentSimProjectId}
              onChange={(e) => {
                setSelectedSimProjectId(e.target.value);
                setSelectedSimScope('ALL');
                setProjectShiftDays(0);
                setGroupShifts({});
              }}
              className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer max-w-xs"
            >
              {activeProjects.map((p) => {
                const totalH = getProjectTotalHours(p, workCenters);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({Math.round(totalH)}h)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Scope Selector: Entire Project OR Specific Group within the Project */}
        {selectedSimProject && (
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>O que você deseja deslocar neste projeto?</span>
              </span>
              {hasActiveSimulation && (
                <button
                  onClick={handleResetAllShifts}
                  className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpar Todos os Deslocamentos</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Option 1: Entire Project */}
              <button
                type="button"
                onClick={() => setSelectedSimScope('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                  selectedSimScope === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-900/40 ring-2 ring-indigo-400/40'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Projeto Inteiro (Todas as Etapas)</span>
                {projectShiftDays !== 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-400 text-slate-950">
                    {projectShiftDays > 0 ? `+${projectShiftDays}d` : `${projectShiftDays}d`}
                  </span>
                )}
              </button>

              {/* Options for each group in this project */}
              {selectedProjectGroups.map((grp) => {
                const isSelected = selectedSimScope === grp.groupName;
                const shiftForGrp = groupShifts[grp.groupName] || 0;
                return (
                  <button
                    key={grp.groupName}
                    type="button"
                    onClick={() => setSelectedSimScope(grp.groupName)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-900/40 ring-2 ring-indigo-400/40'
                        : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Flame className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-amber-400/70'}`} />
                    <span>{grp.groupName}</span>
                    <span className="text-[10px] opacity-75 font-mono">({Math.round(grp.hours)}h)</span>
                    {shiftForGrp !== 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-400 text-slate-950">
                        {shiftForGrp > 0 ? `+${shiftForGrp}d` : `${shiftForGrp}d`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Target Details & Shift Slider Controls */}
        {selectedSimProject && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Target Info & Date Badge */}
            <div className="lg:col-span-4 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white/20"
                    style={{ backgroundColor: selectedSimProject.color || '#6366f1' }}
                  ></div>
                  <div className="truncate">
                    <span className="text-xs font-black text-white block truncate">
                      {selectedSimScope === 'ALL' ? selectedSimProject.name : `Grupo: ${selectedSimScope}`}
                    </span>
                    {selectedSimScope !== 'ALL' && (
                      <span className="text-[10px] text-slate-400 block truncate">
                        em {selectedSimProject.name}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  currentSimShiftValue !== 0
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {currentSimShiftValue === 0 ? 'Data Original' : `${currentSimShiftValue > 0 ? '+' : ''}${currentSimShiftValue} dias`}
                </span>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60 font-mono space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-200">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{simulatedTargetDates.simulatedStart}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{simulatedTargetDates.simulatedEnd}</span>
                  </div>
                </div>
                {currentSimShiftValue !== 0 && (
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                    <span>Original:</span>
                    <span>{simulatedTargetDates.originalStart} ➔ {simulatedTargetDates.originalEnd}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Shift Slider & Step Buttons */}
            <div className="lg:col-span-8 space-y-2.5">
              {/* Interactive Range Slider (Drag bar) */}
              <div className="space-y-1 bg-slate-800/60 p-3 rounded-xl border border-slate-700/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1">
                    <MoveHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {selectedSimScope === 'ALL'
                        ? 'Deslocar Projeto Inteiro no Tempo:'
                        : `Deslocar Grupo ${selectedSimScope} no Tempo:`}
                    </span>
                  </span>
                  <span className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                    currentSimShiftValue > 0
                      ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/40'
                      : currentSimShiftValue < 0
                      ? 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {currentSimShiftValue === 0
                      ? '0 dias (Original)'
                      : `${currentSimShiftValue > 0 ? `+${currentSimShiftValue}` : currentSimShiftValue} dias (${(currentSimShiftValue / 7).toFixed(1)} sem)`}
                  </span>
                </div>

                <div className="pt-1">
                  <input
                    type="range"
                    min={-28}
                    max={28}
                    step={1}
                    value={currentSimShiftValue}
                    onChange={(e) => handleSetCurrentShift(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1 pt-1">
                    <span>-4 sem (-28d)</span>
                    <span>-2 sem</span>
                    <span>-1 sem</span>
                    <span className="text-white font-bold">0 (Original)</span>
                    <span>+1 sem</span>
                    <span>+2 sem</span>
                    <span>+4 sem (+28d)</span>
                  </div>
                </div>
              </div>

              {/* Quick Step Buttons Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Ajuste Rápido:
                  </span>
                  <button
                    onClick={() => handleStepCurrentShift(-14)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Antecipar 2 semanas (-14 dias)"
                  >
                    <ArrowLeft className="w-3 h-3 text-amber-400" />
                    <span>-2 sem</span>
                  </button>
                  <button
                    onClick={() => handleStepCurrentShift(-7)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Antecipar 1 semana (-7 dias)"
                  >
                    <ArrowLeft className="w-3 h-3 text-amber-400" />
                    <span>-1 sem</span>
                  </button>
                  <button
                    onClick={() => handleStepCurrentShift(-1)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    title="Antecipar 1 dia"
                  >
                    -1d
                  </button>
                  <button
                    onClick={handleResetCurrentShift}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                      currentSimShiftValue === 0
                        ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-default'
                        : 'bg-indigo-600/60 hover:bg-indigo-600 text-white border-indigo-500'
                    }`}
                    title="Restaurar posição original do item selecionado"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Original (0)</span>
                  </button>
                  <button
                    onClick={() => handleStepCurrentShift(1)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    title="Postergar 1 dia"
                  >
                    +1d
                  </button>
                  <button
                    onClick={() => handleStepCurrentShift(7)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Postergar 1 semana (+7 dias)"
                  >
                    <span>+1 sem</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                  </button>
                  <button
                    onClick={() => handleStepCurrentShift(14)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Postergar 2 semanas (+14 dias)"
                  >
                    <span>+2 sem</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                  </button>
                </div>

                {/* Save to Project Button */}
                {hasActiveSimulation && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleApplyShiftToProject}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar no Projeto</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Active Shifts Summary Badges if multiple are active */}
              {hasActiveSimulation && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-300">
                  <span className="font-bold text-slate-400">Deslocamentos ativos:</span>
                  {projectShiftDays !== 0 && (
                    <span className="px-2 py-0.5 bg-slate-800 rounded-md border border-slate-700 flex items-center gap-1">
                      <span>Projeto: <strong>{projectShiftDays > 0 ? `+${projectShiftDays}` : projectShiftDays}d</strong></span>
                      <button onClick={() => setProjectShiftDays(0)} className="text-slate-400 hover:text-white cursor-pointer ml-1">×</button>
                    </span>
                  )}
                  {Object.entries(groupShifts).map(([grp, offVal]) => {
                    const off = Number(offVal) || 0;
                    if (off === 0) return null;
                    return (
                      <span key={grp} className="px-2 py-0.5 bg-slate-800 rounded-md border border-slate-700 flex items-center gap-1">
                        <span>{grp}: <strong>{off > 0 ? `+${off}` : off}d</strong></span>
                        <button onClick={() => setGroupShifts(prev => ({ ...prev, [grp]: 0 }))} className="text-slate-400 hover:text-white cursor-pointer ml-1">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Simulation Impact / Load Relief Feedback */}
        {simulationImpact && (
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${
                simulationImpact.isRelieved
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
              }`}>
                {simulationImpact.isRelieved ? (
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div>
                <span className="font-bold text-white block">
                  {simulationImpact.isRelieved ? '✨ Alívio de Carga e Gargalos Detectado!' : '⚠️ Impacto na Curva de Demanda'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Pico Semanal: <strong className="text-white">{Math.round(simulationImpact.baselinePeak)}h</strong> ➔ <strong className={simulationImpact.isRelieved ? 'text-emerald-400' : 'text-amber-400'}>{Math.round(simulationImpact.simulatedPeak)}h</strong>
                  {' '}({simulationImpact.peakDelta > 0 ? `+${Math.round(simulationImpact.peakDelta)}h` : `${Math.round(simulationImpact.peakDelta)}h`})
                  {' • '}
                  Semanas com Sobrecarga: <strong className="text-white">{simulationImpact.baselineOverloadedWeeks}</strong> ➔ <strong className={simulationImpact.simulatedOverloadedWeeks < simulationImpact.baselineOverloadedWeeks ? 'text-emerald-400' : 'text-slate-300'}>{simulationImpact.simulatedOverloadedWeeks}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleResetAllShifts}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 cursor-pointer"
              >
                Desfazer Tudo
              </button>
              <button
                onClick={handleApplyShiftToProject}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Aplicar Cronograma</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TABLE 1: Consolidated Sector Groups Table (In GROUP mode) */}
      {viewMode === 'GROUP' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Consolidado por Agrupadores de Setor ({sectorSummaries.length} agrupadores)
              </h3>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Clique em uma linha para exibir o agrupador no gráfico acima
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Agrupador / Setor</th>
                  <th className="py-3 px-3 text-center">Postos / Centros</th>
                  <th className="py-3 px-3 text-center">Recursos Totais</th>
                  <th className="py-3 px-3 text-right">Capacidade Semanal</th>
                  <th className="py-3 px-3 text-right">Carga Total</th>
                  <th className="py-3 px-3 text-right">Pico Semanal</th>
                  <th className="py-3 px-4 text-center">Ocupação Máx</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                {/* Global "TODOS (Fábrica Completa)" Row */}
                <tr
                  onClick={() => setSelectedGroup('ALL')}
                  className={`cursor-pointer transition-colors font-bold ${
                    selectedGroup === 'ALL'
                      ? 'bg-indigo-50/90 ring-1 ring-inset ring-indigo-300'
                      : allFactorySummary.maxUtilizationPercentage > 100
                      ? 'bg-rose-50/40 hover:bg-rose-50/70'
                      : 'bg-slate-50/50 hover:bg-slate-100/70'
                  }`}
                >
                  <td className="py-3 px-4 text-indigo-950 font-black flex items-center gap-2 uppercase tracking-wide">
                    <span>🌟 TODOS (Fábrica Completa)</span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span className="bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded-md text-[11px]">
                      {allFactorySummary.workCenterCount} centros
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center font-extrabold text-indigo-950">
                    {allFactorySummary.totalResources} operadores/máquinas
                  </td>

                  <td className="py-3 px-3 text-right font-medium text-slate-600">
                    {Math.round(allFactorySummary.weeklyCapacity || 0).toLocaleString()}h/sem
                  </td>

                  <td className="py-3 px-3 text-right font-black text-slate-900">
                    {Math.round(allFactorySummary.totalRequiredHours || 0).toLocaleString()}h
                  </td>

                  <td className="py-3 px-3 text-right font-bold text-slate-800">
                    {Math.round(allFactorySummary.peakWeeklyLoad || 0).toLocaleString()}h
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300">
                        <div
                          className={`h-full ${
                            allFactorySummary.maxUtilizationPercentage > 100
                              ? 'bg-rose-500'
                              : allFactorySummary.maxUtilizationPercentage > 85
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(100, allFactorySummary.maxUtilizationPercentage)}%`,
                          }}
                        ></div>
                      </div>
                      <span className="font-black text-xs">
                        {(allFactorySummary.maxUtilizationPercentage ?? 0).toFixed(0)}%
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        allFactorySummary.maxUtilizationPercentage > 100
                          ? 'bg-rose-100 text-rose-800'
                          : allFactorySummary.maxUtilizationPercentage > 85
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {allFactorySummary.maxUtilizationPercentage > 100 ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Gargalo Fabril
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          OK
                        </>
                      )}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedGroup('ALL')}
                      className={`px-2.5 py-1 font-bold rounded-md text-[11px] transition-colors cursor-pointer ${
                        selectedGroup === 'ALL'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedGroup === 'ALL' ? 'No Gráfico' : 'Ver Gráfico'}
                    </button>
                  </td>
                </tr>

                {sectorSummaries.map((s) => {
                  const isSelected = selectedGroup === s.groupName;
                  const isOverloaded = s.maxUtilizationPercentage > 100;
                  const isExpanded = !!expandedGroups[s.groupName];

                  return (
                    <React.Fragment key={s.groupName}>
                      <tr
                        onClick={() => setSelectedGroup(s.groupName)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-50/90'
                            : isOverloaded
                            ? 'bg-rose-50/40 hover:bg-rose-50/70'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-4 text-slate-900 font-black flex items-center gap-2 uppercase tracking-wide">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroupExpand(s.groupName);
                            }}
                            className="p-1 hover:bg-slate-200/60 rounded text-slate-500 cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <span>{s.groupName}</span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                            {s.workCenterCount} centros
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center font-extrabold text-indigo-950">
                          {s.totalResources} operadores/máquinas
                        </td>

                        <td className="py-3 px-3 text-right font-medium text-slate-600">
                          {Math.round(s.weeklyCapacity || 0).toLocaleString()}h/sem
                        </td>

                        <td className="py-3 px-3 text-right font-black text-slate-900">
                          {Math.round(s.totalRequiredHours || 0).toLocaleString()}h
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                          {Math.round(s.peakWeeklyLoad || 0).toLocaleString()}h
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                              <div
                                className={`h-full ${
                                  isOverloaded
                                    ? 'bg-rose-500'
                                    : s.maxUtilizationPercentage > 85
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, s.maxUtilizationPercentage)}%`,
                                }}
                              ></div>
                            </div>
                            <span className="font-black text-xs">
                              {(s.maxUtilizationPercentage ?? 0).toFixed(0)}%
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              isOverloaded
                                ? 'bg-rose-100 text-rose-800'
                                : s.maxUtilizationPercentage > 85
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isOverloaded ? (
                              <>
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                Gargalo
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                OK
                              </>
                            )}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedGroup(s.groupName);
                              }}
                              className={`px-2.5 py-1 font-bold rounded-md text-[11px] transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isSelected ? 'No Gráfico' : 'Ver Gráfico'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Sub-rows: Individual Work Centers inside this Sector */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-slate-50/90 p-3 pl-10 border-b border-slate-200">
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Centros de Trabalho pertencentes a {s.groupName}:
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {s.workCenters.map((wc) => {
                                  const wcSummary = currentSummaries.find((sum) => sum.workCenter.id === wc.id);
                                  const isWcOver = (wcSummary?.maxUtilizationPercentage || 0) > 100;

                                  return (
                                    <div
                                      key={wc.id}
                                      className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between shadow-2xs"
                                    >
                                      <div className="min-w-0 pr-2">
                                        <span className="font-bold text-xs text-slate-900 block truncate">
                                          {wc.name}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          {Math.round(wcSummary?.totalRequiredHours || 0).toLocaleString()}h / {Math.round(wcSummary?.weeklyCapacity || 0).toLocaleString()}h sem
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span
                                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                            isWcOver ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                          }`}
                                        >
                                          {(wcSummary?.maxUtilizationPercentage || 0).toFixed(0)}%
                                        </span>
                                        <button
                                          onClick={() => switchToIndividual(wc.id)}
                                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                        >
                                          Ver Gráfico
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLE 2: Interactive Individual Work Centers Table (In INDIVIDUAL mode) */}
      {viewMode === 'INDIVIDUAL' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Capacidade & Ocupação por Centro de Trabalho ({filteredIndividualSummaries.length} exibidos de {summaries.length})
              </h3>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Clique em qualquer centro da lista para exibir seus indicadores individuais no gráfico
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Centro de Trabalho</th>
                  <th className="py-3 px-3 text-center">Agrupador</th>
                  <th className="py-3 px-3 text-center">Recursos</th>
                  <th className="py-3 px-3 text-center">Horas/Dia</th>
                  <th className="py-3 px-3 text-right">Capacidade Semanal</th>
                  <th className="py-3 px-3 text-right">Carga Total</th>
                  <th className="py-3 px-3 text-right">Pico Semanal</th>
                  <th className="py-3 px-4 text-center">Ocupação Máx</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                {filteredIndividualSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Layers className="w-6 h-6 text-slate-400" />
                        <span className="font-bold text-xs text-slate-700">Nenhum centro de trabalho com demanda alocada</span>
                        <span className="text-[11px] text-slate-400">Centros sem horas alocadas em projetos neste cenário não são contabilizados.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredIndividualSummaries.map((s) => {
                  const wc = s.workCenter;
                  const isSelected = wc.id === selectedIndividualSummary?.workCenter.id;
                  const isOverloaded = s.maxUtilizationPercentage > 100;
                  const category = getWorkCenterCategory(wc);

                  return (
                    <tr
                      key={wc.id}
                      onClick={() => setSelectedWcId(wc.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/90 ring-1 ring-inset ring-indigo-300'
                          : isOverloaded
                          ? 'bg-rose-50/40 hover:bg-rose-50/70'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-900 font-extrabold flex items-center gap-2">
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isSelected ? 'rotate-90 text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                        <span>{wc.name}</span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="text-[10px] font-black uppercase text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {category}
                        </span>
                      </td>

                      {/* Interactive Resources Count buttons in row */}
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs">
                          <button
                            onClick={() => handleResourceCountChange(wc, -1)}
                            className="px-2 py-0.5 hover:bg-slate-100 text-slate-600 rounded-l cursor-pointer font-bold"
                          >
                            -
                          </button>
                          <span className="px-2.5 text-xs font-black text-slate-900">
                            {wc.resourcesCount}
                          </span>
                          <button
                            onClick={() => handleResourceCountChange(wc, 1)}
                            className="px-2.5 py-0.5 hover:bg-slate-100 text-slate-600 rounded-r cursor-pointer font-bold"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className="text-slate-700 font-bold">{wc.dailyHours}h</span>
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-slate-600">
                        {Math.round(s.weeklyCapacity || 0).toLocaleString()}h
                      </td>

                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {Math.round(s.totalRequiredHours || 0).toLocaleString()}h
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        {Math.round(s.peakWeeklyLoad || 0).toLocaleString()}h
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                            <div
                              className={`h-full ${
                                isOverloaded
                                  ? 'bg-rose-500'
                                  : s.maxUtilizationPercentage > 85
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${Math.min(100, s.maxUtilizationPercentage)}%`,
                              }}
                            ></div>
                          </div>
                          <span className="font-black text-xs">
                            {(s.maxUtilizationPercentage ?? 0).toFixed(0)}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isOverloaded
                              ? 'bg-rose-100 text-rose-800'
                              : s.maxUtilizationPercentage > 85
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOverloaded ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Gargalo
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              OK
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedWcId(wc.id)}
                          className={`px-2.5 py-1 font-semibold rounded-md text-[11px] transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isSelected ? 'No Gráfico' : 'Ver no Gráfico'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
