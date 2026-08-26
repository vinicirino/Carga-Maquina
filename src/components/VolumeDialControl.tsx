import React, { useState, useMemo } from 'react';
import {
  Plus,
  Minus,
  Activity,
  Calendar,
  Volume2,
  Percent,
  Clock,
  Sparkles,
  ArrowRight,
  Users,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Scale,
  Zap,
} from 'lucide-react';
import { SectorCurveConfig, CurveShape } from '../types/turbine';
import { WorkCenter } from '../types';
import { calculateWeeklyCapacity } from '../utils/calculator';

interface VolumeDialControlProps {
  sectorName: string;
  config: SectorCurveConfig;
  color?: string;
  calculatedHours: number;
  totalProjectHours: number;
  workCenters?: WorkCenter[];
  onUpdateConfig: (updated: SectorCurveConfig) => void;
  onUpdateHours?: (newHours: number) => void;
}

export const VolumeDialControl: React.FC<VolumeDialControlProps> = ({
  sectorName,
  config,
  color = '#6366f1',
  calculatedHours,
  totalProjectHours,
  workCenters = [],
  onUpdateConfig,
  onUpdateHours,
}) => {
  const { percentage, startPct, endPct, curveShape, volumeGain = 1.0 } = config;
  const [showWcDistribution, setShowWcDistribution] = useState<boolean>(false);

  // Derive duration / dispersion percentage: how much it spreads along the timeline
  const durationPct = Math.max(1, endPct - startPct);

  // Filter work centers that belong to this sector category
  const sectorWorkCenters = useMemo(() => {
    if (!workCenters || workCenters.length === 0) return [];
    return workCenters.filter((wc) => {
      const cat = (wc.category || 'OUTROS').trim().toUpperCase();
      return cat === sectorName.trim().toUpperCase();
    });
  }, [workCenters, sectorName]);

  // Current custom shares or default equal shares (integers summing to 100%)
  const wcShares = useMemo(() => {
    const shares: Record<string, number> = {};
    const n = sectorWorkCenters.length;
    if (n === 0) return shares;

    const custom = config.customWorkCenterShares;
    const hasCustom = custom && Object.keys(custom).length > 0;

    if (hasCustom) {
      sectorWorkCenters.forEach((wc) => {
        const raw = custom[wc.id] ?? custom[wc.name];
        shares[wc.id] = typeof raw === 'number' ? Math.round(raw) : 0;
      });
    } else if (calculatedHours === 0 || percentage === 0) {
      // Sector has 0 hours allocated - all work centers in this sector remain 0%
      sectorWorkCenters.forEach((wc) => {
        shares[wc.id] = 0;
      });
    } else {
      // Default integer equal shares strictly summing to 100%
      const baseShare = Math.floor(100 / n);
      const remainder = 100 % n;
      sectorWorkCenters.forEach((wc, i) => {
        shares[wc.id] = baseShare + (i < remainder ? 1 : 0);
      });
    }

    return shares;
  }, [sectorWorkCenters, config.customWorkCenterShares, calculatedHours, percentage]);

  const totalWcShareSum = useMemo(() => {
    const vals = Object.values(wcShares);
    if (vals.length === 0) return 0;
    const sum = vals.reduce<number>((acc, v) => acc + (Math.round(Number(v)) || 0), 0);
    return Math.round(sum);
  }, [wcShares]);

  const hasCustomWcShares = useMemo(() => {
    return !!(config.customWorkCenterShares && Object.keys(config.customWorkCenterShares).length > 0);
  }, [config.customWorkCenterShares]);

  // Direct edit of hours: triggers onUpdateHours or calculates corresponding percentage
  const handleDirectHoursChange = (rawHours: number) => {
    const safeHours = Math.max(0, isNaN(rawHours) ? 0 : rawHours);
    if (onUpdateHours) {
      onUpdateHours(safeHours);
      return;
    }
    const total = totalProjectHours > 0 ? totalProjectHours : 1;
    const gain = volumeGain > 0 ? volumeGain : 1.0;
    const newPct = Math.round((safeHours * 100) / (total * gain));
    onUpdateConfig({
      ...config,
      percentage: Math.min(100, Math.max(0, newPct)),
    });
  };

  // Change Volume Gain (multiplier: 0.1 to 3.0)
  const handleVolumeGainChange = (newVal: number) => {
    const clamped = Math.max(0.1, Math.min(3.0, Number(newVal.toFixed(2))));
    onUpdateConfig({
      ...config,
      volumeGain: clamped,
    });
  };

  // Change Base Weight Percentage (0% to 100% - Strictly Integers)
  const handlePercentageChange = (newVal: number) => {
    const safeVal = isNaN(newVal) ? 0 : Math.round(newVal);
    const clamped = Math.max(0, Math.min(100, safeVal));
    onUpdateConfig({
      ...config,
      percentage: clamped,
    });
  };

  // Parameter 1: Início no Cronograma (0% a 100% - Strictly Integers)
  const handleStartPctChange = (newStart: number) => {
    const safeStart = Math.max(0, Math.min(99, Math.round(isNaN(newStart) ? 0 : newStart)));
    const currentDuration = Math.max(1, endPct - startPct);
    const newEnd = Math.min(100, safeStart + currentDuration);
    onUpdateConfig({
      ...config,
      startPct: safeStart,
      endPct: Math.max(safeStart + 1, newEnd),
    });
  };

  // Parameter 2: % Dispersão / Duração (Espalhamento na Linha do Tempo - Strictly Integers)
  const handleDurationPctChange = (newDuration: number) => {
    const safeDuration = Math.max(1, Math.min(100, Math.round(isNaN(newDuration) ? 1 : newDuration)));
    const newEnd = Math.min(100, startPct + safeDuration);
    onUpdateConfig({
      ...config,
      endPct: newEnd,
    });
  };

  const handleShapeChange = (shape: CurveShape) => {
    onUpdateConfig({
      ...config,
      curveShape: shape,
    });
  };

  // Work Center Allocation handlers (Strictly Integers)
  const handleWcShareChange = (wcId: string, val: number) => {
    const intVal = Math.max(0, Math.min(100, Math.round(isNaN(val) ? 0 : val)));
    const currentMap = config.customWorkCenterShares ? { ...config.customWorkCenterShares } : { ...wcShares };
    currentMap[wcId] = intVal;
    onUpdateConfig({
      ...config,
      customWorkCenterShares: currentMap,
    });
  };

  const handleDistributeEqually = () => {
    const n = sectorWorkCenters.length;
    if (n === 0) return;
    const baseShare = Math.floor(100 / n);
    const remainder = 100 % n;
    const updated: Record<string, number> = {};
    sectorWorkCenters.forEach((wc, i) => {
      updated[wc.id] = baseShare + (i < remainder ? 1 : 0);
    });
    onUpdateConfig({
      ...config,
      customWorkCenterShares: updated,
    });
  };

  const handleDistributeByCapacity = () => {
    const totalCap = sectorWorkCenters.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);
    if (totalCap === 0) {
      handleDistributeEqually();
      return;
    }
    // Largest Remainder Method (Hare-Niemeyer) for exact 100% integer sum
    const items = sectorWorkCenters.map((wc) => {
      const cap = calculateWeeklyCapacity(wc);
      const exact = (cap / totalCap) * 100;
      const floor = Math.floor(exact);
      const remainder = exact - floor;
      return { wcId: wc.id, floor, remainder };
    });

    const sumFloor = items.reduce((acc, it) => acc + it.floor, 0);
    let remainingToDistribute = 100 - sumFloor;

    items.sort((a, b) => b.remainder - a.remainder);

    const updated: Record<string, number> = {};
    items.forEach((it) => {
      if (remainingToDistribute > 0) {
        updated[it.wcId] = it.floor + 1;
        remainingToDistribute--;
      } else {
        updated[it.wcId] = it.floor;
      }
    });

    onUpdateConfig({
      ...config,
      customWorkCenterShares: updated,
    });
  };

  const handleAutoNormalizeWcShares = () => {
    if (totalWcShareSum <= 0) {
      handleDistributeEqually();
      return;
    }
    const factor = 100 / totalWcShareSum;
    
    // Largest Remainder Method to get exact integers summing to 100%
    const items = sectorWorkCenters.map((wc) => {
      const current = wcShares[wc.id] || 0;
      const exact = current * factor;
      const floor = Math.floor(exact);
      const remainder = exact - floor;
      return { wcId: wc.id, floor, remainder };
    });

    const sumFloor = items.reduce((acc, it) => acc + it.floor, 0);
    let remainingToDistribute = 100 - sumFloor;

    items.sort((a, b) => b.remainder - a.remainder);

    const updated: Record<string, number> = {};
    items.forEach((it) => {
      if (remainingToDistribute > 0) {
        updated[it.wcId] = it.floor + 1;
        remainingToDistribute--;
      } else {
        updated[it.wcId] = it.floor;
      }
    });

    onUpdateConfig({
      ...config,
      customWorkCenterShares: updated,
    });
  };

  const getShapeLabel = (s: CurveShape) => {
    switch (s) {
      case 's-curve':
        return 'Curva S';
      case 'bell':
        return 'Gauss / Sino';
      case 'front-loaded':
        return 'Início Forte';
      case 'back-loaded':
        return 'Final Forte';
      case 'linear':
        return 'Linear';
    }
  };

  const effectivePct = ((calculatedHours / (totalProjectHours || 1)) * 100).toFixed(1);

  return (
    <div className="bg-white text-slate-900 p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3 hover:border-slate-300 transition-colors">
      {/* Header: Sector Dot & Name on Left, Hours Badge & Centros Button on Right */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        {/* Left: Sector Dot and Name */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0 shadow-xs"
            style={{ backgroundColor: color }}
          ></div>
          <span className="font-black text-xs text-slate-900 uppercase tracking-wider truncate" title={sectorName}>
            {sectorName}
          </span>
        </div>

        {/* Right: Hours Badge (Display Only) + Effective % + Centros Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Read-Only Hours Display */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <span className="font-black text-xs text-emerald-700">
              {Math.round(calculatedHours || 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-700 ml-1">h</span>
          </div>

          <span className="text-[11px] text-slate-500 font-semibold shrink-0">
            ({effectivePct}%)
          </span>

          {/* Centros Button (Placed after hours per center) */}
          {sectorWorkCenters.length > 0 && (
            <button
              type="button"
              onClick={() => setShowWcDistribution((prev) => !prev)}
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                showWcDistribution
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : hasCustomWcShares
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title="Clique para configurar a porcentagem de cada centro de trabalho deste setor"
            >
              <Users className="w-3 h-3" />
              <span>{sectorWorkCenters.length} centros</span>
              {showWcDistribution ? (
                <ChevronUp className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Work Center Distribution Drawer */}
      {showWcDistribution && sectorWorkCenters.length > 0 && (
        <div className="bg-slate-50 p-3 rounded-xl border border-indigo-200 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Distribuição entre Centros ({sectorName})</span>
              </div>
              <span className="text-[10px] text-slate-600 font-medium">
                Carga do setor: <strong className="text-emerald-700">{Math.round(calculatedHours || 0).toLocaleString()}h</strong>
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleDistributeEqually}
                className="inline-flex items-center gap-1 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-300 cursor-pointer transition-colors shadow-2xs"
                title="Divide 100% em partes iguais para todos os centros"
              >
                <Scale className="w-3 h-3 text-cyan-600" />
                <span>Dividir Igualmente</span>
              </button>

              <button
                type="button"
                onClick={handleDistributeByCapacity}
                className="inline-flex items-center gap-1 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-300 cursor-pointer transition-colors shadow-2xs"
                title="Distribui proporcionalmente à capacidade semanal de cada centro"
              >
                <Zap className="w-3 h-3 text-amber-600" />
                <span>Por Capacidade</span>
              </button>
            </div>
          </div>

          {/* List of Work Centers with % share sliders & inputs */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {sectorWorkCenters.map((wc) => {
              const cap = calculateWeeklyCapacity(wc);
              const share = Math.round(wcShares[wc.id] ?? 0);
              const allocatedHours = Math.round(calculatedHours * (share / 100));

              return (
                <div
                  key={wc.id}
                  className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col gap-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-black text-slate-900 truncate block" title={wc.name}>
                        {wc.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Cap: {cap}h/sem • Alocado: <strong className="text-emerald-700">{(allocatedHours || 0).toLocaleString()}h</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={share}
                          onChange={(e) => handleWcShareChange(wc.id, parseInt(e.target.value, 10) || 0)}
                          className="w-11 bg-transparent text-right font-black text-xs text-indigo-700 focus:outline-none"
                        />
                        <span className="text-[10px] font-bold text-indigo-700 ml-0.5">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Percentage Slider (Integer Step = 1) */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={share}
                      onChange={(e) => handleWcShareChange(wc.id, parseInt(e.target.value, 10) || 0)}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sum Validator Badge & Auto-normalize */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px]">
            <div className="flex items-center gap-1.5">
              {totalWcShareSum === 100 ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>Soma dos centros: 100% ✓</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span>Soma atual: {totalWcShareSum}% (deve somar 100%)</span>
                </span>
              )}
            </div>

            {totalWcShareSum !== 100 && (
              <button
                type="button"
                onClick={handleAutoNormalizeWcShares}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
              >
                Ajustar para 100%
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mini Visual Timeline Track: Alocação */}
      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-bold text-slate-700 uppercase tracking-wider">
            Alocação
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-amber-700 font-bold">Início: {startPct}%</span>
            <span className="text-slate-400">→</span>
            <span className="text-indigo-700 font-bold">Duração: {durationPct}%</span>
            <span className="text-slate-400">→</span>
            <span className="text-emerald-700 font-bold">Fim: {endPct}%</span>
          </div>
        </div>

        {/* Track Bar (0% to 100%) */}
        <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
          {/* Grid lines at 25%, 50%, 75% */}
          <div className="absolute inset-0 flex justify-between px-1 pointer-events-none opacity-30">
            <div className="w-px h-full bg-slate-500" style={{ left: '25%' }}></div>
            <div className="w-px h-full bg-slate-500" style={{ left: '50%' }}></div>
            <div className="w-px h-full bg-slate-500" style={{ left: '75%' }}></div>
          </div>

          {/* Active Sector Span */}
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-150 flex items-center justify-center text-[8px] font-black text-white"
            style={{
              left: `${startPct}%`,
              width: `${Math.max(2, durationPct)}%`,
              backgroundColor: color,
            }}
          ></div>
        </div>

        <div className="flex justify-between text-[8px] text-slate-500 font-mono px-0.5">
          <span>0% (Início)</span>
          <span>25%</span>
          <span>50% (Meio)</span>
          <span>75%</span>
          <span>100% (Entrega)</span>
        </div>
      </div>

      {/* 4 Draggable Sliders with Refined Parameters */}
      <div className="space-y-2.5">
        {/* 1. Volume de Carga */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Volume de Carga</span>
            </span>

            <div className="flex items-center gap-1">
              <div className="flex items-center bg-white border border-slate-300 hover:border-indigo-500 focus-within:border-indigo-500 rounded px-1.5 py-0.5">
                <input
                  type="number"
                  min={10}
                  max={300}
                  step={5}
                  value={Math.round(volumeGain * 100)}
                  onChange={(e) => handleVolumeGainChange((parseFloat(e.target.value) || 100) / 100)}
                  className="w-12 bg-transparent text-right font-black text-xs text-indigo-700 focus:outline-none"
                />
                <span className="text-[11px] font-bold text-indigo-700 ml-0.5">%</span>
              </div>
              <span className="text-[10px] text-slate-500 font-normal">
                ({volumeGain >= 1 ? `+${Math.round((volumeGain - 1) * 100)}%` : `-${Math.round((1 - volumeGain) * 100)}%`})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleVolumeGainChange(volumeGain - 0.05)}
              className="w-7 h-7 rounded bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs border border-slate-300 cursor-pointer shrink-0 transition-transform active:scale-95 shadow-2xs"
              title="Diminuir Volume (-5%)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={0.1}
              max={2.5}
              step={0.05}
              value={volumeGain}
              onChange={(e) => handleVolumeGainChange(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />

            <button
              type="button"
              onClick={() => handleVolumeGainChange(volumeGain + 0.05)}
              className="w-7 h-7 rounded bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white flex items-center justify-center font-black text-xs border border-indigo-600 cursor-pointer shrink-0 transition-transform active:scale-95 shadow-2xs"
              title="Aumentar Volume (+5%)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. % Peso Base */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-emerald-600" />
              <span>% Peso Base</span>
            </span>

            <div className="flex items-center bg-white border border-slate-300 hover:border-emerald-500 focus-within:border-emerald-500 rounded px-1.5 py-0.5">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(percentage)}
                onChange={(e) => handlePercentageChange(parseInt(e.target.value, 10) || 0)}
                className="w-12 bg-transparent text-right font-black text-xs text-slate-900 focus:outline-none"
                title="Digite o percentual base diretamente"
              />
              <span className="text-[11px] font-bold text-slate-500 ml-0.5">%</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePercentageChange(percentage - 1)}
              className="w-7 h-7 rounded bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs border border-slate-300 cursor-pointer shrink-0 transition-transform active:scale-95 shadow-2xs"
              title="Diminuir Peso (-1%)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(percentage)}
              onChange={(e) => handlePercentageChange(parseInt(e.target.value, 10) || 0)}
              className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />

            <button
              type="button"
              onClick={() => handlePercentageChange(percentage + 1)}
              className="w-7 h-7 rounded bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-center font-black text-xs border border-emerald-600 cursor-pointer shrink-0 transition-transform active:scale-95 shadow-2xs"
              title="Aumentar Peso (+1%)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Início Cronograma */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Início Cronograma:</span>
            </span>

            <div className="flex items-center bg-white border border-slate-300 hover:border-amber-500 focus-within:border-amber-500 rounded px-1.5 py-0.5">
              <input
                type="number"
                min={0}
                max={99}
                step={1}
                value={startPct}
                onChange={(e) => handleStartPctChange(parseFloat(e.target.value) || 0)}
                className="w-10 bg-transparent text-right font-black text-xs text-amber-700 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 ml-1 font-semibold">% proj</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleStartPctChange(startPct - 1)}
              className="w-7 h-7 rounded bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs border border-slate-300 cursor-pointer shrink-0 transition-transform active:scale-95 shadow-2xs"
              title="Recuar Início (-1%)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={0}
              max={99}
              step={1}
              value={startPct}
              onChange={(e) => handleStartPctChange(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />

            <button
              type="button"
              onClick={() => handleStartPctChange(startPct + 1)}
              className="w-7 h-7 rounded bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs border border-slate-300 cursor-pointer shrink-0 transition-transform active:scale-95 shadow-2xs"
              title="Avançar Início (+1%)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4. Duração */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-600" />
              <span>Duração:</span>
            </span>

            <div className="flex items-center bg-white border border-slate-300 hover:border-cyan-500 focus-within:border-cyan-500 rounded px-1.5 py-0.5">
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={durationPct}
                onChange={(e) => handleDurationPctChange(parseFloat(e.target.value) || 1)}
                className="w-10 bg-transparent text-right font-black text-xs text-cyan-700 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 ml-1 font-semibold">% proj</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleDurationPctChange(durationPct - 1)}
              className="w-7 h-7 rounded bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs border border-slate-300 cursor-pointer shrink-0 transition-transform active:scale-95 shadow-2xs"
              title="Diminuir Duração (-1%)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={1}
              max={100 - startPct > 1 ? 100 - startPct : 100}
              step={1}
              value={durationPct}
              onChange={(e) => handleDurationPctChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />

            <button
              type="button"
              onClick={() => handleDurationPctChange(durationPct + 1)}
              className="w-7 h-7 rounded bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs border border-slate-300 cursor-pointer shrink-0 transition-transform active:scale-95 shadow-2xs"
              title="Aumentar Duração (+1%)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Curva de Distribuição */}
      <div className="pt-0.5">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 block mb-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-600" />
          <span>Curva de Distribuição:</span>
        </span>

        <div className="grid grid-cols-5 gap-1 text-[10px]">
          {(['s-curve', 'bell', 'front-loaded', 'back-loaded', 'linear'] as CurveShape[]).map(
            (shape) => {
              const isSelected = curveShape === shape;
              return (
                <button
                  key={shape}
                  type="button"
                  onClick={() => handleShapeChange(shape)}
                  className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all truncate cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs border border-indigo-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                  }`}
                  title={getShapeLabel(shape)}
                >
                  {getShapeLabel(shape)}
                </button>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
};
