import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  FileJson,
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Layers,
  Calendar,
  Sparkles,
  Info,
  Database,
  ArrowRight,
  RefreshCw,
  Clock,
  Briefcase,
  FileText,
} from 'lucide-react';
import { WorkCenter, Project, PlanningScenario } from '../types';
import {
  analyzeAndParseJson,
  generateFullExportJson,
  generateErpMatrixJson,
  JSON_TEMPLATES,
  ParsedJsonResult,
} from '../utils/jsonImportExportHelper';

export interface ImportPayload {
  mode: 'replace_current' | 'create_new_scenario' | 'replace_all_scenarios';
  workCenters: WorkCenter[];
  projects: Project[];
  sectorGroups: string[];
  scenarios?: PlanningScenario[];
  activeScenarioId?: string;
  scenarioName?: string;
}

interface JsonImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workCenters: WorkCenter[];
  projects: Project[];
  sectorGroups: string[];
  scenarios: PlanningScenario[];
  activeScenarioId: string;
  onImportComplete: (payload: ImportPayload) => void;
  onOpenMatrixModal?: () => void;
}

export const JsonImportExportModal: React.FC<JsonImportExportModalProps> = ({
  isOpen,
  onClose,
  workCenters,
  projects,
  sectorGroups,
  scenarios,
  activeScenarioId,
  onImportComplete,
  onOpenMatrixModal,
}) => {
  const [modalTab, setModalTab] = useState<'export' | 'import' | 'schema'>('import');

  // Export States
  const [exportFormat, setExportFormat] = useState<'full_v2' | 'erp_matrix'>('full_v2');
  const [includeAllScenarios, setIncludeAllScenarios] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);

  // Import States
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'replace_current' | 'create_new_scenario' | 'replace_all_scenarios'>('replace_current');
  const [newScenarioName, setNewScenarioName] = useState('Cenário Importado');

  // Generate current export string dynamically based on selections
  const generatedExportJson = useMemo(() => {
    if (exportFormat === 'erp_matrix') {
      return generateErpMatrixJson(projects);
    }
    return generateFullExportJson({
      workCenters,
      projects,
      sectorGroups,
      scenarios,
      activeScenarioId,
      includeAllScenarios,
    });
  }, [
    exportFormat,
    includeAllScenarios,
    workCenters,
    projects,
    sectorGroups,
    scenarios,
    activeScenarioId,
  ]);

  // Live analysis of import text
  const parseResult: ParsedJsonResult | null = useMemo(() => {
    if (!importText.trim()) return null;
    return analyzeAndParseJson(importText);
  }, [importText]);

  // Automatically update import mode recommendation when format changes
  useEffect(() => {
    if (parseResult?.detectedFormat === 'scenarios_bundle') {
      setImportMode('replace_all_scenarios');
    } else if (parseResult?.success) {
      if (importMode === 'replace_all_scenarios') {
        setImportMode('replace_current');
      }
    }
  }, [parseResult?.detectedFormat]);

  if (!isOpen) return null;

  const handleCopyExport = () => {
    navigator.clipboard.writeText(generatedExportJson);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    const blob = new Blob([generatedExportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const prefix = exportFormat === 'erp_matrix' ? 'carga_maquina_matriz_erp' : 'carga_maquina_estrutura_v2';
    a.href = url;
    a.download = `${prefix}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
        setModalTab('import');
      }
    };
    reader.readAsText(file);
  };

  const handleBeautifyImport = () => {
    try {
      const parsed = JSON.parse(importText);
      setImportText(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore if invalid
    }
  };

  const handleLoadTemplate = (type: 'full_v2' | 'legacy_erp') => {
    setImportText(JSON_TEMPLATES[type]);
    setModalTab('import');
  };

  const handleConfirmImport = () => {
    if (!parseResult || !parseResult.success) return;

    onImportComplete({
      mode: importMode,
      workCenters: parseResult.workCenters,
      projects: parseResult.projects,
      sectorGroups: parseResult.sectorGroups,
      scenarios: parseResult.scenarios,
      activeScenarioId: parseResult.activeScenarioId,
      scenarioName: newScenarioName.trim() || 'Cenário Importado',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Importação & Exportação JSON</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                  Estrutura v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Centros com Agrupadores, Cronogramas por Setor, Horas e Cenários de Planejamento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 -mb-px">
            <button
              onClick={() => setModalTab('import')}
              className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                modalTab === 'import'
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Importar Dados</span>
              {parseResult?.success && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setModalTab('export')}
              className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                modalTab === 'export'
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Exportar / Backup</span>
            </button>

            <button
              onClick={() => setModalTab('schema')}
              className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                modalTab === 'schema'
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Guia de Estrutura & Modelos</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-medium py-2">
            <span>
              {workCenters.length} Centros | {projects.length} Projetos | {sectorGroups.length} Agrupadores
            </span>
          </div>
        </div>

        {/* Body Content Area */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5 bg-slate-50/50">
          {/* TAB 1: IMPORT */}
          {modalTab === 'import' && (
            <div className="space-y-4">
              {/* Spreadsheet Import Promotion Banner */}
              {onOpenMatrixModal && (
                <div className="bg-linear-to-r from-indigo-50 to-emerald-50 border border-indigo-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        Novo Importador de Planilha (Projetos & Centros em Matriz CSV / Excel)
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Importe tabelas onde cada linha é um projeto e as colunas são centros de trabalho com ajuste de Curva S e vinculação de postos.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenMatrixModal();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <span>Abrir Importador de Planilha</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Import Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg cursor-pointer transition-colors border border-indigo-200 shadow-2xs">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span>Carregar Arquivo .json</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => handleLoadTemplate('full_v2')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-300"
                    title="Preenche o campo com um modelo estruturado v2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Usar Exemplo Completo</span>
                  </button>

                  <button
                    onClick={() => handleLoadTemplate('legacy_erp')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-300"
                    title="Preenche com a matriz tradicional por projeto"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    <span>Usar Matriz ERP</span>
                  </button>
                </div>

                {importText.trim() && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBeautifyImport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-lg transition-colors hover:bg-slate-100 border border-slate-200"
                      title="Formatar identação do código JSON"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Formatar JSON</span>
                    </button>
                    <button
                      onClick={() => setImportText('')}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              {/* JSON Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold">Cole o código JSON abaixo:</span>
                  <span className="text-[11px] text-slate-500">
                    Formatos aceitos: Estrutura Completa v2.0, Multi-Cenários ou Matriz de Projetos ERP
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={10}
                    className="w-full font-mono text-xs p-3.5 bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner leading-relaxed resize-y"
                    placeholder="Cole seu código JSON aqui ou clique em 'Carregar Arquivo .json'..."
                  />
                  {!importText && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500 text-xs">
                      Arraste um arquivo .json ou cole os dados aqui
                    </div>
                  )}
                </div>
              </div>

              {/* Real-time Diagnostics & Structure Inspection Card */}
              {parseResult && (
                <div
                  className={`rounded-xl border p-4 transition-all shadow-2xs ${
                    parseResult.success
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50/80 border-rose-300 text-rose-950'
                  }`}
                >
                  {parseResult.success ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <h4 className="font-bold text-sm text-emerald-900">
                            JSON Válido Detectado: {parseResult.formatDescription}
                          </h4>
                        </div>
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-200/70 text-emerald-900 rounded-full border border-emerald-300">
                          Pronto para Importação
                        </span>
                      </div>

                      {/* Detected Stats Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-xs text-slate-500 font-medium">Projetos</div>
                          <div className="text-base font-bold text-slate-800">
                            {parseResult.stats.projectsCount}
                          </div>
                        </div>

                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-xs text-slate-500 font-medium">Centros Trabalho</div>
                          <div className="text-base font-bold text-slate-800">
                            {parseResult.stats.workCentersCount}
                          </div>
                        </div>

                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-xs text-slate-500 font-medium">Agrupadores</div>
                          <div className="text-base font-bold text-slate-800">
                            {parseResult.stats.sectorGroupsCount}
                          </div>
                        </div>

                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-xs text-slate-500 font-medium">Datas Setor?</div>
                          <div className="text-xs font-bold text-indigo-700 mt-1">
                            {parseResult.stats.hasGroupDates ? 'Sim (Detalhadas)' : 'Datas Gerais'}
                          </div>
                        </div>

                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-xs text-slate-500 font-medium">Carga Total</div>
                          <div className="text-xs font-bold text-slate-800 mt-1">
                            {parseResult.stats.totalHours.toLocaleString()}h
                          </div>
                        </div>
                      </div>

                      {/* Import Destination Options */}
                      <div className="pt-2 border-t border-emerald-200/80 space-y-2">
                        <div className="text-xs font-bold text-slate-700">
                          Como você deseja aplicar os dados importados?
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                              importMode === 'replace_current'
                                ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-medium'
                                : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'replace_current'}
                              onChange={() => setImportMode('replace_current')}
                              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="text-xs font-bold">Substituir Cenário Ativo</div>
                              <div className="text-[11px] text-slate-500">
                                Atualiza os centros, projetos e agrupadores na visão atual.
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                              importMode === 'create_new_scenario'
                                ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-medium'
                                : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'create_new_scenario'}
                              onChange={() => setImportMode('create_new_scenario')}
                              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1">
                              <div className="text-xs font-bold">Criar como Novo Cenário</div>
                              <div className="text-[11px] text-slate-500">
                                Mantém os cenários atuais e cria uma nova versão isolada.
                              </div>
                            </div>
                          </label>
                        </div>

                        {importMode === 'create_new_scenario' && (
                          <div className="pt-1 flex items-center gap-2">
                            <label className="text-xs font-semibold text-slate-700 shrink-0">
                              Nome do Cenário:
                            </label>
                            <input
                              type="text"
                              value={newScenarioName}
                              onChange={(e) => setNewScenarioName(e.target.value)}
                              placeholder="Ex: Importação ERP Linha 2"
                              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                            />
                          </div>
                        )}

                        {parseResult.detectedFormat === 'scenarios_bundle' && (
                          <label
                            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                              importMode === 'replace_all_scenarios'
                                ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-medium'
                                : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'replace_all_scenarios'}
                              onChange={() => setImportMode('replace_all_scenarios')}
                              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="text-xs font-bold">
                                Restaurar Pacote com Todos os {parseResult.stats.scenariosCount} Cenários
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Substitui toda a base de cenários pela contida no arquivo.
                              </div>
                            </div>
                          </label>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs text-rose-900">
                          Não foi possível interpretar o JSON
                        </h4>
                        <p className="text-xs text-rose-700 font-mono">
                          {parseResult.error}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPORT */}
          {modalTab === 'export' && (
            <div className="space-y-4">
              {/* Format selection */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  Selecione o Formato de Exportação:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat('full_v2')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      exportFormat === 'full_v2'
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-2xs ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-indigo-600" />
                        Estrutura Completa v2.0 (Recomendado)
                      </span>
                      {exportFormat === 'full_v2' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Preserva tudo: Centros com Agrupadores, Capacidades, Projetos com Datas por Setor (groupDates) e Cenários.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('erp_matrix')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      exportFormat === 'erp_matrix'
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-2xs ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-slate-600" />
                        Matriz de Carga ERP (Horas por Projeto)
                      </span>
                      {exportFormat === 'erp_matrix' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Formato tradicional compatível com exportações diretas de ERP e planilhas tabulares.
                    </p>
                  </button>
                </div>

                {exportFormat === 'full_v2' && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeAllScenarios}
                        onChange={(e) => setIncludeAllScenarios(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        Incluir todos os {scenarios.length} cenários salvos no pacote de backup
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Prévia do JSON ({Math.round(generatedExportJson.length / 1024)} KB):
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyExport}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    {exportCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Copiado com Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-300" />
                        <span>Copiar JSON</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadExport}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Arquivo .json</span>
                  </button>
                </div>
              </div>

              {/* Export Code Viewer */}
              <div className="relative">
                <textarea
                  readOnly
                  value={generatedExportJson}
                  rows={12}
                  className="w-full font-mono text-xs p-3.5 bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-700 shadow-inner leading-relaxed resize-y select-all"
                />
              </div>
            </div>
          )}

          {/* TAB 3: SCHEMA & DOCUMENTATION */}
          {modalTab === 'schema' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-indigo-900">
                  <Info className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-bold text-sm">
                    Estrutura de Dados Suportada na Versão Atual
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      1. Centros de Trabalho & Agrupadores
                    </div>
                    <p className="leading-relaxed">
                      Cada centro de trabalho contém:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 font-mono">
                      <li><strong>name</strong>: Nome da máquina ou posto</li>
                      <li><strong>category</strong>: Agrupador de setor (ex: CORTE, CALDEIRARIA)</li>
                      <li><strong>resourcesCount</strong>: Qtde de operadores/máquinas</li>
                      <li><strong>dailyHours / daysPerWeek</strong>: Turno de trabalho</li>
                      <li><strong>efficiencyPercentage</strong>: Eficiência (OEE)</li>
                    </ul>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      2. Projetos & Cronograma por Setor
                    </div>
                    <p className="leading-relaxed">
                      Projetos suportam datas independentes por agrupador:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 font-mono">
                      <li><strong>startDate / endDate</strong>: Janela global do projeto</li>
                      <li><strong>groupDates</strong>: Escalonamento por setor (CORTE: datas, etc.)</li>
                      <li><strong>workCenterHours</strong>: Horas exigidas em cada centro</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Quer testar ou preencher seus próprios dados?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoadTemplate('full_v2')}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors"
                    >
                      Carregar Modelo Completo v2.0
                    </button>
                    <button
                      onClick={() => handleLoadTemplate('legacy_erp')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
                    >
                      Carregar Modelo ERP
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {modalTab === 'import' && parseResult?.success && (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Estrutura validada com sucesso!
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Fechar
            </button>

            {modalTab === 'import' && (
              <button
                onClick={handleConfirmImport}
                disabled={!parseResult || !parseResult.success}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
                  parseResult && parseResult.success
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200 ring-2 ring-indigo-400'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <span>Importar & Aplicar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {modalTab === 'export' && (
              <button
                onClick={handleDownloadExport}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Arquivo .json</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
