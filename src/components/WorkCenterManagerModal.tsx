import React, { useState } from 'react';
import { WorkCenter, Project } from '../types';
import { TurbineType, SectorCurveConfig } from '../types/turbine';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import {
  X,
  Plus,
  Trash2,
  Factory,
  Save,
  FolderTree,
  Tag,
  Filter,
  Layers,
  CheckCircle,
  Power,
  ToggleLeft,
  ToggleRight,
  Check,
  Ban,
  AlertTriangle,
  Flame,
  TrendingUp,
} from 'lucide-react';

export interface SCurveLinkDetail {
  modelId: string;
  modelName: string;
  sectorName: string;
  detail: string;
}

export interface ProjectLinkDetail {
  projectId: string;
  projectName: string;
  hours: number;
}

interface WorkCenterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workCenters: WorkCenter[];
  sectorGroups: string[];
  turbineTypes?: TurbineType[];
  projects?: Project[];
  onAddSectorGroup: (name: string) => void;
  onDeleteSectorGroup: (name: string) => void;
  onSaveWorkCenters: (wcs: WorkCenter[]) => void;
  onUpdateTurbineTypes?: (types: TurbineType[]) => void;
}

export const WorkCenterManagerModal: React.FC<WorkCenterManagerModalProps> = ({
  isOpen,
  onClose,
  workCenters,
  sectorGroups,
  turbineTypes = [],
  projects = [],
  onAddSectorGroup,
  onDeleteSectorGroup,
  onSaveWorkCenters,
  onUpdateTurbineTypes,
}) => {
  const [list, setList] = useState<WorkCenter[]>(workCenters);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [newWcName, setNewWcName] = useState('');
  const [newWcCategory, setNewWcCategory] = useState<string>(
    sectorGroups.length > 0 ? sectorGroups[0] : 'CORTE'
  );
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Confirmation Alert Dialog when deleting a work center linked to S-Curve / Projects
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    wc: WorkCenter;
    linkedTurbines: SCurveLinkDetail[];
    linkedProjects: ProjectLinkDetail[];
  } | null>(null);

  if (!isOpen) return null;

  const handleCreateGroup = () => {
    if (!newGroupInput.trim()) return;
    const trimmed = newGroupInput.trim().toUpperCase();
    onAddSectorGroup(trimmed);
    setNewGroupInput('');
    if (!newWcCategory) {
      setNewWcCategory(trimmed);
    }
  };

  const handleUpdate = (id: string, field: keyof WorkCenter, value: any) => {
    setList((prev) =>
      prev.map((wc) => (wc.id === id ? { ...wc, [field]: value } : wc))
    );
  };

  const handleToggleEnabled = (id: string) => {
    setList((prev) =>
      prev.map((wc) =>
        wc.id === id ? { ...wc, enabled: wc.enabled === false ? true : false } : wc
      )
    );
  };

  // Helper to detect all links between a work center and the S-Curve models / Projects
  const getSCurveLinks = (wc: WorkCenter) => {
    const linkedTurbines: SCurveLinkDetail[] = [];
    const linkedProjects: ProjectLinkDetail[] = [];
    const wcCat = getWorkCenterCategory(wc);

    // 1. Scan Turbine Types / S-Curve Models
    turbineTypes.forEach((t) => {
      if (!t.sectorCurves) return;
      Object.entries(t.sectorCurves).forEach(([secName, rawCfg]) => {
        const sc = rawCfg as SectorCurveConfig;
        if (!sc) return;
        const shares = sc.customWorkCenterShares;
        const hasCustomShare =
          shares && (shares[wc.id] !== undefined || shares[wc.name] !== undefined);
        const isSectorMatch =
          secName.trim().toUpperCase() === wcCat && (sc.percentage || 0) > 0;

        if (hasCustomShare) {
          const shareVal = shares[wc.id] ?? shares[wc.name];
          linkedTurbines.push({
            modelId: t.id,
            modelName: t.name,
            sectorName: secName,
            detail: `Rateio customizado de ${shareVal}% no setor ${secName}`,
          });
        } else if (isSectorMatch) {
          linkedTurbines.push({
            modelId: t.id,
            modelName: t.name,
            sectorName: secName,
            detail: `Alocado no agrupador ${secName} (${sc.percentage}% da curva total)`,
          });
        }
      });
    });

    // 2. Scan Projects with Turbine S-Curve Configuration
    projects.forEach((p) => {
      const hours =
        p.workCenterHours?.[wc.name] ||
        (p.workCenterHours as any)?.[wc.id] ||
        0;
      if (hours > 0 || (p.turbineConfig && p.turbineConfig.hoursPerTurbine > 0)) {
        if (hours > 0) {
          linkedProjects.push({
            projectId: p.id,
            projectName: p.name,
            hours,
          });
        }
      }
    });

    return { linkedTurbines, linkedProjects };
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const wc = list.find((w) => w.id === id);
    if (!wc) return;

    const { linkedTurbines, linkedProjects } = getSCurveLinks(wc);

    if (linkedTurbines.length > 0 || linkedProjects.length > 0) {
      setDeleteConfirmation({
        wc,
        linkedTurbines,
        linkedProjects,
      });
      return;
    }

    // Direct deletion if no links
    setList((prev) => prev.filter((w) => w.id !== id));
  };

  const handleConfirmDeleteWithSCurveUpdate = () => {
    if (!deleteConfirmation) return;
    const { wc } = deleteConfirmation;

    // 1. Remove from work centers list
    setList((prev) => prev.filter((w) => w.id !== wc.id));

    // 2. Clean up customWorkCenterShares from turbine types if callback exists
    if (onUpdateTurbineTypes && turbineTypes.length > 0) {
      const updatedTurbineTypes = turbineTypes.map((t) => {
        if (!t.sectorCurves) return t;
        let changed = false;
        const updatedCurves: Record<string, SectorCurveConfig> = { ...t.sectorCurves };

        Object.entries(updatedCurves).forEach(([secKey, rawSecCfg]) => {
          const secCfg = rawSecCfg as SectorCurveConfig;
          if (secCfg && secCfg.customWorkCenterShares) {
            const shares = { ...secCfg.customWorkCenterShares };
            if (shares[wc.id] !== undefined || shares[wc.name] !== undefined) {
              delete shares[wc.id];
              delete shares[wc.name];
              changed = true;
              updatedCurves[secKey] = {
                ...secCfg,
                customWorkCenterShares: Object.keys(shares).length > 0 ? shares : undefined,
              };
            }
          }
        });

        return changed ? { ...t, sectorCurves: updatedCurves } : t;
      });

      onUpdateTurbineTypes(updatedTurbineTypes);
    }

    setDeleteConfirmation(null);
  };

  const handleAdd = () => {
    if (!newWcName.trim()) return;
    const cat = newWcCategory || (sectorGroups.length > 0 ? sectorGroups[0] : 'OUTROS');
    const newWc: WorkCenter = {
      id: `wc-${Date.now()}-${newWcName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: newWcName.trim().toUpperCase(),
      dailyHours: 8,
      daysPerWeek: 5,
      resourcesCount: 1,
      efficiencyPercentage: 100,
      category: cat,
      enabled: true,
    };
    setList((prev) => [...prev, newWc]);
    setNewWcName('');
  };

  const handleSave = () => {
    for (const wc of list) {
      if (!wc.name.trim()) return;
      if (!wc.dailyHours || wc.dailyHours <= 0) return;
      if (!wc.daysPerWeek || wc.daysPerWeek <= 0) return;
      if (!wc.resourcesCount || wc.resourcesCount <= 0) return;
      if (!wc.efficiencyPercentage || wc.efficiencyPercentage <= 0) return;
    }
    onSaveWorkCenters(list);
    onClose();
  };

  const filteredList = list.filter((wc) => {
    if (selectedGroupFilter !== 'ALL' && getWorkCenterCategory(wc) !== selectedGroupFilter) {
      return false;
    }
    if (selectedStatusFilter === 'ACTIVE' && wc.enabled === false) {
      return false;
    }
    if (selectedStatusFilter === 'INACTIVE' && wc.enabled !== false) {
      return false;
    }
    return true;
  });

  const activeCount = list.filter((wc) => wc.enabled !== false).length;
  const inactiveCount = list.filter((wc) => wc.enabled === false).length;

  const totalWeeklyCapacity = list
    .filter((wc) => wc.enabled !== false)
    .reduce((acc, wc) => {
      return (
        acc +
        (wc.dailyHours || 0) *
          (wc.daysPerWeek || 0) *
          (wc.resourcesCount || 0) *
          ((wc.efficiencyPercentage || 0) / 100)
      );
    }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-7xl 2xl:max-w-[96vw] overflow-hidden flex flex-col h-[94vh] max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-xs">
              <Factory className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                Gerenciador de Agrupadores & Centros de Trabalho
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold uppercase">
                  Capacidade & Recursos
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Organize os centros em agrupadores setoriais, ajuste jornadas, quantidade de recursos e eficiências operacionais.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Sidebar (Dark Blue) + Right Content (Light) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* ========================================================================= */}
          {/* LEFT SIDEBAR (DARK BLUE): AGRUPADORES DE CENTROS & CRIAÇÃO               */}
          {/* ========================================================================= */}
          <div className="w-full md:w-72 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-3.5 flex flex-col justify-between overflow-y-auto shrink-0 text-white">
            <div className="space-y-3">
              {/* Header of Sidebar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Agrupadores ({sectorGroups.length})</span>
                </span>
              </div>

              {/* Form to Create New Group */}
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Criar Novo Agrupador
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Nome (ex: CORTE, SOLDA)..."
                    value={newGroupInput}
                    onChange={(e) => setNewGroupInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-bold uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Agrupador</span>
                  </button>
                </div>
              </div>

              {/* Agrupadores List / Quick Filters */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1 pb-0.5">
                  Filtrar / Visualizar
                </div>

                {/* All Groups Button */}
                <button
                  type="button"
                  onClick={() => setSelectedGroupFilter('ALL')}
                  className={`w-full p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                    selectedGroupFilter === 'ALL'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-bold truncate">Todos os Agrupadores</span>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      selectedGroupFilter === 'ALL'
                        ? 'bg-indigo-700 text-indigo-100'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {list.length}
                  </span>
                </button>

                {/* Individual Group Badges/Cards */}
                {sectorGroups.map((group) => {
                  const count = list.filter((wc) => getWorkCenterCategory(wc) === group).length;
                  const isSelected = selectedGroupFilter === group;

                  return (
                    <div
                      key={group}
                      onClick={() => setSelectedGroupFilter(group)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                          : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        <Tag className="w-3 h-3 shrink-0 text-indigo-300" />
                        <span className="text-xs font-bold truncate uppercase">{group}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-indigo-700 text-indigo-100'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {count}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSectorGroup(group);
                            if (selectedGroupFilter === group) {
                              setSelectedGroupFilter('ALL');
                            }
                          }}
                          title={`Excluir agrupador ${group}`}
                          className="p-1 text-slate-400 hover:text-rose-300 hover:bg-slate-700/80 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Summary Footer */}
            <div className="pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Centros Ativos:</span>
                <strong className="text-emerald-400 font-mono">{activeCount} / {list.length}</strong>
              </div>
              {inactiveCount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Inativos / Desativados:</span>
                  <strong className="text-rose-400 font-mono">{inactiveCount}</strong>
                </div>
              )}
              <div className="flex justify-between">
                <span>Capacidade Ativa:</span>
                <strong className="text-indigo-300 font-mono">{totalWeeklyCapacity.toFixed(1)}h/sem</strong>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT MAIN AREA (LIGHT THEME): CADASTRO & TABELA DE CENTROS              */}
          {/* ========================================================================= */}
          <div className="flex-1 p-4 flex flex-col space-y-3.5 overflow-y-auto bg-slate-50 min-h-0">
            {/* Section 1: Cadastrar Novo Centro de Trabalho */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cadastrar Novo Centro de Trabalho</span>
              </h4>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome do Centro de Trabalho (ex: TORNO CNC MULTITASK)..."
                  value={newWcName}
                  onChange={(e) => setNewWcName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  className="flex-1 text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white font-bold text-slate-900 placeholder:text-slate-400 uppercase transition-colors"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-600">Agrupador:</span>
                  <select
                    value={newWcCategory}
                    onChange={(e) => setNewWcCategory(e.target.value)}
                    className="text-xs font-bold px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 uppercase cursor-pointer"
                  >
                    {sectorGroups.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Centro</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Tabela de Centros de Trabalho */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      Lista de Centros & Parâmetros Operacionais (
                      {selectedGroupFilter === 'ALL'
                        ? `${filteredList.length} de ${list.length} centros`
                        : `${filteredList.length} em ${selectedGroupFilter}`}
                      )
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Ative ou inative recursos (centros inativos têm horas e capacidade zeradas nos gráficos). Ajuste jornadas e postos.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Filter */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedStatusFilter('ALL')}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                        selectedStatusFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Todos ({list.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatusFilter('ACTIVE')}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                        selectedStatusFilter === 'ACTIVE'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-emerald-700 hover:text-emerald-900'
                      }`}
                    >
                      Ativos ({activeCount})
                    </button>
                    {inactiveCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStatusFilter('INACTIVE')}
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                          selectedStatusFilter === 'INACTIVE'
                            ? 'bg-slate-700 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Inativos ({inactiveCount})
                      </button>
                    )}
                  </div>

                  {/* Filter Table by Group */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={selectedGroupFilter}
                      onChange={(e) => setSelectedGroupFilter(e.target.value)}
                      className="text-xs font-bold px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="ALL">Todos os Agrupadores</option>
                      {sectorGroups.map((grp) => (
                        <option key={grp} value={grp}>
                          {grp}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto overflow-y-auto border border-slate-200 rounded-xl flex-1 max-h-[52vh]">
                <table className="w-full text-left text-xs min-w-[840px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-24 shrink-0">Status</th>
                      <th className="py-2.5 px-4 min-w-[240px] sm:min-w-[300px]">Centro de Trabalho</th>
                      <th className="py-2.5 px-2 min-w-[140px]">Agrupador (Setor)</th>
                      <th className="py-2.5 px-2 text-center w-20">Horas/Dia</th>
                      <th className="py-2.5 px-2 text-center w-20">Dias/Sem</th>
                      <th className="py-2.5 px-2 text-center w-20">Nº Rec</th>
                      <th className="py-2.5 px-2 text-center w-20">Efic. %</th>
                      <th className="py-2.5 px-3 text-right min-w-[90px]">Cap. Semanal</th>
                      <th className="py-2.5 px-2 text-center w-14">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredList.map((wc) => {
                      const isEnabled = wc.enabled !== false;
                      const cap = isEnabled
                        ? (wc.dailyHours || 0) *
                          (wc.daysPerWeek || 0) *
                          (wc.resourcesCount || 0) *
                          ((wc.efficiencyPercentage || 0) / 100)
                        : 0;

                      const currentCategory = getWorkCenterCategory(wc);

                      return (
                        <tr
                          key={wc.id}
                          className={`transition-colors ${
                            isEnabled
                              ? 'hover:bg-indigo-50/30'
                              : 'bg-slate-100/60 opacity-65 hover:opacity-100'
                          }`}
                        >
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleEnabled(wc.id)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition-all ${
                                isEnabled
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-600 border border-slate-300 hover:bg-slate-300'
                              }`}
                              title={isEnabled ? 'Clique para Inativar este Centro' : 'Clique para Ativar este Centro'}
                            >
                              {isEnabled ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>ATIVO</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3 h-3 text-slate-500" />
                                  <span>INATIVO</span>
                                </>
                              )}
                            </button>
                          </td>

                          <td className="py-2 px-4 min-w-[240px] sm:min-w-[300px]">
                            <div className="flex items-center gap-1.5 w-full">
                              <input
                                type="text"
                                value={wc.name}
                                onChange={(e) => handleUpdate(wc.id, 'name', e.target.value)}
                                title={wc.name}
                                className={`w-full font-black bg-slate-50/60 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md px-2 py-1 focus:outline-none text-xs uppercase transition-colors ${
                                  isEnabled ? 'text-slate-900' : 'text-slate-500 line-through'
                                }`}
                              />
                            </div>
                          </td>

                          <td className="py-2 px-2">
                            <select
                              value={currentCategory}
                              onChange={(e) => handleUpdate(wc.id, 'category', e.target.value)}
                              className="text-xs font-black text-indigo-950 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer uppercase"
                            >
                              {sectorGroups.map((grp) => (
                                <option key={grp} value={grp}>
                                  {grp}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step={0.5}
                              min={1}
                              value={wc.dailyHours === 0 ? '' : wc.dailyHours}
                              onChange={(e) =>
                                handleUpdate(wc.id, 'dailyHours', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
                              }
                              placeholder="0"
                              className={`w-16 text-center text-xs border rounded px-1 py-0.5 transition-colors font-bold ${
                                !wc.dailyHours || wc.dailyHours <= 0
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min={1}
                              max={7}
                              value={wc.daysPerWeek === 0 ? '' : wc.daysPerWeek}
                              onChange={(e) =>
                                handleUpdate(wc.id, 'daysPerWeek', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)
                              }
                              placeholder="0"
                              className={`w-14 text-center text-xs border rounded px-1 py-0.5 transition-colors font-bold ${
                                !wc.daysPerWeek || wc.daysPerWeek <= 0
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min={1}
                              value={wc.resourcesCount === 0 ? '' : wc.resourcesCount}
                              onChange={(e) =>
                                handleUpdate(wc.id, 'resourcesCount', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)
                              }
                              placeholder="0"
                              className={`w-14 text-center text-xs font-black border rounded px-1 py-0.5 transition-colors ${
                                !wc.resourcesCount || wc.resourcesCount <= 0
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step={1}
                              min={1}
                              max={200}
                              value={wc.efficiencyPercentage === 0 ? '' : Math.round(wc.efficiencyPercentage)}
                              onChange={(e) =>
                                handleUpdate(
                                  wc.id,
                                  'efficiencyPercentage',
                                  e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                                )
                              }
                              placeholder="0"
                              className={`w-14 text-center text-xs border rounded px-1 py-0.5 transition-colors font-bold ${
                                !wc.efficiencyPercentage || wc.efficiencyPercentage <= 0
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2 text-right font-black text-indigo-700 font-mono">
                            {isEnabled ? `${cap.toFixed(1)}h` : <span className="text-slate-400 italic">0.0h (inativo)</span>}
                          </td>

                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => handleDelete(wc.id, e)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Remover Centro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredList.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  Nenhum centro de trabalho cadastrado para o filtro selecionado.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Total: <strong className="text-slate-900">{activeCount} ativos</strong> de {list.length} centros em{' '}
              <strong className="text-slate-900">{sectorGroups.length} agrupadores</strong> | Capacidade Ativa:{' '}
              <strong className="text-indigo-700 font-mono">{totalWeeklyCapacity.toFixed(1)}h/semana</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* S-CURVE / TURBINE LINK DELETION CONFIRMATION DIALOG                      */}
      {/* ========================================================================= */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center font-bold shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>Excluir Centro com Vínculos na Curva S</span>
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  O centro de trabalho <strong className="text-rose-700 font-mono font-bold uppercase">{deleteConfirmation.wc.name}</strong> possui vínculos ativos com parametrizações de Curva S.
                </p>
              </div>
            </div>

            {/* Warning Callout Box */}
            <div className="bg-rose-50/80 border border-rose-200/90 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-800">
              <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                <TrendingUp className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Impacto nos Registros da Curva S:</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-700">
                Tem certeza que deseja excluir? Ao confirmar a exclusão, <strong>os registros e configurações da Curva S serão alterados automaticamente</strong> (o centro será removido dos rateios percentuais do setor e seus históricos vinculados).
              </p>

              {/* Linked Turbines / S-Curve Models */}
              {deleteConfirmation.linkedTurbines.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-rose-200/60">
                  <span className="text-[10px] font-bold text-rose-900 uppercase tracking-wider block">
                    Modelos de Curva S Afetados ({deleteConfirmation.linkedTurbines.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                    {deleteConfirmation.linkedTurbines.map((lt, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-rose-200 text-rose-800 px-2 py-0.5 rounded-md text-[10px] font-bold"
                        title={lt.detail}
                      >
                        {lt.modelName} ({lt.sectorName})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Projects */}
              {deleteConfirmation.linkedProjects.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-rose-200/60">
                  <span className="text-[10px] font-bold text-rose-900 uppercase tracking-wider block">
                    Projetos com Horas Vinculadas ({deleteConfirmation.linkedProjects.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                    {deleteConfirmation.linkedProjects.map((lp, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-rose-200 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold"
                      >
                        {lp.projectName} ({lp.hours.toLocaleString()}h)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Prompt */}
            <p className="text-xs font-semibold text-slate-700">
              Deseja realmente prosseguir com a exclusão do centro de trabalho e a atualização dos registros da Curva S?
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWithSCurveUpdate}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir e Alterar Curva S</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
