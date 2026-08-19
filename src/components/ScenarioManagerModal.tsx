import React, { useState } from 'react';
import { PlanningScenario } from '../types';
import {
  X,
  GitBranch,
  CheckCircle,
  Copy,
  Trash2,
  Edit2,
  Save,
  Star,
  Clock,
  Layers,
  Factory,
} from 'lucide-react';

interface ScenarioManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: PlanningScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onUpdateScenarioInfo: (id: string, name: string, description: string) => void;
  onSetBaselineScenario: (id: string) => void;
  onDuplicateScenario: (id: string) => void;
  onDeleteScenario: (id: string) => void;
}

export const ScenarioManagerModal: React.FC<ScenarioManagerModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onUpdateScenarioInfo,
  onSetBaselineScenario,
  onDuplicateScenario,
  onDeleteScenario,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  if (!isOpen) return null;

  const startEdit = (scen: PlanningScenario) => {
    setEditingId(scen.id);
    setEditName(scen.name);
    setEditDescription(scen.description);
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;
    onUpdateScenarioInfo(id, editName.trim(), editDescription.trim());
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">Gerenciador de Cenários de Planejamento</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Scenarios */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <p className="text-xs text-slate-600 font-medium">
            Alterne entre diferentes versões de capacidade e prazos para simular impactos no PCP, apresentar relatórios para a diretoria ou testar contratações e turnos extras.
          </p>

          <div className="space-y-3">
            {scenarios.map((scen) => {
              const isActive = scen.id === activeScenarioId;
              const isEditing = editingId === scen.id;

              return (
                <div
                  key={scen.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Nome do Cenário
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full text-xs font-bold px-3 py-1.5 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Descrição / Premissas
                        </label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => saveEdit(scen.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Salvar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-900">{scen.name}</h4>

                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-md uppercase tracking-wider">
                              <CheckCircle className="w-3 h-3" />
                              <span>Ativo no Sistema</span>
                            </span>
                          )}

                          {scen.isBaseline && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold rounded-md uppercase">
                              <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                              <span>Cenário Padrão (Baseline)</span>
                            </span>
                          )}
                        </div>

                        {scen.description && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {scen.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1 font-semibold">
                          <span className="flex items-center gap-1">
                            <Factory className="w-3 h-3 text-indigo-500" />
                            {scen.workCenters.length} Centros
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-indigo-500" />
                            {scen.projects.length} Projetos
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Atualizado em: {new Date(scen.updatedAt).toLocaleDateString('pt-BR')} às{' '}
                            {new Date(scen.updatedAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Actions for this scenario */}
                      <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                        {!isActive && (
                          <button
                            onClick={() => {
                              onSelectScenario(scen.id);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            Ativar Cenário
                          </button>
                        )}

                        <button
                          onClick={() => startEdit(scen)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar Nome e Descrição"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onDuplicateScenario(scen.id)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Duplicar Cenário"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {!scen.isBaseline && (
                          <button
                            onClick={() => onSetBaselineScenario(scen.id)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Definir como Cenário Padrão (Baseline)"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}

                        {scenarios.length > 1 && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Tem certeza que deseja excluir o cenário "${scen.name}"?`
                                )
                              ) {
                                onDeleteScenario(scen.id);
                              }
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Cenário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
