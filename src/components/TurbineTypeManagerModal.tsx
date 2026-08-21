import React, { useState, useMemo } from 'react';
import {
  TurbineType,
  SectorCurveConfig,
  CurveShape,
} from '../types/turbine';
import { DEFAULT_TURBINE_TYPES } from '../data/defaultTurbines';
import { WorkCenter, DEFAULT_SECTOR_GROUPS } from '../types';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import { evaluateCurveDensity } from '../utils/turbineCalculator';
import { VolumeDialControl } from './VolumeDialControl';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  X,
  Sliders,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Save,
  Layers,
  CheckCircle,
  Scale,
  Search,
  Activity,
  Calendar,
  Clock,
  Flame,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Info,
  Check,
} from 'lucide-react';

interface TurbineTypeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  turbineTypes: TurbineType[];
  onSaveTurbineTypes: (types: TurbineType[]) => void;
  sectorGroups?: string[];
  workCenters?: WorkCenter[];
}

export const TurbineTypeManagerModal: React.FC<TurbineTypeManagerModalProps> = ({
  isOpen,
  onClose,
  turbineTypes,
  onSaveTurbineTypes,
  sectorGroups = DEFAULT_SECTOR_GROUPS,
  workCenters = [],
}) => {
  const [typesList, setTypesList] = useState<TurbineType[]>(() => {
    return turbineTypes.length > 0 ? turbineTypes : DEFAULT_TURBINE_TYPES;
  });

  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    typesList.length > 0 ? typesList[0].id : 'francis'
  );

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newSectorNameInput, setNewSectorNameInput] = useState<string>('');
  const [isAddingNewSector, setIsAddingNewSector] = useState<boolean>(false);
  const [previewSectorFilter, setPreviewSectorFilter] = useState<string>('ALL');
  const [previewTab, setPreviewTab] = useState<'chart' | 'timeline'>('chart');

  // Confirmation Alert Dialog when weights differ from 100%
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    calculatedTotal: number;
    baseTotal: number;
    weightSum: number;
  } | null>(null);

  const sectorColors: Record<string, string> = {
    CORTE: '#f59e0b',
    CALDEIRARIA: '#06b6d4',
    SOLDA: '#ec4899',
    USINAGEM: '#6366f1',
    MONTAGENS: '#10b981',
    ACABAMENTOS: '#8b5cf6',
    OUTROS: '#64748b',
  };

  // Compute available sector groups STRICTLY from registered work centers
  const allKnownSectorGroups = useMemo(() => {
    const set = new Set<string>();

    // Scan all registered work centers
    workCenters.forEach((wc) => {
      const cat = getWorkCenterCategory(wc);
      if (cat && cat.trim()) {
        set.add(cat.trim().toUpperCase());
      }
    });

    // Fallback only if no work centers exist in the database yet
    if (set.size === 0) {
      if (sectorGroups && sectorGroups.length > 0) {
        sectorGroups.forEach((s) => {
          if (s && s.trim()) set.add(s.trim().toUpperCase());
        });
      } else {
        DEFAULT_SECTOR_GROUPS.forEach((s) => set.add(s.trim().toUpperCase()));
      }
    }

    return Array.from(set);
  }, [workCenters, sectorGroups]);

  const currentType = typesList.find((t) => t.id === selectedTypeId) || typesList[0];

  // Helper to ensure currentType has ONLY the known sector groups present in work centers
  const enrichedSectorCurves: Record<string, SectorCurveConfig> = useMemo(() => {
    if (!currentType) return {};
    const existingCurves = currentType.sectorCurves || {};
    const curves: Record<string, SectorCurveConfig> = {};

    allKnownSectorGroups.forEach((secName) => {
      if (existingCurves[secName]) {
        curves[secName] = existingCurves[secName];
      } else {
        curves[secName] = {
          sectorName: secName,
          percentage: 0,
          startPct: 10,
          endPct: 90,
          curveShape: 's-curve',
          volumeGain: 1.0,
        };
      }
    });

    return curves;
  }, [currentType, allKnownSectorGroups]);

  // Baseline hours (Meta Padrão Fixa definida pelo usuário, ex: 10.000h)
  const baseTargetHours = currentType?.defaultHoursPerTurbine || 10000;

  // Calculate actual hours for each sector based STRICTLY on the baseTargetHours reference
  // Sector Hours = baseTargetHours * (percentage / 100) * volumeGain
  const sectorCalculatedHoursMap = useMemo(() => {
    const map: Record<string, number> = {};

    Object.entries(enrichedSectorCurves).forEach(([secName, rawCfg]) => {
      const cfg = rawCfg as SectorCurveConfig;
      const hrs = Math.round(
        (baseTargetHours * (cfg.percentage || 0) * (cfg.volumeGain || 1.0)) / 100
      );
      map[secName] = hrs;
    });
    return map;
  }, [baseTargetHours, enrichedSectorCurves]);

  // Total sum of hours calculated from all centers
  const totalCalculatedSectorHours = useMemo(() => {
    return Object.values(sectorCalculatedHoursMap).reduce((acc: number, h: number) => acc + h, 0);
  }, [sectorCalculatedHoursMap]);

  // Calculate total base percentage sum
  const totalBaseWeightSum = useMemo(() => {
    const sum = Object.values(enrichedSectorCurves).reduce(
      (acc, curr) => acc + (curr.percentage || 0),
      0
    );
    return Number(sum.toFixed(1));
  }, [enrichedSectorCurves]);

  // Difference vs Base Target
  const hoursDifference = totalCalculatedSectorHours - baseTargetHours;
  const hoursDifferencePct = Number(
    (((totalCalculatedSectorHours - baseTargetHours) / (baseTargetHours || 1)) * 100).toFixed(1)
  );

  // Filtered sectors list
  const filteredSectorEntries = useMemo(() => {
    return Object.entries(enrichedSectorCurves).filter(([secName]) => {
      if (!searchTerm.trim()) return true;
      return secName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [enrichedSectorCurves, searchTerm]);

  // --- Real-time S-Curve Points Generation for Live Preview ---
  const livePreviewData = useMemo(() => {
    if (!currentType) return [];
    const totalHours = totalCalculatedSectorHours > 0 ? totalCalculatedSectorHours : baseTargetHours;
    const totalSteps = 24; // 24 timeline intervals (0% to 100%)

    // Sum for normalization across sectors
    let rawSum = 0;
    Object.values(enrichedSectorCurves).forEach((cfg) => {
      rawSum += (cfg.percentage || 0) * (cfg.volumeGain || 1.0);
    });
    if (rawSum === 0) rawSum = 100;

    const points: {
      percent: number;
      stepLabel: string;
      totalLoad: number;
      cumulativeHours: number;
      cumulativePercentage: number;
      [key: string]: any;
    }[] = [];

    let runningCumulativeHours = 0;

    for (let i = 0; i <= totalSteps; i++) {
      const t = i / totalSteps; // 0.0 to 1.0
      const pct = Math.round(t * 100);

      const sectorLoads: Record<string, number> = {};
      let stepTotalLoad = 0;

      Object.entries(enrichedSectorCurves).forEach(([secName, curveCfg]) => {
        if (previewSectorFilter !== 'ALL' && previewSectorFilter !== secName) {
          return;
        }

        const secTotalHours = sectorCalculatedHoursMap[secName] || 0;
        const secStartT = curveCfg.startPct / 100;
        const secEndT = curveCfg.endPct / 100;

        if (t >= secStartT && t <= secEndT && secTotalHours > 0) {
          const secDurationT = Math.max(0.04, secEndT - secStartT);
          const relativeT = (t - secStartT) / secDurationT;
          const density = evaluateCurveDensity(relativeT, curveCfg.curveShape);
          const loadInStep = (secTotalHours / (secDurationT * totalSteps)) * density;

          sectorLoads[secName] = Math.round(loadInStep);
          stepTotalLoad += loadInStep;
        } else {
          sectorLoads[secName] = 0;
        }
      });

      runningCumulativeHours += stepTotalLoad;

      const ptObj: any = {
        percent: pct,
        stepLabel: `${pct}%`,
        totalLoad: Math.round(stepTotalLoad),
        cumulativeHours: Math.round(runningCumulativeHours),
        cumulativePercentage: 0,
        ...sectorLoads,
      };

      points.push(ptObj);
    }

    // Normalize cumulative curve to 100%
    const totalGenerated = runningCumulativeHours > 0 ? runningCumulativeHours : 1;
    let normRunning = 0;
    points.forEach((pt, idx) => {
      normRunning += pt.totalLoad;
      pt.cumulativePercentage = Math.min(
        100,
        Number(((normRunning / totalGenerated) * 100).toFixed(1))
      );
      if (idx === points.length - 1) {
        pt.cumulativePercentage = 100;
      }
    });

    return points;
  }, [currentType, totalCalculatedSectorHours, baseTargetHours, enrichedSectorCurves, previewSectorFilter, sectorCalculatedHoursMap]);

  if (!isOpen) return null;

  const handleUpdateCurrentType = (updated: TurbineType) => {
    setTypesList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  // Direct change of base target hours (Meta Padrão Fixa da Máquina)
  const handleBaseTargetHoursChange = (newBase: number) => {
    if (!currentType) return;
    const safeBase = isNaN(newBase) ? 0 : newBase;
    handleUpdateCurrentType({
      ...currentType,
      defaultHoursPerTurbine: safeBase,
    });
  };

  // Direct hours change in a sector: adjusts the sector percentage against baseTargetHours
  const handleSectorHoursChange = (sectorName: string, targetHours: number) => {
    if (!currentType) return;
    const safeTarget = Math.max(0, targetHours);
    const cfg = enrichedSectorCurves[sectorName];
    const gain = cfg?.volumeGain || 1.0;
    const effectiveBase = baseTargetHours > 0 ? baseTargetHours : 1;
    const newPct = Math.round((safeTarget * 100) / (effectiveBase * (gain > 0 ? gain : 1.0)));

    const updatedCurves = {
      ...enrichedSectorCurves,
      ...currentType.sectorCurves,
      [sectorName]: {
        ...cfg,
        percentage: Math.min(200, Math.max(0, newPct)),
      },
    };

    handleUpdateCurrentType({
      ...currentType,
      sectorCurves: updatedCurves,
    });
  };

  // Sector curve parameter change handler (Keeps base target hours intact!)
  const handleSectorCurveChange = (sectorName: string, config: SectorCurveConfig) => {
    if (!currentType) return;

    const mergedCurves: Record<string, SectorCurveConfig> = {
      ...enrichedSectorCurves,
      ...currentType.sectorCurves,
      [sectorName]: config,
    };

    handleUpdateCurrentType({
      ...currentType,
      sectorCurves: mergedCurves,
    });
  };

  const handleAddNewSectorGroup = () => {
    if (!newSectorNameInput.trim()) return;
    const secName = newSectorNameInput.trim().toUpperCase();

    const updatedCurves = {
      ...enrichedSectorCurves,
      [secName]: {
        sectorName: secName,
        percentage: 5,
        startPct: 10,
        endPct: 80,
        curveShape: 's-curve' as const,
        volumeGain: 1.0,
      },
    };

    handleUpdateCurrentType({
      ...currentType,
      sectorCurves: updatedCurves,
    });

    setNewSectorNameInput('');
    setIsAddingNewSector(false);
  };

  const handleDistributeEqually = () => {
    if (!currentType) return;
    const entries = Object.entries(enrichedSectorCurves);
    const count = entries.length;
    if (count === 0) return;

    const equalPct = Number((100 / count).toFixed(1));
    const normalizedCurves: Record<string, SectorCurveConfig> = {};
    let runningSum = 0;

    entries.forEach(([secName, c], idx) => {
      if (idx === entries.length - 1) {
        normalizedCurves[secName] = {
          ...c,
          percentage: Number(Math.max(0, 100 - runningSum).toFixed(1)),
        };
      } else {
        runningSum += equalPct;
        normalizedCurves[secName] = {
          ...c,
          percentage: equalPct,
        };
      }
    });

    handleUpdateCurrentType({
      ...currentType,
      sectorCurves: normalizedCurves,
    });
  };

  const handleNormalizeWeightsTo100 = () => {
    if (!currentType) return;
    const entries = Object.entries(enrichedSectorCurves);
    const effectiveWeights = entries.map(([secName, c]) => ({
      secName,
      config: c,
      effectiveWeight: (c.percentage || 0) * (c.volumeGain || 1.0),
    }));
    const sum = effectiveWeights.reduce((acc, curr) => acc + curr.effectiveWeight, 0);

    if (sum === 0) {
      handleDistributeEqually();
      return;
    }

    const normalizedCurves: Record<string, SectorCurveConfig> = {};
    let runningSum = 0;
    const nonZeroEntries = effectiveWeights.filter((item) => item.effectiveWeight > 0);

    effectiveWeights.forEach(({ secName, config, effectiveWeight }) => {
      if (effectiveWeight > 0) {
        const scaled = Number(((effectiveWeight / sum) * 100).toFixed(1));
        runningSum += scaled;
        normalizedCurves[secName] = {
          ...config,
          percentage: scaled,
          volumeGain: 1.0,
        };
      } else {
        normalizedCurves[secName] = {
          ...config,
          percentage: 0,
          volumeGain: 1.0,
        };
      }
    });

    if (nonZeroEntries.length > 0) {
      const diff = Number((100 - runningSum).toFixed(1));
      if (Math.abs(diff) > 0.001) {
        const largest = nonZeroEntries.reduce((max, cur) =>
          cur.effectiveWeight > max.effectiveWeight ? cur : max
        );
        if (normalizedCurves[largest.secName]) {
          normalizedCurves[largest.secName].percentage = Number(
            (normalizedCurves[largest.secName].percentage + diff).toFixed(1)
          );
        }
      }
    }

    handleUpdateCurrentType({
      ...currentType,
      sectorCurves: normalizedCurves,
    });
  };

  const handleCreateNewType = () => {
    const newId = `custom-curva-s-${Date.now()}`;
    const base = currentType || DEFAULT_TURBINE_TYPES[0];
    const newType: TurbineType = {
      ...JSON.parse(JSON.stringify(base)),
      id: newId,
      name: 'Novo Modelo de Curva S Custom',
      category: 'CUSTOM',
      description: 'Modelo customizado com perfil de curva S e dispersão temporal parametrizável.',
      isCustom: true,
      sectorCurves: { ...enrichedSectorCurves },
    };
    setTypesList((prev) => [...prev, newType]);
    setSelectedTypeId(newId);
  };

  const handleDuplicateType = (type: TurbineType) => {
    const newId = `dup-curva-s-${Date.now()}`;
    const dup: TurbineType = {
      ...JSON.parse(JSON.stringify(type)),
      id: newId,
      name: `${type.name} (Cópia)`,
      isCustom: true,
      sectorCurves: { ...type.sectorCurves },
    };
    setTypesList((prev) => [...prev, dup]);
    setSelectedTypeId(newId);
  };

  const handleDeleteType = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (typesList.length <= 1) {
      const blankId = `curva-s-${Date.now()}`;
      const blankType: TurbineType = {
        id: blankId,
        name: 'NOVO MODELO DE CURVA S',
        category: 'CUSTOM',
        description: 'Modelo em branco personalizado.',
        defaultHoursPerTurbine: 10000,
        defaultDurationDays: 180,
        isCustom: true,
        sectorCurves: {},
      };
      setTypesList([blankType]);
      setSelectedTypeId(blankId);
      return;
    }

    const remaining = typesList.filter((t) => t.id !== id);
    setTypesList(remaining);
    if (selectedTypeId === id) {
      setSelectedTypeId(remaining[0].id);
    }
  };

  const handleResetToDefaults = () => {
    setTypesList(DEFAULT_TURBINE_TYPES);
    setSelectedTypeId(DEFAULT_TURBINE_TYPES[0].id);
  };

  // Primary Save Action with Validation Alert Dialog
  const handleInitiateSave = () => {
    // Check if any model in the list has missing/invalid essential fields
    for (const t of typesList) {
      if (!t.name.trim()) {
        return;
      }
      if (!t.defaultDurationDays || t.defaultDurationDays <= 0) {
        return;
      }
      if (!t.defaultHoursPerTurbine || t.defaultHoursPerTurbine <= 0) {
        return;
      }
    }

    // Check if total weights differ from 100% or total calculated hours differ from baseTargetHours
    const effectiveWeightSum = Object.values(enrichedSectorCurves).reduce(
      (acc, c) => acc + (c.percentage || 0) * (c.volumeGain || 1.0),
      0
    );
    const roundedEffectiveWeightSum = Number(effectiveWeightSum.toFixed(1));

    if (
      Math.abs(totalBaseWeightSum - 100) > 0.1 ||
      Math.abs(roundedEffectiveWeightSum - 100) > 0.1 ||
      totalCalculatedSectorHours !== baseTargetHours
    ) {
      setConfirmationDialog({
        isOpen: true,
        calculatedTotal: totalCalculatedSectorHours,
        baseTotal: baseTargetHours,
        weightSum: roundedEffectiveWeightSum !== 100 ? roundedEffectiveWeightSum : totalBaseWeightSum,
      });
      return;
    }

    // Exact 100%, save directly
    onSaveTurbineTypes(typesList);
    onClose();
  };

  // Save with updated base hours AND recalculate all sector base weights & load volumes to strictly 100%
  const handleConfirmSaveWithUpdatedBase = () => {
    if (!currentType || !confirmationDialog) return;
    const newBase = confirmationDialog.calculatedTotal > 0 ? confirmationDialog.calculatedTotal : baseTargetHours;

    const newCurves: Record<string, SectorCurveConfig> = {};
    const entries = Object.entries(enrichedSectorCurves);
    let runningPctSum = 0;

    const activeEntries = entries.filter(([name]) => (sectorCalculatedHoursMap[name] || 0) > 0);

    entries.forEach(([secName, cfg]) => {
      const secHours = sectorCalculatedHoursMap[secName] || 0;
      if (newBase > 0 && secHours > 0) {
        const rawPct = (secHours / newBase) * 100;
        const roundedPct = Number(rawPct.toFixed(1));
        runningPctSum += roundedPct;
        newCurves[secName] = {
          ...cfg,
          percentage: roundedPct,
          volumeGain: 1.0, // Volume de carga normalizado em 1.0 (100%)
        };
      } else {
        newCurves[secName] = {
          ...cfg,
          percentage: 0,
          volumeGain: 1.0,
        };
      }
    });

    // Guarantee exact 100.0% sum
    if (activeEntries.length > 0) {
      const diff = Number((100 - runningPctSum).toFixed(1));
      if (Math.abs(diff) > 0.001) {
        const largestSecName = activeEntries.reduce((maxName, [curName]) => {
          const maxHrs = sectorCalculatedHoursMap[maxName] || 0;
          const curHrs = sectorCalculatedHoursMap[curName] || 0;
          return curHrs > maxHrs ? curName : maxName;
        }, activeEntries[0][0]);

        if (newCurves[largestSecName]) {
          newCurves[largestSecName].percentage = Number(
            (newCurves[largestSecName].percentage + diff).toFixed(1)
          );
        }
      }
    }

    const updatedList = typesList.map((t) =>
      t.id === currentType.id
        ? {
            ...t,
            defaultHoursPerTurbine: newBase,
            sectorCurves: newCurves,
          }
        : t
    );

    setTypesList(updatedList);
    onSaveTurbineTypes(updatedList);
    setConfirmationDialog(null);
    onClose();
  };

  // Save keeping original base hours AND normalize sector base weights to strictly 100%
  const handleConfirmSaveKeepOriginalBase = () => {
    if (!currentType || !confirmationDialog) return;
    const keepBase = confirmationDialog.baseTotal > 0 ? confirmationDialog.baseTotal : 10000;

    const newCurves: Record<string, SectorCurveConfig> = {};
    const entries = Object.entries(enrichedSectorCurves);
    let runningPctSum = 0;
    const totalCalcHours = totalCalculatedSectorHours > 0 ? totalCalculatedSectorHours : keepBase;
    const activeEntries = entries.filter(([name]) => (sectorCalculatedHoursMap[name] || 0) > 0);

    entries.forEach(([secName, cfg]) => {
      const secHours = sectorCalculatedHoursMap[secName] || 0;
      if (totalCalcHours > 0 && secHours > 0) {
        const rawPct = (secHours / totalCalcHours) * 100;
        const roundedPct = Number(rawPct.toFixed(1));
        runningPctSum += roundedPct;
        newCurves[secName] = {
          ...cfg,
          percentage: roundedPct,
          volumeGain: 1.0, // Volume de carga normalizado em 1.0 (100%)
        };
      } else {
        newCurves[secName] = {
          ...cfg,
          percentage: 0,
          volumeGain: 1.0,
        };
      }
    });

    // Guarantee exact 100.0% sum
    if (activeEntries.length > 0) {
      const diff = Number((100 - runningPctSum).toFixed(1));
      if (Math.abs(diff) > 0.001) {
        const largestSecName = activeEntries.reduce((maxName, [curName]) => {
          const maxHrs = sectorCalculatedHoursMap[maxName] || 0;
          const curHrs = sectorCalculatedHoursMap[curName] || 0;
          return curHrs > maxHrs ? curName : maxName;
        }, activeEntries[0][0]);

        if (newCurves[largestSecName]) {
          newCurves[largestSecName].percentage = Number(
            (newCurves[largestSecName].percentage + diff).toFixed(1)
          );
        }
      }
    }

    const updatedList = typesList.map((t) =>
      t.id === currentType.id
        ? {
            ...t,
            defaultHoursPerTurbine: keepBase,
            sectorCurves: newCurves,
          }
        : t
    );

    setTypesList(updatedList);
    onSaveTurbineTypes(updatedList);
    setConfirmationDialog(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-3">
      <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[1520px] overflow-hidden flex flex-col h-[96vh] max-h-[96vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                Cadastro de Curva S
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold uppercase">
                  Modelagem Paramétrica de Cronograma & Pesos
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Parametrize a posição inicial no cronograma, a dispersão/duração de cada setor e visualize a Curva S acumulada e o histograma de esforço em tempo real.
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

        {/* Modal Body: Sidebar (Blue/Navy) + Main Content (Light Theme) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Sidebar: Turbine / S-Curve Models List (Preserved in rich blue/navy theme) */}
          <div className="w-full md:w-56 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-3 flex flex-col justify-between overflow-y-auto shrink-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Modelos ({typesList.length})
                </span>
                <button
                  onClick={handleCreateNewType}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Novo</span>
                </button>
              </div>

              <div className="space-y-1">
                {typesList.map((type) => {
                  const isSelected = type.id === selectedTypeId;
                  return (
                    <div
                      key={type.id}
                      onClick={() => setSelectedTypeId(type.id)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                          : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="min-w-0 pr-1.5">
                        <span className="text-xs font-black block truncate">{type.name}</span>
                        <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {(type.defaultHoursPerTurbine ?? 0).toLocaleString()}h | {type.defaultDurationDays ?? 0}d
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateType(type);
                          }}
                          title="Duplicar Modelo"
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/80 cursor-pointer transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteType(type.id, e)}
                          title="Excluir Modelo"
                          className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-slate-700/80 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800/80">
              <button
                onClick={handleResetToDefaults}
                className="w-full py-1.5 px-2 text-[10px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar Padrões</span>
              </button>
            </div>
          </div>

          {/* Main Area: Split Screen (Left = Fixed Graph/Metadata, Right = Scrollable Sectors) */}
          {currentType && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0 bg-slate-50">
              {/* ========================================================================= */}
              {/* LEFT COLUMN (LG:COL-SPAN-5): FIXED LIVE PREVIEW & MODEL METADATA         */}
              {/* ========================================================================= */}
              <div className="lg:col-span-5 bg-slate-100/70 border-b lg:border-b-0 lg:border-r border-slate-200 p-3.5 flex flex-col justify-between overflow-y-auto space-y-3 shrink-0">
                {/* 1. Model Metadata & Comparison Metrics */}
                <div className="space-y-2.5">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Nome do Modelo de Curva S
                      </label>
                      <input
                        type="text"
                        value={currentType.name}
                        onChange={(e) =>
                          handleUpdateCurrentType({ ...currentType, name: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Reference Hours & Total Calculated Comparison Fields */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Meta Padrão Fixa (Valor Base da Máquina) */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            Meta Base (h):
                          </label>
                          <span className="text-[9px] text-indigo-700 font-bold bg-indigo-100 px-1 rounded border border-indigo-200">
                            Referência
                          </span>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min={1}
                            step={100}
                            value={currentType.defaultHoursPerTurbine === 0 ? '' : currentType.defaultHoursPerTurbine}
                            onChange={(e) =>
                              handleBaseTargetHoursChange(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)
                            }
                            placeholder="0"
                            className={`w-full bg-white border rounded px-2 py-0.5 text-xs font-black text-right focus:outline-none transition-colors ${
                              !currentType.defaultHoursPerTurbine || currentType.defaultHoursPerTurbine <= 0
                                ? 'border-rose-500 text-rose-700 focus:border-rose-500 bg-rose-50'
                                : 'border-slate-300 focus:border-indigo-500 text-slate-900'
                            }`}
                            title="Valor padrão / Meta da máquina para referência dos cálculos"
                          />
                          <span className="text-xs font-bold text-slate-500 ml-1">h</span>
                        </div>
                        {(!currentType.defaultHoursPerTurbine || currentType.defaultHoursPerTurbine <= 0) && (
                          <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                            Mínimo 1h
                          </span>
                        )}
                      </div>

                      {/* Total Calculado dos Setores */}
                      <div
                        className={`p-2.5 rounded-lg border ${
                          Math.abs(hoursDifference) < 5
                            ? 'bg-emerald-50/60 border-emerald-300'
                            : hoursDifference > 0
                            ? 'bg-amber-50/60 border-amber-300'
                            : 'bg-blue-50/60 border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            Total Calculado:
                          </label>
                          <span
                            className={`text-[9px] font-black px-1 rounded ${
                              Math.abs(hoursDifference) < 5
                                ? 'text-emerald-800 bg-emerald-100'
                                : hoursDifference > 0
                                ? 'text-amber-800 bg-amber-100'
                                : 'text-blue-800 bg-blue-100'
                            }`}
                          >
                            {hoursDifference === 0
                              ? '100% Meta'
                              : hoursDifference > 0
                              ? `+${hoursDifferencePct}%`
                              : `${hoursDifferencePct}%`}
                          </span>
                        </div>
                        <div className="flex items-center justify-end font-mono">
                          <span
                            className={`text-xs font-black ${
                              Math.abs(hoursDifference) < 5
                                ? 'text-emerald-700'
                                : hoursDifference > 0
                                ? 'text-amber-700'
                                : 'text-blue-700'
                            }`}
                          >
                            {(totalCalculatedSectorHours ?? 0).toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-slate-500 ml-1">h</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Duração Típica (Dias)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={currentType.defaultDurationDays === 0 ? '' : currentType.defaultDurationDays}
                          onChange={(e) =>
                            handleUpdateCurrentType({
                              ...currentType,
                              defaultDurationDays: e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0,
                            })
                          }
                          placeholder="Ex: 200"
                          className={`w-full bg-slate-50 border rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none text-right transition-colors ${
                            !currentType.defaultDurationDays || currentType.defaultDurationDays <= 0
                              ? 'border-rose-500 text-rose-700 focus:border-rose-500 bg-rose-50'
                              : 'border-slate-300 text-slate-900 focus:border-indigo-500 focus:bg-white'
                          }`}
                        />
                        {(!currentType.defaultDurationDays || currentType.defaultDurationDays <= 0) && (
                          <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                            Mínimo 1 dia
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Soma dos Pesos Base
                        </label>
                        <div
                          className={`w-full border rounded-lg px-2.5 py-1 text-xs font-black flex items-center justify-between ${
                            totalBaseWeightSum === 100
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-amber-50 border-amber-300 text-amber-800'
                          }`}
                        >
                          <span>{totalBaseWeightSum}%</span>
                          <span className="text-[9px] font-normal text-slate-500">
                            {totalBaseWeightSum === 100 ? 'Equilibrado' : totalBaseWeightSum > 100 ? 'Excede Meta' : 'Abaixo da Meta'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Live S-Curve & Timeline Container */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                          Pré-Visualizador em Tempo Real
                        </span>
                      </div>

                      {/* Tab toggles */}
                      <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setPreviewTab('chart')}
                          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                            previewTab === 'chart'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Curva S
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewTab('timeline')}
                          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                            previewTab === 'timeline'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Régua Gantt
                        </button>
                      </div>
                    </div>

                    {/* Filter Sector Dropdown */}
                    <div className="flex items-center justify-between text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                      <span className="text-slate-600 font-bold">Visualização:</span>
                      <select
                        value={previewSectorFilter}
                        onChange={(e) => setPreviewSectorFilter(e.target.value)}
                        className="bg-transparent text-xs font-bold text-indigo-700 focus:outline-none cursor-pointer text-right"
                      >
                        <option value="ALL" className="bg-white text-slate-900">
                          Todos os Setores (Curva Global)
                        </option>
                        {Object.keys(enrichedSectorCurves).map((sec) => (
                          <option key={sec} value={sec} className="bg-white text-slate-900">
                            Setor: {sec}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Chart Tab */}
                    {previewTab === 'chart' && (
                      <div className="space-y-1.5">
                        <div className="h-44 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={livePreviewData}
                              margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis
                                dataKey="stepLabel"
                                stroke="#64748b"
                                fontSize={9}
                                tickLine={false}
                              />
                              <YAxis
                                yAxisId="left"
                                stroke="#4f46e5"
                                fontSize={9}
                                tickFormatter={(v) => `${v}h`}
                              />
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                domain={[0, 100]}
                                stroke="#059669"
                                fontSize={9}
                                tickFormatter={(v) => `${v}%`}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#ffffff',
                                  borderColor: '#e2e8f0',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  color: '#0f172a',
                                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                }}
                                formatter={(value: any, name: any) => {
                                  if (name === 'Curva S Acumulada') return [`${value}%`, name];
                                  return [`${value} h`, name];
                                }}
                                labelFormatter={(label) => `Progresso: ${label}`}
                              />
                              <Bar
                                yAxisId="left"
                                dataKey="totalLoad"
                                name="Carga no Período"
                                fill="#4f46e5"
                                radius={[3, 3, 0, 0]}
                                opacity={0.85}
                              />
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="cumulativePercentage"
                                name="Curva S Acumulada"
                                stroke="#059669"
                                strokeWidth={2.5}
                                dot={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-slate-500 font-medium px-1">
                          <span className="flex items-center gap-1 text-emerald-700 font-bold">
                            <span className="w-2 h-2 bg-emerald-600 rounded-full inline-block"></span>
                            Curva S Acumulada (%)
                          </span>
                          <span className="flex items-center gap-1 text-indigo-700 font-bold">
                            <span className="w-2 h-2 bg-indigo-600 rounded-xs inline-block"></span>
                            Histograma de Carga (h)
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Timeline Gantt Tab */}
                    {previewTab === 'timeline' && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {Object.entries(enrichedSectorCurves)
                          .filter(([_, cfg]) => (cfg.percentage || 0) > 0)
                          .map(([secName, cfg]) => {
                            const dur = Math.max(1, cfg.endPct - cfg.startPct);
                            const col = sectorColors[secName] || '#6366f1';
                            const hours = sectorCalculatedHoursMap[secName] || 0;

                            return (
                              <div
                                key={secName}
                                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px]"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                                      style={{ backgroundColor: col }}
                                    />
                                    <span className="font-bold text-slate-900 truncate">{secName}</span>
                                    <span className="text-slate-500 text-[9px]">
                                      ({cfg.percentage}%)
                                    </span>
                                  </div>
                                  <div className="font-mono text-[9px] text-slate-600">
                                    <span className="text-amber-700 font-bold">{cfg.startPct}%</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-indigo-700 font-bold">{dur}%</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-emerald-700 font-bold">{cfg.endPct}%</span>
                                    <span className="text-slate-500 ml-1">({hours}h)</span>
                                  </div>
                                </div>

                                <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                                  <div
                                    className="absolute top-0 bottom-0 rounded-full"
                                    style={{
                                      left: `${cfg.startPct}%`,
                                      width: `${dur}%`,
                                      backgroundColor: col,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-medium italic">
                  * Os pesos de cada setor são calculados sobre a Meta Base de {(baseTargetHours ?? 0).toLocaleString()}h.
                </div>
              </div>

              {/* ========================================================================= */}
              {/* RIGHT COLUMN (LG:COL-SPAN-7): SCROLLABLE SECTORS PARAMETRIZATION PANEL   */}
              {/* ========================================================================= */}
              <div className="lg:col-span-7 p-3.5 flex flex-col justify-between overflow-y-auto space-y-3 bg-slate-50/80 min-h-0">
                {/* Header Action Bar */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 shrink-0 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Parametrização por Setor ({filteredSectorEntries.length} Grupos dos Centros de Trabalho)</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Agrupadores sincronizados com o cadastro de centros de trabalho. Defina <strong>Início</strong> e <strong>Duração</strong> para cada grupo.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {totalBaseWeightSum !== 100 && (
                        <button
                          type="button"
                          onClick={handleNormalizeWeightsTo100}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                          title="Ajustar proporcionalmente os percentuais para totalizar 100%"
                        >
                          <Scale className="w-3 h-3" />
                          <span>Ajustar 100%</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleDistributeEqually}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors border border-slate-300"
                        title="Distribuir pesos igualmente entre todos os grupos"
                      >
                        <Layers className="w-3 h-3 text-slate-500" />
                        <span>Igualar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsAddingNewSector(!isAddingNewSector)}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Agrupador</span>
                      </button>
                    </div>
                  </div>

                  {/* Add New Sector Bar */}
                  {isAddingNewSector && (
                    <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg flex items-center gap-2">
                      <input
                        type="text"
                        value={newSectorNameInput}
                        onChange={(e) => setNewSectorNameInput(e.target.value)}
                        placeholder="Nome do Novo Agrupador (ex: PINTURA, TESTES, MONTAGEM)"
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 uppercase focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewSectorGroup}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        Adicionar
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewSector(false)}
                        className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Search Bar */}
                  {Object.keys(enrichedSectorCurves).length > 3 && (
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Filtrar agrupador (Corte, Solda, Usinagem...)"
                        className="w-full bg-white border border-slate-300 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Sector Cards Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-2">
                  {filteredSectorEntries.map(([secName, rawCfg]) => {
                    const curveCfg = rawCfg as SectorCurveConfig;
                    const secHours = sectorCalculatedHoursMap[secName] || 0;

                    return (
                      <div key={secName} className="relative">
                        <VolumeDialControl
                          sectorName={secName}
                          config={curveCfg}
                          color={sectorColors[secName] || '#6366f1'}
                          calculatedHours={secHours}
                          totalProjectHours={baseTargetHours}
                          workCenters={workCenters}
                          onUpdateConfig={(updated) => handleSectorCurveChange(secName, updated)}
                          onUpdateHours={(newHrs) => handleSectorHoursChange(secName, newHrs)}
                        />
                      </div>
                    );
                  })}
                </div>

                {filteredSectorEntries.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-xs italic">
                    Nenhum agrupador encontrado com o termo "{searchTerm}".
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">
              Meta Base: <strong className="text-slate-900">{(baseTargetHours ?? 0).toLocaleString()}h</strong> | Total Calculado: <strong className={hoursDifference === 0 ? 'text-emerald-700' : 'text-amber-700'}>{(totalCalculatedSectorHours ?? 0).toLocaleString()}h ({totalBaseWeightSum}%)</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleInitiateSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Cadastro de Curva S</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONFIRMATION / WEIGHT VALIDATION ALERT DIALOG                            */}
      {/* ========================================================================= */}
      {confirmationDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  confirmationDialog.weightSum > 100
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {confirmationDialog.weightSum > 100
                    ? 'Atenção: Pesos Excederam a Meta Base'
                    : 'Atenção: Pesos Abaixo de 100%'}
                </h4>
                <p className="text-xs text-slate-500">
                  A soma dos pesos base está em <strong>{confirmationDialog.weightSum}%</strong>.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Meta Base Atual:</span>
                <span className="font-bold text-slate-900">
                  {(confirmationDialog.baseTotal ?? 0).toLocaleString()} h
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Calculado dos Setores:</span>
                <span
                  className={`font-black ${
                    confirmationDialog.weightSum > 100 ? 'text-amber-700' : 'text-blue-700'
                  }`}
                >
                  {(confirmationDialog.calculatedTotal ?? 0).toLocaleString()} h ({confirmationDialog.weightSum}%)
                </span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                <span>Variação:</span>
                <span
                  className={
                    confirmationDialog.calculatedTotal > confirmationDialog.baseTotal
                      ? 'text-amber-700 font-bold'
                      : 'text-blue-700 font-bold'
                  }
                >
                  {confirmationDialog.calculatedTotal > confirmationDialog.baseTotal ? '+' : ''}
                  {((confirmationDialog.calculatedTotal ?? 0) - (confirmationDialog.baseTotal ?? 0)).toLocaleString()} h
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Deseja atualizar o valor padrão das Horas Típicas do modelo para{' '}
              <strong className="text-slate-900">
                {(confirmationDialog.calculatedTotal ?? 0).toLocaleString()} h
              </strong>{' '}
              ou manter a meta original de{' '}
              <strong className="text-slate-900">
                {(confirmationDialog.baseTotal ?? 0).toLocaleString()} h
              </strong>
              ?
            </p>

            <div className="bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
              💡 <strong>Ajuste Automático:</strong> Ao selecionar qualquer uma das opções, o sistema recalculará os <strong>pesos base (%)</strong> e os <strong>volumes de carga</strong> de cada agrupador/setor, ajustando o somatório total para <strong>exatamente 100%</strong>.
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmSaveWithUpdatedBase}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Atualizar Meta para {(confirmationDialog.calculatedTotal ?? 0).toLocaleString()}h e Salvar</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmSaveKeepOriginalBase}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300"
              >
                <span>Manter Meta em {(confirmationDialog.baseTotal ?? 0).toLocaleString()}h e Salvar</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmationDialog(null)}
                className="w-full py-1.5 text-slate-500 hover:text-slate-800 text-xs cursor-pointer transition-colors"
              >
                Voltar e Ajustar Pesos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
