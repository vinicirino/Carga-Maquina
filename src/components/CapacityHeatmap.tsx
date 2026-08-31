import React, { useState } from 'react';
import { WorkCenter, WeeklyBucket } from '../types';
import { calculateWeeklyCapacity } from '../utils/calculator';
import { Layers, AlertTriangle, CheckCircle, Search } from 'lucide-react';

interface CapacityHeatmapProps {
  workCenters: WorkCenter[];
  weeklyBuckets: WeeklyBucket[];
}

export const CapacityHeatmap: React.FC<CapacityHeatmapProps> = ({
  workCenters,
  weeklyBuckets,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyOverloaded, setOnlyOverloaded] = useState(false);

  // Filter work centers - only include centers with demand > 0 in this scenario
  const activeWorkCenters = workCenters.filter(
    (wc) =>
      wc.enabled !== false &&
      weeklyBuckets.some((b) => (b.workCenterLoads[wc.id] || 0) > 0)
  );

  const filteredWorkCenters = activeWorkCenters.filter((wc) => {
    const matchesSearch = wc.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!onlyOverloaded) return matchesSearch;

    // Check if wc is overloaded in any bucket
    const weeklyCap = calculateWeeklyCapacity(wc);
    const hasOverload = weeklyBuckets.some(
      (b) => (b.workCenterLoads[wc.id] || 0) > weeklyCap + 0.01
    );

    return matchesSearch && hasOverload;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>Matriz de Carga Semanal (Heatmap)</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Visualização em matriz da ocupação semanal por centro de trabalho. Células em vermelho indicam sobrecarga de capacidade.
          </p>
        </div>

        {/* Filters & Legend */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <input
            type="text"
            placeholder="Filtrar setor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-purple-500"
          />

          <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOverloaded}
              onChange={(e) => setOnlyOverloaded(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span>Apenas com Gargalo</span>
          </label>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium border-l border-slate-200 pl-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-slate-100 border border-slate-300 rounded-xs"></span> 0%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs"></span> &lt;80%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs"></span> 80-100%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-rose-600 rounded-xs"></span> &gt;100%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-indigo-950 border border-indigo-700 rounded-xs"></span> 🏖️ Parada (0h)
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Matrix Scrollable Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[600px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-white sticky top-0 z-20">
            <tr>
              <th className="py-2.5 px-3 sticky left-0 z-30 bg-slate-900 min-w-[200px] border-r border-slate-700 font-bold">
                Centro de Trabalho
              </th>
              <th className="py-2.5 px-2 text-center min-w-[70px] border-r border-slate-700 font-bold">
                Cap/Sem
              </th>
              {weeklyBuckets.map((bucket) => {
                const hasHoliday = (bucket.activeHolidays || []).length > 0;
                return (
                  <th
                    key={bucket.weekKey}
                    className={`py-2 px-2 text-center min-w-[85px] border-r border-slate-800 text-[10px] font-normal leading-tight ${
                      hasHoliday ? 'bg-indigo-950 text-amber-300' : ''
                    }`}
                    title={hasHoliday ? bucket.activeHolidays?.map((h) => h.title).join(', ') : undefined}
                  >
                    <div className="font-bold flex items-center justify-center gap-0.5">
                      {hasHoliday && <span>🏖️</span>}
                      <span>{bucket.label.split(' ')[1]}</span>
                    </div>
                    <div className="text-[9px] text-slate-400">{bucket.label.split('(')[1]?.replace(')', '')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredWorkCenters.map((wc) => {
              const nominalWeeklyCap = calculateWeeklyCapacity(wc);

              return (
                <tr key={wc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 sticky left-0 z-10 bg-white font-semibold text-slate-900 border-r border-slate-200 truncate max-w-[220px]">
                    {wc.name}
                  </td>
                  <td className="py-2 px-2 text-center font-medium text-slate-600 border-r border-slate-200 bg-slate-50 text-[11px]">
                    {nominalWeeklyCap.toFixed(0)}h
                  </td>

                  {weeklyBuckets.map((bucket) => {
                    const load = bucket.workCenterLoads[wc.id] || 0;
                    const effectiveCap = bucket.workCenterCapacities?.[wc.id] ?? nominalWeeklyCap;
                    const isClosed = effectiveCap === 0 && nominalWeeklyCap > 0;
                    const util = effectiveCap > 0 ? (load / effectiveCap) * 100 : load > 0 ? 999 : 0;

                    let bgClass = 'bg-slate-50 text-slate-400';
                    let cellNode: React.ReactNode = <span className="opacity-30">-</span>;

                    if (isClosed) {
                      if (load > 0) {
                        bgClass = 'bg-rose-700 text-white font-black';
                        cellNode = (
                          <div>
                            <div>{load.toFixed(0)}h</div>
                            <div className="text-[8px] text-amber-200">⚠️ FECHADO</div>
                          </div>
                        );
                      } else {
                        bgClass = 'bg-indigo-950/80 text-indigo-300 font-bold';
                        cellNode = (
                          <div className="text-[10px] leading-tight">
                            <span>🏖️ Parada</span>
                            <span className="block text-[8px] text-indigo-400">0h cap</span>
                          </div>
                        );
                      }
                    } else if (load > 0) {
                      if (util > 100) {
                        bgClass = 'bg-rose-600 text-white font-bold';
                      } else if (util > 80) {
                        bgClass = 'bg-amber-400 text-amber-950 font-bold';
                      } else {
                        bgClass = 'bg-emerald-100 text-emerald-900 font-medium';
                      }

                      cellNode = (
                        <div>
                          <div>{load.toFixed(0)}h</div>
                          <div className="text-[9px] opacity-80">{util.toFixed(0)}%</div>
                        </div>
                      );
                    }

                    const activeHolidays = (bucket.activeHolidays || []).filter(
                      (h) =>
                        !h.workCenterIds ||
                        h.workCenterIds.length === 0 ||
                        h.workCenterIds.includes(wc.id) ||
                        h.workCenterIds.includes(wc.name)
                    );

                    const tooltipText = `${wc.name} - ${bucket.label}\nCarga: ${load.toFixed(
                      1
                    )}h / Cap Efetiva: ${effectiveCap.toFixed(1)}h (Nominal: ${nominalWeeklyCap.toFixed(0)}h)${
                      activeHolidays.length > 0 ? `\nParada/Feriado: ${activeHolidays.map((h) => h.title).join(', ')}` : ''
                    }`;

                    return (
                      <td
                        key={bucket.weekKey}
                        className={`py-2 px-1 text-center border-r border-slate-200 text-[11px] transition-colors ${bgClass}`}
                        title={tooltipText}
                      >
                        {cellNode}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
