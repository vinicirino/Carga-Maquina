import React, { useState } from 'react';
import { PlanningScenario } from '../types';
import { X, GitBranch, Save, FilePlus, Copy, Sparkles, Layers, Factory } from 'lucide-react';

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
  const [creationMode, setCreationMode] = useState<'blank' | 'clone'>('blank');
  const [sourceScenarioId, setSourceScenarioId] = useState(activeScenarioId);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const chosenSource = creationMode === 'blank' ? 'blank' : sourceScenarioId;
    onCreateScenario(name.trim(), description.trim(), chosenSource);
    setName('');
    setDescription('');
    setCreationMode('blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">Novo Cenário de Planejamento</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Choice: Blank vs Clone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tipo de Início do Cenário
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCreationMode('blank')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  creationMode === 'blank'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <FilePlus className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Em Branco (0 Projetos)</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Inicia sem nenhum projeto. Ideal para montar carteira do zero mantendo a fábrica.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCreationMode('clone')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  creationMode === 'clone'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Copy className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Clonar de Cenário</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Copia todos os projetos e cronogramas de um cenário existente para simulação.
                </p>
              </button>
            </div>
          </div>

          {/* Conditional Clone Selector */}
          {creationMode === 'clone' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Cenário de Origem
              </label>
              <select
                value={sourceScenarioId}
                onChange={(e) => setSourceScenarioId(e.target.value)}
                className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="current">📋 Usar Estado Atual da Tela</option>
                {scenarios.map((scen) => (
                  <option key={scen.id} value={scen.id}>
                    Clonar: {scen.name} ({scen.projects.length} projetos) {scen.isBaseline ? '⭐ Padrão' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scenario Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nome do Novo Cenário <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={
                creationMode === 'blank'
                  ? 'Ex: Cenário Limpo 2026 - Nova Carteira'
                  : 'Ex: Cenário 4 - Turno Noturno no Torno CNC'
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Descrição / Premissas da Versão
            </label>
            <textarea
              rows={3}
              placeholder={
                creationMode === 'blank'
                  ? 'Ex: Cenário limpo para simular entrada de novos contratos de hidrogeração sem projetos legados...'
                  : 'Ex: Considera contratação de 2 novos operadores e adiamento do projeto ITUPORANGA em 2 semanas...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
              <span>Criar Cenário {creationMode === 'blank' ? 'em Branco' : ''}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
