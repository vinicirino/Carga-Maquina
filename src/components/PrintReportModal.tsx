import React, { useState, useMemo, useRef } from 'react';
import {
  Printer,
  X,
  FileText,
  Sliders,
  Calendar,
  AlertTriangle,
  Factory,
  Layers,
  Sparkles,
  TrendingUp,
  Clock,
  ShieldAlert,
  User,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Settings2,
  FileSpreadsheet,
  Check,
  Star,
  Info,
  FileDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import {
  WorkCenter,
  WorkCenterCapacitySummary,
  WeeklyBucket,
  Project,
  PlanningScenario,
  DEFAULT_SECTOR_GROUPS,
} from '../types';
import { calculateWeeklyCapacity } from '../utils/calculator';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import { getProjectTotalHours } from '../utils/dateValidation';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpis: {
    totalRequiredHours: number;
    totalWeeklyCapacity: number;
    overloadedWorkCentersCount: number;
    overallUtilizationPercentage: number;
    overloadedWeeksCount: number;
    timeframeStart: string;
    timeframeEnd: string;
  };
  workCenters: WorkCenter[];
  summaries: WorkCenterCapacitySummary[];
  weeklyBuckets: WeeklyBucket[];
  projects: Project[];
  activeScenario?: PlanningScenario;
  sectorGroups?: string[];
  recommendations?: any[];
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  kpis,
  workCenters,
  summaries,
  weeklyBuckets,
  projects,
  activeScenario,
  sectorGroups = DEFAULT_SECTOR_GROUPS,
  recommendations = [],
}) => {
  // Metadata & Customization
  const [reportTitle, setReportTitle] = useState('Relatório Executivo de Carga Máquina & Capacidade Fabril');
  const [companyName, setCompanyName] = useState('PCP Industrial - Planejamento & Controle');
  const [plannerName, setPlannerName] = useState('Engenharia de Planejamento (PCP)');
  const [customNotes, setCustomNotes] = useState(
    'Análise de capacidade produtiva, nivelamento de postos e diagnóstico de gargalos fabris. Recomenda-se atenção imediata aos postos em sobrecarga e alocação de turnos/horas extras nos períodos críticos.'
  );

  // Filters
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedWorkCenterId, setSelectedWorkCenterId] = useState<string>('all');
  const [timeRangeLimit, setTimeRangeLimit] = useState<'all' | '3m' | '6m' | '12m'>('all');

  // Preview UI Controls
  const [showSettings, setShowSettings] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewStyle, setViewStyle] = useState<'a4-pages' | 'continuous'>('a4-pages');

  // Section Toggles
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includePlantChart, setIncludePlantChart] = useState(true);
  const [includeSectorBreakdown, setIncludeSectorBreakdown] = useState(true);
  const [includeWorkCenterTable, setIncludeWorkCenterTable] = useState(true);
  const [includeProjectsTable, setIncludeProjectsTable] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Active items
  const activeProjects = useMemo(() => projects.filter((p) => p.enabled !== false), [projects]);

  // Helper to retrieve project hours specifically for a work center
  const getProjectWorkCenterHours = (project: Project, wc: WorkCenter): number => {
    if (!project.workCenterHours) return 0;
    if (typeof project.workCenterHours[wc.id] === 'number' && !isNaN(project.workCenterHours[wc.id])) {
      return project.workCenterHours[wc.id];
    }
    if (typeof project.workCenterHours[wc.name] === 'number' && !isNaN(project.workCenterHours[wc.name])) {
      return project.workCenterHours[wc.name];
    }
    const norm = wc.name.trim().toUpperCase();
    for (const [k, v] of Object.entries(project.workCenterHours)) {
      if (k.trim().toUpperCase() === norm && typeof v === 'number' && !isNaN(v)) {
        return v;
      }
    }
    return 0;
  };

  // Available work centers for filter dropdown based on selected sector
  const availableWorkCentersForFilter = useMemo(() => {
    return workCenters.filter((wc) => {
      if (wc.enabled === false) return false;
      if (selectedSector !== 'all' && getWorkCenterCategory(wc) !== selectedSector) return false;
      return true;
    });
  }, [workCenters, selectedSector]);

  // Selected single work center object (if active)
  const selectedWorkCenterObj = useMemo(() => {
    if (selectedWorkCenterId === 'all') return null;
    return workCenters.find((wc) => wc.id === selectedWorkCenterId) || null;
  }, [workCenters, selectedWorkCenterId]);

  const filteredWorkCenters = useMemo(() => {
    return workCenters.filter((wc) => {
      if (wc.enabled === false) return false;
      if (selectedSector !== 'all' && getWorkCenterCategory(wc) !== selectedSector) return false;
      if (selectedWorkCenterId !== 'all' && wc.id !== selectedWorkCenterId) return false;
      return true;
    });
  }, [workCenters, selectedSector, selectedWorkCenterId]);

  const filteredWcIds = useMemo(() => new Set(filteredWorkCenters.map((wc) => wc.id)), [filteredWorkCenters]);

  // Filter weekly buckets based on timeRangeLimit
  const filteredWeeklyBuckets = useMemo(() => {
    if (timeRangeLimit === 'all') return weeklyBuckets;
    const count = timeRangeLimit === '3m' ? 13 : timeRangeLimit === '6m' ? 26 : 52;
    return weeklyBuckets.slice(0, count);
  }, [weeklyBuckets, timeRangeLimit]);

  // Filtered Summaries
  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) => filteredWcIds.has(s.workCenter.id));
  }, [summaries, filteredWcIds]);

  // Filtered KPIs calculation
  const reportKpis = useMemo(() => {
    const totalWeeklyCap = filteredWorkCenters.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);
    const totalReqHours = filteredSummaries.reduce((acc, s) => acc + s.totalRequiredHours, 0);

    let peakLoad = 0;
    let overloadedWcs = 0;
    let overloadedWeeks = 0;

    filteredSummaries.forEach((s) => {
      if (s.status === 'CRITICAL' || (s.maxUtilizationPercentage ?? 0) > 100 || (s.overloadedWeeksCount ?? 0) > 0) {
        overloadedWcs++;
      }
    });

    filteredWeeklyBuckets.forEach((bucket) => {
      let weekLoad = 0;
      filteredWorkCenters.forEach((wc) => {
        weekLoad += bucket.workCenterLoads[wc.id] || 0;
      });
      if (weekLoad > peakLoad) peakLoad = weekLoad;
      if (totalWeeklyCap > 0 && weekLoad > totalWeeklyCap) overloadedWeeks++;
    });

    const totalAvailableHours = totalWeeklyCap * Math.max(filteredWeeklyBuckets.length, 1);
    const overallUtil = totalAvailableHours > 0 ? (totalReqHours / totalAvailableHours) * 100 : 0;

    return {
      totalRequiredHours: totalReqHours,
      totalWeeklyCapacity: totalWeeklyCap,
      overloadedWorkCentersCount: overloadedWcs,
      overallUtilizationPercentage: overallUtil,
      overloadedWeeksCount: overloadedWeeks,
      peakLoad,
    };
  }, [filteredWorkCenters, filteredSummaries, filteredWeeklyBuckets]);

  // Active projects list with optional work center hours prioritization
  const relevantProjectsList = useMemo(() => {
    if (!selectedWorkCenterObj) return activeProjects;
    return [...activeProjects].sort((a, b) => {
      const aHrs = getProjectWorkCenterHours(a, selectedWorkCenterObj);
      const bHrs = getProjectWorkCenterHours(b, selectedWorkCenterObj);
      return bHrs - aHrs;
    });
  }, [activeProjects, selectedWorkCenterObj]);

  // Filter recommendations when a single work center or sector is active
  const filteredRecommendations = useMemo(() => {
    if (selectedWorkCenterObj) {
      const matched = recommendations.filter(
        (r) => r.workCenterId === selectedWorkCenterObj.id || r.workCenterName === selectedWorkCenterObj.name
      );
      return matched.length > 0 ? matched : recommendations;
    }
    if (selectedSector !== 'all') {
      const secWcNames = new Set(filteredWorkCenters.map((w) => w.name));
      const matched = recommendations.filter(
        (r) => secWcNames.has(r.workCenterName) || r.sector === selectedSector
      );
      return matched.length > 0 ? matched : recommendations;
    }
    return recommendations;
  }, [recommendations, selectedWorkCenterObj, selectedSector, filteredWorkCenters]);

  // Chart data for plant or selected sector
  const chartData = useMemo(() => {
    const weeklyCapacity = filteredWorkCenters.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);

    return filteredWeeklyBuckets.map((bucket) => {
      let totalLoad = 0;
      filteredWorkCenters.forEach((wc) => {
        totalLoad += bucket.workCenterLoads[wc.id] || 0;
      });

      return {
        weekLabel: bucket.label.split(' ')[1] || bucket.label,
        weekKey: bucket.weekKey,
        load: Math.round(totalLoad),
        capacity: weeklyCapacity,
        isOverloaded: totalLoad > weeklyCapacity,
      };
    });
  }, [filteredWeeklyBuckets, filteredWorkCenters]);

  // Sector breakdown calculations
  const sectorList = useMemo(() => {
    const allGroups = Array.from(
      new Set([...sectorGroups, ...workCenters.map((wc) => getWorkCenterCategory(wc))])
    );
    return allGroups
      .map((grp) => {
        const groupWcs = workCenters.filter((wc) => wc.enabled !== false && getWorkCenterCategory(wc) === grp);
        if (groupWcs.length === 0) return null;

        const groupWcIds = new Set(groupWcs.map((wc) => wc.id));
        const groupSummaries = summaries.filter((s) => groupWcIds.has(s.workCenter.id));
        const totalHours = groupSummaries.reduce((acc, s) => acc + s.totalRequiredHours, 0);
        const weeklyCap = groupWcs.reduce((acc, wc) => acc + calculateWeeklyCapacity(wc), 0);
        const totalRes = groupWcs.reduce((acc, wc) => acc + (wc.resourcesCount || 0), 0);

        let peak = 0;
        let overWeeks = 0;

        filteredWeeklyBuckets.forEach((bucket) => {
          let wLoad = 0;
          groupWcs.forEach((wc) => {
            wLoad += bucket.workCenterLoads[wc.id] || 0;
          });
          if (wLoad > peak) peak = wLoad;
          if (weeklyCap > 0 && wLoad > weeklyCap) overWeeks++;
        });

        const peakUtil = weeklyCap > 0 ? (peak / weeklyCap) * 100 : 0;

        return {
          name: grp,
          workCentersCount: groupWcs.length,
          totalResources: totalRes,
          weeklyCapacity: weeklyCap,
          totalRequiredHours: totalHours,
          peakLoad: peak,
          peakUtilization: peakUtil,
          overloadedWeeks: overWeeks,
          isCritical: overWeeks > 0 || peakUtil > 100,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.peakUtilization || 0) - (a?.peakUtilization || 0));
  }, [sectorGroups, workCenters, summaries, filteredWeeklyBuckets]);

  // Handle direct print
  const handlePrint = () => {
    window.print();
  };

  // Generate standalone HTML report & Open in new tab or download
  const handleOpenStandaloneReport = () => {
    if (!printAreaRef.current) return;
    const printHtml = printAreaRef.current.innerHTML;

    const fullDoc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - PCP</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #0f172a; padding: 20px; }
    .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <strong style="color: #1e293b;">Visualização de Impressão do Relatório</strong>
      <div style="font-size: 12px; color: #64748b;">Pronto para impressão direta ou salvar em PDF</div>
    </div>
    <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
      🖨️ Imprimir / Salvar PDF
    </button>
  </div>
  ${printHtml}
</body>
</html>`;

    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // If popup blocked, download as file
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_PCP_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Dedicated Print & Save to PDF launcher (opens clean A4 window and triggers print dialog)
  const handleLaunchPrintDialog = () => {
    if (!printAreaRef.current) return;
    const printHtml = printAreaRef.current.innerHTML;

    const fullDoc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle} - PCP Industrial</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { 
      size: A4 portrait; 
      margin: 8mm 8mm 8mm 8mm; 
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    html, body { 
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #ffffff; 
      color: #0f172a; 
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-wrapper {
      width: 100%;
      max-width: 194mm;
      margin: 0 auto;
      padding: 10px 0;
    }
    .break-inside-avoid { 
      break-inside: avoid !important; 
      page-break-inside: avoid !important; 
    }
    table { 
      width: 100% !important; 
      border-collapse: collapse !important; 
      table-layout: fixed !important;
    }
    tr {
      page-break-inside: avoid !important;
    }
    @media print {
      body { padding: 0; margin: 0; background: #ffffff !important; }
      .no-print { display: none !important; }
      .print-wrapper { padding: 0; margin: 0 auto; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: sticky; top: 0; z-index: 999; background: #0f172a; color: white; padding: 12px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366f1; margin-bottom: 15px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="background: #4f46e5; color: white; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px;">PCP</div>
      <div>
        <div style="font-weight: 800; font-size: 13px; color: #f8fafc;">Impressão & Salvar em PDF (Formato A4)</div>
        <div style="font-size: 11px; color: #94a3b8;">💡 Na janela de impressão, escolha <strong>"Salvar como PDF"</strong> no campo Destino para gerar o arquivo PDF.</div>
      </div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
        🖨️ Abrir Diálogo de Impressão / PDF
      </button>
      <button onclick="window.close()" style="background: #334155; color: #e2e8f0; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 12px;">
        Fechar
      </button>
    </div>
  </div>
  <div class="print-wrapper">
    ${printHtml}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (e) {
          console.log('Dialog opened or cancelled:', e);
        }
      }, 400);
    });
  </script>
</body>
</html>`;

    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // Fallback if popup blocked
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_PCP_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Direct download standalone HTML file
  const handleDownloadStandaloneHtml = () => {
    if (!printAreaRef.current) return;
    const printHtml = printAreaRef.current.innerHTML;

    const fullDoc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle} - PCP Industrial</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { size: A4 portrait; margin: 8mm 8mm 8mm 8mm; }
    *, *::before, *::after { box-sizing: border-box !important; }
    html, body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #0f172a; margin: 0; padding: 0; }
    .print-wrapper { width: 100%; max-width: 194mm; margin: 0 auto; padding: 15px 0; }
    .break-inside-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }
    table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
    tr { page-break-inside: avoid !important; }
    @media print {
      body { padding: 0; margin: 0; }
      .no-print { display: none !important; }
      .print-wrapper { padding: 0; margin: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin: 15px auto; max-width: 194mm; padding: 12px 18px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <strong style="color: #0f172a; font-size: 13px;">Relatório de Análise de Carga Máquina & Capacidade</strong>
      <div style="font-size: 11px; color: #64748b;">Pronto para visualização, impressão ou exportação em PDF</div>
    </div>
    <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px;">
      🖨️ Imprimir / Salvar em PDF
    </button>
  </div>
  <div class="print-wrapper">
    ${printHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileSuffix = selectedWorkCenterObj
      ? selectedWorkCenterObj.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      : selectedSector !== 'all'
      ? selectedSector.replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'Geral';
    a.download = `Relatorio_PCP_${fileSuffix}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // State for print options modal / menu
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  if (!isOpen) return null;

  const issueDateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      id="print-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex flex-col p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto"
    >
      {/* Modal Dialog Card */}
      <div
        id="print-modal-card"
        className="bg-slate-900 text-slate-100 w-full max-w-6xl mx-auto rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700 my-auto print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none print:bg-white"
      >
        {/* ========================================================================= */}
        {/* Top Control Bar (Hidden during print) */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 text-white px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md font-black shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  Pré-visualização do Relatório Executivo
                </h2>
                <span className="text-[10px] uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-black">
                  Layout A4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Visualize exatamente o que será impresso e configure os parâmetros antes de emitir
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Settings Panel */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer border ${
                showSettings
                  ? 'bg-slate-800 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800/60 text-slate-300 hover:text-white border-slate-700'
              }`}
              title="Ajustar Filtros, Título e Seções do Relatório"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{showSettings ? 'Ocultar Opções' : 'Configurar'}</span>
            </button>

            {/* Download HTML / PDF Standalone Report */}
            <button
              onClick={handleDownloadStandaloneHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-700 cursor-pointer"
              title="Baixar arquivo autônomo formatado para visualização offline ou envio por e-mail"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Baixar Arquivo</span>
            </button>

            {/* Print / Save as PDF Primary Action */}
            <button
              onClick={() => {
                setShowPrintOptions(true);
                handleLaunchPrintDialog();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer hover:scale-102"
              title="Imprimir ou Salvar como PDF via janela otimizada A4"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Fechar Pré-visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print & PDF Options Guide / Modal */}
        {showPrintOptions && (
          <div className="bg-indigo-950/90 border-b border-indigo-800 px-5 py-3 text-xs text-indigo-100 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150 print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white text-xs flex items-center gap-1.5">
                  Opções de Impressão & Exportação PDF Ativadas
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                    Margens A4 Ajustadas
                  </span>
                </p>
                <p className="text-[11px] text-indigo-200">
                  Para gerar o PDF: na janela de impressão do seu navegador, selecione <strong>"Salvar como PDF"</strong> em Destino.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLaunchPrintDialog}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Reabrir Janela de Impressão
              </button>
              <button
                onClick={handleDownloadStandaloneHtml}
                className="px-3 py-1.5 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-100 font-semibold rounded-lg border border-indigo-700 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                Baixar Relatório (.HTML)
              </button>
              <button
                onClick={() => handlePrint()}
                className="px-2.5 py-1.5 bg-indigo-900/40 hover:bg-indigo-800 text-indigo-300 text-[11px] rounded-lg transition-colors cursor-pointer"
                title="Tentar acionar caixa de diálogo diretamente nesta página"
              >
                Imprimir Direto
              </button>
              <button
                onClick={() => setShowPrintOptions(false)}
                className="p-1 text-indigo-300 hover:text-white rounded hover:bg-indigo-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Customization Options Accordion (Hidden during print) */}
        {/* ========================================================================= */}
        {showSettings && (
          <div className="bg-slate-800/90 text-slate-200 p-4 border-b border-slate-700 space-y-3.5 text-xs print:hidden animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Sector Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Agrupador / Setor:</span>
                  {selectedSector !== 'all' && (
                    <button
                      onClick={() => {
                        setSelectedSector('all');
                        setSelectedWorkCenterId('all');
                      }}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </label>
                <select
                  value={selectedSector}
                  onChange={(e) => {
                    const newSec = e.target.value;
                    setSelectedSector(newSec);
                    if (newSec !== 'all' && selectedWorkCenterId !== 'all') {
                      const currWc = workCenters.find((w) => w.id === selectedWorkCenterId);
                      if (currWc && getWorkCenterCategory(currWc) !== newSec) {
                        setSelectedWorkCenterId('all');
                      }
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-hidden font-medium"
                >
                  <option value="all">🏭 Todos os Setores ({workCenters.length} postos)</option>
                  {sectorGroups.map((g) => (
                    <option key={g} value={g}>
                      📁 {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specific Work Center Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Centro / Posto Específico:</span>
                  {selectedWorkCenterId !== 'all' && (
                    <button
                      onClick={() => setSelectedWorkCenterId('all')}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      Todos
                    </button>
                  )}
                </label>
                <select
                  value={selectedWorkCenterId}
                  onChange={(e) => {
                    const newWcId = e.target.value;
                    setSelectedWorkCenterId(newWcId);
                    if (newWcId !== 'all') {
                      const targetWc = workCenters.find((w) => w.id === newWcId);
                      if (targetWc) {
                        const targetSec = getWorkCenterCategory(targetWc);
                        if (selectedSector !== 'all' && selectedSector !== targetSec) {
                          setSelectedSector(targetSec);
                        }
                      }
                    }
                  }}
                  className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-hidden font-medium ${
                    selectedWorkCenterId !== 'all' ? 'border-indigo-500 text-indigo-200 ring-1 ring-indigo-500' : 'border-slate-700'
                  }`}
                >
                  <option value="all">
                    {selectedSector === 'all'
                      ? `⚙️ Todos os Postos (${availableWorkCentersForFilter.length})`
                      : `⚙️ Todos os Postos de ${selectedSector} (${availableWorkCentersForFilter.length})`}
                  </option>
                  {availableWorkCentersForFilter.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.name} {selectedSector === 'all' ? `(${getWorkCenterCategory(wc)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Range Horizon */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Horizonte Temporal:
                </label>
                <select
                  value={timeRangeLimit}
                  onChange={(e) => setTimeRangeLimit(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-hidden font-medium"
                >
                  <option value="all">📅 Cronograma Completo ({weeklyBuckets.length} semanas)</option>
                  <option value="3m">3 Meses (13 semanas)</option>
                  <option value="6m">6 Meses (26 semanas)</option>
                  <option value="12m">12 Meses (52 semanas)</option>
                </select>
              </div>

              {/* Document Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Título do Relatório:
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              {/* Author / Planner */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Responsável / Emissor:
                </label>
                <input
                  type="text"
                  value={plannerName}
                  onChange={(e) => setPlannerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>

            {/* Active Filter Feedback Badge if specific work center or sector is chosen */}
            {(selectedWorkCenterObj || selectedSector !== 'all') && (
              <div className="bg-indigo-950/70 border border-indigo-700/60 px-3 py-2 rounded-lg flex items-center justify-between text-[11px] text-indigo-200">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>
                    {selectedWorkCenterObj ? (
                      <>
                        Filtrando posto específico: <strong>{selectedWorkCenterObj.name}</strong> (Setor: {getWorkCenterCategory(selectedWorkCenterObj)}, Recursos: {selectedWorkCenterObj.resourcesCount}, Eficiência: {selectedWorkCenterObj.efficiencyPercentage}%)
                      </>
                    ) : (
                      <>
                        Filtrando setor fabril: <strong>{selectedSector}</strong> ({filteredWorkCenters.length} postos de trabalho incluídos)
                      </>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedSector('all');
                    setSelectedWorkCenterId('all');
                  }}
                  className="text-xs text-indigo-300 hover:text-white font-semibold underline ml-2 cursor-pointer shrink-0"
                >
                  Restaurar Fábrica Toda
                </button>
              </div>
            )}

            {/* Custom Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Parecer Técnico & Observações do PCP:
              </label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-hidden resize-y"
              />
            </div>

            {/* Section Toggles */}
            <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                Seções Visíveis:
              </span>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includeKpis}
                  onChange={(e) => setIncludeKpis(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>KPIs Globais</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includePlantChart}
                  onChange={(e) => setIncludePlantChart(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Gráfico Curva de Demanda</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includeSectorBreakdown}
                  onChange={(e) => setIncludeSectorBreakdown(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Resumo por Setores</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includeWorkCenterTable}
                  onChange={(e) => setIncludeWorkCenterTable(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Matriz de Postos</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includeProjectsTable}
                  onChange={(e) => setIncludeProjectsTable(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Carteira de Projetos</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includeRecommendations}
                  onChange={(e) => setIncludeRecommendations(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Parecer Técnico</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>Campos de Assinatura</span>
              </label>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Preview Status & Zoom Ribbon (Hidden during print) */}
        {/* ========================================================================= */}
        <div className="bg-slate-950/60 px-5 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Documento Pré-visualizado em Tempo Real
            </span>
            <span>•</span>
            <span>
              {filteredWorkCenters.length} postos | {activeProjects.length} projetos | {filteredWeeklyBuckets.length} semanas
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                onClick={() => setViewStyle('a4-pages')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                  viewStyle === 'a4-pages' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Páginas A4
              </button>
              <button
                onClick={() => setViewStyle('continuous')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                  viewStyle === 'continuous' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visão Contínua
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 15, 60))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                title="Reduzir Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono w-10 text-center text-slate-300 font-bold">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 15, 140))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 text-[10px] font-bold"
                title="Resetar 100%"
              >
                100%
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* REPORT CANVAS / PAPER SIMULATION CONTAINER */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 p-4 sm:p-8 overflow-y-auto max-h-[72vh] flex justify-center print:bg-white print:p-0 print:m-0 print:max-h-none print:overflow-visible">
          
          {/* Visual Paper Sheet */}
          <div
            id="printable-report-content"
            ref={printAreaRef}
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
            }}
            className={`bg-white text-slate-900 transition-transform duration-150 w-full max-w-[194mm] mx-auto p-4 sm:p-6 space-y-4 print:transform-none print:w-full print:max-w-none print:p-0 print:m-0 print:space-y-4 ${
              viewStyle === 'a4-pages'
                ? 'shadow-2xl rounded-sm border border-slate-300 min-h-[280mm]'
                : 'rounded-xl shadow-xl'
            }`}
          >
            {/* 1. DOCUMENT HEADER */}
            <div className="border-b-2 border-slate-900 pb-3 break-inside-avoid space-y-1.5">
              {/* Row 1: Logo + Main Title spanning horizontally */}
              <div className="flex items-center gap-3">
                {/* PCP Brand Badge */}
                <div className="w-11 h-11 bg-slate-900 text-white rounded-xl flex flex-col items-center justify-center border border-slate-800 shrink-0 shadow-xs">
                  <span className="font-black text-sm tracking-wider leading-none">PCP</span>
                  <span className="text-[7.5px] font-bold text-slate-300 uppercase tracking-tight mt-0.5 leading-none">
                    IND
                  </span>
                </div>

                {/* H1 Title */}
                <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none truncate">
                  {reportTitle}
                </h1>
              </div>

              {/* Row 2: Subtitle / Company & Scenario on left, Emissão on right */}
              <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium pt-0.5">
                <div className="flex items-center gap-1.5 truncate">
                  <span>{companyName}</span>
                  <span>•</span>
                  <span>
                    Cenário: <strong>{activeScenario?.name || 'Cenário 1: Base Operacional (Atual)'}</strong>
                  </span>
                  {activeScenario?.isBaseline !== false && (
                    <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-bold inline-flex items-center gap-0.5 ml-1">
                      <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                      BASE OFICIAL
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-slate-700 text-right">
                  <strong>Emissão:</strong> {issueDateStr}
                </div>
              </div>

              {/* Row 3: Responsável on right */}
              <div className="flex justify-end text-[11px] text-slate-700 font-medium">
                <div>
                  <strong>Responsável:</strong> {plannerName}
                </div>
              </div>

              {/* Row 4: Scope / Posto Badge on left, Period on right */}
              <div className="flex justify-between items-center text-[11px] text-slate-700 font-medium pt-0.5">
                <div>
                  {selectedWorkCenterObj ? (
                    <span className="text-indigo-900 font-bold bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded text-xs inline-block">
                      <strong>Posto:</strong> {selectedWorkCenterObj.name} ({getWorkCenterCategory(selectedWorkCenterObj)})
                    </span>
                  ) : selectedSector !== 'all' ? (
                    <span className="text-indigo-900 font-bold bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded text-xs inline-block">
                      <strong>Setor:</strong> {selectedSector}
                    </span>
                  ) : (
                    <span className="text-slate-800 font-bold bg-slate-100 border border-slate-300 px-2.5 py-1 rounded text-xs inline-block">
                      <strong>Escopo:</strong> Fábrica Completa ({filteredWorkCenters.length} postos)
                    </span>
                  )}
                </div>

                <div className="text-right text-slate-600">
                  <strong>Período:</strong>{' '}
                  {filteredWeeklyBuckets[0]?.label || kpis.timeframeStart} até{' '}
                  {filteredWeeklyBuckets[filteredWeeklyBuckets.length - 1]?.label || kpis.timeframeEnd} (
                  {filteredWeeklyBuckets.length} sem)
                </div>
              </div>
            </div>

            {/* 2. EXECUTIVE KPI CARDS */}
            {includeKpis && (
              <div className="space-y-1.5 break-inside-avoid">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  {selectedWorkCenterObj ? `1. Indicadores do Posto: ${selectedWorkCenterObj.name}` : '1. Indicadores Executivos Globais'}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 print:grid-cols-6">
                  {/* Demand Hours */}
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">
                      {selectedWorkCenterObj ? 'Demanda no Posto' : 'Demanda Total'}
                    </span>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {Math.round(reportKpis.totalRequiredHours).toLocaleString('pt-BR')} h
                    </div>
                    <span className="text-[9px] text-slate-500 block truncate">
                      {selectedWorkCenterObj
                        ? `${relevantProjectsList.filter((p) => getProjectWorkCenterHours(p, selectedWorkCenterObj) > 0).length} projetos c/ carga`
                        : `${activeProjects.length} projetos`}
                    </span>
                  </div>

                  {/* Installed Capacity */}
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">Capacidade Semanal</span>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {Math.round(reportKpis.totalWeeklyCapacity).toLocaleString('pt-BR')} h/sem
                    </div>
                    <span className="text-[9px] text-slate-500 block truncate">
                      {selectedWorkCenterObj
                        ? `${selectedWorkCenterObj.resourcesCount} rec. • ${selectedWorkCenterObj.efficiencyPercentage}% efic.`
                        : `${filteredWorkCenters.length} postos`}
                    </span>
                  </div>

                  {/* Average Utilization */}
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">Utilização Média</span>
                    <div
                      className={`text-sm font-black mt-0.5 ${
                        (reportKpis?.overallUtilizationPercentage ?? 0) > 100 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {(reportKpis?.overallUtilizationPercentage ?? 0).toFixed(1)}%
                    </div>
                    <span className="text-[9px] text-slate-500 block truncate">Carga / Capacidade</span>
                  </div>

                  {/* Peak Demand */}
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">Pico Semanal</span>
                    <div className="text-sm font-black text-indigo-700 mt-0.5">
                      {Math.round(reportKpis.peakLoad).toLocaleString('pt-BR')} h
                    </div>
                    <span className="text-[9px] text-slate-500 block truncate">
                      {reportKpis.totalWeeklyCapacity > 0
                        ? `${((reportKpis.peakLoad / reportKpis.totalWeeklyCapacity) * 100).toFixed(0)}% cap`
                        : '-'}
                    </span>
                  </div>

                  {/* Overloaded Work Centers / Turnos & Eficiência */}
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">
                      {selectedWorkCenterObj ? 'Turnos & Horário' : 'Postos Críticos'}
                    </span>
                    {selectedWorkCenterObj ? (
                      <>
                        <div className="text-sm font-black text-slate-900 mt-0.5">
                          {selectedWorkCenterObj.dailyHours ? Math.round(selectedWorkCenterObj.dailyHours / 8) : 1} Turno(s)
                        </div>
                        <span className="text-[9px] text-slate-500 block truncate">
                          {selectedWorkCenterObj.dailyHours || 8}h/dia • {selectedWorkCenterObj.resourcesCount} op.
                        </span>
                      </>
                    ) : (
                      <>
                        <div
                          className={`text-sm font-black mt-0.5 ${
                            reportKpis.overloadedWorkCentersCount > 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {reportKpis.overloadedWorkCentersCount} postos
                        </div>
                        <span className="text-[9px] text-slate-500 block truncate">Com sobrecarga</span>
                      </>
                    )}
                  </div>

                  {/* Critical Weeks */}
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">Semanas Críticas</span>
                    <div
                      className={`text-sm font-black mt-0.5 ${
                        reportKpis.overloadedWeeksCount > 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {reportKpis.overloadedWeeksCount} sem
                    </div>
                    <span className="text-[9px] text-slate-500 block truncate">
                      {reportKpis.overloadedWeeksCount > 0 ? 'Sobrecarga' : 'Balanceado'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. GLOBAL PLANT / SECTOR / POSTO CAPACITY CHART */}
            {includePlantChart && (
              <div className="space-y-1.5 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-indigo-600" />
                    {selectedWorkCenterObj
                      ? `2. Curva de Carga Semanal vs. Capacidade: ${selectedWorkCenterObj.name} (${getWorkCenterCategory(selectedWorkCenterObj)})`
                      : selectedSector !== 'all'
                      ? `2. Curva de Demanda Semanal vs. Capacidade Instalada - Setor ${selectedSector}`
                      : '2. Curva de Demanda Semanal vs. Capacidade Instalada - Planta Geral'}
                  </h3>
                  <span className="text-[10px] text-indigo-900 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    {selectedWorkCenterObj
                      ? `Posto: ${selectedWorkCenterObj.name}`
                      : selectedSector === 'all'
                      ? 'Fábrica Completa'
                      : `Setor: ${selectedSector}`}
                  </span>
                </div>

                <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200">
                  <div className="h-48 sm:h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 8, right: 10, left: -15, bottom: 15 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="weekLabel"
                          tick={{ fontSize: 9, fill: '#475569' }}
                          interval={Math.ceil(chartData.length / 15)}
                          angle={-30}
                          textAnchor="end"
                          height={28}
                        />
                        <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
                        <Tooltip
                          formatter={(val: number) => [`${val.toLocaleString('pt-BR')} h`, '']}
                          labelFormatter={(lbl) => `Semana: ${lbl}`}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', fontSize: '11px' }}
                        />
                        <Legend verticalAlign="top" height={20} wrapperStyle={{ fontSize: '9px' }} />

                        <Bar
                          dataKey="load"
                          name={selectedWorkCenterObj ? `Carga no Posto (${selectedWorkCenterObj.name})` : 'Carga Demandada (Horas)'}
                          fill="#4f46e5"
                          radius={[2, 2, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="capacity"
                          name={selectedWorkCenterObj ? `Capacidade do Posto (${Math.round(reportKpis.totalWeeklyCapacity)} h/sem)` : 'Capacidade Instalada Semanal'}
                          stroke="#dc2626"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5 px-1">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-medium">
                        <span className="w-2 h-2 bg-indigo-600 inline-block rounded-xs"></span> Demanda Semanal
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <span className="w-2.5 h-0.5 bg-red-600 inline-block border-t border-dashed border-red-600"></span> Limite de Capacidade Instalada
                      </span>
                    </div>
                    <span className="italic">Horas disponíveis por semana</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SECTOR BREAKDOWN SUMMARY TABLE */}
            {includeSectorBreakdown && sectorList.length > 0 && (
              <div className="space-y-1.5 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    3. Diagnóstico e Balanceamento por Setor Fabril
                  </h3>
                  {selectedWorkCenterObj && (
                    <span className="text-[9px] text-slate-500 font-semibold">
                      Setor do Posto: <strong className="text-slate-800">{getWorkCenterCategory(selectedWorkCenterObj)}</strong>
                    </span>
                  )}
                </div>

                <div className="w-full overflow-x-hidden">
                  <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-200">
                    <colgroup>
                      <col className="w-[26%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[12%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[9px] uppercase">
                      <tr>
                        <th className="p-1.5 border-r border-slate-200">Setor</th>
                        <th className="p-1.5 text-center border-r border-slate-200">Postos</th>
                        <th className="p-1.5 text-center border-r border-slate-200">Rec.</th>
                        <th className="p-1.5 text-right border-r border-slate-200">Capacidade</th>
                        <th className="p-1.5 text-right border-r border-slate-200">Demanda</th>
                        <th className="p-1.5 text-right border-r border-slate-200">Pico</th>
                        <th className="p-1.5 text-center border-r border-slate-200">% Pico</th>
                        <th className="p-1.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800 text-[10px]">
                      {sectorList.map((sec: any) => {
                        const isSelectedCategory = selectedWorkCenterObj && getWorkCenterCategory(selectedWorkCenterObj) === sec.name;
                        return (
                          <tr key={sec.name} className={isSelectedCategory ? 'bg-indigo-50/80 font-semibold' : 'hover:bg-slate-50'}>
                            <td className="p-1.5 font-bold border-r border-slate-200 truncate" title={sec.name}>
                              <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${isSelectedCategory ? 'bg-indigo-700 ring-2 ring-indigo-300' : 'bg-indigo-600'}`}></span>
                              {sec.name}
                              {isSelectedCategory && (
                                <span className="ml-1 text-[8px] bg-indigo-200 text-indigo-900 px-1 py-0.2 rounded font-black uppercase">
                                  Posto Atual
                                </span>
                              )}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-medium">{sec.workCentersCount}</td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-medium">{sec.totalResources}</td>
                            <td className="p-1.5 text-right border-r border-slate-200 font-semibold truncate">
                              {Math.round(sec.weeklyCapacity).toLocaleString('pt-BR')} h
                            </td>
                            <td className="p-1.5 text-right border-r border-slate-200 font-bold truncate">
                              {Math.round(sec.totalRequiredHours).toLocaleString('pt-BR')} h
                            </td>
                            <td className="p-1.5 text-right border-r border-slate-200 font-semibold truncate">
                              {Math.round(sec.peakLoad).toLocaleString('pt-BR')} h
                            </td>
                            <td
                              className={`p-1.5 text-center border-r border-slate-200 font-black ${
                                (sec.peakUtilization ?? 0) > 100 ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              {(sec.peakUtilization ?? 0).toFixed(0)}%
                            </td>
                            <td className="p-1.5 text-center">
                              {sec.isCritical ? (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                  GARGALO ({sec.overloadedWeeks}s)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ OK
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
            )}

            {/* 5. WORK CENTERS DETAILED MATRIX */}
            {includeWorkCenterTable && (
              <div className="space-y-1.5 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    {selectedWorkCenterObj
                      ? `4. Parâmetros & Diagnóstico do Posto: ${selectedWorkCenterObj.name}`
                      : '4. Detalhamento de Carga por Centro de Trabalho'}
                  </h3>
                  <span className="text-[9px] text-slate-500 font-semibold">{filteredSummaries.length} postos listados</span>
                </div>

                <div className="w-full overflow-x-hidden">
                  <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-200">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[14%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[10%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                    </colgroup>
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[9px] uppercase">
                      <tr>
                        <th className="p-1 border-r border-slate-200">Posto</th>
                        <th className="p-1 border-r border-slate-200">Setor</th>
                        <th className="p-1 text-center border-r border-slate-200">Rec</th>
                        <th className="p-1 text-center border-r border-slate-200">Turn</th>
                        <th className="p-1 text-center border-r border-slate-200">Efic</th>
                        <th className="p-1 text-right border-r border-slate-200">Capac.</th>
                        <th className="p-1 text-right border-r border-slate-200">Demanda</th>
                        <th className="p-1 text-right border-r border-slate-200">Pico</th>
                        <th className="p-1 text-center border-r border-slate-200">%</th>
                        <th className="p-1 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800 text-[10px]">
                      {filteredSummaries.map((s) => {
                        const weeklyCap = calculateWeeklyCapacity(s.workCenter);
                        const maxUtil = s.maxUtilizationPercentage ?? 0;
                        const avgUtil = s.averageUtilizationPercentage ?? 0;
                        const isOver = s.status === 'CRITICAL' || maxUtil > 100 || (s.overloadedWeeksCount ?? 0) > 0;
                        const shifts = s.workCenter.dailyHours ? Math.round(s.workCenter.dailyHours / 8) : 1;
                        return (
                          <tr key={s.workCenter.id} className={isOver ? 'bg-rose-50/60' : 'hover:bg-slate-50'}>
                            <td className="p-1 font-bold border-r border-slate-200 truncate" title={s.workCenter.name}>
                              {s.workCenter.name}
                            </td>
                            <td className="p-1 border-r border-slate-200 text-slate-600 text-[9px] truncate" title={getWorkCenterCategory(s.workCenter)}>
                              {getWorkCenterCategory(s.workCenter)}
                            </td>
                            <td className="p-1 text-center border-r border-slate-200 font-semibold">{s.workCenter.resourcesCount}</td>
                            <td className="p-1 text-center border-r border-slate-200">{shifts}T</td>
                            <td className="p-1 text-center border-r border-slate-200">{s.workCenter.efficiencyPercentage}%</td>
                            <td className="p-1 text-right border-r border-slate-200 font-medium truncate">
                              {Math.round(weeklyCap).toLocaleString('pt-BR')}h
                            </td>
                            <td className="p-1 text-right border-r border-slate-200 font-bold truncate">
                              {Math.round(s.totalRequiredHours || 0).toLocaleString('pt-BR')}h
                            </td>
                            <td className="p-1 text-right border-r border-slate-200 font-semibold truncate">
                              {Math.round(s.peakWeeklyLoad || 0).toLocaleString('pt-BR')}h
                            </td>
                            <td
                              className={`p-1 text-center border-r border-slate-200 font-black ${
                                maxUtil > 100 ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              {maxUtil.toFixed(0)}%
                            </td>
                            <td className="p-1 text-center font-bold">
                              {isOver ? (
                                <span className="text-[9px] font-black text-rose-700">
                                  ⚠️ SOBRE ({s.overloadedWeeksCount || 0}s)
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-700">
                                  ✓ {avgUtil.toFixed(0)}%
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
            )}

            {/* 6. PROJECTS & TIMELINE SUMMARY */}
            {includeProjectsTable && activeProjects.length > 0 && (
              <div className="space-y-1.5 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    {selectedWorkCenterObj
                      ? `5. Projetos com Alocação em "${selectedWorkCenterObj.name}"`
                      : '5. Carteira de Projetos & Cronograma'}
                  </h3>
                  <span className="text-[9px] text-slate-500 font-semibold">
                    {selectedWorkCenterObj
                      ? `${relevantProjectsList.filter((p) => getProjectWorkCenterHours(p, selectedWorkCenterObj) > 0).length} projetos com carga no posto`
                      : `${activeProjects.length} projetos ativos`}
                  </span>
                </div>

                <div className="w-full overflow-x-hidden">
                  <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-200">
                    {selectedWorkCenterObj ? (
                      <>
                        <colgroup>
                          <col className="w-[28%]" />
                          <col className="w-[20%]" />
                          <col className="w-[12%]" />
                          <col className="w-[12%]" />
                          <col className="w-[14%]" />
                          <col className="w-[14%]" />
                        </colgroup>
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[9px] uppercase">
                          <tr>
                            <th className="p-1 border-r border-slate-200">Projeto</th>
                            <th className="p-1 border-r border-slate-200">Tipo / Equipamento</th>
                            <th className="p-1 text-center border-r border-slate-200">Início</th>
                            <th className="p-1 text-center border-r border-slate-200">Término</th>
                            <th className="p-1 text-right border-r border-slate-200 text-indigo-900 bg-indigo-50/70">
                              Horas no Posto
                            </th>
                            <th className="p-1 text-right">Horas Totais</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-800 text-[10px]">
                          {relevantProjectsList.map((p) => {
                            const wcHrs = getProjectWorkCenterHours(p, selectedWorkCenterObj);
                            const totalHrs = getProjectTotalHours(p, workCenters);
                            const hasWcLoad = wcHrs > 0;
                            return (
                              <tr
                                key={p.id}
                                className={hasWcLoad ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'opacity-60 hover:opacity-100 hover:bg-slate-50'}
                              >
                                <td className={`p-1 border-r border-slate-200 truncate ${hasWcLoad ? 'font-bold text-slate-900' : 'text-slate-600'}`} title={p.name}>
                                  {hasWcLoad && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block mr-1"></span>}
                                  {p.name}
                                </td>
                                <td className="p-1 border-r border-slate-200 text-slate-600 text-[9px] truncate" title={p.turbineConfig?.turbineTypeName || 'Equipamento'}>
                                  {p.turbineConfig?.turbineTypeName || 'Equipamento'}
                                </td>
                                <td className="p-1 text-center border-r border-slate-200 font-mono text-[9px]">
                                  {p.startDate}
                                </td>
                                <td className="p-1 text-center border-r border-slate-200 font-mono text-[9px]">
                                  {p.endDate}
                                </td>
                                <td
                                  className={`p-1 text-right border-r border-slate-200 font-black truncate ${
                                    hasWcLoad ? 'text-indigo-800 bg-indigo-50/70' : 'text-slate-400'
                                  }`}
                                >
                                  {Math.round(wcHrs).toLocaleString('pt-BR')} h
                                </td>
                                <td className="p-1 text-right font-medium text-slate-600 truncate">
                                  {Math.round(totalHrs).toLocaleString('pt-BR')} h
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </>
                    ) : (
                      <>
                        <colgroup>
                          <col className="w-[28%]" />
                          <col className="w-[22%]" />
                          <col className="w-[12%]" />
                          <col className="w-[12%]" />
                          <col className="w-[14%]" />
                          <col className="w-[12%]" />
                        </colgroup>
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[9px] uppercase">
                          <tr>
                            <th className="p-1 border-r border-slate-200">Projeto</th>
                            <th className="p-1 border-r border-slate-200">Tipo / Equipamento</th>
                            <th className="p-1 text-center border-r border-slate-200">Início</th>
                            <th className="p-1 text-center border-r border-slate-200">Término</th>
                            <th className="p-1 text-right border-r border-slate-200">Horas</th>
                            <th className="p-1 text-center">Curva</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-800 text-[10px]">
                          {activeProjects.map((p) => {
                            const totalHrs = getProjectTotalHours(p, workCenters);
                            return (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="p-1 font-bold border-r border-slate-200 truncate" title={p.name}>
                                  {p.name}
                                </td>
                                <td className="p-1 border-r border-slate-200 text-slate-600 text-[9px] truncate" title={p.turbineConfig?.turbineTypeName || 'Equipamento'}>
                                  {p.turbineConfig?.turbineTypeName || 'Equipamento'}
                                </td>
                                <td className="p-1 text-center border-r border-slate-200 font-mono text-[9px]">
                                  {p.startDate}
                                </td>
                                <td className="p-1 text-center border-r border-slate-200 font-mono text-[9px]">
                                  {p.endDate}
                                </td>
                                <td className="p-1 text-right border-r border-slate-200 font-bold truncate">
                                  {Math.round(totalHrs).toLocaleString('pt-BR')} h
                                </td>
                                <td className="p-1 text-center text-[9px] text-indigo-700 font-semibold">
                                  Curva S
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* 7. TECHNICAL NOTES & RECOMMENDATIONS */}
            {includeRecommendations && (
              <div className="space-y-2 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    6. Parecer Técnico & Recomendações de Balanceamento
                  </h3>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Parecer da Engenharia de Planejamento (PCP):
                    </label>
                    <p className="text-slate-700 leading-relaxed font-medium bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                      {customNotes}
                    </p>
                  </div>

                    {filteredRecommendations.length > 0 && (
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Ações Prioritárias Recomendadas:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
                        {filteredRecommendations.slice(0, 4).map((rec, i) => (
                          <li key={i}>
                            <strong>{rec.workCenterName || 'Centro'}:</strong> {rec.message || rec.description || rec.action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 8. SIGNATURES & VERIFICATION */}
            {includeSignatures && (
              <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 break-inside-avoid text-xs text-slate-700">
                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 w-52 mx-auto pt-1"></div>
                  <p className="font-bold text-slate-900">{plannerName}</p>
                  <p className="text-[10px] text-slate-500">Engenharia de Planejamento & Controle (PCP)</p>
                </div>

                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 w-52 mx-auto pt-1"></div>
                  <p className="font-bold text-slate-900">Gerência Industrial / Operações</p>
                  <p className="text-[10px] text-slate-500">Aprovação de Capacidade e Recursos</p>
                </div>
              </div>
            )}

            {/* Report Footer */}
            <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-2 break-inside-avoid">
              Documento gerado automaticamente pelo Sistema de Análise de Carga Máquina & Gestão de Capacidade PCP.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
