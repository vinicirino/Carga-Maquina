import React from 'react';
import {
  X,
  Trash2,
  RotateCcw,
  Sparkles,
  Database,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { WorkCenter, DEFAULT_SECTOR_GROUPS } from '../types';

interface DatabaseResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetToDemo: () => void;
  onResetToCleanCompanyState: () => void;
  onRestoreOfficialBaseline: () => void;
  onHardClearStorage: () => void;
  hasOfficialBaseline: boolean;
  currentProjectsCount: number;
  currentWorkCentersCount: number;
}

export const DatabaseResetModal: React.FC<DatabaseResetModalProps> = ({
  isOpen,
  onClose,
  onResetToDemo,
  onResetToCleanCompanyState,
  onRestoreOfficialBaseline,
  onHardClearStorage,
  hasOfficialBaseline,
  currentProjectsCount,
  currentWorkCentersCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                Gestão e Limpeza do Banco de Dados
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie o estado operacional, inicialize para produção ou restaure dados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Indicator */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span>
              Projetos atuais: <strong className="text-slate-900 font-bold">{currentProjectsCount}</strong>
            </span>
            <span>
              Centros cadastrados: <strong className="text-slate-900 font-bold">{currentWorkCentersCount}</strong>
            </span>
          </div>
          {hasOfficialBaseline && (
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Base Primária Oficial Salva
            </span>
          )}
        </div>

        {/* Action Cards */}
        <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Option 1: Clean Production State */}
          <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/40 hover:bg-indigo-50/70 transition-all flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Inicializar Base de Produção da Empresa (0 Projetos)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Zera todos os projetos de teste/demonstração e prepara o sistema limpo para você cadastrar ou importar os projetos reais da sua empresa via planilha Excel ou JSON.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Deseja limpar todos os projetos e inicializar a base limpa de produção para a sua empresa?'
                    )
                  ) {
                    onResetToCleanCompanyState();
                    onClose();
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Inicializar Base Limpa (Produção)
              </button>
            </div>
          </div>

          {/* Option 2: Restore Official Baseline */}
          {hasOfficialBaseline && (
            <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/40 hover:bg-emerald-50/70 transition-all flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">
                    Restaurar Base Primária Oficial Salva
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Restaura o estado gravado como a Base Oficial do PCP da sua empresa.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Deseja restaurar os dados para a Base Primária Oficial da sua empresa?'
                      )
                    ) {
                      onRestoreOfficialBaseline();
                      onClose();
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Restaurar Base Primária
                </button>
              </div>
            </div>
          )}

          {/* Option 3: Load Demo Sample Data */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 hover:bg-slate-100/70 transition-all flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-200 text-slate-700 rounded-lg shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Carregar Dados de Exemplo / Demonstração
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Carrega um conjunto de dados de exemplo com turbinas, múltiplos projetos e cenários simulados para treinamento e testes de visualização.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Deseja carregar o conjunto de dados de exemplo / demonstração?'
                    )
                  ) {
                    onResetToDemo();
                    onClose();
                  }
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Carregar Dados de Exemplo
              </button>
            </div>
          </div>

          {/* Option 4: Full Hard Reset */}
          <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/40 hover:bg-rose-50/70 transition-all flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Limpeza Completa do Armazenamento Local (Hard Reset)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Apaga todas as preferências, baselines salvas e chaves de armazenamento local do navegador e reinicia o aplicativo.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'ATENÇÃO: Isso apagará permanentemente todos os dados armazenados localmente no navegador. Tem certeza?'
                    )
                  ) {
                    onHardClearStorage();
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Limpar Todo o Armazenamento
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
