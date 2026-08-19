import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Layers,
  CheckCircle,
  FolderPlus,
  Sliders,
  Scale,
  Search,
  Activity,
  Calendar,
  Clock,
  Plus,
  Minus,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import {
  TurbineType,
  SectorCurveConfig,
  TurbineProjectConfig,
} from '../types/turbine';
import { WorkCenter, Project, DEFAULT_SECTOR_GROUPS } from '../types';
import { DEFAULT_TURBINE_TYPES } from '../data/defaultTurbines';
import {
  calculateTurbineProject,
  buildProjectFromTurbineConfig,
  safeParseDate,
  TurbineCalculationResult,
} from '../utils/turbineCalculator';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import { VolumeDialControl } from './VolumeDialControl';
import { TurbineTypeManagerModal } from './TurbineTypeManagerModal';
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
import { format, addMonths, addDays, isValid } from 'date-fns';

interface CustomTurbineProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  workCenters: WorkCenter[];
  sectorGroups?: string[];
  onAddProject: (project: Project) => void;
  projectToEdit?: Project | null;
  onUpdateProject?: (project: Project) => void;
}

const STORAGE_KEY_TURBINE_TYPES = 'carga_maquina_turbine_types_v1';

export const CustomTurbineProjectModal: React.FC<CustomTurbineProjectModalProps> = ({
  isOpen,
  onClose,
  workCenters,
  sectorGroups = DEFAULT_SECTOR_GROUPS,
  onAddProject,
  projectToEdit,
  onUpdateProject,
}) => {
  // Turbine Types State
  const [turbineTypes, setTurbineTypes] = useState<TurbineType[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TURBINE_TYPES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load turbine types from localStorage', e);
    }
    return DEFAULT_TURBINE_TYPES;
  });

  const handleSaveTurbineTypes = (updated: TurbineType[]) => {
    setTurbineTypes(updated);
    localStorage.setItem(STORAGE_KEY_TURBINE_TYPES, JSON.stringify(updated));
  };

  // Reload turbine types when modal opens to ensure changes from manager are synced
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_TURBINE_TYPES);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTurbineTypes(parsed);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  // Selected Turbine Model
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    turbineTypes.length > 0 ? turbineTypes[0].id : 'francis'
  );

  const selectedTurbine = useMemo(() => {
    return turbineTypes.find((t) => t.id === selectedTypeId) || turbineTypes[0];
  }, [turbineTypes, selectedTypeId]);

  // Project Form State
  const [projectName, setProjectName] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [hoursPerTurbine, setHoursPerTurbine] = useState<number>(10000);
  const [totalHoursInput, setTotalHoursInput] = useState<number>(10000);
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(
    format(addMonths(new Date(), 12), 'yyyy-MM-dd')
  );
  const [staggeringMode, setStaggeringMode] = useState<
    'SIMULTANEOUS' | 'STAGGERED' | 'SEQUENTIAL'
  >('STAGGERED');
  const [staggerOffsetWeeks, setStaggerOffsetWeeks] = useState<number>(4);

  // Custom Sector Curves per Project instance
  const [customSectorCurves, setCustomSectorCurves] = useState<
    Record<string, SectorCurveConfig>
  >({});

  // Active Sector Groups
  const allKnownSectorGroups = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_SECTOR_GROUPS.forEach((s) => set.add(s.trim().toUpperCase()));
    sectorGroups.forEach((s) => {
      if (s && s.trim()) set.add(s.trim().toUpperCase());
    });
    workCenters.forEach((wc) => {
      const cat = getWorkCenterCategory(wc);
      if (cat && cat.trim()) set.add(cat.trim().toUpperCase());
    });
    if (selectedTurbine?.sectorCurves) {
      Object.keys(selectedTurbine.sectorCurves).forEach((k) => {
        if (k && k.trim()) set.add(k.trim().toUpperCase());
      });
    }
    return Array.from(set);
  }, [sectorGroups, workCenters, selectedTurbine]);

  // Populate state when projectToEdit changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (projectToEdit) {
      setProjectName(projectToEdit.name);
      setStartDate(projectToEdit.startDate);
      setEndDate(projectToEdit.endDate);

      const cfg = projectToEdit.turbineConfig;
      if (cfg) {
        if (cfg.turbineTypeId) setSelectedTypeId(cfg.turbineTypeId);
        if (cfg.quantity) setQuantity(cfg.quantity);
        if (cfg.hoursPerTurbine) setHoursPerTurbine(cfg.hoursPerTurbine);
        if (cfg.totalHours) setTotalHoursInput(cfg.totalHours);
        if (cfg.customSectorCurves) {
          setCustomSectorCurves(JSON.parse(JSON.stringify(cfg.customSectorCurves)));
        }
      } else {
        // Calculate total hours from workCenterHours
        const sumHours = Object.values(projectToEdit.workCenterHours || {}).reduce<number>(
          (acc, h) => acc + (Number(h) || 0),
          0
        );
        const hrs = sumHours > 0 ? sumHours : 10000;
        setHoursPerTurbine(hrs);
        setTotalHoursInput(hrs);
        setQuantity(1);
      }
    } else {
      // New project mode
      if (selectedTurbine) {
        const baseHours = selectedTurbine.defaultHoursPerTurbine || 10000;
        setHoursPerTurbine(baseHours);
        setTotalHoursInput(baseHours * quantity);

        const days = selectedTurbine.defaultDurationDays || 365;
        const start = safeParseDate(startDate, new Date());
        const computedEnd = addDays(start, days);
        setEndDate(format(computedEnd, 'yyyy-MM-dd'));

        setProjectName(
          `PROJETO NOVO - ${quantity > 1 ? `${quantity}x ` : ''}${selectedTurbine.name.toUpperCase()}`
        );

        // Deep copy curves
        const curves: Record<string, SectorCurveConfig> = {};
        const baseCurves = selectedTurbine.sectorCurves || {};

        allKnownSectorGroups.forEach((secName) => {
          if (baseCurves[secName]) {
            curves[secName] = { ...baseCurves[secName] };
          } else {
            curves[secName] = {
              sectorName: secName,
              percentage: 0,
              startPct: 10,
              endPct: 60,
              curveShape: 's-curve',
              volumeGain: 1.0,
            };
          }
        });

        setCustomSectorCurves(curves);
      }
    }
  }, [isOpen, projectToEdit]);

  // Sync state when selected turbine type changes in creation mode
  const handleSelectTurbineType = (typeId: string) => {
    setSelectedTypeId(typeId);
    const targetTurbine = turbineTypes.find((t) => t.id === typeId);
    if (targetTurbine) {
      const baseHours = targetTurbine.defaultHoursPerTurbine || 10000;
      setHoursPerTurbine(baseHours);
      setTotalHoursInput(baseHours * quantity);

      const days = targetTurbine.defaultDurationDays || 365;
      const start = safeParseDate(startDate, new Date());
      const computedEnd = addDays(start, days);
      setEndDate(format(computedEnd, 'yyyy-MM-dd'));

      if (!projectToEdit) {
        setProjectName(
          `PROJETO NOVO - ${quantity > 1 ? `${quantity}x ` : ''}${targetTurbine.name.toUpperCase()}`
        );
      }

      const curves: Record<string, SectorCurveConfig> = {};
      const baseCurves = targetTurbine.sectorCurves || {};

      allKnownSectorGroups.forEach((secName) => {
        if (baseCurves[secName]) {
          curves[secName] = { ...baseCurves[secName] };
        } else {
          curves[secName] = {
            sectorName: secName,
            percentage: 0,
            startPct: 10,
            endPct: 60,
            curveShape: 's-curve',
            volumeGain: 1.0,
          };
        }
      });

      setCustomSectorCurves(curves);
    }
  };

  // Quantity Change Handler
  const handleQuantityChange = (newQty: number) => {
    const safeQty = isNaN(newQty) ? 0 : Math.max(0, Math.min(50, newQty));
    setQuantity(safeQty);
    if (safeQty > 0 && hoursPerTurbine > 0) {
      setTotalHoursInput(hoursPerTurbine * safeQty);
    }
    if (!projectToEdit && safeQty > 0) {
      setProjectName(
        `PROJETO NOVO - ${safeQty > 1 ? `${safeQty}x ` : ''}${selectedTurbine.name.toUpperCase()}`
      );
    }
  };

  // Hours per unit change
  const handleHoursPerTurbineChange = (val: number) => {
    const safeVal = isNaN(val) ? 0 : Math.max(0, val);
    setHoursPerTurbine(safeVal);
    if (safeVal > 0 && quantity > 0) {
      setTotalHoursInput(safeVal * quantity);
    }
  };

  // Total Hours direct change
  const handleTotalHoursChange = (val: number) => {
    const safeVal = isNaN(val) ? 0 : Math.max(0, val);
    setTotalHoursInput(safeVal);
    if (quantity > 0 && safeVal > 0) {
      setHoursPerTurbine(Math.round(safeVal / quantity));
    }
  };

  // Sector Curve modification handler
  const handleSectorConfigChange = (secName: string, updated: SectorCurveConfig) => {
    setCustomSectorCurves((prev) => ({
      ...prev,
      [secName]: updated,
    }));
  };

  // Direct edit of hours on a sector
  const handleSectorHoursChange = (secName: string, newHours: number) => {
    const total = totalHoursInput > 0 ? totalHoursInput : 1;
    const currentCfg = customSectorCurves[secName];
    const gain = currentCfg?.volumeGain || 1.0;
    const newPct = Math.round((newHours * 100) / (total * gain));

    setCustomSectorCurves((prev) => ({
      ...prev,
      [secName]: {
        ...(prev[secName] || {
          sectorName: secName,
          startPct: 10,
          endPct: 60,
          curveShape: 's-curve',
          volumeGain: 1.0,
        }),
        percentage: Math.min(100, Math.max(0, newPct)),
      },
    }));
  };

  // Reset sector curves to turbine template defaults
  const handleResetToTurbineDefaults = () => {
    if (!selectedTurbine) return;
    const curves: Record<string, SectorCurveConfig> = {};
    const baseCurves = selectedTurbine.sectorCurves || {};
    allKnownSectorGroups.forEach((secName) => {
      if (baseCurves[secName]) {
        curves[secName] = { ...baseCurves[secName] };
      } else {
        curves[secName] = {
          sectorName: secName,
          percentage: 0,
          startPct: 10,
          endPct: 60,
          curveShape: 's-curve',
          volumeGain: 1.0,
        };
      }
    });
    setCustomSectorCurves(curves);
  };

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [chartTab, setChartTab] = useState<'CURVE' | 'HISTOGRAM' | 'SECTORS'>('CURVE');
  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState<boolean>(false);

  // Calculation Result (Engine Output)
  const calculationConfig: TurbineProjectConfig = useMemo(() => {
    return {
      projectName: projectName || 'PROJETO PERSONALIZADO',
      turbineTypeId: selectedTypeId,
      quantity,
      hoursPerTurbine,
      totalHours: totalHoursInput,
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      staggeringMode: 'STAGGERED',
      staggerOffsetWeeks: 4,
      customSectorCurves,
    };
  }, [
    projectName,
    selectedTypeId,
    quantity,
    hoursPerTurbine,
    totalHoursInput,
    startDate,
    endDate,
    customSectorCurves,
  ]);

  const calculationResult: TurbineCalculationResult = useMemo(() => {
    return calculateTurbineProject(calculationConfig, selectedTurbine, workCenters);
  }, [calculationConfig, selectedTurbine, workCenters]);

  // Filtered sector entries for search
  const filteredSectorEntries = useMemo(() => {
    return Object.entries(customSectorCurves).filter(([secName]) => {
      if (!searchTerm.trim()) return true;
      return secName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [customSectorCurves, searchTerm]);

  // Sector colors palette
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

  if (!isOpen) return null;

  const handleSaveAndAddToPlanning = () => {
    if (!projectName.trim()) {
      alert('Por favor, informe o nome do projeto.');
      return;
    }
    if (!quantity || quantity <= 0) {
      alert('Por favor, informe uma quantidade válida (maior que zero).');
      return;
    }
    if (!hoursPerTurbine || hoursPerTurbine <= 0 || !totalHoursInput || totalHoursInput <= 0) {
      alert('Por favor, informe valores de horas válidos (maiores que zero) antes de salvar.');
      return;
    }

    if (projectToEdit && onUpdateProject) {
      onUpdateProject({
        ...projectToEdit,
        name: projectName.trim().toUpperCase(),
        startDate: calculationResult.startDate,
        endDate: calculationResult.endDate,
        workCenterHours: calculationResult.workCenterHours,
        groupDates: calculationResult.groupDates,
        workCenterDates: calculationResult.workCenterDates,
        turbineConfig: calculationConfig,
      });
      onClose();
    } else {
      const newProject = buildProjectFromTurbineConfig(calculationConfig, calculationResult);
      onAddProject(newProject);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-2 sm:p-3">
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-2xl w-full max-w-[1520px] h-[96vh] max-h-[96vh] overflow-hidden flex flex-col">
        {/* ========================================================================= */}
        {/* MODAL HEADER                                                              */}
        {/* ========================================================================= */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black shadow-md">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                {projectToEdit ? 'Editar Projeto Personalizado' : 'Novo Projeto Personalizado'}
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase">
                  Cálculo Automático de Curva S
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Defina os parâmetros do projeto à esquerda e acompanhe a Curva S em tempo real enquanto ajusta os setores à direita.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTypeManagerOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Gerenciar e cadastrar modelos base de Curva S"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Cadastro de Curva S</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY: DUAL COLUMN SPLIT VIEW                                        */}
        {/* ========================================================================= */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          {/* ========================================================================= */}
          {/* LEFT COLUMN (LG:COL-SPAN-5): GENERAL PROJECT PARAMETERS & FIXED S-CURVE  */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 bg-slate-950/70 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 flex flex-col justify-between overflow-y-auto space-y-3 shrink-0">
            {/* 1. Project Global Parameters Card */}
            <div className="space-y-3">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Parâmetros Gerais do Projeto</span>
                  </h4>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">
                    Duração: <strong className="text-white">{calculationResult.durationDays}d</strong> ({Math.round(calculationResult.durationDays / 7)} sem)
                  </span>
                </div>

                {/* Project Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nome do Projeto
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="Ex: PROJETO NOVO - TURBINA FRANCIS"
                  />
                </div>

                {/* Model & Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Modelo de Curva S
                    </label>
                    <select
                      value={selectedTypeId}
                      onChange={(e) => handleSelectTurbineType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {turbineTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({(t.defaultHoursPerTurbine ?? 0).toLocaleString()}h)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Quantidade
                    </label>
                    <div
                      className={`flex items-center bg-slate-950 border rounded-lg transition-colors ${
                        !quantity || quantity <= 0
                          ? 'border-rose-500 bg-rose-950/20'
                          : 'border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(Math.max(1, quantity - 1))}
                        className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={quantity === 0 ? '' : quantity}
                        onChange={(e) =>
                          handleQuantityChange(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)
                        }
                        placeholder="0"
                        className={`w-full text-center bg-transparent text-xs font-bold focus:outline-none ${
                          !quantity || quantity <= 0 ? 'text-rose-300' : 'text-white'
                        }`}
                      />
                      <span className="text-[10px] text-slate-500 pr-1 font-semibold">un</span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(quantity + 1)}
                        className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {(!quantity || quantity <= 0) && (
                      <span className="text-[9px] text-rose-400 font-bold block mt-0.5">
                        Mínimo 1 un
                      </span>
                    )}
                  </div>
                </div>

                {/* Reference Hours & Total Hours */}
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`bg-slate-950/80 p-2 rounded-lg border transition-colors ${
                      !hoursPerTurbine || hoursPerTurbine <= 0
                        ? 'border-rose-500 bg-rose-950/20'
                        : 'border-slate-800'
                    }`}
                  >
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                      Horas / Unidade
                    </label>
                    <div className="flex items-baseline justify-end gap-1">
                      <input
                        type="number"
                        min={1}
                        step={100}
                        value={hoursPerTurbine === 0 ? '' : hoursPerTurbine}
                        onChange={(e) =>
                          handleHoursPerTurbineChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
                        }
                        placeholder="0"
                        className={`w-full bg-transparent text-right font-black text-xs focus:outline-none ${
                          !hoursPerTurbine || hoursPerTurbine <= 0 ? 'text-rose-300' : 'text-white'
                        }`}
                      />
                      <span className="text-[10px] font-bold text-slate-400">h</span>
                    </div>
                    {(!hoursPerTurbine || hoursPerTurbine <= 0) && (
                      <span className="text-[9px] text-rose-400 font-bold block mt-0.5">
                        Mínimo 1h
                      </span>
                    )}
                  </div>

                  <div
                    className={`bg-slate-950/80 p-2 rounded-lg border transition-colors ${
                      !totalHoursInput || totalHoursInput <= 0
                        ? 'border-rose-500 bg-rose-950/20'
                        : 'border-slate-800'
                    }`}
                  >
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                      Carga Total
                    </label>
                    <div className="flex items-baseline justify-end gap-1">
                      <input
                        type="number"
                        min={1}
                        step={100}
                        value={totalHoursInput === 0 ? '' : totalHoursInput}
                        onChange={(e) =>
                          handleTotalHoursChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
                        }
                        placeholder="0"
                        className={`w-full bg-transparent text-right font-black text-xs focus:outline-none ${
                          !totalHoursInput || totalHoursInput <= 0 ? 'text-rose-300' : 'text-emerald-400'
                        }`}
                      />
                      <span className="text-[10px] font-bold text-emerald-400">h</span>
                    </div>
                    {(!totalHoursInput || totalHoursInput <= 0) && (
                      <span className="text-[9px] text-rose-400 font-bold block mt-0.5">
                        Mínimo 1h
                      </span>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Data Início
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Data Término
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Visualização da Curva S em Tempo Real */}
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Visualização da Curva S em Tempo Real</span>
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
                      Carga Semanal
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
                      Resumo Setores
                    </button>
                  </div>
                </div>

                {/* S-Curve Graph */}
                {chartTab === 'CURVE' && (
                  <div className="h-52 w-full pt-1">
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

                {/* Weekly Histogram Tab */}
                {chartTab === 'HISTOGRAM' && (
                  <div className="h-52 w-full pt-1">
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

                {/* Summary Table Tab */}
                {chartTab === 'SECTORS' && (
                  <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
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
            </div>

            <div className="text-[10px] text-slate-500 font-medium italic pt-1">
              * O cálculo da Curva S distribui as {(totalHoursInput ?? 0).toLocaleString()}h com base na duração e início de cada setor.
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN (LG:COL-SPAN-7): SCROLLABLE SECTOR PARAMETERS PANEL         */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 p-4 flex flex-col justify-between overflow-y-auto space-y-3 bg-slate-900 min-h-0">
            {/* Header Action Bar */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Parametrização por Setor ({filteredSectorEntries.length} Grupos)</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Ajuste o <strong>Início no Cronograma</strong> e <strong>Espalhamento/Duração</strong> para recalcular o gráfico à esquerda.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleResetToTurbineDefaults}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Restaura os valores padrões do modelo de turbina"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-400" />
                    <span>Restaurar Curva Padrão</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              {Object.keys(customSectorCurves).length > 3 && (
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar agrupador (Corte, Solda, Usinagem, Caldeiraria...)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Sector Cards Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-2">
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
                      totalProjectHours={totalHoursInput}
                      workCenters={workCenters}
                      onUpdateConfig={(updated) => handleSectorConfigChange(secName, updated)}
                      onUpdateHours={(newHrs) => handleSectorHoursChange(secName, newHrs)}
                    />
                  </div>
                );
              })}
            </div>

            {filteredSectorEntries.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                Nenhum setor encontrado com o termo "{searchTerm}".
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER                                                              */}
        {/* ========================================================================= */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">
              Projeto: <strong className="text-white">{projectName}</strong> | Carga Total:{' '}
              <strong className="text-emerald-400">
                {(calculationResult?.totalHours ?? 0).toLocaleString()}h
              </strong>{' '}
              ({calculationResult?.durationDays ?? 0} dias)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveAndAddToPlanning}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {projectToEdit ? (
                <>
                  <Edit3 className="w-4 h-4" />
                  <span>Salvar Alterações do Projeto</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  <span>Gerar & Integrar Projeto ao PCP</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Embedded S-Curve / Turbine Type Manager Modal */}
      {isTypeManagerOpen && (
        <TurbineTypeManagerModal
          isOpen={isTypeManagerOpen}
          onClose={() => setIsTypeManagerOpen(false)}
          turbineTypes={turbineTypes}
          onSaveTurbineTypes={handleSaveTurbineTypes}
          sectorGroups={sectorGroups}
          workCenters={workCenters}
        />
      )}
    </div>
  );
};
