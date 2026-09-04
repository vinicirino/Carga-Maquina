import React from 'react';
import {
  GanttTaskNode,
  MaterialDeliveryStatus,
} from '../../types/gantt';
import {
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';

interface GanttMaterialsPanelProps {
  allTasks: GanttTaskNode[];
  onUpdateMaterialStatus: (taskId: string, newStatus: MaterialDeliveryStatus) => void;
  onEditTask: (task: GanttTaskNode) => void;
}

export const GanttMaterialsPanel: React.FC<GanttMaterialsPanelProps> = ({
  allTasks,
  onUpdateMaterialStatus,
  onEditTask,
}) => {
  // Filter all items with material dependency
  const materialTasks = allTasks.filter(
    (t) => t.materialName || t.constraintType === 'material'
  );

  const today = new Date();

  // Categorize
  const received = materialTasks.filter((t) => t.materialStatus === 'received');
  const inTransit = materialTasks.filter(
    (t) => t.materialStatus === 'in_transit' || t.materialStatus === 'ordered'
  );
  const delayed = materialTasks.filter(
    (t) =>
      t.materialStatus === 'delayed' ||
      (t.materialEtaDate && isBefore(parseISO(t.materialEtaDate), today) && t.materialStatus !== 'received')
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            Gestão de Suprimentos & Matéria-Prima no Cronograma
          </h2>
          <p className="text-xs text-slate-400">
            Acompanhamento de compras de forjados, chapas, fundidos e servomotores que impactam a liberação de máquinas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
            Total de Itens: <strong className="text-white">{materialTasks.length}</strong>
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-emerald-400">Recebidos / Em Estoque</span>
            <div className="text-2xl font-black text-white mt-1">{received.length}</div>
            <span className="text-[10px] text-emerald-300">Liberados para Usinagem / Caldeiraria</span>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-60" />
        </div>

        <div className="bg-blue-950/20 border border-blue-500/30 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-blue-400">Em Trânsito / Pedido</span>
            <div className="text-2xl font-black text-white mt-1">{inTransit.length}</div>
            <span className="text-[10px] text-blue-300">Previsões dentro da janela</span>
          </div>
          <Truck className="w-8 h-8 text-blue-400 opacity-60" />
        </div>

        <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-rose-400">Atrasos de Entrega</span>
            <div className="text-2xl font-black text-rose-300 mt-1">{delayed.length}</div>
            <span className="text-[10px] text-rose-300">Risco de ociosidade ou postergação</span>
          </div>
          <AlertTriangle className="w-8 h-8 text-rose-400 opacity-60" />
        </div>
      </div>

      {/* Materials List Table */}
      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-400" />
          Relação de Matérias-Primas por Conjunto e Operação
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Item / Conjunto</th>
                <th className="p-3">Material & Especificação</th>
                <th className="p-3">Fornecedor</th>
                <th className="p-3">Previsão (ETA)</th>
                <th className="p-3">Início da Operação</th>
                <th className="p-3">Status da Entrega</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {materialTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Nenhum material cadastrado na árvore EAP ainda.
                  </td>
                </tr>
              ) : (
                materialTasks.map((t) => {
                  const isLate =
                    t.materialStatus === 'delayed' ||
                    (t.materialEtaDate &&
                      isBefore(parseISO(t.materialEtaDate), today) &&
                      t.materialStatus !== 'received');

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono text-indigo-400 font-bold">{t.code}</td>
                      <td className="p-3">
                        <span className="font-bold text-white block">{t.name}</span>
                        <span className="text-[10px] text-slate-400">Nível {t.level}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-amber-300">
                          {t.materialName || 'Material Padrão'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {t.materialSupplier || 'Fornecedor Homologado'}
                      </td>
                      <td className="p-3 font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            isLate ? 'bg-rose-950 text-rose-300 font-bold' : 'text-slate-200'
                          }`}
                        >
                          {t.materialEtaDate || 'A definir'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{t.startDate}</td>
                      <td className="p-3">
                        <select
                          value={t.materialStatus || 'ordered'}
                          onChange={(e) =>
                            onUpdateMaterialStatus(
                              t.id,
                              e.target.value as MaterialDeliveryStatus
                            )
                          }
                          className={`text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                            t.materialStatus === 'received'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                              : t.materialStatus === 'delayed'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                              : t.materialStatus === 'in_transit'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-700'
                              : 'bg-amber-950/80 text-amber-300 border-amber-700'
                          }`}
                        >
                          <option value="not_ordered">Não Solicitado</option>
                          <option value="ordered">Pedido Colocado</option>
                          <option value="in_transit">Em Trânsito</option>
                          <option value="received">Recebido em Fábrica</option>
                          <option value="delayed">⚠️ Em Atraso</option>
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onEditTask(t)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
