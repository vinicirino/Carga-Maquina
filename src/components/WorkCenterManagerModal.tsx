import React, { useState, useEffect, useMemo } from 'react';
import { WorkCenter, Project, CalendarException } from '../types';
import { TurbineType, SectorCurveConfig } from '../types/turbine';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import { getWorkCenterAllocatedHours } from '../utils/calculator';
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
  Palmtree,
  Calendar,
  Link2,
  ExternalLink,
  Clock,
  Sparkles,
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
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

interface WorkCenterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workCenters: WorkCenter[];
  sectorGroups: string[];
  turbineTypes?: TurbineType[];
  projects?: Project[];
  calendarExceptions?: CalendarException[];
  onOpenCalendarModal?: () => void;
  onAddSectorGroup: (name: string) => void;
  onDeleteSectorGroup: (name: string) => void;
  onSaveWorkCenters: (wcs: WorkCenter[]) => void;
  onUpdateTurbineTypes?: (types: TurbineType[]) => void;
  onUpdateProject?: (project: Project) => void;
}

export const WorkCenterManagerModal: React.FC<WorkCenterManagerModalProps> = ({
  isOpen,
  onClose,
  workCenters,
  sectorGroups,
  turbineTypes = [],
  projects = [],
  calendarExceptions = [],
  onOpenCalendarModal,
  onAddSectorGroup,
  onDeleteSectorGroup,
  onSaveWorkCenters,
  onUpdateTurbineTypes,
  onUpdateProject,
}) => {
  const [list, setList] = useState<WorkCenter[]>(workCenters);
  const [newGroupInput, setNewGroupInput] = useState('');

  // Discover all groups across sectorGroups and current work centers
  const allGroups = useMemo(() => {
    const set = new Set<string>();
    sectorGroups.forEach((g) => {
      if (g && g.trim()) set.add(g.trim().toUpperCase());
    });
    list.forEach((wc) => {
      const cat = getWorkCenterCategory(wc);
      if (cat && cat.trim()) set.add(cat.trim().toUpperCase());
    });
    if (set.size === 0) set.add('OUTROS');
    return Array.from(set);
  }, [sectorGroups, list]);

  const [newWcName, setNewWcName] = useState('');
  const [newWcCategory, setNewWcCategory] = useState<string>(
    allGroups.length > 0 ? allGroups[0] : 'CORTE'
  );
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedLinkFilter, setSelectedLinkFilter] = useState<'ALL' | 'LINKED' | 'UNLINKED'>('ALL');
  const [viewingLinksWc, setViewingLinksWc] = useState<WorkCenter | null>(null);

  // Keep list continuously synchronized with the central workCenters prop
  useEffect(() => {
    setList(workCenters);
  }, [workCenters, isOpen]);

  // Keep category selector valid when groups change
  useEffect(() => {
    if (allGroups.length > 0 && (!newWcCategory || !allGroups.includes(newWcCategory))) {
      setNewWcCategory(allGroups[0]);
    }
  }, [allGroups, newWcCategory]);

  // If selected group filter is deleted, return to ALL
  useEffect(() => {
    if (selectedGroupFilter !== 'ALL' && !allGroups.includes(selectedGroupFilter)) {
      setSelectedGroupFilter('ALL');
    }
  }, [allGroups, selectedGroupFilter]);

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

  const [selectedProjectIdToLink, setSelectedProjectIdToLink] = useState<string>('');
  const [linkHoursInput, setLinkHoursInput] = useState<number>(100);
  const [linkSuccessMessage, setLinkSuccessMessage] = useState<string | null>(null);

  // Helper to detect all links between a work center and the S-Curve models / Projects
  const getSCurveLinks = (wc: WorkCenter) => {
    const linkedTurbines: SCurveLinkDetail[] = [];
    const linkedProjects: ProjectLinkDetail[] = [];
    const wcCat = getWorkCenterCategory(wc);
    const wcNorm = String(wc.name || '').trim().toUpperCase();
    const wcIdNorm = String(wc.id || '').trim().toUpperCase();

    // 1. Scan Turbine Types / S-Curve Models
    turbineTypes.forEach((t) => {
      if (!t.sectorCurves) return;
      Object.entries(t.sectorCurves).forEach(([secName, rawCfg]) => {
        const sc = rawCfg as SectorCurveConfig;
        if (!sc) return;
        const shares = sc.customWorkCenterShares;
        let shareVal: number | undefined = undefined;
        if (shares) {
          if (shares[wc.id] !== undefined) shareVal = shares[wc.id];
          else if (shares[wc.name] !== undefined) shareVal = shares[wc.name];
          else {
            for (const [k, v] of Object.entries(shares)) {
              const kNorm = String(k || '').trim().toUpperCase();
              if (kNorm === wcNorm || kNorm === wcIdNorm) {
                shareVal = v;
                break;
              }
            }
          }
        }
        const hasCustomShare = shareVal !== undefined;
        const isSectorMatch =
          secName.trim().toUpperCase() === wcCat && (sc.percentage || 0) > 0;

        if (hasCustomShare) {
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

    // 2. Scan Projects with Turbine S-Curve Configuration / workCenterHours / dates
    projects.forEach((p) => {
      let hours = 0;
      let isLinked = false;

      if (p.workCenterHours) {
        if (typeof p.workCenterHours[wc.id] === 'number') {
          hours = p.workCenterHours[wc.id];
          isLinked = true;
        } else if (typeof p.workCenterHours[wc.name] === 'number') {
          hours = p.workCenterHours[wc.name];
          isLinked = true;
        } else {
          for (const [k, v] of Object.entries(p.workCenterHours)) {
            if (typeof v === 'number') {
              const kNorm = String(k || '').trim().toUpperCase();
              if (kNorm === wcNorm || kNorm === wcIdNorm) {
                hours = v;
                isLinked = true;
                break;
              }
            }
          }
        }
      }

      // Check turbine config custom hours if not yet matched
      if (!isLinked && p.turbineConfig?.customWorkCenterHours) {
        const customHours = p.turbineConfig.customWorkCenterHours;
        if (typeof customHours[wc.id] === 'number') {
          hours = customHours[wc.id];
          isLinked = true;
        } else if (typeof customHours[wc.name] === 'number') {
          hours = customHours[wc.name];
          isLinked = true;
        } else {
          for (const [k, v] of Object.entries(customHours)) {
            if (typeof v === 'number') {
              const kNorm = String(k || '').trim().toUpperCase();
              if (kNorm === wcNorm || kNorm === wcIdNorm) {
                hours = v;
                isLinked = true;
                break;
              }
            }
          }
        }
      }

      // Check workCenterDates if project explicitly assigned schedule for this center
      if (!isLinked && p.workCenterDates) {
        if (p.workCenterDates[wc.id] || p.workCenterDates[wc.name]) {
          isLinked = true;
        }
      }

      if (isLinked || hours > 0) {
        linkedProjects.push({
          projectId: p.id,
          projectName: p.name,
          hours,
          startDate: p.startDate,
          endDate: p.endDate,
          enabled: p.enabled !== false,
        });
      }
    });

    return { linkedTurbines, linkedProjects };
  };

  const handleLinkProject = (wc: WorkCenter) => {
    if (!selectedProjectIdToLink || linkHoursInput < 0 || !onUpdateProject) return;
    const proj = projects.find((p) => p.id === selectedProjectIdToLink);
    if (!proj) return;
    const currentWcHours = { ...(proj.workCenterHours || {}) };
    currentWcHours[wc.id] = linkHoursInput;
    currentWcHours[wc.name] = linkHoursInput;
    const updatedProject: Project = {
      ...proj,
      workCenterHours: currentWcHours,
    };
    onUpdateProject(updatedProject);
    setSelectedProjectIdToLink('');
    setLinkSuccessMessage(`✅ Vínculo criado com sucesso no projeto "${proj.name}" (${linkHoursInput}h)!`);
    setTimeout(() => setLinkSuccessMessage(null), 3000);
  };

  const handleUnlinkProject = (wc: WorkCenter, projectId: string) => {
    if (!onUpdateProject) return;
    const proj = projects.find((p) => p.id === projectId);
    if (!proj || !proj.workCenterHours) return;
    const currentWcHours = { ...proj.workCenterHours };
    delete currentWcHours[wc.id];
    delete currentWcHours[wc.name];
    delete currentWcHours[String(wc.name || '').trim().toUpperCase()];
    const updatedProject: Project = {
      ...proj,
      workCenterHours: currentWcHours,
    };
    onUpdateProject(updatedProject);
    setLinkSuccessMessage(`Vínculo removido do projeto "${proj.name}".`);
    setTimeout(() => setLinkSuccessMessage(null), 3000);
  };

  const handleUpdateProjectHours = (wc: WorkCenter, projectId: string, hours: number) => {
    if (!onUpdateProject || hours < 0) return;
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const currentWcHours = { ...(proj.workCenterHours || {}) };
    if (hours === 0) {
      delete currentWcHours[wc.id];
      delete currentWcHours[wc.name];
    } else {
      currentWcHours[wc.id] = hours;
      currentWcHours[wc.name] = hours;
    }
    const updatedProject: Project = {
      ...proj,
      workCenterHours: currentWcHours,
    };
    onUpdateProject(updatedProject);
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
    const nextList = list.filter((w) => w.id !== id);
    setList(nextList);
    onSaveWorkCenters(nextList);
  };

  const handleConfirmDeleteWithSCurveUpdate = () => {
    if (!deleteConfirmation) return;
    const { wc } = deleteConfirmation;

    // 1. Remove from work centers list
    const nextList = list.filter((w) => w.id !== wc.id);
    setList(nextList);
    onSaveWorkCenters(nextList);

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
    const updated = [...list, newWc];
    setList(updated);
    onSaveWorkCenters(updated); // Instantly persist new center so it is visible to project imports and all scenarios
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

  const linkedCount = list.filter((wc) => getSCurveLinks(wc).linkedProjects.length > 0).length;
  const unlinkedCount = list.length - linkedCount;

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
    if (selectedLinkFilter === 'LINKED' && getSCurveLinks(wc).linkedProjects.length === 0) {
      return false;
    }
    if (selectedLinkFilter === 'UNLINKED' && getSCurveLinks(wc).linkedProjects.length > 0) {
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
          <div className="flex items-center gap-2">
            {onOpenCalendarModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCalendarModal();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                title="Abrir Calendário de Férias, Feriados e Paradas"
              >
                <Palmtree className="w-3.5 h-3.5 text-emerald-600" />
                <span>Calendário de Férias & Feriados</span>
                {calendarExceptions.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-black">
                    {calendarExceptions.length}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                {allGroups.map((group) => {
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
                    {allGroups.map((grp) => (
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

                  {/* Link Status Filter */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedLinkFilter('ALL')}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                        selectedLinkFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Ver todos os centros"
                    >
                      Todos Vínculos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLinkFilter('LINKED')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                        selectedLinkFilter === 'LINKED'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-indigo-700 hover:text-indigo-900'
                      }`}
                      title="Centros vinculados a pelo menos um projeto ativo"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Vinculados ({linkedCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLinkFilter('UNLINKED')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                        selectedLinkFilter === 'UNLINKED'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-amber-800 hover:text-amber-900'
                      }`}
                      title="Centros sem vínculo ou sem horas em projetos ativos"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Sem Vínculo ({unlinkedCount})</span>
                    </button>
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
                      {allGroups.map((grp) => (
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
                <table className="w-full text-left text-xs min-w-[940px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-24 shrink-0">Status</th>
                      <th className="py-2.5 px-4 min-w-[220px] sm:min-w-[260px]">Centro de Trabalho</th>
                      <th className="py-2.5 px-2 min-w-[140px]">Agrupador (Setor)</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Vínculo com Projetos</th>
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
                      const links = getSCurveLinks(wc);
                      const allocated = getWorkCenterAllocatedHours(wc, projects);
                      const hasLinkedProjects = links.linkedProjects.length > 0;

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

                          <td className="py-2 px-4 min-w-[220px] sm:min-w-[260px]">
                            <input
                              type="text"
                              value={wc.name}
                              onChange={(e) => handleUpdate(wc.id, 'name', e.target.value)}
                              title={wc.name}
                              className={`w-full font-black bg-slate-50/60 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md px-2 py-1 focus:outline-none text-xs uppercase transition-colors ${
                                isEnabled ? 'text-slate-900' : 'text-slate-500 line-through'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2">
                            <select
                              value={currentCategory}
                              onChange={(e) => handleUpdate(wc.id, 'category', e.target.value)}
                              className="text-xs font-black text-indigo-950 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer uppercase"
                            >
                              {allGroups.map((grp) => (
                                <option key={grp} value={grp}>
                                  {grp}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Link Status & Allocation Badge (Clickable to manage links) */}
                          <td className="py-2 px-3">
                            <button
                              type="button"
                              onClick={() => setViewingLinksWc(wc)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                                hasLinkedProjects
                                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200 hover:border-indigo-300'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200 hover:border-amber-300'
                              }`}
                              title="Clique para ver os projetos vinculados ou vincular a novos projetos"
                            >
                              {hasLinkedProjects ? (
                                <>
                                  <Link2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>{links.linkedProjects.length} proj ({Math.round(allocated).toLocaleString()}h)</span>
                                  <ExternalLink className="w-3 h-3 text-indigo-400 shrink-0 opacity-70" />
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Sem Vínculo (0h)</span>
                                  <Plus className="w-3 h-3 text-amber-700 shrink-0 ml-0.5" />
                                </>
                              )}
                            </button>
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

      {/* ========================================================================= */}
      {/* WORK CENTER PROJECT & S-CURVE LINK MANAGER MODAL                         */}
      {/* ========================================================================= */}
      {viewingLinksWc && (() => {
        const links = getSCurveLinks(viewingLinksWc);
        const allocated = getWorkCenterAllocatedHours(viewingLinksWc, projects);
        const currentCategory = getWorkCenterCategory(viewingLinksWc);
        const availableProjectsToLink = projects.filter(
          (p) => !links.linkedProjects.some((lp) => lp.projectId === p.id)
        );

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[88vh] text-slate-900 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold shrink-0">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>Vínculos do Centro: {viewingLinksWc.name}</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-extrabold uppercase">
                        {currentCategory}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Gerencie a vinculação deste centro com projetos ativos e visualize a integração com a Curva S.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewingLinksWc(null);
                    setLinkSuccessMessage(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {linkSuccessMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{linkSuccessMessage}</span>
                  </div>
                )}

                {/* KPI Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Horas Alocadas</span>
                    <div className="text-base font-black text-indigo-700 mt-0.5">
                      {Math.round(allocated).toLocaleString()} h
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Projetos Vinculados</span>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {links.linkedProjects.length}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Modelos de Curva S</span>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {links.linkedTurbines.length}
                    </div>
                  </div>
                </div>

                {/* Form: Vincular a um Novo Projeto */}
                {onUpdateProject && (
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold">
                      <Plus className="w-4 h-4 text-indigo-600" />
                      <span>Vincular este Centro a um Projeto Existente:</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={selectedProjectIdToLink}
                        onChange={(e) => setSelectedProjectIdToLink(e.target.value)}
                        className="flex-1 p-2 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Selecione o Projeto --</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {links.linkedProjects.some((lp) => lp.projectId === p.id) ? '*(já vinculado)' : ''}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-slate-600 font-bold">Horas:</span>
                        <input
                          type="number"
                          min={1}
                          step={10}
                          value={linkHoursInput}
                          onChange={(e) => setLinkHoursInput(Math.max(1, parseInt(e.target.value, 10) || 0))}
                          className="w-20 p-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-center text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleLinkProject(viewingLinksWc)}
                          disabled={!selectedProjectIdToLink}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
                        >
                          Vincular
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section: Projetos Atualmente Vinculados */}
                <div className="space-y-2">
                  <span className="font-black text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>Projetos Vinculados ({links.linkedProjects.length})</span>
                    <span className="text-[10px] text-slate-400 font-medium lowercase">
                      horas registradas no cronograma
                    </span>
                  </span>

                  {links.linkedProjects.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-slate-300 p-4 rounded-xl text-center text-slate-500">
                      Nenhum projeto possui horas alocadas para este centro de trabalho no cenário ativo.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Projeto</th>
                            <th className="py-2 px-2 text-right">Horas</th>
                            <th className="py-2 px-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {links.linkedProjects.map((lp) => (
                            <tr key={lp.projectId} className="hover:bg-slate-50">
                              <td className="py-2 px-3">
                                <div className="font-bold text-slate-900">{lp.projectName}</div>
                                {lp.startDate && lp.endDate && (
                                  <div className="text-[10px] text-slate-400">
                                    {lp.startDate} até {lp.endDate}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-indigo-700">
                                {Math.round(lp.hours).toLocaleString()} h
                              </td>
                              <td className="py-2 px-3 text-center">
                                {onUpdateProject && (
                                  <button
                                    type="button"
                                    onClick={() => handleUnlinkProject(viewingLinksWc, lp.projectId)}
                                    className="px-2 py-0.5 text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 rounded cursor-pointer transition-colors"
                                    title="Remover horas deste centro no projeto"
                                  >
                                    Desvincular
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section: Modelos de Curva S */}
                {links.linkedTurbines.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="font-black text-slate-800 uppercase tracking-wider text-[11px] block">
                      Modelos de Curva S ({links.linkedTurbines.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {links.linkedTurbines.map((lt, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-50 border border-slate-200 p-2 rounded-lg space-y-0.5"
                        >
                          <div className="font-bold text-slate-800">{lt.modelName}</div>
                          <div className="text-[10px] text-indigo-600">{lt.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setViewingLinksWc(null);
                    setLinkSuccessMessage(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
