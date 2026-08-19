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
import { calculateWeeklyCapacity } from '../utils/calculator';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Users,
  Plus,
  Minus,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  BarChart3,
  TrendingUp,
  FolderTree,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
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
  onSelectWorkCenterForSimulation?: (wcId: string) => void;
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
  onSelectWorkCenterForSimulation,
}) => {
  // Mode: 'GROUP' (Consolidado por Agrupador de Setor) or 'INDIVIDUAL' (Por Centro de Trabalho)
  const [viewMode, setViewMode] = useState<'GROUP' | 'INDIVIDUAL'>('INDIVIDUAL');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OVERLOADED' | 'OK'>('ALL');
  
  // Selected Group for GROUP mode
  const [selectedGroup, setSelectedGroup] = useState<string>(initialSectorFilter || 'SOLDA');

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
        const groupWcSummaries = summaries.filter((s) => groupWcIds.has(s.workCenter.id));

        const totalResources = groupWcs.reduce((acc, wc) => acc + (wc.resourcesCount || 0), 0);
        const weeklyCapacity = groupWcs.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);
        const totalRequiredHours = groupWcSummaries.reduce(
          (acc, s) => acc + (s.totalRequiredHours || 0),
          0
        );

        let peakWeeklyLoad = 0;
        let overloadedWeeksCount = 0;
        let totalUtilizationSum = 0;

        for (const bucket of weeklyBuckets) {
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
          weeklyBuckets.length > 0 && weeklyCapacity > 0
            ? totalUtilizationSum / weeklyBuckets.length
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
  }, [sectorGroups, workCenters, summaries, weeklyBuckets]);

  // Current selected group for GROUP mode
  const currentGroupSummary = useMemo(() => {
    const found = sectorSummaries.find((s) => s.groupName === selectedGroup);
    return found || sectorSummaries[0] || null;
  }, [sectorSummaries, selectedGroup]);

  // Filtered list of individual summaries for INDIVIDUAL mode
  const filteredIndividualSummaries = useMemo(() => {
    return summaries.filter((s) => {
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
  }, [summaries, searchTerm, filterStatus, selectedSectorFilter]);

  // Active individual summary for chart
  const selectedIndividualSummary = useMemo(() => {
    if (selectedWcId) {
      const found = summaries.find((s) => s.workCenter.id === selectedWcId);
      if (found) return found;
    }
    return filteredIndividualSummaries[0] || summaries[0] || null;
  }, [summaries, selectedWcId, filteredIndividualSummaries]);

  // Chart data: GROUP mode or INDIVIDUAL mode
  const chartData = useMemo(() => {
    if (viewMode === 'GROUP') {
      if (!currentGroupSummary) return [];

      const groupWcs = currentGroupSummary.workCenters;
      const weeklyCap = currentGroupSummary.weeklyCapacity;

      return weeklyBuckets.map((bucket) => {
        const row: Record<string, any> = {
          weekLabel: bucket.label.split(' ')[1] || bucket.label,
          weekKey: bucket.weekKey,
          capacity: weeklyCap,
          totalLoad: 0,
        };

        let totalWeekLoad = 0;
        for (const proj of projects) {
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

      return weeklyBuckets.map((bucket) => {
        const projectLoads = bucket.projectBreakdown[wcId] || {};
        const row: Record<string, any> = {
          weekLabel: bucket.label.split(' ')[1] || bucket.label,
          weekKey: bucket.weekKey,
          capacity: weeklyCap,
          totalLoad: bucket.workCenterLoads[wcId] || 0,
        };

        for (const proj of projects) {
          if (proj.enabled !== false) {
            row[proj.id] = projectLoads[proj.id] || 0;
          }
        }

        return row;
      });
    }
  }, [viewMode, currentGroupSummary, selectedIndividualSummary, weeklyBuckets, projects]);

  // Dynamic Y domain with headroom
  const maxYValue = useMemo(() => {
    const weeklyCap =
      viewMode === 'GROUP'
        ? currentGroupSummary?.weeklyCapacity || 0
        : selectedIndividualSummary?.weeklyCapacity || 0;

    const maxBarLoad = Math.max(...chartData.map((d) => d.totalLoad || 0), 0);
    const highest = Math.max(maxBarLoad, weeklyCap);
    if (highest === 0) return 100;
    return Math.ceil(highest * 1.25);
  }, [viewMode, currentGroupSummary, selectedIndividualSummary, chartData]);

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

  return (
    <div className="space-y-6">
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
                {sectorSummaries.length}
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

        {/* Quick Filter Bar by Sector / Agrupador */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-2.5 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
            <span>Agrupador:</span>
          </span>

          {/* "Todos os Setores" pill (for Individual mode) */}
          {viewMode === 'INDIVIDUAL' && (
            <button
              onClick={() => setSelectedSectorFilter('ALL')}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedSectorFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Todos os Setores</span>
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
                    // Select first WC in this sector if available
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
                  Agrupador Consolidado ({currentGroupSummary.workCenterCount} centros)
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
              </div>

              <p className="text-xs text-slate-500 mt-1.5">
                Demanda Total: <strong className="text-slate-800">{currentGroupSummary.totalRequiredHours.toFixed(1)}h</strong> |
                Capacidade Semanal Consolidada: <strong className="text-slate-800">{currentGroupSummary.weeklyCapacity.toFixed(1)}h/sem</strong>
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

              <div className="h-6 w-px bg-indigo-200"></div>

              <button
                onClick={() => toggleGroupExpand(currentGroupSummary.groupName)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>{expandedGroups[currentGroupSummary.groupName] ? 'Ocultar Centros' : 'Ver Centros'}</span>
                {expandedGroups[currentGroupSummary.groupName] ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
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
                    const proj = projects.find((p) => p.id === name);
                    const labelName = proj ? proj.name : name === 'capacity' ? 'Capacidade Semanal do Setor' : name;
                    return [`${Number(value).toFixed(1)} h`, labelName];
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
                    const proj = projects.find((p) => p.id === value);
                    return proj ? proj.name : value;
                  }}
                />

                {/* Capacity Threshold Reference Line */}
                <ReferenceLine
                  y={currentGroupSummary.weeklyCapacity}
                  label={{
                    value: `Capacidade Consolidada: ${currentGroupSummary.weeklyCapacity.toFixed(0)}h`,
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
                  const activeProjects = projects.filter((p) => p.enabled !== false);
                  return activeProjects.map((proj, idx) => {
                    const isLast = idx === activeProjects.length - 1;
                    return (
                      <Bar
                        key={proj.id}
                        dataKey={proj.id}
                        name={proj.id}
                        stackId="a"
                        fill={proj.color}
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
          {expandedGroups[currentGroupSummary.groupName] && (
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
                  const wcSummary = summaries.find((s) => s.workCenter.id === wc.id);
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
                            Demanda: {wcSummary?.totalRequiredHours.toFixed(1) || 0}h | Cap: {wcSummary?.weeklyCapacity.toFixed(1) || 0}h/sem
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
                          {wcSummary?.maxUtilizationPercentage.toFixed(0)}%
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
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Demanda Total: <strong className="text-slate-800">{selectedIndividualSummary.totalRequiredHours.toFixed(1)}h</strong> |
                Capacidade Instalada: <strong className="text-slate-800">{selectedIndividualSummary.weeklyCapacity.toFixed(1)}h/semana</strong> ({selectedIndividualSummary.workCenter.resourcesCount} recursos × {selectedIndividualSummary.workCenter.dailyHours}h/dia)
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
                    const proj = projects.find((p) => p.id === name);
                    const labelName = proj ? proj.name : name === 'capacity' ? 'Capacidade Semanal' : name;
                    return [`${Number(value).toFixed(1)} h`, labelName];
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
                    const proj = projects.find((p) => p.id === value);
                    return proj ? proj.name : value;
                  }}
                />

                {/* Capacity Threshold Reference Line */}
                <ReferenceLine
                  y={selectedIndividualSummary.weeklyCapacity}
                  label={{
                    value: `Capacidade Líquida: ${selectedIndividualSummary.weeklyCapacity.toFixed(0)}h`,
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
                  const activeProjects = projects.filter((p) => p.enabled !== false);
                  return activeProjects.map((proj, idx) => {
                    const isLast = idx === activeProjects.length - 1;
                    return (
                      <Bar
                        key={proj.id}
                        dataKey={proj.id}
                        name={proj.id}
                        stackId="a"
                        fill={proj.color}
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
                          {s.weeklyCapacity.toFixed(1)}h/sem
                        </td>

                        <td className="py-3 px-3 text-right font-black text-slate-900">
                          {s.totalRequiredHours.toFixed(1)}h
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                          {s.peakWeeklyLoad.toFixed(1)}h
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
                                  const wcSummary = summaries.find((sum) => sum.workCenter.id === wc.id);
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
                                          {wcSummary?.totalRequiredHours.toFixed(0) || 0}h / {wcSummary?.weeklyCapacity.toFixed(0) || 0}h sem
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span
                                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                            isWcOver ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                          }`}
                                        >
                                          {wcSummary?.maxUtilizationPercentage.toFixed(0)}%
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
                            className="px-2 py-0.5 hover:bg-slate-100 text-slate-600 rounded-r cursor-pointer font-bold"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className="text-slate-700 font-bold">{wc.dailyHours}h</span>
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-slate-600">
                        {s.weeklyCapacity.toFixed(1)}h
                      </td>

                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {s.totalRequiredHours.toFixed(1)}h
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        {s.peakWeeklyLoad.toFixed(1)}h
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
