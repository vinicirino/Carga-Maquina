import React, { useState, useMemo, useEffect } from 'react';
import { Project, WorkCenter, DEFAULT_SECTOR_GROUPS } from '../types';
import {
  TurbineProjectConfig,
  SectorCurveConfig,
  TurbineType,
} from '../types/turbine';
import { DEFAULT_TURBINE_TYPES } from '../data/defaultTurbines';
import {
  calculateTurbineProject,
  buildProjectFromTurbineConfig,
  safeParseDate,
  TurbineCalculationResult,
} from '../utils/turbineCalculator';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import {
  clampDateString,
  sanitizeProjectSchedules,
  getProjectTotalHours,
} from '../utils/dateValidation';
import {
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckSquare,
  Square,
  ShieldCheck,
  Edit3,
  Sparkles,
  Activity,
  CheckCircle,
  Save,
  Sliders,
  Search,
  Maximize2,
  RefreshCw,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';
import { VolumeDialControl } from './VolumeDialControl';
import { CustomTurbineProjectModal } from './CustomTurbineProjectModal';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
} from 'recharts';
import { parseISO, format, differenceInDays, addDays } from 'date-fns';

interface ProjectTimelineProps {
  projects: Project[];
  workCenters: WorkCenter[];
  sectorGroups?: string[];
  onUpdateProject: (updated: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNewProjectModal?: () => void;
  onOpenTurbineProjectModal?: () => void;
  onOpenMatrixModal?: () => void;
}

// Inner Component for the Interactive Split-View Editor per Expanded Project
interface ProjectInlineEditorProps {
  project: Project;
  workCenters: WorkCenter[];
  sectorGroups: string[];
  onSave: (updated: Project) => void;
  onOpenModal: (project: Project) => void;
}

const ProjectInlineEditor: React.FC<ProjectInlineEditorProps> = ({
  project,
  workCenters,
  sectorGroups,
  onSave,
  onOpenModal,
}) => {
  const [chartTab, setChartTab] = useState<'CURVE' | 'HISTOGRAM' | 'SECTORS'>('CURVE');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Initialize turbine project config from project.turbineConfig or generate default
  const [config, setConfig] = useState<TurbineProjectConfig>(() => {
    if (project.turbineConfig) {
      return JSON.parse(JSON.stringify(project.turbineConfig));
    }

    // Derive initial config from project data
    const totalHours = getProjectTotalHours(project, workCenters);

    const initialCurves: Record<string, SectorCurveConfig> = {};
    sectorGroups.forEach((g) => {
      // Calculate hours in this group
      const wcsInGroup = workCenters.filter(
        (wc) => (wc.category || 'OUTROS').trim().toUpperCase() === g.trim().toUpperCase()
      );
      const groupHours = wcsInGroup.reduce(
        (sum, wc) => sum + (project.workCenterHours?.[wc.name] || project.workCenterHours?.[wc.id] || 0),
        0
      );
      const pct = totalHours > 0 ? Number(((groupHours / totalHours) * 100).toFixed(1)) : 0;

      const customWcShares: Record<string, number> = {};
      if (groupHours > 0) {
        wcsInGroup.forEach((wc) => {
          const hrs = project.workCenterHours?.[wc.name] ?? project.workCenterHours?.[wc.id] ?? 0;
          customWcShares[wc.id] = hrs > 0 ? Math.round((hrs / groupHours) * 100) : 0;
        });
      } else {
        wcsInGroup.forEach((wc) => {
          customWcShares[wc.id] = 0;
        });
      }

      initialCurves[g] = {
        sectorName: g,
        percentage: pct,
        startPct: 10,
        endPct: 60,
        curveShape: 's-curve',
        volumeGain: 1.0,
        customWorkCenterShares: customWcShares,
      };
    });

    return {
      projectName: project.name,
      turbineTypeId: 'francis',
      quantity: 1,
      hoursPerTurbine: totalHours || 10000,
      totalHours: totalHours || 10000,
      startDate: project.startDate,
      endDate: project.endDate,
      staggeringMode: 'STAGGERED',
      staggerOffsetWeeks: 4,
      customSectorCurves: initialCurves,
      customWorkCenterHours: project.workCenterHours ? { ...project.workCenterHours } : undefined,
    };
  });

  // Keep dates and name in sync if project prop changes externally
  useEffect(() => {
    if (project.turbineConfig) {
      const cfg: TurbineProjectConfig = JSON.parse(JSON.stringify(project.turbineConfig));
      if (!cfg.customWorkCenterHours && project.workCenterHours) {
        cfg.customWorkCenterHours = { ...project.workCenterHours };
      }

      // Ensure customSectorCurves has customWorkCenterShares for each sector
      if (cfg.customSectorCurves) {
        const sourceHours = cfg.customWorkCenterHours || project.workCenterHours || {};
        Object.entries(cfg.customSectorCurves).forEach(([sec, secCfg]) => {
          if (!secCfg.customWorkCenterShares || Object.keys(secCfg.customWorkCenterShares).length === 0) {
            const wcsInGroup = workCenters.filter(
              (wc) => (wc.category || 'OUTROS').trim().toUpperCase() === sec.trim().toUpperCase()
            );
            const groupHours = wcsInGroup.reduce(
              (sum, wc) => sum + (sourceHours[wc.name] ?? sourceHours[wc.id] ?? 0),
              0
            );
            const customWcShares: Record<string, number> = {};
            if (groupHours > 0) {
              wcsInGroup.forEach((wc) => {
                const hrs = sourceHours[wc.name] ?? sourceHours[wc.id] ?? 0;
                customWcShares[wc.id] = hrs > 0 ? Math.round((hrs / groupHours) * 100) : 0;
              });
            } else {
              wcsInGroup.forEach((wc) => {
                customWcShares[wc.id] = 0;
              });
            }
            secCfg.customWorkCenterShares = customWcShares;
          }
        });
      }
      setConfig(cfg);
    } else {
      setConfig((prev) => ({
        ...prev,
        projectName: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        customWorkCenterHours: project.workCenterHours ? { ...project.workCenterHours } : undefined,
      }));
    }
  }, [project.id, project.startDate, project.endDate, project.name, project.turbineConfig, project.workCenterHours, workCenters]);

  // Find associated turbine type
  const turbineType: TurbineType = useMemo(() => {
    const found = DEFAULT_TURBINE_TYPES.find((t) => t.id === config.turbineTypeId);
    return found || DEFAULT_TURBINE_TYPES[0];
  }, [config.turbineTypeId]);

  // Live calculation
  const calculationResult: TurbineCalculationResult = useMemo(() => {
    return calculateTurbineProject(config, turbineType, workCenters);
  }, [config, turbineType, workCenters]);

  const handleSectorConfigChange = (secName: string, updated: SectorCurveConfig) => {
    setConfig((prev) => {
      const nextCustomCurves = {
        ...(prev.customSectorCurves || {}),
        [secName]: updated,
      };

      let nextWcHours = prev.customWorkCenterHours ? { ...prev.customWorkCenterHours } : undefined;
      if (nextWcHours && updated.customWorkCenterShares) {
        const wcsInGroup = workCenters.filter(
          (wc) => (wc.category || 'OUTROS').trim().toUpperCase() === secName.trim().toUpperCase()
        );
        const groupHours = wcsInGroup.reduce(
          (sum, wc) => sum + (prev.customWorkCenterHours?.[wc.name] ?? prev.customWorkCenterHours?.[wc.id] ?? 0),
          0
        );
        if (groupHours > 0) {
          wcsInGroup.forEach((wc) => {
            const share = updated.customWorkCenterShares?.[wc.id] ?? 0;
            const computedHrs = Math.round(groupHours * (share / 100));
            nextWcHours![wc.id] = computedHrs;
            if (nextWcHours![wc.name] !== undefined) {
              nextWcHours![wc.name] = computedHrs;
            }
          });
        }
      }

      return {
        ...prev,
        customSectorCurves: nextCustomCurves,
        customWorkCenterHours: nextWcHours,
      };
    });
  };

  const handleSectorHoursChange = (secName: string, newHours: number) => {
    const total = config.totalHours > 0 ? config.totalHours : 1;
    const currentCfg = (config.customSectorCurves || {})[secName];
    const gain = currentCfg?.volumeGain || 1.0;
    const newPct = Math.round((newHours * 100) / (total * gain));

    setConfig((prev) => ({
      ...prev,
      customSectorCurves: {
        ...(prev.customSectorCurves || {}),
        [secName]: {
          ...(prev.customSectorCurves?.[secName] || {
            sectorName: secName,
            startPct: 10,
            endPct: 60,
            curveShape: 's-curve',
            volumeGain: 1.0,
          }),
          percentage: Math.min(100, Math.max(0, newPct)),
        },
      },
    }));
  };

  const handleSaveInline = () => {
    const updatedProject: Project = {
      ...project,
      name: config.projectName.trim().toUpperCase(),
      startDate: calculationResult.startDate,
      endDate: calculationResult.endDate,
      workCenterHours: calculationResult.workCenterHours,
      groupDates: calculationResult.groupDates,
      workCenterDates: calculationResult.workCenterDates,
      turbineConfig: config,
    };
    onSave(updatedProject);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const sectorColors: Record<string, string> = {
    CORTE: '#f59e0b',
    CALDEIRARIA: '#06b6d4',
    SOLDA: '#ec4899',
    USINAGEM: '#6366f1',
    MONTAGENS: '#10b981',
    ACABAMENTOS: '#8b5cf6',
    OUTROS: '#64748b',
    ENGENHARIA: '#3b82f6',
    MODELOS: '#14b8a6',
    METALIZAÇÃO: '#a855f7',
    POLIMENTO: '#f43f5e',
  };

  const filteredSectorEntries = useMemo(() => {
    const curves = config.customSectorCurves || {};
    return Object.entries(curves).filter(([secName]) => {
      if (!searchTerm.trim()) return true;
      return secName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [config.customSectorCurves, searchTerm]);

  return (
    <div className="bg-slate-900 border-t border-slate-800 rounded-b-xl overflow-hidden flex flex-col">
      {/* Top Banner of Editor */}
      <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-black text-white uppercase tracking-wider">
            Editor de Parâmetros & Curva S (Visualização Personalizada)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Total: <strong className="text-emerald-400">{(calculationResult?.totalHours ?? 0).toLocaleString()}h</strong> ({calculationResult?.durationDays ?? 0} dias)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              Salvo com sucesso!
            </span>
          )}

          <button
            type="button"
            onClick={handleSaveInline}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
            title="Salva as alterações de prazos, horas e curva S no projeto"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Alterações</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal(project)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 cursor-pointer transition-colors"
            title="Abrir no editor em tela cheia"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Modal Completo</span>
          </button>
        </div>
      </div>

      {/* Dual Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
        {/* LEFT COLUMN: LIVE S-CURVE & WORKLOAD SUMMARY */}
        <div className="lg:col-span-5 bg-slate-950/60 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            {/* S-Curve Graph Card */}
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Curva S em Tempo Real</span>
                </span>

                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setChartTab('CURVE')}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      chartTab === 'CURVE'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Curva S
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartTab('HISTOGRAM')}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      chartTab === 'HISTOGRAM'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Carga
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartTab('SECTORS')}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      chartTab === 'SECTORS'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Resumo
                  </button>
                </div>
              </div>

              {chartTab === 'CURVE' && (
                <div className="h-48 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={calculationResult.weeklyPoints}
                      margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="weekLabel" stroke="#64748b" fontSize={8} tickLine={false} />
                      <YAxis
                        yAxisId="left"
                        stroke="#818cf8"
                        fontSize={8}
                        tickFormatter={(v) => `${v}h`}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#10b981"
                        fontSize={8}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '10px',
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="totalLoad"
                        name="Carga no Período"
                        fill="#6366f1"
                        radius={[2, 2, 0, 0]}
                        opacity={0.8}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cumulativePercentage"
                        name="Curva S Acumulada"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Curva S Acumulada
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-indigo-500"></span> Carga no Período
                    </span>
                  </div>
                </div>
              )}

              {chartTab === 'HISTOGRAM' && (
                <div className="h-48 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={calculationResult.weeklyPoints}
                      margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="weekLabel" stroke="#64748b" fontSize={8} tickLine={false} />
                      <YAxis stroke="#818cf8" fontSize={8} tickFormatter={(v) => `${v}h`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '10px',
                        }}
                      />
                      <Bar
                        dataKey="totalLoad"
                        name="Carga Semanal Total"
                        fill="#3b82f6"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartTab === 'SECTORS' && (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {calculationResult.sectorSummary
                    .filter((s) => s.percentage > 0)
                    .map((s) => {
                      const col = sectorColors[s.sectorName] || '#6366f1';
                      return (
                        <div
                          key={s.sectorName}
                          className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: col }}
                            />
                            <span className="font-bold text-white truncate">{s.sectorName}</span>
                            <span className="text-slate-400">({s.percentage}%)</span>
                          </div>
                          <div className="font-mono text-[9px] text-slate-300">
                            <span className="text-emerald-400 font-bold">{(s.hours ?? 0).toLocaleString()} h</span>
                            <span className="text-slate-500 ml-1">
                              ({s.startDate} a {s.endDate})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Período Global:</span>
                <strong className="text-white font-mono">{calculationResult.startDate} a {calculationResult.endDate}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Duração Total:</span>
                <strong className="text-white font-mono">{calculationResult.durationDays} dias ({Math.round(calculationResult.durationDays / 7)} sem)</strong>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Carga Média Semanal:</span>
                <strong className="text-emerald-400 font-mono">
                  ~{Math.round(calculationResult.totalHours / Math.max(1, calculationResult.durationDays / 7))} h/sem
                </strong>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-medium italic">
            * Altere os sliders de início, espalhamento ou abra os centros de trabalho à direita para recalcular.
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE SECTOR GROUP CARDS WITH WORK CENTER DISTRIBUTIONS */}
        <div className="lg:col-span-7 p-4 bg-slate-900 space-y-3 overflow-y-auto max-h-[600px]">
          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Parametrização dos Setores ({filteredSectorEntries.length} Grupos)</span>
            </h5>

            {filteredSectorEntries.length > 3 && (
              <div className="relative w-48">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-md pl-6 pr-2 py-1 text-[11px] text-slate-300 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-1">
            {filteredSectorEntries.map(([secName, rawCfg]) => {
              const curveCfg = rawCfg as SectorCurveConfig;
              const summary = calculationResult.sectorSummary.find(
                (s) => s.sectorName === secName
              );
              const secHours = summary ? summary.hours : 0;

              return (
                <div key={secName} className="relative">
                  <VolumeDialControl
                    sectorName={secName}
                    config={curveCfg}
                    color={sectorColors[secName] || '#6366f1'}
                    calculatedHours={secHours}
                    totalProjectHours={config.totalHours}
                    workCenters={workCenters}
                    onUpdateConfig={(updated) => handleSectorConfigChange(secName, updated)}
                    onUpdateHours={(newHrs) => handleSectorHoursChange(secName, newHrs)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({
  projects,
  workCenters,
  sectorGroups = DEFAULT_SECTOR_GROUPS,
  onUpdateProject,
  onDeleteProject,
  onOpenNewProjectModal,
  onOpenTurbineProjectModal,
  onOpenMatrixModal,
}) => {
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [modalEditProject, setModalEditProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedProjectId((prev) => (prev === id ? null : id));
  };

  const handleToggleEnabled = (project: Project) => {
    onUpdateProject({
      ...project,
      enabled: project.enabled === false ? true : false,
    });
  };

  const formatDateDisplay = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      return format(parseISO(isoStr), 'dd/MM/yyyy');
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span>Distribuição de Prazos & Cronograma dos Projetos</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie os cronogramas, parametrização por setor e curva S de cada projeto. Clique no projeto para expandir a edição interativa.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenMatrixModal && (
            <button
              onClick={onOpenMatrixModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Importar Planilha / CSV</span>
            </button>
          )}

          {onOpenTurbineProjectModal && (
            <button
              onClick={onOpenTurbineProjectModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Novo Projeto Personalizado</span>
            </button>
          )}
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-3">
        {projects.map((project) => {
          const isExpanded = expandedProjectId === project.id;
          const totalHours = getProjectTotalHours(project, workCenters);

          let durationDays = 0;
          let durationWeeks = 0;
          try {
            const s = parseISO(project.startDate);
            const e = parseISO(project.endDate);
            durationDays = Math.max(1, differenceInDays(e, s) + 1);
            durationWeeks = Number((durationDays / 7).toFixed(1));
          } catch {
            durationDays = 0;
          }

          const avgWeeklyHours =
            durationWeeks > 0 ? Math.round(totalHours / durationWeeks) : 0;

          return (
            <div
              key={project.id}
              className={`bg-white rounded-xl border transition-all duration-200 shadow-xs ${
                project.enabled === false
                  ? 'border-slate-200 opacity-60 bg-slate-50/70'
                  : isExpanded
                  ? 'border-indigo-500 ring-2 ring-indigo-500/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Project Card Header */}
              <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left: Enable toggle, color indicator, name */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(project)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0 cursor-pointer"
                    title={project.enabled === false ? 'Ativar no cálculo de carga' : 'Desativar no cálculo de carga'}
                  >
                    {project.enabled === false ? (
                      <Square className="w-5 h-5 text-slate-300" />
                    ) : (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    )}
                  </button>

                  <div
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: project.color || '#3b82f6' }}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-black truncate ${
                          project.enabled === false
                            ? 'text-slate-400 line-through'
                            : 'text-slate-900'
                        }`}
                        title={project.name}
                      >
                        {project.name}
                      </h3>
                      {project.enabled === false && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {Object.keys(project.workCenterHours || {}).length} centros de trabalho envolvidos
                    </p>
                  </div>
                </div>

                {/* Right: Dates, duration, total hours, action buttons */}
                <div className="flex flex-wrap items-center gap-3 lg:gap-4 shrink-0">
                  {/* Read-Only Dates Display */}
                  <div
                    onClick={() => setModalEditProject(project)}
                    className="flex items-center gap-2 bg-slate-50 hover:bg-indigo-50/60 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 text-xs transition-colors cursor-pointer group shadow-2xs"
                    title="Datas do Projeto. Clique em 'Editar' para alterar no modal completo"
                  >
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <div className="flex items-center gap-1.5 font-medium text-slate-700">
                      <span className="text-[11px] font-bold text-slate-500">Início:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {formatDateDisplay(project.startDate)}
                      </span>

                      <span className="text-slate-400 font-bold px-0.5">à</span>

                      <span className="text-[11px] font-bold text-slate-500">Término:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {formatDateDisplay(project.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {durationDays} dias ({durationWeeks} sem)
                    </span>
                  </div>

                  {/* Total Hours Badge */}
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 block">
                      {totalHours.toLocaleString()} h
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      ~{avgWeeklyHours.toLocaleString()} h/semana
                    </span>
                  </div>

                  {/* Modal Full Editor Button */}
                  <button
                    type="button"
                    onClick={() => setModalEditProject(project)}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Editar projeto completo no modal"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden md:inline">Editar</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToDelete(project);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Excluir projeto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Toggle Split-View Editor Accordion */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(project.id)}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isExpanded
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                    title={isExpanded ? 'Recolher editor de Curva S' : 'Expandir editor de Curva S'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Inline Split-View Editor inside expanded project */}
              {isExpanded && (
                <ProjectInlineEditor
                  key={project.id}
                  project={project}
                  workCenters={workCenters}
                  sectorGroups={sectorGroups}
                  onSave={onUpdateProject}
                  onOpenModal={(proj) => setModalEditProject(proj)}
                />
              )}
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
            <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">
              Nenhum projeto cadastrado no momento
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Utilize o menu lateral para cadastrar um novo projeto personalizado com Curva S ou importar via JSON.
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal (Native in-app UI without blocked window.confirm) */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden text-slate-800 p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Excluir Projeto</h3>
                <p className="text-xs text-slate-500">Esta ação removerá o projeto da programação.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza de que deseja remover o projeto{' '}
              <strong className="text-slate-900 font-black font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {projectToDelete.name}
              </strong>
              ? Todas as horas alocadas nos centros de trabalho e o cronograma deste projeto serão desativados.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProject(projectToDelete.id);
                  if (expandedProjectId === projectToDelete.id) {
                    setExpandedProjectId(null);
                  }
                  setProjectToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Projeto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Full-Screen Editing */}
      {modalEditProject && (
        <CustomTurbineProjectModal
          isOpen={!!modalEditProject}
          onClose={() => setModalEditProject(null)}
          workCenters={workCenters}
          sectorGroups={sectorGroups}
          projectToEdit={modalEditProject}
          onUpdateProject={(updated) => {
            onUpdateProject(updated);
            setModalEditProject(null);
          }}
          onAddProject={(p) => onUpdateProject(p)}
        />
      )}
    </div>
  );
};
