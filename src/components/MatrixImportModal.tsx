import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Layers,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  Briefcase,
  Sliders,
  Check,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FolderTree,
  Building2,
  CalendarRange,
} from 'lucide-react';
import { WorkCenter, Project, PlanningScenario } from '../types';
import { TurbineType } from '../types/turbine';
import { DEFAULT_TURBINE_TYPES } from '../data/defaultTurbines';
import {
  parseMatrixCsvText,
  parseMatrixBinaryFile,
  compileMatrixImport,
  MatrixParsedData,
  MatrixColumnMapping,
  MatrixProjectRow,
} from '../utils/matrixImportParser';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import { addWeeks, format, parseISO } from 'date-fns';

export interface MatrixImportPayload {
  mode: 'append' | 'replace_projects' | 'new_scenario';
  workCenters: WorkCenter[];
  projects: Project[];
  sectorGroups: string[];
  scenarioName?: string;
}

interface MatrixImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workCenters: WorkCenter[];
  projects: Project[];
  sectorGroups: string[];
  turbineTypes?: TurbineType[];
  onImportComplete: (payload: MatrixImportPayload) => void;
}

// Sample CSV embedded for quick 1-click test
const SAMPLE_CSV = `Rotulos de Linha;10010 MANDRILHADORA CNC WOTAN M3;10011 MANDRILHADORA CNC WOTAN CUTMAX 2 TT;10012 MANDRILHADORA CNC DIPLOMAT TK 6511B;10020 CENTRO DE USINAGEM GROB G500 5 EIXOS;10030 CENTRO DE USINAGEM HAAS 4 EIXOS VF - 9/50;6010  TORNO CNC LOGIC 500;6012  TORNO VERTICAL CNC D1M;6013 TORNO CNC VULCANIC 550;6014  TORNO CNC VULCANIC 1050;6015  TORNO VERTICAL CNC WOTAN TWTVI-2000;6016 TORNO VERTICAL CNC HACKER 6000;6017  TORNO VERTICAL CNC MORANDO 3000;6018 TORNO VERTICAL CNC CHINES D2M;6019 TORNO CNC ATLASMAQ TCGA-CK62145;7010 FRESADORA CNC PETRUS 90250R;7011  FRESADORA CNC SUNLIKE S3092;7012 FRESADORA CNC PETRUS 8013R;7014 FRESADORA CNC SUNLIKE S 2063;7015  FRESADORA CNC SUNLIKE BT-3000;7016 FRESADORA CNC MILLMASTER F-1250;7017 FRESADORA CNC MILLMASTER F-1500;7018  FRESADORA CNC MILLMASTER C 1000 L;7019 FRESADORA CNC ROUTER RC6090 ;9010 TORNO ROMI 30 B;9011 TORNO NARDINI AM 650 D;ALMOXARIFADO;CALDEIRARIA 01;CHANFRAMENTO;CONFORMACAO MECANICA;FORNOS;FRESADORAS ROUTER;FURADEIRA RADIAL STANKOIMPORT;GARANTIA DA QUALIDADE;JATEAMENTO;JATEAMENTO GRANDE PORTE;LIXAMENTO;MARCENARIA;METALIZACAO;MODELAGEM;MONTAGEM DE PROCESSO;MONTAGEM DISTRIBUIDORES;MONTAGEM ELETRICA;MONTAGEM GERADORES;MONTAGEM HIDRAULICA;MONTAGEM MANCAIS;MONTAGEM MECANICA 01;MONTAGEM ROTORES;MONTAGENS ESPECIAIS;OXICORTE CNC MULTI THERM 4000;OXIPIRA PLASMA HPR 400XD;PINTURA;PROJETO;REBARBAMENTO;RETIFICA ROTATIVA;ROBO CALDEIRARIA;ROBO DE POLIMENTO;ROBO DE SOLDAGEM;ROSQUEAMENTO;SERRAS;SERVICOS DE TERCEIROS;SOLDAGEM 01;SOLDAGEM POSICIONADOR DE SOLDA;TORNOS NARDINI 325
NOVA ERECHIM 1;107,74;66,61;50,15;97,57;120,44;21,98;53,61;8,79;24,01;116,28;77,14;46,72;38,55;49,56;41,02;11,63;18,56;16,34;19,11;50,42;68,72;28,56;2,03;3,99;71,51;4259,92;349,92;34,96;58,14;88,5;169,83;42,4;44,31;65,03;7,8;28,94;40,76;48,3;74,03;36,34;72,68;28,08;93,51;57,42;30,13;97,23;33,11;7,55;59,26;4,18;135,09;1383,27;45,06;16,33;102,68;18,66;24,68;181,59;16,09;4231,9;580,34;20,58;21,22
NOVA ERECHIM 2;67,8;66,61;50,15;93,07;73,08;21,98;43,25;8,32;24,01;116,28;54,66;49,2;38,55;49,56;15,5;58,99;15,76;16,34;44,63;42,48;54,56;28,56;2,03;3,99;71,51;4259,08;378,21;34,96;58,14;88,5;;42,4;43,08;65,03;5,41;28,94;;48,4;;36,34;72,68;22,97;93,51;29,07;25,81;89,07;33,11;7,55;59,17;3,99;128,35;;45,77;16,33;102,68;18,66;24,68;170,65;13,83;3557,86;586,74;30,16;19,28
NOVA ERECHIM 3;67,8;66,61;50,15;90,22;73,08;15,18;43,81;8,32;17,19;116,28;54,66;44,83;39,63;49,56;17,11;58,99;18,56;16,34;44,63;32,4;63,51;24,28;2,03;3,99;64,75;3939,02;383,97;35,31;58,14;88,5;;42,4;42,99;67,42;5,41;28,94;;48,4;;36,34;72,68;28,08;93,51;47,97;25,81;84,75;33,11;7,55;58,36;3,62;135,09;;44,13;16,33;102,68;18,66;24,68;173,56;12,45;3537,86;600,8;30,16;12
NOVA ERECHIM 4;67,8;66,61;50,15;90,22;73,08;15,18;41,39;8,32;17,19;116,28;55,86;44,83;39,63;49,56;15,38;58,99;18,56;16,34;44,63;32,4;63,51;24,28;2,03;3,99;64,75;3938,92;390,83;34,96;57,42;88,5;;42,4;42,95;65,03;5,41;28,94;;48,4;;36,34;72,68;22,97;93,51;19,62;25,81;84,75;33,11;7,55;58,67;3,62;128,35;;44,32;16,33;102,68;18,66;24,68;173,56;12,71;3137,86;604,26;30,16;12
NOVA ERECHIM 5;67,8;66,61;50,15;90,22;73,08;15,18;41,14;8,32;17,19;116,28;52,32;48,67;41,74;49,56;17,11;58,99;18,56;16,34;44,63;32,4;63,51;24,28;2,03;3,99;64,75;3939,02;392,54;46,56;63,11;88,5;;42,4;42,98;67,42;5,41;28,94;;48,4;;36,34;72,68;28,08;93,51;47,97;25,81;84,75;33,11;7,55;58,07;15,76;135,09;;49,79;16,33;112,86;18,66;25,93;174,78;12,61;3657,86;614,64;30,16;14`;

export const MatrixImportModal: React.FC<MatrixImportModalProps> = ({
  isOpen,
  onClose,
  workCenters,
  projects,
  sectorGroups,
  turbineTypes = DEFAULT_TURBINE_TYPES,
  onImportComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps: 1: Upload/Paste -> 2: Projects & Turbine S-Curve -> 3: WorkCenter Mapping -> 4: Review & Confirm
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Raw file / text state
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload');

  // Global project parameters
  const [globalTurbineTypeId, setGlobalTurbineTypeId] = useState<string>('francis');
  const [globalStartDate, setGlobalStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [globalDurationWeeks, setGlobalDurationWeeks] = useState<number>(16);
  const [globalStaggerWeeks, setGlobalStaggerWeeks] = useState<number>(2);

  // Parsed Data state
  const [parsedData, setParsedData] = useState<MatrixParsedData | null>(null);

  // Mapping filter in Step 3
  const [mappingFilter, setMappingFilter] = useState<'ALL' | 'UNMAPPED' | 'MAPPED'>('ALL');
  const [mappingSearch, setMappingSearch] = useState<string>('');

  // Import Destination Option
  const [importDestination, setImportDestination] = useState<'append' | 'replace_projects' | 'new_scenario'>('append');
  const [newScenarioName, setNewScenarioName] = useState('Importação Planilha de Projetos');

  // Reset wizard to Step 1 whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setInputText('');
      setFileName(null);
      setParsedData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    setStep(1);
    setParsedData(null);
    setInputText('');
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // Handle Text/File parsing
  const handleParseText = (text: string) => {
    setStep(1);
    setInputText(text);
    const parsed = parseMatrixCsvText(
      text,
      workCenters,
      sectorGroups,
      globalTurbineTypeId,
      globalStartDate
    );
    setParsedData(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Always reset to Step 1 when a new file is uploaded
    setStep(1);
    setFileName(file.name);
    const reader = new FileReader();

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleParseText(text);
      };
      reader.readAsText(file);
    } else {
      // Excel (.xlsx, .xls)
      reader.onload = (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        const parsed = parseMatrixBinaryFile(
          buffer,
          workCenters,
          sectorGroups,
          globalTurbineTypeId,
          globalStartDate
        );
        setStep(1);
        setParsedData(parsed);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Apply batch schedule to all projects in parsedData
  const handleApplyBatchSchedule = () => {
    if (!parsedData) return;
    const baseDate = parseISO(globalStartDate);

    const updatedProjects: MatrixProjectRow[] = parsedData.projectRows.map((p, idx) => {
      const pStart = addWeeks(baseDate, idx * globalStaggerWeeks);
      const pEnd = addWeeks(pStart, globalDurationWeeks);
      return {
        ...p,
        startDate: format(pStart, 'yyyy-MM-dd'),
        endDate: format(pEnd, 'yyyy-MM-dd'),
        turbineTypeId: globalTurbineTypeId,
      };
    });

    setParsedData({
      ...parsedData,
      projectRows: updatedProjects,
    });
  };

  // Update single project row in step 2
  const handleUpdateProjectRow = (idx: number, updates: Partial<MatrixProjectRow>) => {
    if (!parsedData) return;
    const updated = [...parsedData.projectRows];
    updated[idx] = { ...updated[idx], ...updates };
    setParsedData({
      ...parsedData,
      projectRows: updated,
    });
  };

  // Update single column mapping in step 3
  const handleUpdateMapping = (rawHeader: string, updates: Partial<MatrixColumnMapping>) => {
    if (!parsedData) return;
    const updatedMappings = parsedData.columnMappings.map((m) =>
      m.rawHeader === rawHeader ? { ...m, ...updates } : m
    );
    setParsedData({
      ...parsedData,
      columnMappings: updatedMappings,
    });
  };

  // Compile and finalize import
  const handleFinalizeImport = () => {
    if (!parsedData) return;

    const compiled = compileMatrixImport(
      parsedData,
      workCenters,
      sectorGroups,
      turbineTypes
    );

    onImportComplete({
      mode: importDestination,
      workCenters: compiled.updatedWorkCenters,
      projects: compiled.generatedProjects,
      sectorGroups: compiled.updatedSectorGroups,
      scenarioName: newScenarioName,
    });

    setStep(1);
    setParsedData(null);
    setInputText('');
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    onClose();
  };

  // Step 3 Filtering
  const filteredMappings = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.columnMappings.filter((m) => {
      const matchSearch =
        m.cleanName.toLowerCase().includes(mappingSearch.toLowerCase()) ||
        m.rawHeader.toLowerCase().includes(mappingSearch.toLowerCase());

      if (!matchSearch) return false;

      if (mappingFilter === 'UNMAPPED') {
        return m.action === 'CREATE_NEW' && !m.isExistingMatch;
      }
      if (mappingFilter === 'MAPPED') {
        return m.action === 'MAP_EXISTING';
      }
      return true;
    });
  }, [parsedData, mappingFilter, mappingSearch]);

  const unmappedCount = useMemo(() => {
    if (!parsedData) return 0;
    return parsedData.columnMappings.filter((m) => m.action === 'CREATE_NEW' && !m.isExistingMatch).length;
  }, [parsedData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>Importador de Projetos & Centros (Matriz CSV / Excel)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase font-bold">
                  Multi-Projetos
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Importe planilhas onde cada linha é um projeto e as colunas são as horas alocadas nos centros de trabalho.
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 shrink-0">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {/* Step 1 */}
            <div
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 cursor-pointer ${
                step === 1
                  ? 'text-indigo-600 font-black'
                  : step > 1
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                  step === 1
                    ? 'bg-indigo-600 text-white'
                    : step > 1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
              </div>
              <span className="text-xs">1. Arquivo / Dados</span>
            </div>

            <div className="w-12 h-0.5 bg-slate-200" />

            {/* Step 2 */}
            <div
              onClick={() => parsedData && setStep(2)}
              className={`flex items-center gap-2 ${
                parsedData ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              } ${
                step === 2
                  ? 'text-indigo-600 font-black'
                  : step > 2
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                  step === 2
                    ? 'bg-indigo-600 text-white'
                    : step > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
              </div>
              <span className="text-xs">2. Turbinas & Cronograma</span>
            </div>

            <div className="w-12 h-0.5 bg-slate-200" />

            {/* Step 3 */}
            <div
              onClick={() => parsedData && setStep(3)}
              className={`flex items-center gap-2 ${
                parsedData ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              } ${
                step === 3
                  ? 'text-indigo-600 font-black'
                  : step > 3
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                  step === 3
                    ? 'bg-indigo-600 text-white'
                    : step > 3
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step > 3 ? <Check className="w-3.5 h-3.5" /> : '3'}
              </div>
              <span className="text-xs">3. Centros & Setores</span>
            </div>

            <div className="w-12 h-0.5 bg-slate-200" />

            {/* Step 4 */}
            <div
              onClick={() => parsedData && setStep(4)}
              className={`flex items-center gap-2 ${
                parsedData ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              } ${step === 4 ? 'text-indigo-600 font-black' : 'text-slate-400'}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                  step === 4 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                4
              </div>
              <span className="text-xs">4. Revisão & Destino</span>
            </div>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: FILE / TEXT INPUT */}
          {step === 1 && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Selecione ou Cole a Planilha</h3>
                  <p className="text-xs text-slate-500">
                    Formato esperado: Linha 1 = Nomes dos Centros/Recursos. Linhas 2..N = Projetos com horas nas células.
                  </p>
                </div>

                {/* Switch between Upload or Paste */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setInputTab('upload')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      inputTab === 'upload' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    Upload (.xlsx / .csv)
                  </button>
                  <button
                    onClick={() => setInputTab('paste')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      inputTab === 'paste' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    Colar Texto
                  </button>
                </div>
              </div>

              {inputTab === 'upload' ? (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv, .xlsx, .xls, .txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="p-4 bg-indigo-100 text-indigo-700 rounded-2xl">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-800">
                        {fileName ? fileName : 'Clique para selecionar arquivo .xlsx, .xls ou .csv'}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Suporte nativo para matrizes de planejamento com números decimais e separadores brasileiros (;)
                      </p>
                    </div>
                  </div>

                  {/* Sample CSV Loader */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-bold text-xs text-slate-900">
                          Exemplo de Teste Rápido (Nova Erechim - 10 Projetos & 64 Centros)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Carregue a matriz de exemplo para testar todo o fluxo de importação imediatamente.
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleParseText(SAMPLE_CSV)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      Carregar Exemplo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={12}
                    value={inputText}
                    onChange={(e) => handleParseText(e.target.value)}
                    placeholder="Cole aqui o conteúdo CSV separado por ponto-e-vírgula (;) ou tabulações..."
                    className="w-full font-mono text-xs p-4 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>Separador detectado: <strong>{parsedData?.detectedDelimiter || ';'}</strong></span>
                    <button
                      onClick={() => handleParseText(SAMPLE_CSV)}
                      className="text-indigo-600 hover:underline font-bold"
                    >
                      Preencher com Exemplo Nova Erechim
                    </button>
                  </div>
                </div>
              )}

              {/* Parsed Summary Card */}
              {parsedData && parsedData.totalProjects > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-black text-xs text-emerald-950">
                        {parsedData.totalProjects} Projetos Detectados com Sucesso!
                      </div>
                      <div className="text-xs text-emerald-800">
                        {parsedData.totalColumns} Recursos/Centros de Trabalho • {Math.round(parsedData?.totalHoursSum || 0).toLocaleString('pt-BR')} horas totais
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <span>Avançar para Turbinas & Datas</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: TURBINE TYPE & TIMELINE CONFIGURATION */}
          {step === 2 && parsedData && (
            <div className="space-y-6">
              {/* Batch Configuration Bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Parametrização em Lote (Aplicar a todos os {parsedData.totalProjects} projetos)
                    </h3>
                  </div>

                  <button
                    onClick={handleApplyBatchSchedule}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Aplicar Regras a Todos</span>
                  </button>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-2.5 text-[11px] text-indigo-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    <strong>Valores originais preservados:</strong> As horas exatas de cada centro de trabalho da sua planilha serão mantidas intactas. O tipo de turbina define a curva de avanço temporal (Curva S) e as datas de início e término dos setores.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Turbine Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Tipo de Turbina Padrão (Curva S):
                    </label>
                    <select
                      value={globalTurbineTypeId}
                      onChange={(e) => setGlobalTurbineTypeId(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {turbineTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.category || 'HYDRO'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Data Início do 1º Projeto:
                    </label>
                    <input
                      type="date"
                      value={globalStartDate}
                      onChange={(e) => setGlobalStartDate(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Duração Padrão por Projeto:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={globalDurationWeeks}
                        onChange={(e) => setGlobalDurationWeeks(Number(e.target.value) || 16)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-slate-500 font-medium">semanas</span>
                    </div>
                  </div>

                  {/* Staggering */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Escalonamento entre Projetos:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={52}
                        value={globalStaggerWeeks}
                        onChange={(e) => setGlobalStaggerWeeks(Number(e.target.value) || 0)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-slate-500 font-medium">sem defasagem</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Projects Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold uppercase tracking-wider">
                    Prévia Individual dos Projetos ({parsedData.projectRows.length})
                  </span>
                  <span>Altere datas ou tipos de turbina individualmente se desejar</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[350px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Nome do Projeto</th>
                          <th className="py-2.5 px-3">Tipo de Turbina (Curva S)</th>
                          <th className="py-2.5 px-3">Início</th>
                          <th className="py-2.5 px-3">Término</th>
                          <th className="py-2.5 px-3 text-right">Horas Mapeadas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {parsedData.projectRows.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={p.projectName}
                                onChange={(e) => handleUpdateProjectRow(idx, { projectName: e.target.value })}
                                className="w-full p-1 bg-white border border-slate-200 rounded font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={p.turbineTypeId}
                                onChange={(e) => handleUpdateProjectRow(idx, { turbineTypeId: e.target.value })}
                                className="p-1 bg-white border border-slate-200 rounded font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                {turbineTypes.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="date"
                                value={p.startDate}
                                onChange={(e) => handleUpdateProjectRow(idx, { startDate: e.target.value })}
                                className="p-1 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="date"
                                value={p.endDate}
                                onChange={(e) => handleUpdateProjectRow(idx, { endDate: e.target.value })}
                                className="p-1 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-black text-indigo-700">
                              {Math.round(p.totalHours || 0).toLocaleString('pt-BR')} h
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <button
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span>Avançar para Mapeamento de Centros</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: WORK CENTER MAPPING & CATEGORIZATION */}
          {step === 3 && parsedData && (
            <div className="space-y-5">
              {/* Header with Search and Filter */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>Mapeamento dos {parsedData.totalColumns} Recursos / Centros de Trabalho</span>
                    {unmappedCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        {unmappedCount} novos postos a cadastrar
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Vincule a centros de trabalho já existentes ou cadastre-os como novos centros associando ao agrupador/setor correto.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar recurso..."
                      value={mappingSearch}
                      onChange={(e) => setMappingSearch(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <select
                    value={mappingFilter}
                    onChange={(e) => setMappingFilter(e.target.value as any)}
                    className="text-xs p-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700"
                  >
                    <option value="ALL">Todos ({parsedData.columnMappings.length})</option>
                    <option value="UNMAPPED">Novos / Não Mapeados ({unmappedCount})</option>
                    <option value="MAPPED">Vinculados ({parsedData.columnMappings.length - unmappedCount})</option>
                  </select>
                </div>
              </div>

              {/* Mappings Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Recurso na Planilha</th>
                        <th className="py-2.5 px-3 text-right">Horas Totais</th>
                        <th className="py-2.5 px-3">Ação Desejada</th>
                        <th className="py-2.5 px-3">Centro / Agrupador Destino</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {filteredMappings.map((mapping) => {
                        const isMatch = mapping.isExistingMatch;

                        return (
                          <tr key={mapping.rawHeader} className="hover:bg-slate-50/80">
                            {/* Raw Header Name */}
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{mapping.cleanName}</div>
                              {isMatch && mapping.matchedWorkCenter && (
                                <div className="text-[10px] text-emerald-700 flex items-center gap-1 mt-0.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Correspondência automática: {mapping.matchedWorkCenter.name}</span>
                                </div>
                              )}
                            </td>

                            {/* Total Hours */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                              {Math.round(mapping.totalHoursInColumn || 0).toLocaleString('pt-BR')} h
                            </td>

                            {/* Action Selector */}
                            <td className="py-2.5 px-3">
                              <select
                                value={mapping.action}
                                onChange={(e) =>
                                  handleUpdateMapping(mapping.rawHeader, {
                                    action: e.target.value as any,
                                  })
                                }
                                className="p-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="MAP_EXISTING">🔗 Vincular a Centro Existente</option>
                                <option value="CREATE_NEW">✨ Cadastrar como Novo Centro</option>
                                <option value="IGNORE">🚫 Ignorar Coluna</option>
                              </select>
                            </td>

                            {/* Target Detail */}
                            <td className="py-2.5 px-3">
                              {mapping.action === 'MAP_EXISTING' && (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={mapping.targetWorkCenterId || ''}
                                    onChange={(e) =>
                                      handleUpdateMapping(mapping.rawHeader, {
                                        targetWorkCenterId: e.target.value,
                                      })
                                    }
                                    className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="">-- Selecione o Centro Existente --</option>
                                    {workCenters.map((wc) => (
                                      <option key={wc.id} value={wc.id}>
                                        {wc.name} ({getWorkCenterCategory(wc)})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {mapping.action === 'CREATE_NEW' && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 shrink-0">Agrupador:</span>
                                    <select
                                      value={mapping.newCenterCategory || sectorGroups[0] || 'OUTROS'}
                                      onChange={(e) =>
                                        handleUpdateMapping(mapping.rawHeader, {
                                          newCenterCategory: e.target.value,
                                        })
                                      }
                                      className="p-1 bg-white border border-slate-300 rounded font-bold text-xs text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                      {sectorGroups.map((g) => (
                                        <option key={g} value={g}>
                                          {g}
                                        </option>
                                      ))}
                                      <option value="OUTROS">OUTROS</option>
                                    </select>
                                  </div>
                                </div>
                              )}

                              {mapping.action === 'IGNORE' && (
                                <span className="text-[11px] text-slate-400 italic">
                                  Esta coluna será ignorada e não gerará horas.
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <button
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span>Revisar & Confirmar Importação</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & DESTINATION */}
          {step === 4 && parsedData && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">Tudo Pronto para a Importação!</h3>
                <p className="text-xs text-slate-500">
                  Revise o resumo das informações que serão integradas ao seu PCP.
                </p>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Projetos a Importar
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {parsedData.totalProjects}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Novos Centros
                  </span>
                  <div className="text-2xl font-black text-indigo-600 mt-1">
                    {unmappedCount}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total de Horas
                  </span>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {Math.round(parsedData?.totalHoursSum || 0).toLocaleString('pt-BR')} h
                  </div>
                </div>
              </div>

              {/* Destination Selector */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Escolha o Modo de Destino da Importação:
                </span>

                <div className="space-y-2.5">
                  {/* Append */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    importDestination === 'append'
                      ? 'bg-white border-indigo-600 shadow-xs ring-1 ring-indigo-600'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="destination"
                      value="append"
                      checked={importDestination === 'append'}
                      onChange={() => setImportDestination('append')}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        Adicionar ao Cenário Atual (Manter projetos existentes)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Os {parsedData.totalProjects} novos projetos serão somados à carteira atual ({projects.length} projetos existentes).
                      </span>
                    </div>
                  </label>

                  {/* Replace */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    importDestination === 'replace_projects'
                      ? 'bg-white border-indigo-600 shadow-xs ring-1 ring-indigo-600'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="destination"
                      value="replace_projects"
                      checked={importDestination === 'replace_projects'}
                      onChange={() => setImportDestination('replace_projects')}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        Substituir Projetos do Cenário Atual
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Substitui toda a carteira de projetos atual pelos {parsedData.totalProjects} projetos importados.
                      </span>
                    </div>
                  </label>

                  {/* New Scenario */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    importDestination === 'new_scenario'
                      ? 'bg-white border-indigo-600 shadow-xs ring-1 ring-indigo-600'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="destination"
                      value="new_scenario"
                      checked={importDestination === 'new_scenario'}
                      onChange={() => setImportDestination('new_scenario')}
                      className="mt-1"
                    />
                    <div className="w-full">
                      <span className="font-bold text-xs text-slate-900 block">
                        Criar Novo Cenário de Planejamento Separado
                      </span>
                      <span className="text-[11px] text-slate-500 block mb-2">
                        Cria uma cópia isolada para análise e simulação sem alterar o cenário base.
                      </span>

                      {importDestination === 'new_scenario' && (
                        <input
                          type="text"
                          value={newScenarioName}
                          onChange={(e) => setNewScenarioName(e.target.value)}
                          placeholder="Nome do Novo Cenário..."
                          className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Final Actions */}
              <div className="flex justify-between items-center pt-3">
                <button
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <button
                  onClick={handleFinalizeImport}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-101"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Concluir Importação de {parsedData.totalProjects} Projetos</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
