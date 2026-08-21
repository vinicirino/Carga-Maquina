import React, { useState } from 'react';
import {
  Factory,
  FileCode,
  FileSpreadsheet,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Layers,
  SlidersHorizontal,
  Sliders,
  CalendarRange,
  LayoutDashboard,
  GitBranch,
  Save,
  Plus,
  Copy,
  BarChart3,
  Settings2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Flame,
  TrendingUp,
  Database,
  Star,
} from 'lucide-react';
import { PlanningScenario } from '../types';

interface SidebarProps {
  activeTab: 'overview' | 'workcenters' | 'projects' | 'heatmap' | 'simulation';
  setActiveTab: (tab: 'overview' | 'workcenters' | 'projects' | 'heatmap' | 'simulation') => void;
  onOpenJsonModal: () => void;
  onOpenWorkCenterModal: () => void;
  onOpenTurbineTypesModal?: () => void;
  onOpenNewProjectModal: () => void;
  onOpenTurbineProjectModal: () => void;
  onOpenMatrixModal?: () => void;
  onResetData: () => void;
  onSaveAsBaseline?: () => void;
  overloadCount: number;
  // Scenario Props
  scenarios: PlanningScenario[];
  activeScenarioId: string;
  isScenarioModified: boolean;
  onSelectScenario: (id: string) => void;
  onSaveCurrentScenario: () => void;
  onOpenNewScenarioModal: () => void;
  onDuplicateCurrentScenario: () => void;
  onOpenCompareModal: () => void;
  onOpenManagerModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenJsonModal,
  onOpenWorkCenterModal,
  onOpenTurbineTypesModal,
  onOpenNewProjectModal,
  onOpenTurbineProjectModal,
  onOpenMatrixModal,
  onResetData,
  onSaveAsBaseline,
  overloadCount,
  scenarios,
  activeScenarioId,
  isScenarioModified,
  onSelectScenario,
  onSaveCurrentScenario,
  onOpenNewScenarioModal,
  onDuplicateCurrentScenario,
  onOpenCompareModal,
  onOpenManagerModal,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  const navItems = [
    {
      id: 'overview' as const,
      label: 'Visão Geral & KPIs',
      icon: LayoutDashboard,
      badge: null,
      color: 'text-indigo-400',
    },
    {
      id: 'workcenters' as const,
      label: 'Centros de Trabalho',
      icon: Factory,
      badge: overloadCount > 0 ? overloadCount : null,
      badgeColor: 'bg-rose-500 text-white',
      color: 'text-blue-400',
    },
    {
      id: 'projects' as const,
      label: 'Projetos & Cronograma',
      icon: CalendarRange,
      badge: null,
      color: 'text-teal-400',
    },
    {
      id: 'heatmap' as const,
      label: 'Matriz de Carga',
      icon: Flame,
      badge: null,
      color: 'text-purple-400',
    },
    {
      id: 'simulation' as const,
      label: 'Simulação & Otimização',
      icon: Sparkles,
      badge: 'PRO',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      color: 'text-amber-400',
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black tracking-wider shadow-md shrink-0">
            PCP
          </div>
          {!isCollapsed && (
            <div className="min-w-0 transition-opacity duration-200">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight truncate">
                  Carga Máquina
                </span>
                <span className="text-[9px] uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-bold">
                  PCP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Capacidade & Planejamento</p>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Navigation Body */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Navigation Tabs */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navegação Principal
            </div>
          )}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileOpen(false);
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                  } ${isCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : item.color
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}
                  {!isCollapsed && item.badge && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                        item.badgeColor || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Scenario Management Box */}
        <div className={`bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 ${isCollapsed ? 'px-2 text-center' : ''}`}>
          {!isCollapsed ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-400">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Cenário de Planejamento</span>
                </div>
                <button
                  onClick={onOpenManagerModal}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                  title="Gerenciar todos os cenários"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scenario Select */}
              <div className="relative">
                <select
                  value={activeScenarioId}
                  onChange={(e) => onSelectScenario(e.target.value)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-2.5 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
                >
                  {scenarios.map((scen) => (
                    <option key={scen.id} value={scen.id} className="bg-slate-900 text-white py-1">
                      {scen.name} {scen.isBaseline ? ' (Padrão)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-1 text-[11px]">
                {isScenarioModified ? (
                  <span className="flex items-center gap-1 text-amber-400 font-semibold animate-pulse">
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">Alterações não salvas</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">Sincronizado</span>
                  </span>
                )}
              </div>

              {/* Scenario Actions */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={onSaveCurrentScenario}
                  disabled={!isScenarioModified}
                  className={`col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isScenarioModified
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                  }`}
                  title="Salvar alterações no cenário ativo"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Cenário</span>
                </button>

                <button
                  onClick={onOpenNewScenarioModal}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                  title="Criar novo cenário a partir do estado atual"
                >
                  <Plus className="w-3 h-3" />
                  <span>Novo</span>
                </button>

                <button
                  onClick={onDuplicateCurrentScenario}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] rounded-lg transition-colors border border-slate-700 cursor-pointer"
                  title="Duplicar cenário ativo"
                >
                  <Copy className="w-3 h-3 text-indigo-400" />
                  <span>Duplicar</span>
                </button>

                <button
                  onClick={onOpenCompareModal}
                  className="col-span-2 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                  title="Comparar cenários de capacidade"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Comparar Cenários ({scenarios.length})</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                onClick={onOpenCompareModal}
                className="p-2 text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={`Cenários (${scenarios.length}) - Comparar`}
              >
                <GitBranch className="w-4 h-4" />
              </button>
              {isScenarioModified && (
                <button
                  onClick={onSaveCurrentScenario}
                  className="p-2 text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Salvar Alterações no Cenário"
                >
                  <Save className="w-4 h-4 animate-bounce" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions & Configuration */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Cadastros & Ações
            </div>
          )}
          <div className="space-y-1.5">
            {/* Novo Projeto Personalizado (Highlight) */}
            <button
              onClick={() => {
                onOpenTurbineProjectModal();
                setIsMobileOpen(false);
              }}
              title={isCollapsed ? 'Novo Projeto Personalizado' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer hover:scale-101 ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
              {!isCollapsed && <span className="truncate">Novo Projeto Personalizado</span>}
            </button>

            {/* Novo Projeto Manual */}
            <button
              onClick={() => {
                onOpenNewProjectModal();
                setIsMobileOpen(false);
              }}
              title={isCollapsed ? 'Novo Projeto Manual' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
            >
              <PlusCircle className="w-4 h-4 text-indigo-400 shrink-0" />
              {!isCollapsed && <span className="truncate">Novo Manual</span>}
            </button>

            {/* Centros de Trabalho Modal */}
            <button
              onClick={() => {
                onOpenWorkCenterModal();
                setIsMobileOpen(false);
              }}
              title={isCollapsed ? 'Configurar Centros de Trabalho' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-800 transition-colors cursor-pointer ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-400 shrink-0" />
              {!isCollapsed && <span className="truncate">Centros de Trabalho</span>}
            </button>

            {/* Cadastro de Curva S Modal */}
            {onOpenTurbineTypesModal && (
              <button
                onClick={() => {
                  onOpenTurbineTypesModal();
                  setIsMobileOpen(false);
                }}
                title={isCollapsed ? 'Cadastro de Curva S (Parametrização & Pesos)' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-800 transition-colors cursor-pointer ${
                  isCollapsed ? 'justify-center px-2' : ''
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Cadastro de Curva S</span>}
              </button>
            )}

            {/* Importar Planilha Matriz CSV / Excel */}
            {onOpenMatrixModal && (
              <button
                onClick={() => {
                  onOpenMatrixModal();
                  setIsMobileOpen(false);
                }}
                title={isCollapsed ? 'Importar Planilha (Projetos & Centros)' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 border border-indigo-500/30 transition-colors cursor-pointer ${
                  isCollapsed ? 'justify-center px-2' : ''
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Importar Planilha / CSV</span>}
              </button>
            )}

            {/* Import / Export JSON */}
            <button
              onClick={() => {
                onOpenJsonModal();
                setIsMobileOpen(false);
              }}
              title={isCollapsed ? 'Importar / Exportar JSON' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/60 hover:bg-slate-700 text-slate-300 border border-slate-800 transition-colors cursor-pointer ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
            >
              <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
              {!isCollapsed && <span className="truncate">Importar / Exportar JSON</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Footer / Reset / Info */}
      <div className="p-3 border-t border-slate-800/90 bg-slate-950/40 shrink-0 space-y-1.5">
        {onSaveAsBaseline && (
          <button
            onClick={onSaveAsBaseline}
            title="Salvar Estado Atual como Base Primária (Baseline Padrão de Inicialização)"
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
          >
            <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
            {!isCollapsed && <span className="truncate">Definir como Base Primária</span>}
          </button>
        )}

        <button
          onClick={onResetData}
          title="Restaurar Dados Iniciais de Fábrica"
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-2' : ''
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && <span className="truncate">Restaurar Base Padrão</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Topbar (Shown only on small screens < md) */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs">
              PCP
            </div>
            <span className="font-bold text-sm text-white">Carga Máquina</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isScenarioModified && (
            <button
              onClick={onSaveCurrentScenario}
              className="p-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar</span>
            </button>
          )}
          <button
            onClick={onOpenTurbineProjectModal}
            className="p-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Novo</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Sidebar (Permanent) */}
      <aside
        className={`hidden md:block shrink-0 h-screen sticky top-0 border-r border-slate-800 transition-all duration-300 z-30 shadow-md ${
          isCollapsed ? 'w-[72px]' : 'w-[268px]'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
