import React, { useMemo } from 'react';
import {
  Clock,
  Cpu,
  AlertTriangle,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Factory,
  Layers,
  ArrowRight,
  Sparkles,
  BarChart3,
  CalendarRange,
  Users,
  ShieldAlert,
  Flame,
  Zap,
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
} from 'recharts';
import {
  WorkCenter,
  WorkCenterCapacitySummary,
  WeeklyBucket,
  Project,
  DEFAULT_SECTOR_GROUPS,
  SectorGroupSummary,
} from '../types';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import { calculateWeeklyCapacity } from '../utils/calculator';
import { getProjectTotalHours } from '../utils/dateValidation';
import { KPIs } from './KPIs';

interface OverviewDashboardProps {
  kpis: {
    totalRequiredHours: number;
    totalWeeklyCapacity: number;
    overloadedWorkCentersCount: number;
    overallUtilizationPercentage: number;
    overloadedWeeksCount: number;
    timeframeStart: string;
    timeframeEnd: string;
  };
  workCenters: WorkCenter[];
  summaries: WorkCenterCapacitySummary[];
  weeklyBuckets: WeeklyBucket[];
  projects: Project[];
  sectorGroups?: string[];
  recommendations?: any[];
  onNavigateToWorkCenters: (sectorGroup?: string, wcId?: string) => void;
  onNavigateToProjects: () => void;
  onNavigateToSimulation: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  kpis,
  workCenters,
  summaries,
  weeklyBuckets,
  projects,
  sectorGroups = DEFAULT_SECTOR_GROUPS,
  recommendations = [],
  onNavigateToWorkCenters,
  onNavigateToProjects,
  onNavigateToSimulation,
}) => {
  const activeProjects = useMemo(() => projects.filter((p) => p.enabled !== false), [projects]);
  const usedWcIds = useMemo(() => new Set(summaries.map((s) => s.workCenter.id)), [summaries]);
  const activeWorkCenters = useMemo(
    () => workCenters.filter((wc) => wc.enabled !== false && usedWcIds.has(wc.id)),
    [workCenters, usedWcIds]
  );

  // Aggregate Plant-wide Weekly Capacity & Demand Curve
  const plantWeeklyChartData = useMemo(() => {
    const totalWeeklyInstalledCapacity = activeWorkCenters.reduce(
      (acc, wc) => acc + calculateWeeklyCapacity(wc),
      0
    );

    return weeklyBuckets.map((bucket) => {
      let totalWeekLoad = 0;
      const row: Record<string, any> = {
        weekLabel: bucket.label.split(' ')[1] || bucket.label,
        weekKey: bucket.weekKey,
        capacity: totalWeeklyInstalledCapacity,
      };

      for (const proj of activeProjects) {
        let projTotalHours = 0;
        for (const wc of activeWorkCenters) {
          projTotalHours += bucket.projectBreakdown[wc.id]?.[proj.id] || 0;
        }
        row[proj.id] = Math.round(projTotalHours);
        totalWeekLoad += projTotalHours;
      }

      row.totalLoad = Math.round(totalWeekLoad);
      row.isOverloaded = totalWeekLoad > totalWeeklyInstalledCapacity;
      return row;
    });
  }, [activeWorkCenters, weeklyBuckets, activeProjects]);

  const maxPlantWeeklyY = useMemo(() => {
    const totalWeeklyInstalledCapacity = activeWorkCenters.reduce(
      (acc, wc) => acc + calculateWeeklyCapacity(wc),
      0
    );
    const maxDemand = Math.max(...plantWeeklyChartData.map((d) => d.totalLoad || 0), 0);
    const highest = Math.max(maxDemand, totalWeeklyInstalledCapacity);
    return Math.ceil((highest || 100) * 1.2);
  }, [plantWeeklyChartData, activeWorkCenters]);

  // Sector Groups Aggregated Load & Utilization
  const sectorSummaries: SectorGroupSummary[] = useMemo(() => {
    const allGroups = Array.from(
      new Set([...sectorGroups, ...activeWorkCenters.map((wc) => getWorkCenterCategory(wc))])
    );

    return allGroups
      .map((grp) => {
        const groupWcs = activeWorkCenters.filter((wc) => getWorkCenterCategory(wc) === grp);
        if (groupWcs.length === 0) return null;

        const groupWcIds = new Set(groupWcs.map((wc) => wc.id));
        const groupWcSummaries = summaries.filter((s) => groupWcIds.has(s.workCenter.id));

        const totalResources = groupWcs.reduce((acc, wc) => acc + (wc.resourcesCount || 0), 0);
        const weeklyCapacity = groupWcs.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);
        const totalRequiredHours = groupWcSummaries.reduce(
          (acc, s) => acc + (s.totalRequiredHours || 0),
          0
        );

        if (totalRequiredHours === 0) return null;

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
  }, [sectorGroups, activeWorkCenters, summaries, weeklyBuckets]);

  // Top Critical Overloaded Work Centers (Ranked by peak utilization)
  const criticalWorkCenters = useMemo(() => {
    return [...summaries]
      .filter((s) => s.maxUtilizationPercentage > 100)
      .sort((a, b) => b.maxUtilizationPercentage - a.maxUtilizationPercentage)
      .slice(0, 5);
  }, [summaries]);

  return (
    <div className="space-y-6">
      {/* 1. Header KPIs */}
      <KPIs
        kpis={kpis}
        totalWorkCentersCount={workCenters.length}
        totalProjectsCount={projects.length}
        activeProjectsCount={activeProjects.length}
      />

      {/* 2. Bottleneck Alert Banner (if any) */}
      {criticalWorkCenters.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-lg shadow-2xs shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-rose-950 text-sm">
                Atenção Gerencial: {criticalWorkCenters.length} Postos de Trabalho com Estouro de Capacidade!
              </h3>
              <p className="text-xs text-rose-800 font-medium">
                Picos de demanda ultrapassam a capacidade instalada. Utilize a simulação inteligente para balancear recursos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={() => onNavigateToWorkCenters()}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-900 font-bold text-xs rounded-lg border border-rose-300 transition-colors cursor-pointer"
            >
              <Factory className="w-3.5 h-3.5" />
              <span>Ver Postos</span>
            </button>
            <button
              onClick={onNavigateToSimulation}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Otimizar Capacidade</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Plant-wide Load vs Installed Capacity Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-black text-slate-900 tracking-tight">
                Curva Executiva de Carga Fabril Consolidada (Planta Completa)
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Demanda semanal acumulada de todos os projetos vs. capacidade nominal total da fábrica ({(kpis?.totalWeeklyCapacity ?? 0).toLocaleString('pt-BR')}h/sem)
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-indigo-600"></div>
              <span className="text-slate-600">Demanda em Horas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-rose-600 border-dashed"></div>
              <span className="text-rose-700 font-bold">Capacidade Nominal</span>
            </div>
          </div>
        </div>

        {/* Recharts Plant Chart */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={plantWeeklyChartData}
              margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="weekLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                domain={[0, maxPlantWeeklyY]}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const rowData = payload[0].payload;
                    const totalHours = rowData.totalLoad || 0;
                    const cap = rowData.capacity || 0;
                    const util = cap > 0 ? ((totalHours / cap) * 100).toFixed(1) : '0';
                    const isOver = totalHours > cap;

                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-2 border border-slate-800">
                        <div className="font-bold border-b border-slate-800 pb-1 flex justify-between gap-4">
                          <span>Semana {label}</span>
                          <span className={isOver ? 'text-rose-400 font-black' : 'text-emerald-400'}>
                            {util}% Ocupação
                          </span>
                        </div>
                        <div className="space-y-1 text-slate-300">
                          <div className="flex justify-between gap-4">
                            <span>Demanda Total:</span>
                            <strong className="text-white">{(totalHours || 0).toLocaleString()}h</strong>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Capacidade Fabril:</span>
                            <strong className="text-slate-300">{(cap || 0).toLocaleString()}h</strong>
                          </div>
                          {isOver && (
                            <div className="text-rose-300 text-[11px] font-semibold pt-1 border-t border-slate-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>Sobrecarga de +{((totalHours || 0) - (cap || 0)).toLocaleString()}h</span>
                            </div>
                          )}
                        </div>

                        {/* Breakdown per Project */}
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-0.5 text-[10px]">
                          {activeProjects.map((p) => {
                            const val = rowData[p.id] || 0;
                            if (val <= 0) return null;
                            return (
                              <div key={p.id} className="flex justify-between text-slate-400">
                                <span className="truncate max-w-[140px]">{p.name}:</span>
                                <span className="font-mono text-slate-200">{val}h</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={activeWorkCenters.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0)}
                stroke="#dc2626"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
              {activeProjects.map((p, idx) => (
                <Bar
                  key={p.id}
                  dataKey={p.id}
                  name={p.name}
                  stackId="plant"
                  fill={p.color || `hsl(${(idx * 55) % 360}, 70%, 50%)`}
                  radius={idx === activeProjects.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Sector Groups Status Grid (Visão Consolidada por Agrupador) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-black text-slate-900 tracking-tight">
                Balanço de Carga por Agrupador / Setor
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Consolidação de postos fabris por departamento produtivo
            </p>
          </div>

          <button
            onClick={() => onNavigateToWorkCenters()}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            <span>Gerenciar Centros</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sectorSummaries.map((sector) => {
            const isCritical = sector.status === 'CRITICAL';
            const isWarning = sector.status === 'WARNING';

            return (
              <div
                key={sector.groupName}
                className="bg-slate-50 hover:bg-slate-100/80 p-4 rounded-xl border border-slate-200 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-xs text-slate-900 uppercase tracking-wider">
                      {sector.groupName}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isCritical
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : isWarning
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {isCritical ? 'Gargalo' : isWarning ? 'Atenção' : 'OK'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{sector.workCenterCount} postos • {sector.totalResources} recursos</span>
                  </div>
                </div>

                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Capacidade Semanal:</span>
                    <strong className="text-slate-900">{(sector.weeklyCapacity || 0).toLocaleString()}h/sem</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Demanda Total:</span>
                    <strong className="text-indigo-700">{Math.round(sector.totalRequiredHours || 0).toLocaleString()}h</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pico de Ocupação:</span>
                    <strong
                      className={
                        isCritical
                          ? 'text-rose-600 font-black'
                          : isWarning
                          ? 'text-amber-600 font-black'
                          : 'text-emerald-700 font-black'
                      }
                    >
                      {sector.maxUtilizationPercentage.toFixed(1)}%
                    </strong>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateToWorkCenters(sector.groupName)}
                  className="w-full text-center py-1.5 px-3 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-900 font-bold text-xs rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Ver Postos ({sector.groupName})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Two-column Grid: Top Bottlenecks + Portfolio Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Bottlenecks Table */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Gargalos Críticos Mais Relevantes
              </h3>
            </div>
            <button
              onClick={onNavigateToSimulation}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
            >
              Simular Soluções →
            </button>
          </div>

          {criticalWorkCenters.length === 0 ? (
            <div className="py-8 text-center text-slate-500 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Nenhum gargalo crítico detectado!</p>
              <p className="text-[11px] text-slate-400">Todos os postos de trabalho estão operando dentro do limite de capacidade.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {criticalWorkCenters.map((s) => (
                <div
                  key={s.workCenter.id}
                  className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 hover:border-rose-300 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900 truncate">
                        {s.workCenter.name}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded uppercase">
                        {getWorkCenterCategory(s.workCenter)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Capacidade: {s.weeklyCapacity}h/sem • Carga Total: {Math.round(s.totalRequiredHours)}h
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-black text-rose-600">
                        {s.maxUtilizationPercentage.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {s.overloadedWeeksCount} sem sobrecarga
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateToWorkCenters(getWorkCenterCategory(s.workCenter), s.workCenter.id)}
                      className="p-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-md border border-slate-300 transition-colors cursor-pointer"
                      title="Ver Detalhes do Posto"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio Projects Summary */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
                <CalendarRange className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Projetos & Carteira Ativa
              </h3>
            </div>
            <button
              onClick={onNavigateToProjects}
              className="text-xs font-bold text-teal-600 hover:text-teal-800 transition-colors cursor-pointer"
            >
              Ver Cronogramas →
            </button>
          </div>

          <div className="space-y-2">
            {activeProjects.map((p) => {
              const projectTotalHours = getProjectTotalHours(p, activeWorkCenters);
              const pctOfPlant = kpis.totalRequiredHours > 0
                ? ((projectTotalHours / kpis.totalRequiredHours) * 100).toFixed(1)
                : '0';

              return (
                <div
                  key={p.id}
                  className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.color || '#6366f1' }}
                    ></div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 truncate block">
                        {p.name}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {p.startDate} até {p.endDate}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-slate-900">
                      {(projectTotalHours || 0).toLocaleString()}h
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {pctOfPlant}% da carga fabril
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
