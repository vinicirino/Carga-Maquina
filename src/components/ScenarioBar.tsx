import React from 'react';
import { PlanningScenario } from '../types';
import {
  GitBranch,
  Save,
  Plus,
  Copy,
  BarChart3,
  Settings2,
  CheckCircle2,
  AlertCircle,
  FolderSync,
  FileDown,
  FileUp,
} from 'lucide-react';

interface ScenarioBarProps {
  scenarios: PlanningScenario[];
  activeScenarioId: string;
  isModified: boolean;
  onSelectScenario: (id: string) => void;
  onSaveCurrentScenario: () => void;
  onOpenNewScenarioModal: () => void;
  onDuplicateCurrentScenario: () => void;
  onOpenCompareModal: () => void;
  onOpenManagerModal: () => void;
  onOpenImportExportModal?: (tab?: 'export' | 'import') => void;
}

export const ScenarioBar: React.FC<ScenarioBarProps> = ({
  scenarios,
  activeScenarioId,
  isModified,
  onSelectScenario,
  onSaveCurrentScenario,
  onOpenNewScenarioModal,
  onDuplicateCurrentScenario,
  onOpenCompareModal,
  onOpenManagerModal,
  onOpenImportExportModal,
}) => {
  const activeScenario =
    scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white py-2 px-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: Active Scenario Selector & Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg font-black uppercase tracking-wider text-[11px] shrink-0">
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            <span>Cenário Ativo:</span>
          </div>

          <div className="relative shrink-0">
            <select
              value={activeScenarioId}
              onChange={(e) => onSelectScenario(e.target.value)}
              className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg border border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-xs truncate"
            >
              {scenarios.map((scen) => (
                <option key={scen.id} value={scen.id} className="bg-slate-900 text-white py-1">
                  {scen.name} {scen.isBaseline ? ' (Padrão)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Modification Badge */}
          {isModified ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-extrabold animate-pulse">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>Alterações não salvas no cenário</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Sincronizado com o cenário</span>
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          {/* Save changes to current scenario */}
          <button
            onClick={onSaveCurrentScenario}
            disabled={!isModified}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              isModified
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
            title="Salvar alterações no cenário ativo"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Alterações</span>
          </button>

          {/* New Scenario */}
          <button
            onClick={onOpenNewScenarioModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            title="Criar novo cenário de planejamento a partir do estado atual"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Cenário</span>
          </button>

          {/* Duplicate Current */}
          <button
            onClick={onDuplicateCurrentScenario}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
            title="Duplicar o cenário ativo como nova versão"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span>Duplicar</span>
          </button>

          {/* Compare Scenarios */}
          <button
            onClick={onOpenCompareModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/40 hover:bg-purple-900/70 text-purple-200 border border-purple-500/30 font-bold rounded-lg transition-colors cursor-pointer"
            title="Comparar indicadores entre todos os cenários salvos"
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            <span>Comparar ({scenarios.length})</span>
          </button>

          {/* Export / Import Scenario */}
          {onOpenImportExportModal && (
            <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => onOpenImportExportModal('export')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors cursor-pointer text-xs font-semibold"
                title="Exportar Cenário (.json)"
              >
                <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                <span>Exportar</span>
              </button>
              <button
                onClick={() => onOpenImportExportModal('import')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors cursor-pointer text-xs font-semibold"
                title="Importar Cenário (.json)"
              >
                <FileUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Importar</span>
              </button>
            </div>
          )}

          {/* Manage Scenarios */}
          <button
            onClick={onOpenManagerModal}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Gerenciar, renomear e excluir cenários"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
