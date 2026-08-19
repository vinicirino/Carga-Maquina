import React from 'react';
import { SystemRecommendation, WorkCenter, OverloadAlert } from '../types';
import {
  Sparkles,
  CheckCircle2,
  AlertOctagon,
  Users,
  ArrowRight,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface SimulationsPanelProps {
  recommendations: SystemRecommendation[];
  overloadAlerts: OverloadAlert[];
  workCenters: WorkCenter[];
  onApplyAllRecommendations: () => void;
  onApplySingleRecommendation: (wcId: string, newResources: number) => void;
}

export const SimulationsPanel: React.FC<SimulationsPanelProps> = ({
  recommendations,
  overloadAlerts,
  workCenters,
  onApplyAllRecommendations,
  onApplySingleRecommendation,
}) => {
  const hasBottlenecks = recommendations.length > 0;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-xl border border-indigo-900/50 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-400" />
              <h2 className="text-xl font-black tracking-tight">
                Assistente de Otimização & Rebalanceamento
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl font-medium leading-relaxed">
              Análise inteligente de gargalos baseada na carga pico dos projetos. O algoritmo sugere o número ótimo de recursos em cada Centro de Trabalho para eliminar sobrecargas.
            </p>
          </div>

          {hasBottlenecks && (
            <button
              onClick={onApplyAllRecommendations}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg shadow-md hover:shadow-amber-500/20 transition-all self-start md:self-auto cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Resolver Todos os Gargalos ({recommendations.length})</span>
            </button>
          )}
        </div>
      </div>

      {!hasBottlenecks ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center space-y-3">
          <div className="inline-flex p-3 bg-emerald-100 text-emerald-700 rounded-full">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Nenhum Gargalo de Capacidade Detectado!
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Todos os centros de trabalho possuem recursos suficientes para absorver a demanda dos projetos dentro do cronograma configurado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec) => {
            const extraResources = rec.recommendedResources - rec.currentResources;

            return (
              <div
                key={rec.workCenterId}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-rose-600" />
                      <span>{rec.workCenterName}</span>
                    </h3>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                      Pico {rec.maxUtilization.toFixed(0)}% Carga
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {rec.reason}
                  </p>
                </div>

                {/* Proposed Solution Card */}
                <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-md">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs text-indigo-950 font-medium">
                        Aumentar Recursos:
                      </div>
                      <div className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                        <span>{rec.currentResources} rec</span>
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-emerald-700">{rec.recommendedResources} rec</span>
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                          (+{extraResources})
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      onApplySingleRecommendation(rec.workCenterId, rec.recommendedResources)
                    }
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-md shadow-2xs transition-colors"
                  >
                    Ajustar Recurso
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overload Alerts Breakdown List */}
      {overloadAlerts.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rose-600" />
            <span>Detalhamento dos Períodos Críticos por Semana ({overloadAlerts.length})</span>
          </h3>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
            {overloadAlerts.map((alert, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-800">
                    {alert.workCenterName} — <span className="text-indigo-600">{alert.weekLabel}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Projetos concorrentes: {alert.contributingProjects.map((p) => `${p.projectName} (${p.hours.toFixed(1)}h)`).join(', ')}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    +{alert.excessHours.toFixed(1)}h acima da cap. ({alert.utilizationPercentage.toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
