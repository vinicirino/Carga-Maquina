import React, { useMemo } from 'react';
import { PlanningScenario } from '../types';
import { generateWeeklySchedule } from '../utils/calculator';
import {
  X,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Factory,
  Layers,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface ScenarioComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: PlanningScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
}

export const ScenarioComparisonModal: React.FC<ScenarioComparisonModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  activeScenarioId,
  onSelectScenario,
}) => {
  if (!isOpen) return null;

  // Calculate metrics for each scenario
  const evaluatedScenarios = useMemo(() => {
    return scenarios.map((scen) => {
      const calc = generateWeeklySchedule(scen.projects, scen.workCenters);
      return {
        scenario: scen,
        calc,
      };
    });
  }, [scenarios]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-base">Comparativo de Cenários de Planejamento</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <p className="text-xs text-slate-600 font-medium">
            Compare os indicadores chave de desempenho (KPIs) entre os cenários para tomar decisões estratégicas sobre prazos, alocação de equipes e capacidade fabril.
          </p>

          {/* Grid of Scenarios Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluatedScenarios.map(({ scenario, calc }) => {
              const isActive = scenario.id === activeScenarioId;
              const { kpis, workCenterSummaries, overloadAlerts } = calc;

              // Find top 3 bottleneck work centers
              const topBottlenecks = workCenterSummaries
                .filter((s) => s.maxUtilizationPercentage > 100)
                .sort((a, b) => b.maxUtilizationPercentage - a.maxUtilizationPercentage)
                .slice(0, 3);

              return (
                <div
                  key={scenario.id}
                  className={`rounded-2xl border flex flex-col justify-between transition-all ${
                    isActive
                      ? 'bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-500/30 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-100 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-black text-sm text-slate-900 leading-snug">
                        {scenario.name}
                      </h4>
                      {isActive && (
                        <span className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-md shrink-0">
                          Ativo
                        </span>
                      )}
                    </div>
                    {scenario.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {scenario.description}
                      </p>
                    )}
                  </div>

                  {/* Main Metrics Grid */}
                  <div className="p-4 space-y-4 flex-1">
                    {/* Overload Status Highlight */}
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        kpis.overloadedWorkCentersCount > 0
                          ? 'bg-rose-50 border-rose-200 text-rose-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {kpis.overloadedWorkCentersCount > 0 ? (
                          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                            Gargalos Fabris
                          </span>
                          <span className="text-xs font-extrabold">
                            {kpis.overloadedWorkCentersCount > 0
                              ? `${kpis.overloadedWorkCentersCount} centros sobrecarregados`
                              : 'Capacidade 100% Equilibrada'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* KPI Numbers */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Ocupação Média
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {kpis.avgUtilizationAllCenters}%
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Pico Máximo
                        </span>
                        <span
                          className={`text-sm font-black ${
                            kpis.maxUtilizationPeak > 100 ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {kpis.maxUtilizationPeak}%
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Carga Total (h)
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">
                          {(kpis?.totalDemandedHours || 0).toLocaleString()}h
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Projetos Ativos
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">
                          {scenario.projects.filter((p) => p.enabled !== false).length} de{' '}
                          {scenario.projects.length}
                        </span>
                      </div>
                    </div>

                    {/* Bottlenecks list */}
                    {topBottlenecks.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                          Principais Centros Estourados:
                        </span>
                        <div className="space-y-1">
                          {topBottlenecks.map((wc) => (
                            <div
                              key={wc.workCenter.id}
                              className="text-[11px] bg-rose-50/80 border border-rose-100 p-1.5 rounded-lg flex items-center justify-between text-rose-950 font-medium"
                            >
                              <span className="truncate max-w-[160px]">
                                {wc.workCenter.name}
                              </span>
                              <span className="font-extrabold text-rose-600 shrink-0">
                                {(wc.maxUtilizationPercentage ?? 0).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Action */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl">
                    <button
                      onClick={() => {
                        onSelectScenario(scenario.id);
                        onClose();
                      }}
                      className={`w-full py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-900 hover:bg-indigo-600 text-white'
                      }`}
                    >
                      <span>{isActive ? 'Cenário Ativo' : 'Ativar Este Cenário'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Fechar Comparador
          </button>
        </div>
      </div>
    </div>
  );
};
