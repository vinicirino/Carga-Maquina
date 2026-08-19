import React from 'react';
import {
  Clock,
  Cpu,
  AlertTriangle,
  TrendingUp,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

interface KPIsProps {
  kpis: {
    totalRequiredHours: number;
    totalWeeklyCapacity: number;
    overloadedWorkCentersCount: number;
    overallUtilizationPercentage: number;
    overloadedWeeksCount: number;
    timeframeStart: string;
    timeframeEnd: string;
  };
  totalWorkCentersCount: number;
  totalProjectsCount: number;
  activeProjectsCount: number;
}

export const KPIs: React.FC<KPIsProps> = ({
  kpis,
  totalWorkCentersCount,
  totalProjectsCount,
  activeProjectsCount,
}) => {
  const isOverloaded = kpis.overloadedWorkCentersCount > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Total Required Hours */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Demanda Total</span>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {(kpis?.totalRequiredHours || 0).toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })} <span className="text-sm font-medium text-slate-500">h</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {activeProjectsCount} de {totalProjectsCount} projetos ativos
          </p>
        </div>
      </div>

      {/* 2. Total Weekly Installed Capacity */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capacidade Semanal</span>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {(kpis?.totalWeeklyCapacity || 0).toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })} <span className="text-xs font-medium text-slate-500">h/sem</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {totalWorkCentersCount} centros de trabalho
          </p>
        </div>
      </div>

      {/* 3. Global Utilization Percentage */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ocupação Média</span>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {(kpis?.overallUtilizationPercentage || 0).toFixed(1)}%
            </span>
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                kpis.overallUtilizationPercentage > 100
                  ? 'bg-rose-100 text-rose-700'
                  : kpis.overallUtilizationPercentage > 85
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {kpis.overallUtilizationPercentage > 100
                ? 'Sobrecarregado'
                : kpis.overallUtilizationPercentage > 85
                ? 'Alta Carga'
                : 'Equilibrado'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Gargalo Médio no Período</p>
        </div>
      </div>

      {/* 4. Overloaded Sectors Alert */}
      <div
        className={`p-5 rounded-xl border shadow-xs flex flex-col justify-between transition-colors ${
          isOverloaded
            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
            : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Gargalos Detectados</span>
          <div
            className={`p-2 rounded-lg ${
              isOverloaded ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isOverloaded ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight">
              {kpis.overloadedWorkCentersCount}
            </span>
            <span className="text-xs font-semibold">centros de trabalho</span>
          </div>
          <p className="text-xs opacity-80 mt-1 font-medium">
            {kpis.overloadedWeeksCount} semana(s) com sobrecarga
          </p>
        </div>
      </div>

      {/* 5. Timeframe */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Janela de Análise</span>
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-sm font-extrabold text-slate-900">
            {kpis.timeframeStart}
          </div>
          <div className="text-xs text-slate-500 font-medium">até {kpis.timeframeEnd}</div>
          <p className="text-xs text-indigo-600 font-semibold mt-1">Período Ativo</p>
        </div>
      </div>
    </div>
  );
};

