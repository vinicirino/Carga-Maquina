import React, { useState, useMemo } from 'react';
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
import { parseISO, format, addDays } from 'date-fns';
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
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
}

/**
 * Helper to shift a project's timeline (including work center and sector group custom dates)
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
}) => {
  // Mode: 'GROUP' (Consolidado por Agrupador de Setor) or 'INDIVIDUAL' (Por Centro de Trabalho)
  const [viewMode, setViewMode] = useState<'GROUP' | 'INDIVIDUAL'>('GROUP');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OVERLOADED' | 'OK'>('ALL');

  // Selected Group for GROUP mode: 'ALL' means "Todos os Agrupadores (Fábrica Completa)" or specific group name
  const [selectedGroup, setSelectedGroup] = useState<string>(initialSectorFilter || 'ALL');

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

  // --- INTERACTIVE PROJECT SHIFTING SIMULATION STATE ---
  const activeProjects = useMemo(() => projects.filter((p) => p.enabled !== false), [projects]);
  const [selectedSimProjectId, setSelectedSimProjectId] = useState<string>('');
  const [projectShiftDays, setProjectShiftDays] = useState<number>(0);
  const [saveToast, setSaveToast] = useState<string | null>(null);

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

  // Dynamically calculate effective projects with shift simulation applied
  const effectiveProjects = useMemo(() => {
    if (!projectShiftDays || projectShiftDays === 0 || !currentSimProjectId) {
      return projects;
    }
    return projects.map((p) => (p.id === currentSimProjectId ? shiftProjectDates(p, projectShiftDays) : p));
  }, [projects, currentSimProjectId, projectShiftDays]);

  // Dynamically recalculate weekly schedule in real time during simulation
  const effectiveSchedule = useMemo(() => {
    if (!projectShiftDays || projectShiftDays === 0) {
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
  }, [effectiveProjects, workCenters, projectShiftDays, weeklyBuckets, summaries]);

  const currentWeeklyBuckets = effectiveSchedule.weeklyBuckets;
  const currentSummaries = effectiveSchedule.workCenterSummaries;

  // Calculate sector group summaries (Aggregated)
  const sectorSummaries: SectorGroupSummary[] = useMemo(() => {
    const allGroups = Array.from(
      new Set([...sectorGroups, ...workCenters.map((wc) => getWorkCenterCategory(wc))])
    );

    return allGroups
      .map((grp) => {
        const groupWcs = workCenters.filter((wc) => getWorkCenterCategory(wc) === grp);
        if (groupWcs.length === 0) return null;

        const groupWcIds = new Set(groupWcs.map((wc) => wc.id));
        const groupWcSummaries = currentSummaries.filter((s) => groupWcIds.has(s.workCenter.id));

        const totalResources = groupWcs.reduce((acc, wc) => acc + (wc.resourcesCount || 0), 0);
        const weeklyCapacity = groupWcs.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);
        const totalRequiredHours = groupWcSummaries.reduce(
          (acc, s) => acc + (s.totalRequiredHours || 0),
          0
        );

        let peakWeeklyLoad = 0;
        let overloadedWeeksCount = 0;
        let totalUtilizationSum = 0;

        for (const bucket of currentWeeklyBuckets) {
          let weekLoad = 0;
          for (const wc of groupWcs) {
            weekLoad += bucket.workCenterLoads[wc.id] || 0;
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
          currentWeeklyBuckets.length > 0 && weeklyCapacity > 0
            ? totalUtilizationSum / currentWeeklyBuckets.length
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
  }, [sectorGroups, workCenters, currentSummaries, currentWeeklyBuckets]);

  // Consolidated "TODOS (Fábrica Completa)" summary
  const allFactorySummary: SectorGroupSummary = useMemo(() => {
    const totalResources = workCenters.reduce((acc, wc) => acc + (wc.resourcesCount || 0), 0);
    const weeklyCapacity = workCenters.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);
    const totalRequiredHours = currentSummaries.reduce((acc, s) => acc + (s.totalRequiredHours || 0), 0);

    let peakWeeklyLoad = 0;
    let overloadedWeeksCount = 0;
    let totalUtilizationSum = 0;

    for (const bucket of currentWeeklyBuckets) {
      let weekLoad = 0;
      for (const wc of workCenters) {
        weekLoad += bucket.workCenterLoads[wc.id] || 0;
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
      currentWeeklyBuckets.length > 0 && weeklyCapacity > 0
        ? totalUtilizationSum / currentWeeklyBuckets.length
        : 0;

    const status: 'OK' | 'WARNING' | 'CRITICAL' =
      maxUtilizationPercentage > 100
        ? 'CRITICAL'
        : maxUtilizationPercentage > 85
        ? 'WARNING'
        : 'OK';

    return {
      groupName: 'TODOS (Fábrica Completa)',
      workCenterCount: workCenters.length,
      totalResources,
      weeklyCapacity,
      totalRequiredHours,
      peakWeeklyLoad,
      maxUtilizationPercentage,
      averageUtilizationPercentage,
      overloadedWeeksCount,
      workCenters,
      status,
    };
  }, [workCenters, currentSummaries, currentWeeklyBuckets]);

  // Current selected group for GROUP mode
  const currentGroupSummary = useMemo(() => {
    if (selectedGroup === 'ALL') {
      return allFactorySummary;
    }
    const found = sectorSummaries.find((s) => s.groupName === selectedGroup);
    return found || allFactorySummary;
  }, [sectorSummaries, selectedGroup, allFactorySummary]);

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

  // Chart data: GROUP mode (specific or ALL) or INDIVIDUAL mode
  const chartData = useMemo(() => {
    if (viewMode === 'GROUP') {
      if (!currentGroupSummary) return [];

      const groupWcs = currentGroupSummary.workCenters;
      const weeklyCap = currentGroupSummary.weeklyCapacity;

      return currentWeeklyBuckets.map((bucket) => {
        const row: Record<string, any> = {
          weekLabel: bucket.label.split(' ')[1] || bucket.label,
          fullLabel: bucket.label,
          weekKey: bucket.weekKey,
          capacity: weeklyCap,
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
      const weeklyCap = selectedIndividualSummary.weeklyCapacity;

      return currentWeeklyBuckets.map((bucket) => {
        const projectLoads = bucket.projectBreakdown[wcId] || {};
        const row: Record<string, any> = {
          weekLabel: bucket.label.split(' ')[1] || bucket.label,
          fullLabel: bucket.label,
          weekKey: bucket.weekKey,
          capacity: weeklyCap,
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
  }, [viewMode, currentGroupSummary, selectedIndividualSummary, currentWeeklyBuckets, effectiveProjects]);

  // Dynamic Y domain with headroom
  const maxYValue = useMemo(() => {
    const weeklyCap =
      viewMode === 'GROUP'
        ? currentGroupSummary?.weeklyCapacity || 0
        : selectedIndividualSummary?.weeklyCapacity || 0;

    const maxBarLoad = Math.max(...chartData.map((d) => d.totalLoad || 0), 0);
    const highest = Math.max(maxBarLoad, weeklyCap);
    if (highest === 0) return 100;
    return Math.ceil(highest * 1.2);
  }, [viewMode, currentGroupSummary, selectedIndividualSummary, chartData]);

  // Impact metrics comparison: Original baseline vs Simulated shifted state
  const simulationImpact = useMemo(() => {
    if (!projectShiftDays || projectShiftDays === 0) {
      return null;
    }

    // Baseline calculation on original weeklyBuckets and summaries
    let baselinePeak = 0;
    let baselineOverloadedWeeks = 0;
    let targetCapacity = 0;

    if (viewMode === 'GROUP') {
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

    const simulatedPeak = currentGroupSummary?.peakWeeklyLoad || 0;
    const simulatedOverloadedWeeks = currentGroupSummary?.overloadedWeeksCount || 0;
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
  }, [projectShiftDays, viewMode, currentGroupSummary, selectedIndividualSummary, weeklyBuckets]);

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

  const handleApplyShiftToProject = () => {
    if (!selectedSimProject || projectShiftDays === 0) return;
    const updated = shiftProjectDates(selectedSimProject, projectShiftDays);
    if (onUpdateProject) {
      onUpdateProject(updated);
    }
    setProjectShiftDays(0);
    setSaveToast(`Cronograma de "${updated.name}" atualizado com sucesso (${projectShiftDays > 0 ? '+' : ''}${projectShiftDays} dias)!`);
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleResetShift = () => {
    setProjectShiftDays(0);
  };

  // Preview dates of shifted project
  const simulatedProjectDates = useMemo(() => {
    if (!selectedSimProject) return { start: '-', end: '-' };
    if (projectShiftDays === 0) {
      return {
        start: format(parseISO(selectedSimProject.startDate), 'dd/MM/yyyy'),
        end: format(parseISO(selectedSimProject.endDate), 'dd/MM/yyyy'),
      };
    }
    const shifted = shiftProjectDates(selectedSimProject, projectShiftDays);
    return {
      start: format(parseISO(shifted.startDate), 'dd/MM/yyyy'),
      end: format(parseISO(shifted.endDate), 'dd/MM/yyyy'),
    };
  }, [selectedSimProject, projectShiftDays]);

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
                {workCenters.length} postos
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
      </div>

      {/* Main Chart Card (GROUP MODE: Consolidado) */}
      {viewMode === 'GROUP' && currentGroupSummary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <FolderTree className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    {currentGroupSummary.groupName}
                  </h2>
                </div>

                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  {selectedGroup === 'ALL' ? 'Visão Fabril Consolidada' : 'Agrupador Consolidado'} ({currentGroupSummary.workCenterCount} centros)
                </span>

                <span
                  className={`px-2.5 py-0.5 text-xs font-black rounded-full ${
                    currentGroupSummary.maxUtilizationPercentage > 100
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : currentGroupSummary.maxUtilizationPercentage > 85
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {currentGroupSummary.maxUtilizationPercentage > 100
                    ? `Sobrecarga (${currentGroupSummary.maxUtilizationPercentage.toFixed(0)}% Máx)`
                    : `${currentGroupSummary.maxUtilizationPercentage.toFixed(0)}% Ocupação Máx`}
                </span>

                {projectShiftDays !== 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-700" />
                    <span>Simulação: {projectShiftDays > 0 ? `+${projectShiftDays}d` : `${projectShiftDays}d`}</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1.5">
                Demanda Total: <strong className="text-slate-800">{Math.round(currentGroupSummary.totalRequiredHours || 0).toLocaleString()}h</strong> |
                Capacidade Semanal Consolidada: <strong className="text-slate-800">{Math.round(currentGroupSummary.weeklyCapacity || 0).toLocaleString()}h/sem</strong>
                {' '}({currentGroupSummary.totalResources} recursos somados em {currentGroupSummary.workCenterCount} postos)
              </p>
            </div>

            {/* Resources summary box */}
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
          </div>

          {/* Recharts Stacked Weekly Demand vs Capacity Line */}
          <div className="h-80 w-full pt-2">
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
                  formatter={(value: any, name: any) => {
                    const proj = effectiveProjects.find((p) => p.id === name);
                    const labelName = proj ? proj.name : name === 'capacity' ? 'Capacidade Semanal Consolidada' : name;
                    return [`${Number(value || 0).toFixed(1)} h`, labelName];
                  }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                  formatter={(value) => {
                    const proj = effectiveProjects.find((p) => p.id === value);
                    return proj ? proj.name : value;
                  }}
                />

                {/* Capacity Threshold Reference Line */}
                <ReferenceLine
                  y={currentGroupSummary.weeklyCapacity}
                  label={{
                    value: `Capacidade Consolidada: ${Math.round(currentGroupSummary.weeklyCapacity || 0).toLocaleString()}h`,
                    fill: '#dc2626',
                    fontSize: 11,
                    fontWeight: 'bold',
                    position: 'top',
                  }}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />

                {/* Bars for each active project */}
                {(() => {
                  return activeProjects.map((proj, idx) => {
                    const isLast = idx === activeProjects.length - 1;
                    const isSimulated = proj.id === currentSimProjectId && projectShiftDays !== 0;
                    return (
                      <Bar
                        key={proj.id}
                        dataKey={proj.id}
                        name={proj.id}
                        stackId="a"
                        fill={proj.color}
                        stroke={isSimulated ? '#06b6d4' : undefined}
                        strokeWidth={isSimulated ? 2 : 0}
                        radius={isLast ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      >
                        {isLast && (
                          <LabelList
                            dataKey="totalLoad"
                            position="top"
                            angle={-90}
                            offset={12}
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
                          onClick={() => switchToIndividual(wc.id)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <span>Ver Gráfico Individual</span>
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
                  {selectedIndividualSummary.maxUtilizationPercentage > 100
                    ? `Sobrecarga (${selectedIndividualSummary.maxUtilizationPercentage.toFixed(0)}% Máx)`
                    : `${selectedIndividualSummary.maxUtilizationPercentage.toFixed(0)}% Ocupação`}
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

          {/* Recharts Stacked Weekly Demand vs Capacity Line */}
          <div className="h-80 w-full pt-2">
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
                  formatter={(value: any, name: any) => {
                    const proj = effectiveProjects.find((p) => p.id === name);
                    const labelName = proj ? proj.name : name === 'capacity' ? 'Capacidade Semanal' : name;
                    return [`${Number(value || 0).toFixed(1)} h`, labelName];
                  }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                  formatter={(value) => {
                    const proj = effectiveProjects.find((p) => p.id === value);
                    return proj ? proj.name : value;
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

                {/* Bars for each active project */}
                {(() => {
                  return activeProjects.map((proj, idx) => {
                    const isLast = idx === activeProjects.length - 1;
                    const isSimulated = proj.id === currentSimProjectId && projectShiftDays !== 0;
                    return (
                      <Bar
                        key={proj.id}
                        dataKey={proj.id}
                        name={proj.id}
                        stackId="a"
                        fill={proj.color}
                        stroke={isSimulated ? '#06b6d4' : undefined}
                        strokeWidth={isSimulated ? 2 : 0}
                        radius={isLast ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      >
                        {isLast && (
                          <LabelList
                            dataKey="totalLoad"
                            position="top"
                            angle={-90}
                            offset={12}
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
        </div>
      )}

      {/* --- INTERACTIVE PROJECT TIMELINE SHIFTER & LOAD RELIEF CONTROLLER --- */}
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
                  Simulador de Deslocamento de Projetos & Alívio de Gargalos
                </h3>
                {projectShiftDays !== 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 animate-pulse">
                    ⚡ Simulação Ativa
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Selecione um projeto e arraste o cronograma ou use os botões para antecipar/postergar datas e liberar sobrecargas em tempo real no gráfico.
              </p>
            </div>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-300">Projeto Selecionado:</span>
            <select
              value={currentSimProjectId}
              onChange={(e) => {
                setSelectedSimProjectId(e.target.value);
                setProjectShiftDays(0);
              }}
              className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer max-w-xs"
            >
              {activeProjects.map((p) => {
                let totalH = 0;
                if (p.workCenterHours) {
                  totalH = (Object.values(p.workCenterHours) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
                }
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({Math.round(totalH)}h)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Selected Project Details & Shift Controls */}
        {selectedSimProject && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Project Info Badge */}
            <div className="lg:col-span-4 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white/20"
                    style={{ backgroundColor: selectedSimProject.color || '#6366f1' }}
                  ></div>
                  <span className="text-xs font-black text-white truncate">
                    {selectedSimProject.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                  {projectShiftDays === 0 ? 'Data Original' : `${projectShiftDays > 0 ? '+' : ''}${projectShiftDays} dias`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-700/60 font-mono">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{simulatedProjectDates.start}</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{simulatedProjectDates.end}</span>
                </div>
              </div>
            </div>

            {/* Shift Slider & Step Buttons */}
            <div className="lg:col-span-8 space-y-2.5">
              {/* Interactive Range Slider (Drag bar) */}
              <div className="space-y-1 bg-slate-800/60 p-3 rounded-xl border border-slate-700/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1">
                    <MoveHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Arraste para Deslocar no Tempo:</span>
                  </span>
                  <span className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                    projectShiftDays > 0 ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/40' : projectShiftDays < 0 ? 'bg-amber-900/60 text-amber-300 border border-amber-500/40' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {projectShiftDays === 0 ? '0 dias (Original)' : `${projectShiftDays > 0 ? `+${projectShiftDays}` : projectShiftDays} dias (${(projectShiftDays / 7).toFixed(1)} sem)`}
                  </span>
                </div>

                <div className="pt-1">
                  <input
                    type="range"
                    min={-28}
                    max={28}
                    step={1}
                    value={projectShiftDays}
                    onChange={(e) => setProjectShiftDays(parseInt(e.target.value, 10))}
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
                    onClick={() => setProjectShiftDays((prev) => prev - 14)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Antecipar 2 semanas (-14 dias)"
                  >
                    <ArrowLeft className="w-3 h-3 text-amber-400" />
                    <span>-2 sem</span>
                  </button>
                  <button
                    onClick={() => setProjectShiftDays((prev) => prev - 7)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Antecipar 1 semana (-7 dias)"
                  >
                    <ArrowLeft className="w-3 h-3 text-amber-400" />
                    <span>-1 sem</span>
                  </button>
                  <button
                    onClick={() => setProjectShiftDays((prev) => prev - 1)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    title="Antecipar 1 dia"
                  >
                    -1d
                  </button>
                  <button
                    onClick={handleResetShift}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                      projectShiftDays === 0
                        ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-default'
                        : 'bg-indigo-600/60 hover:bg-indigo-600 text-white border-indigo-500'
                    }`}
                    title="Restaurar posição original do projeto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Original (0)</span>
                  </button>
                  <button
                    onClick={() => setProjectShiftDays((prev) => prev + 1)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    title="Postergar 1 dia"
                  >
                    +1d
                  </button>
                  <button
                    onClick={() => setProjectShiftDays((prev) => prev + 7)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Postergar 1 semana (+7 dias)"
                  >
                    <span>+1 sem</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                  </button>
                  <button
                    onClick={() => setProjectShiftDays((prev) => prev + 14)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Postergar 2 semanas (+14 dias)"
                  >
                    <span>+2 sem</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                  </button>
                </div>

                {/* Save to Project Button */}
                {projectShiftDays !== 0 && (
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
                onClick={handleResetShift}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 cursor-pointer"
              >
                Desfazer
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
                        {allFactorySummary.maxUtilizationPercentage.toFixed(0)}%
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
                              {s.maxUtilizationPercentage.toFixed(0)}%
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
                {filteredIndividualSummaries.map((s) => {
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
                            {s.maxUtilizationPercentage.toFixed(0)}%
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
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
