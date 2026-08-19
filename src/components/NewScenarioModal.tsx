import React, { useState } from 'react';
import { PlanningScenario } from '../types';
import { X, GitBranch, Save } from 'lucide-react';

interface NewScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: PlanningScenario[];
  activeScenarioId: string;
  onCreateScenario: (name: string, description: string, sourceScenarioId: string) => void;
}

export const NewScenarioModal: React.FC<NewScenarioModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  activeScenarioId,
  onCreateScenario,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceScenarioId, setSourceScenarioId] = useState(activeScenarioId);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateScenario(name.trim(), description.trim(), sourceScenarioId);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">Salvar Novo Cenário de Planejamento</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nome do Cenário <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Cenário 4 - Turno Noturno no Torno CNC e Oxicorte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Descrição / Premissas da Versão
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Considera contratação de 2 novos operadores e adiamento do projeto ITUPORANGA em 2 semanas para eliminação de gargalos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Base de Origem dos Dados
            </label>
            <select
              value={sourceScenarioId}
              onChange={(e) => setSourceScenarioId(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="current">--- Usar Alterações Atuais da Tela ---</option>
              {scenarios.map((scen) => (
                <option key={scen.id} value={scen.id}>
                  Clonar de: {scen.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Se você selecionou "Usar Alterações Atuais da Tela", o novo cenário copiará o estado exato dos projetos e centros de trabalho que você modificou.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Criar Cenário</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
