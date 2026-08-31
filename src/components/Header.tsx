import React from 'react';
import {
  Factory,
  FileCode,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Layers,
  SlidersHorizontal,
  Sliders,
  CalendarRange,
  Printer,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'overview' | 'workcenters' | 'projects' | 'heatmap' | 'simulation';
  setActiveTab: (tab: 'overview' | 'workcenters' | 'projects' | 'heatmap' | 'simulation') => void;
  onOpenJsonModal: () => void;
  onOpenWorkCenterModal: () => void;
  onOpenTurbineTypesModal?: () => void;
  onOpenNewProjectModal: () => void;
  onOpenTurbineProjectModal: () => void;
  onOpenPrintReportModal?: () => void;
  onResetData: () => void;
  overloadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenJsonModal,
  onOpenWorkCenterModal,
  onOpenTurbineTypesModal,
  onOpenNewProjectModal,
  onOpenTurbineProjectModal,
  onOpenPrintReportModal,
  onResetData,
  overloadCount,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-xs font-black tracking-wider">
              PCP
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Análise de Carga Máquina
                <span className="text-[10px] uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-semibold">
                  SISTEMA PCP
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Gestão e Equilíbrio de Capacidade Instalada por Projeto
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {onOpenPrintReportModal && (
              <button
                onClick={onOpenPrintReportModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg transition-all border border-indigo-500/30 cursor-pointer shadow-xs"
                title="Gerar e Imprimir Relatório Executivo (PDF / A4)"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-400" />
                <span>Imprimir Relatório</span>
              </button>
            )}

            <button
              onClick={onOpenJsonModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>Importar / Exportar JSON</span>
            </button>

            <button
              onClick={onOpenWorkCenterModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Centros de Trabalho</span>
            </button>

            {onOpenTurbineTypesModal && (
              <button
                onClick={onOpenTurbineTypesModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                title="Cadastro e Modelagem de Tipos de Turbina (Curva S Paramétrica)"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Modelos de Turbina</span>
              </button>
            )}

            {/* Novo Projeto Personalizado (Turbinas & Curva S) */}
            <button
              onClick={onOpenTurbineProjectModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-xs ring-1 ring-emerald-400/40 cursor-pointer hover:scale-102"
              title="Criar projeto parametrizado de turbinas com cálculo automático de curva S"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Novo Projeto Personalizado</span>
            </button>

            <button
              onClick={onOpenNewProjectModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Novo Manual</span>
            </button>

            <button
              onClick={onResetData}
              title="Gestão e Limpeza do Banco de Dados / Inicializar Produção"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-t border-slate-800/80 pt-1.5 pb-1.5 text-xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Visão Geral & KPIs</span>
          </button>

          <button
            onClick={() => setActiveTab('workcenters')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'workcenters'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Centros de Trabalho</span>
            {overloadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-extrabold bg-rose-500 text-white rounded-full">
                {overloadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'projects'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Projetos & Cronograma</span>
          </button>

          <button
            onClick={() => setActiveTab('heatmap')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'heatmap'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Matriz de Carga (Heatmap)</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'simulation'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-amber-400 hover:text-amber-200 hover:bg-amber-950/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Simulação & Otimização</span>
          </button>
        </div>
      </div>
    </header>
  );
};

