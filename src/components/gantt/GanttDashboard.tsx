import React from 'react';
import {
  GanttTaskNode,
  GanttMetrics,
} from '../../types/gantt';
import { WorkCenter } from '../../types';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  Calendar,
  Layers,
  Factory,
  TrendingUp,
  Percent,
  FileCheck2,
  ArrowUpRight,
  Flame,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface GanttDashboardProps {
  allTasks: GanttTaskNode[];
  metrics: GanttMetrics;
  workCenters: WorkCenter[];
  onSelectTask: (task: GanttTaskNode) => void;
  onNavigateToGantt: () => void;
}

export const GanttDashboard: React.FC<GanttDashboardProps> = ({
  allTasks,
  metrics,
  workCenters,
  onSelectTask,
  onNavigateToGantt,
}) => {
  // Level 1 Groups (Conjuntos) Progress Breakdown
  const level1Groups = allTasks.filter((t) => t.level === 1);

  // Group progress calculation
  const groupsProgressData = level1Groups.map((g) => {
    return {
      id: g.id,
      name: g.name.length > 25 ? g.name.slice(0, 25) + '...' : g.name,
      fullName: g.name,
      code: g.code,
      progress: g.progress,
      totalHours: g.plannedHours || 0,
      actualHours: g.actualHours || 0,
      status: g.status,
      startDate: g.startDate,
      endDate: g.endDate,
    };
  });

  // Status breakdown for Pie Chart
  const statusPieData = [
    { name: 'Concluídos', value: metrics.completedTasks, color: '#10b981' },
    { name: 'Em Andamento', value: metrics.inProgressTasks, color: '#6366f1' },
    { name: 'Atrasados', value: metrics.delayedTasks, color: '#f43f5e' },
    { name: 'Aguardando Material', value: metrics.waitingMaterialTasks, color: '#f59e0b' },
    { name: 'Não Iniciados', value: metrics.notStartedTasks, color: '#64748b' },
  ].filter((d) => d.value > 0);

  // Work Center Load breakdown from WBS operations
  const wcHoursMap = new Map<string, { name: string; planned: number; actual: number }>();
  allTasks.forEach((t) => {
    if (t.workCenterId && t.plannedHours) {
      const existing = wcHoursMap.get(t.workCenterId) || {
        name: t.workCenterName || t.workCenterId,
        planned: 0,
        actual: 0,
      };
      existing.planned += t.plannedHours || 0;
      existing.actual += t.actualHours || 0;
      wcHoursMap.set(t.workCenterId, existing);
    }
  });

  const wcChartData = Array.from(wcHoursMap.values())
    .sort((a, b) => b.planned - a.planned)
    .slice(0, 8);

  // Critical delayed or waiting material items
  const criticalItems = allTasks.filter(
    (t) => t.status === 'delayed' || t.status === 'waiting_material' || t.constraintType === 'contract'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            Dashboard Executivo de Prazos & Avanço do Projeto
          </h2>
          <p className="text-xs text-slate-400">
            Acompanhamento de eventos concluídos, itens em aberto, marcos contratuais e suprimentos
          </p>
        </div>

        <button
          onClick={onNavigateToGantt}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-900/30 cursor-pointer self-start sm:self-auto"
        >
          <Calendar className="w-4 h-4" />
          Ver Linha do Tempo no Gantt
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tasks */}
        <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase">Total Itens EAP</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white font-mono">{metrics.totalTasks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Operações e Conjuntos</span>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase">Avanço Físico</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {metrics.overallProgress}%
            </span>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1 border border-slate-700">
              <div
                style={{ width: `${metrics.overallProgress}%` }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[11px] font-bold uppercase">Concluídos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {metrics.completedTasks}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {metrics.totalTasks > 0
                ? `${Math.round((metrics.completedTasks / metrics.totalTasks) * 100)}% do total`
                : '0%'}
            </span>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-400">
            <span className="text-[11px] font-bold uppercase">Em Andamento</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-indigo-400 font-mono">
              {metrics.inProgressTasks}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Atividades abertas</span>
          </div>
        </div>

        {/* Delayed */}
        <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-[11px] font-bold uppercase">Atrasados</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-400 font-mono">
              {metrics.delayedTasks}
            </span>
            <span className="text-[10px] text-rose-400/80 block mt-0.5 font-semibold">
              Requer remanejamento
            </span>
          </div>
        </div>

        {/* Materials / Supplies */}
        <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[11px] font-bold uppercase">Aguardando Mat.</span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {metrics.waitingMaterialTasks}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {metrics.materialsDelayed > 0
                ? `⚠️ ${metrics.materialsDelayed} compras em atraso`
                : 'Suprimentos previstos'}
            </span>
          </div>
        </div>
      </div>

      {/* Progress by Level 1 Assemblies */}
      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Avanço por Conjunto Principal (Nível 1)
          </span>
          <span className="text-xs font-mono text-slate-400">{groupsProgressData.length} Conjuntos</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupsProgressData.map((grp) => (
            <div
              key={grp.id}
              className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                    {grp.code}
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[200px]" title={grp.fullName}>
                    {grp.fullName}
                  </span>
                </div>
                <span className="text-xs font-black font-mono text-indigo-400">{grp.progress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                <div
                  style={{ width: `${grp.progress}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    grp.progress === 100
                      ? 'bg-emerald-500'
                      : grp.status === 'delayed'
                      ? 'bg-rose-500'
                      : 'bg-indigo-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Período: {grp.startDate} a {grp.endDate}</span>
                <span>Horas: {grp.actualHours}h / {grp.totalHours}h</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row: Status Pie & CT Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Distribuição de Situação dos Itens
          </h3>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Work Center Demand from Detailed Tasks */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Factory className="w-4 h-4 text-blue-400" />
            Carga Detalhada por Centro de Trabalho (Horas)
          </h3>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wcChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  tick={{ fill: '#94a3b8' }}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="planned" name="Horas Planejadas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Horas Apontadas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Attention & Material Blockers Table */}
      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Eventos Críticos, Prazos Contratuais & Dependências de Suprimentos
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-2.5">Código</th>
                <th className="p-2.5">Elemento / Operação</th>
                <th className="p-2.5">Restrição</th>
                <th className="p-2.5">Datas</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {criticalItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">
                    Nenhum item com pendência crítica no momento.
                  </td>
                </tr>
              ) : (
                criticalItems.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 font-mono text-indigo-400 font-bold">{t.code}</td>
                    <td className="p-2.5">
                      <span className="font-bold text-white block">{t.name}</span>
                      {t.notes && <span className="text-[10px] text-slate-400">{t.notes}</span>}
                    </td>
                    <td className="p-2.5">
                      {t.constraintType === 'contract' && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                          📜 Contrato ({t.contractDate || t.endDate})
                        </span>
                      )}
                      {t.constraintType === 'material' && (
                        <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded">
                          📦 {t.materialName || 'Material'} (ETA: {t.materialEtaDate || 'N/A'})
                        </span>
                      )}
                      {t.constraintType === 'capacity' && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
                          ⚙️ {t.workCenterName || 'CT'}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">
                      {t.startDate} a {t.endDate}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : t.status === 'delayed'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : t.status === 'waiting_material'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {t.status === 'completed'
                          ? 'Concluído'
                          : t.status === 'delayed'
                          ? 'Atrasado'
                          : t.status === 'waiting_material'
                          ? 'Aguardando Material'
                          : 'Em Andamento'}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => onSelectTask(t)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
