import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  FileJson,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  GitBranch,
  Calendar,
  Layers,
  Factory,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FolderSync,
  HelpCircle,
  FileDown,
  FileUp,
} from 'lucide-react';
import { PlanningScenario, WorkCenter, Project } from '../types';
import {
  exportSingleScenarioToJson,
  exportAllScenariosToJson,
  downloadScenarioFile,
  downloadAllScenariosFile,
  parseScenarioJson,
  ParsedScenarioResult,
} from '../utils/scenarioImportExportHelper';

export interface ScenarioImportPayload {
  mode: 'replace_current' | 'create_new_scenario' | 'replace_all_scenarios' | 'append_scenarios';
  scenario?: PlanningScenario;
  scenarios?: PlanningScenario[];
  activeScenarioId?: string;
  customScenarioName?: string;
}

interface ScenarioImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: PlanningScenario[];
  activeScenarioId: string;
  currentWorkCenters: WorkCenter[];
  currentProjects: Project[];
  currentSectorGroups: string[];
  onImportScenario: (payload: ScenarioImportPayload) => void;
  initialTab?: 'export' | 'import';
}

export const ScenarioImportExportModal: React.FC<ScenarioImportExportModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  activeScenarioId,
  currentWorkCenters,
  currentProjects,
  currentSectorGroups,
  onImportScenario,
  initialTab = 'export',
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  // Export state
  const [selectedExportScenarioId, setSelectedExportScenarioId] = useState<string>(activeScenarioId);
  const [exportMode, setExportMode] = useState<'single' | 'bundle'>('single');
  const [copied, setCopied] = useState(false);

  // Import state
  const [importText, setImportText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importMode, setImportMode] = useState<'create_new_scenario' | 'replace_current' | 'replace_all_scenarios'>('create_new_scenario');
  const [customName, setCustomName] = useState('');

  // Target scenario for export
  const targetExportScenario = useMemo(() => {
    // If active scenario is selected, use live state from current session to ensure latest unsaved edits are captured
    if (selectedExportScenarioId === activeScenarioId) {
      const activeScen = scenarios.find((s) => s.id === activeScenarioId);
      return {
        id: activeScenarioId,
        name: activeScen?.name || 'Cenário Ativo',
        description: activeScen?.description || '',
        createdAt: activeScen?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBaseline: Boolean(activeScen?.isBaseline),
        workCenters: currentWorkCenters,
        projects: currentProjects,
        sectorGroups: currentSectorGroups,
      } as PlanningScenario;
    }
    return (
      scenarios.find((s) => s.id === selectedExportScenarioId) ||
      scenarios[0]
    );
  }, [scenarios, selectedExportScenarioId, activeScenarioId, currentWorkCenters, currentProjects, currentSectorGroups]);

  // Generated export JSON
  const generatedExportJson = useMemo(() => {
    if (exportMode === 'bundle') {
      return exportAllScenariosToJson(scenarios, activeScenarioId, currentSectorGroups);
    }
    if (!targetExportScenario) return '';
    return exportSingleScenarioToJson(targetExportScenario);
  }, [exportMode, targetExportScenario, scenarios, activeScenarioId, currentSectorGroups]);

  // Live import analysis
  const parseResult: ParsedScenarioResult | null = useMemo(() => {
    if (!importText.trim()) return null;
    return parseScenarioJson(importText);
  }, [importText]);

  // Sync default import name when file is parsed
  React.useEffect(() => {
    if (parseResult?.success && parseResult.stats.scenarioName) {
      if (!customName || customName === 'Cenário Importado') {
        setCustomName(parseResult.stats.scenarioName);
      }
      if (parseResult.isBundle) {
        setImportMode('replace_all_scenarios');
      } else {
        setImportMode('create_new_scenario');
      }
    }
  }, [parseResult?.success, parseResult?.stats.scenarioName, parseResult?.isBundle]);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    if (!generatedExportJson) return;
    navigator.clipboard.writeText(generatedExportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (exportMode === 'bundle') {
      downloadAllScenariosFile(scenarios, activeScenarioId, currentSectorGroups);
    } else if (targetExportScenario) {
      downloadScenarioFile(targetExportScenario);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setImportText(content);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleBeautify = () => {
    try {
      const parsed = JSON.parse(importText);
      setImportText(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore
    }
  };

  const handleConfirmImport = () => {
    if (!parseResult || !parseResult.success) return;

    if (parseResult.isBundle && parseResult.scenarios) {
      onImportScenario({
        mode: importMode === 'replace_all_scenarios' ? 'replace_all_scenarios' : 'append_scenarios',
        scenarios: parseResult.scenarios,
        activeScenarioId: parseResult.activeScenarioId,
      });
    } else if (parseResult.singleScenario) {
      const finalScenario: PlanningScenario = {
        ...parseResult.singleScenario,
        name: customName.trim() || parseResult.singleScenario.name,
      };

      onImportScenario({
        mode: importMode as any,
        scenario: finalScenario,
        customScenarioName: customName.trim() || parseResult.singleScenario.name,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Importar & Exportar Cenários</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                  Formato .JSON
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gere e importe arquivos completos contendo centros, projetos, horas e cronogramas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 -mb-px">
            <button
              onClick={() => setActiveTab('export')}
              className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'export'
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar Cenário (.json)</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'import'
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>Importar Cenário (.json)</span>
              {parseResult?.success && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
            {scenarios.length} cenários salvos no sistema
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5 bg-slate-50/50">
          {/* TAB 1: EXPORTAR */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Scenario Selector & Mode */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800">
                    Selecione o que deseja exportar:
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExportMode('single')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        exportMode === 'single'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Cenário Único
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportMode('bundle')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        exportMode === 'bundle'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todos os Cenários ({scenarios.length})
                    </button>
                  </div>
                </div>

                {exportMode === 'single' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cenário para Exportação
                    </label>
                    <select
                      value={selectedExportScenarioId}
                      onChange={(e) => setSelectedExportScenarioId(e.target.value)}
                      className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {scenarios.map((scen) => (
                        <option key={scen.id} value={scen.id}>
                          {scen.name} {scen.id === activeScenarioId ? ' (Ativo no Momento)' : ''} {scen.isBaseline ? ' ⭐ (Baseline)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Details of export */}
                {exportMode === 'single' && targetExportScenario && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Projetos</div>
                      <div className="text-sm font-black text-slate-800">
                        {targetExportScenario.projects.length}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Centros</div>
                      <div className="text-sm font-black text-slate-800">
                        {targetExportScenario.workCenters.length}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Carga Total</div>
                      <div className="text-sm font-black text-indigo-700">
                        {targetExportScenario.projects.reduce((acc, p) => {
                          const values = Object.values(p.workCenterHours || {});
                          let pSum = 0;
                          for (const v of values) {
                            pSum += Number(v) || 0;
                          }
                          return acc + pSum;
                        }, 0).toLocaleString()}h
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Agrupadores</div>
                      <div className="text-sm font-black text-slate-800">
                        {(targetExportScenario.sectorGroups || []).length}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500 font-medium">
                  Arquivo gerado ({Math.round(generatedExportJson.length / 1024)} KB):
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-300" />
                        <span>Copiar JSON</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Arquivo .json</span>
                  </button>
                </div>
              </div>

              {/* Code Preview */}
              <div className="relative">
                <textarea
                  readOnly
                  value={generatedExportJson}
                  rows={10}
                  className="w-full font-mono text-xs p-3.5 bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-700 shadow-inner leading-relaxed resize-y select-all"
                />
              </div>
            </div>
          )}

          {/* TAB 2: IMPORTAR */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Drag & Drop or Upload Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`p-6 border-2 border-dashed rounded-2xl text-center transition-all bg-white flex flex-col items-center justify-center gap-3 ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-400'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-800">
                    Arraste o arquivo <span className="text-indigo-600 font-mono">.json</span> do cenário aqui
                  </h4>
                  <p className="text-xs text-slate-500">
                    ou clique no botão abaixo para escolher do seu computador
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs">
                    <FileUp className="w-4 h-4" />
                    <span>Selecionar Arquivo .json</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {importText.trim() && (
                    <button
                      onClick={handleBeautify}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Formatar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Textarea for pasting */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold">Ou cole o conteúdo JSON diretamente:</span>
                  {importText.trim() && (
                    <button
                      onClick={() => setImportText('')}
                      className="text-rose-600 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
                    >
                      Limpar Texto
                    </button>
                  )}
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={6}
                  placeholder="Cole o código JSON do cenário exportado aqui..."
                  className="w-full font-mono text-xs p-3.5 bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-y"
                />
              </div>

              {/* Real-Time Diagnostic Analysis */}
              {parseResult && (
                <div
                  className={`rounded-xl border p-4 transition-all shadow-2xs ${
                    parseResult.success
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50/90 border-rose-300 text-rose-950'
                  }`}
                >
                  {parseResult.success ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <h4 className="font-bold text-sm text-emerald-900">
                              Cenário Válido: "{parseResult.stats.scenarioName || 'Cenário'}"
                            </h4>
                            <p className="text-[11px] text-emerald-700">
                              {parseResult.formatDescription}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-200/80 text-emerald-900 rounded-full border border-emerald-300">
                          Pronto para Carregar
                        </span>
                      </div>

                      {/* Stat Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Projetos</div>
                          <div className="text-base font-black text-slate-800">
                            {parseResult.stats.projectsCount}
                          </div>
                        </div>
                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Centros</div>
                          <div className="text-base font-black text-slate-800">
                            {parseResult.stats.workCentersCount}
                          </div>
                        </div>
                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Carga Total</div>
                          <div className="text-base font-black text-indigo-700">
                            {parseResult.stats.totalHours.toLocaleString()}h
                          </div>
                        </div>
                        <div className="bg-white/80 border border-emerald-200 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Datas por Setor</div>
                          <div className="text-xs font-bold text-slate-800 mt-1">
                            {parseResult.stats.hasGroupDates ? 'Sim (Detalhadas)' : 'Datas Gerais'}
                          </div>
                        </div>
                      </div>

                      {/* Import Options */}
                      <div className="pt-3 border-t border-emerald-200 space-y-2">
                        <div className="text-xs font-bold text-slate-800">
                          Escolha o modo de importação:
                        </div>

                        {!parseResult.isBundle ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label
                              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                                importMode === 'create_new_scenario'
                                  ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-medium shadow-2xs'
                                  : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="radio"
                                name="scenarioImportMode"
                                checked={importMode === 'create_new_scenario'}
                                onChange={() => setImportMode('create_new_scenario')}
                                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <div className="text-xs font-bold">Adicionar como Novo Cenário</div>
                                <div className="text-[11px] text-slate-500">
                                  Preserva seus outros cenários e cria uma nova versão isolada.
                                </div>
                              </div>
                            </label>

                            <label
                              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                                importMode === 'replace_current'
                                  ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-medium shadow-2xs'
                                  : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="radio"
                                name="scenarioImportMode"
                                checked={importMode === 'replace_current'}
                                onChange={() => setImportMode('replace_current')}
                                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <div className="text-xs font-bold">Substituir Cenário Ativo</div>
                                <div className="text-[11px] text-slate-500">
                                  Sobrescreve os dados do cenário que está aberto agora.
                                </div>
                              </div>
                            </label>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label
                              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                                importMode === 'replace_all_scenarios'
                                  ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-medium shadow-2xs'
                                  : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="radio"
                                name="scenarioImportMode"
                                checked={importMode === 'replace_all_scenarios'}
                                onChange={() => setImportMode('replace_all_scenarios')}
                                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <div className="text-xs font-bold">Substituir Todos os Cenários</div>
                                <div className="text-[11px] text-slate-500">
                                  Carrega os {parseResult.stats.scenariosCount} cenários exatamente como no pacote.
                                </div>
                              </div>
                            </label>
                          </div>
                        )}

                        {importMode === 'create_new_scenario' && (
                          <div className="pt-2 flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 shrink-0">
                              Nome do Novo Cenário:
                            </label>
                            <input
                              type="text"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              placeholder="Nome do cenário..."
                              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs text-rose-900">
                          Erro ao analisar arquivo
                        </h4>
                        <p className="text-xs text-rose-700">
                          {parseResult.error}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'export' ? (
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Cenário (.json)</span>
              </button>
            ) : (
              <button
                onClick={handleConfirmImport}
                disabled={!parseResult || !parseResult.success}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
                  parseResult && parseResult.success
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200 ring-2 ring-indigo-400'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <span>Importar & Aplicar Cenário</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
