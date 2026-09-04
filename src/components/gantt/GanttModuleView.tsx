import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  GanttTaskNode,
  GanttZoomLevel,
  GanttFilterOptions,
  GanttItemStatus,
  MaterialDeliveryStatus,
} from '../../types/gantt';
import { WorkCenter, CalendarException, Project } from '../../types';
import {
  getFlattenedVisibleTasks,
  getTimelineBounds,
  generateTimelineColumns,
  calculateGanttMetrics,
  generateSmartTaskCode,
  duplicateTaskSubtree,
  deleteTaskSubtree,
} from '../../utils/ganttEngine';
import { GanttTreeGrid } from './GanttTreeGrid';
import { GanttChartTimeline } from './GanttChartTimeline';
import { GanttDashboard } from './GanttDashboard';
import { GanttMaterialsPanel } from './GanttMaterialsPanel';
import { GanttTaskModal } from './GanttTaskModal';
import {
  Calendar,
  Layers,
  Search,
  Plus,
  Filter,
  TrendingUp,
  Package,
  Factory,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  CalendarRange,
  FileSpreadsheet,
  PlusCircle,
} from 'lucide-react';
import { DatePickerField } from '../DatePickerField';
import { addDays, format, parseISO } from 'date-fns';

interface GanttModuleViewProps {
  tasks: GanttTaskNode[];
  onUpdateTasks: (tasks: GanttTaskNode[]) => void;
  workCenters: WorkCenter[];
  projects: Project[];
  calendarExceptions: CalendarException[];
}

export const GanttModuleView: React.FC<GanttModuleViewProps> = ({
  tasks,
  onUpdateTasks,
  workCenters,
  projects,
  calendarExceptions,
}) => {
  // Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'dashboard' | 'materials'>('timeline');

  // Zoom
  const [zoom, setZoom] = useState<GanttZoomLevel>('weeks');

  // Hover state for synchronization between table and timeline
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // Synchronized scroll refs
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Filters
  const [filters, setFilters] = useState<GanttFilterOptions>({
    projectId: 'all',
    levelFilter: 'all',
    constraintFilter: 'all',
    statusFilter: 'all',
    workCenterFilter: 'all',
    searchTerm: '',
  });

  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<GanttTaskNode | null>(null);
  const [modalDefaultParentId, setModalDefaultParentId] = useState<string | null>(null);
  const [modalDefaultLevel, setModalDefaultLevel] = useState<number>(1);
  const [modalDefaultCode, setModalDefaultCode] = useState<string>('');
  const [modalDefaultName, setModalDefaultName] = useState<string>('');
  const [modalDefaultStartDate, setModalDefaultStartDate] = useState<string>('');
  const [modalDefaultEndDate, setModalDefaultEndDate] = useState<string>('');

  // Synchronize vertical scroll between tree and timeline
  useEffect(() => {
    const treeEl = treeScrollRef.current;
    const timeEl = timelineScrollRef.current;

    if (!treeEl || !timeEl) return;

    const handleTreeScroll = () => {
      timeEl.scrollTop = treeEl.scrollTop;
    };

    const handleTimeScroll = () => {
      treeEl.scrollTop = timeEl.scrollTop;
    };

    treeEl.addEventListener('scroll', handleTreeScroll);
    timeEl.addEventListener('scroll', handleTimeScroll);

    return () => {
      treeEl.removeEventListener('scroll', handleTreeScroll);
      timeEl.removeEventListener('scroll', handleTimeScroll);
    };
  }, [activeSubTab]);

  // Compute visible tasks
  const visibleTasks = useMemo(() => {
    return getFlattenedVisibleTasks(tasks, filters);
  }, [tasks, filters]);

  // Compute timeline bounds & columns
  const timelineBounds = useMemo(() => {
    return getTimelineBounds(tasks, customStartDate, customEndDate);
  }, [tasks, customStartDate, customEndDate]);

  const timeline = useMemo(() => {
    return generateTimelineColumns(
      timelineBounds.minDate,
      timelineBounds.maxDate,
      zoom,
      calendarExceptions
    );
  }, [timelineBounds, zoom, calendarExceptions]);

  // Metrics
  const metrics = useMemo(() => {
    return calculateGanttMetrics(tasks);
  }, [tasks]);

  // Handlers
  const handleToggleExpand = (taskId: string) => {
    onUpdateTasks(
      tasks.map((t) =>
        t.id === taskId ? { ...t, expanded: t.expanded !== false ? false : true } : t
      )
    );
  };

  const handleExpandAll = (expand: boolean) => {
    onUpdateTasks(tasks.map((t) => ({ ...t, expanded: expand })));
  };

  const handleSaveTask = (savedTask: GanttTaskNode) => {
    const exists = tasks.some((t) => t.id === savedTask.id);
    if (exists) {
      onUpdateTasks(tasks.map((t) => (t.id === savedTask.id ? savedTask : t)));
    } else {
      // If adding a child, ensure parent is expanded so user immediately sees the new item
      let updated = [...tasks, savedTask];
      if (savedTask.parentId) {
        updated = updated.map((t) =>
          t.id === savedTask.parentId ? { ...t, expanded: true } : t
        );
      }
      onUpdateTasks(updated);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    // Delete task and all its recursive descendants
    const updated = deleteTaskSubtree(taskId, tasks);
    onUpdateTasks(updated);
  };

  // Direct Inline Task Name Edit in Table
  const handleUpdateTaskName = (taskId: string, newName: string) => {
    onUpdateTasks(
      tasks.map((t) => (t.id === taskId ? { ...t, name: newName } : t))
    );
  };

  // Direct Inline / Timeline Progress Edit
  const handleUpdateTaskProgress = (taskId: string, newProgress: number) => {
    onUpdateTasks(
      tasks.map((t) => {
        if (t.id === taskId) {
          const status: GanttItemStatus =
            newProgress >= 100
              ? 'completed'
              : newProgress > 0 && t.status === 'not_started'
              ? 'in_progress'
              : t.status;
          return { ...t, progress: newProgress, status };
        }
        return t;
      })
    );
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: GanttItemStatus) => {
    onUpdateTasks(
      tasks.map((t) => {
        if (t.id === taskId) {
          const progress =
            newStatus === 'completed' ? 100 : newStatus === 'not_started' ? 0 : t.progress;
          return { ...t, status: newStatus, progress };
        }
        return t;
      })
    );
  };

  const handleUpdateMaterialStatus = (taskId: string, newStatus: MaterialDeliveryStatus) => {
    onUpdateTasks(
      tasks.map((t) =>
        t.id === taskId ? { ...t, materialStatus: newStatus } : t
      )
    );
  };

  // Timeline Drag & Drop / Resize update handler
  const handleUpdateTaskDates = (taskId: string, newStartDate: string, newEndDate: string) => {
    onUpdateTasks(
      tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            startDate: newStartDate,
            endDate: newEndDate,
          };
        }
        return t;
      })
    );
  };

  // Quick Sibling Creation: Same Level as selected row
  const handleAddSiblingTask = (currentTask: GanttTaskNode) => {
    const smart = generateSmartTaskCode(currentTask, tasks, false);
    setEditingTask(null);
    setModalDefaultParentId(smart.parentId);
    setModalDefaultLevel(smart.level);
    setModalDefaultCode(smart.code);
    setModalDefaultName(`Novo Item ${smart.code}`);
    setModalDefaultStartDate(currentTask.startDate);
    setModalDefaultEndDate(currentTask.endDate);
    setIsTaskModalOpen(true);
  };

  // Quick Child Creation: One Sub-Level below selected row
  const handleAddChildTask = (parentTask: GanttTaskNode) => {
    const smart = generateSmartTaskCode(parentTask, tasks, true);
    setEditingTask(null);
    setModalDefaultParentId(smart.parentId);
    setModalDefaultLevel(smart.level);
    setModalDefaultCode(smart.code);
    setModalDefaultName(`Operação / Sub-item ${smart.code}`);
    setModalDefaultStartDate(parentTask.startDate);
    setModalDefaultEndDate(parentTask.endDate);
    setIsTaskModalOpen(true);
  };

  // Duplicate Row / Item and its entire descendant subtree
  const handleDuplicateTask = (task: GanttTaskNode) => {
    const updated = duplicateTaskSubtree(task.id, tasks);
    onUpdateTasks(updated);
  };

  // Add Root Project
  const handleAddNewProject = () => {
    const smart = generateSmartTaskCode(null, tasks, false);
    setEditingTask(null);
    setModalDefaultParentId(null);
    setModalDefaultLevel(0);
    setModalDefaultCode(smart.code);
    setModalDefaultName('Novo Projeto / Turbina');
    const today = format(new Date(), 'yyyy-MM-dd');
    setModalDefaultStartDate(today);
    setModalDefaultEndDate(format(addDays(new Date(), 90), 'yyyy-MM-dd'));
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: GanttTaskNode) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  // Distinct projects in Gantt
  const rootProjects = tasks.filter((t) => t.level === 0);

  return (
    <div className="space-y-4">
      {/* Module Navigation Sub-Header */}
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'timeline'
                ? 'bg-indigo-600 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Linha do Tempo (Gantt Interativo)
          </button>

          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Dashboard & KPIs de Execução
            {metrics.delayedTasks > 0 && (
              <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                {metrics.delayedTasks}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('materials')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'materials'
                ? 'bg-indigo-600 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Suprimentos & Materiais
            {metrics.materialsDelayed > 0 && (
              <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full">
                {metrics.materialsDelayed}
              </span>
            )}
          </button>
        </div>

        {/* Global Action: Fast New Item */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddNewProject}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Adicionar Projeto Raiz (N0)"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            + Novo Projeto (N0)
          </button>

          <button
            onClick={() => {
              const lastTask = tasks[tasks.length - 1];
              if (lastTask) {
                handleAddSiblingTask(lastTask);
              } else {
                handleAddNewProject();
              }
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/30 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Nova Linha EAP
          </button>
        </div>
      </div>

      {/* Sub-Tab: Dashboard */}
      {activeSubTab === 'dashboard' && (
        <GanttDashboard
          allTasks={tasks}
          metrics={metrics}
          workCenters={workCenters}
          onSelectTask={handleEditTask}
          onNavigateToGantt={() => setActiveSubTab('timeline')}
        />
      )}

      {/* Sub-Tab: Materials */}
      {activeSubTab === 'materials' && (
        <GanttMaterialsPanel
          allTasks={tasks}
          onUpdateMaterialStatus={handleUpdateMaterialStatus}
          onEditTask={handleEditTask}
        />
      )}

      {/* Sub-Tab: Interactive Gantt Timeline */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-3">
          {/* Filters & Zoom Controls Bar */}
          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left Filter Group */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar operação, código, CT..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Project Filter */}
              <select
                value={filters.projectId}
                onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Todos os Projetos ({rootProjects.length})</option>
                {rootProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>

              {/* Level Filter */}
              <select
                value={filters.levelFilter}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    levelFilter: e.target.value === 'all' ? 'all' : Number(e.target.value),
                  })
                }
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Todos os Níveis (0..N)</option>
                <option value="0">Nível 0 - Turbinas</option>
                <option value="1">Nível 1 - Conjuntos</option>
                <option value="2">Nível 2 - Subconjuntos</option>
                <option value="3">Nível 3 - Itens</option>
                <option value="4">Nível 4+ - Operações</option>
              </select>

              {/* Constraint Filter */}
              <select
                value={filters.constraintFilter}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    constraintFilter: e.target.value as any,
                  })
                }
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Todas as Restrições</option>
                <option value="contract">📜 Contratual</option>
                <option value="capacity">⚙️ Capacidade CT</option>
                <option value="material">📦 Material / Compra</option>
                <option value="manual">✋ Manual</option>
              </select>

              {/* Status Filter */}
              <select
                value={filters.statusFilter}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    statusFilter: e.target.value as any,
                  })
                }
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="in_progress">Em Andamento</option>
                <option value="completed">Concluídos</option>
                <option value="delayed">Atrasados</option>
                <option value="waiting_material">Aguardando Material</option>
                <option value="not_started">Não Iniciados</option>
              </select>
            </div>

            {/* Right Zoom & Expand Group */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Expand / Collapse All */}
              <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                <button
                  onClick={() => handleExpandAll(true)}
                  className="px-2 py-1 text-[11px] text-slate-400 hover:text-white rounded transition-colors"
                  title="Expandir Todos os Ramos"
                >
                  Expandir
                </button>
                <span className="text-slate-700">|</span>
                <button
                  onClick={() => handleExpandAll(false)}
                  className="px-2 py-1 text-[11px] text-slate-400 hover:text-white rounded transition-colors"
                  title="Recolher Todos os Ramos"
                >
                  Recolher
                </button>
              </div>

              {/* Zoom Buttons */}
              <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                {(
                  [
                    { id: 'days', label: 'Dias' },
                    { id: 'weeks', label: 'Semanas' },
                    { id: 'months', label: 'Meses' },
                    { id: 'years', label: 'Anos' },
                  ] as const
                ).map((z) => (
                  <button
                    key={z.id}
                    onClick={() => setZoom(z.id)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      zoom === z.id
                        ? 'bg-indigo-600 text-white font-black shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Drag & Drop Hint Banner */}
          <div className="bg-indigo-950/30 border border-indigo-500/20 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600/40 text-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">
                Edição Instantânea
              </span>
              <span>
                <strong>Editar descrição:</strong> Clique no texto na tabela para renomear.
                {' '}|{' '}
                <strong>Avanço %:</strong> Altere clicando ou digitando na tabela, ou arraste/clique na barra do Gantt.
                {' '}|{' '}
                <strong>Linha do tempo:</strong> Arraste a barra para mudar datas ou as bordas para redimensionar.
              </span>
            </div>
          </div>

          {/* Main Gantt Split Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex h-[680px]">
            {/* Left: Tree Grid */}
            <GanttTreeGrid
              visibleTasks={visibleTasks}
              allTasks={tasks}
              onToggleExpand={handleToggleExpand}
              onEditTask={handleEditTask}
              onAddChildTask={handleAddChildTask}
              onAddSiblingTask={handleAddSiblingTask}
              onDuplicateTask={handleDuplicateTask}
              onAddNewProject={handleAddNewProject}
              onUpdateTaskName={handleUpdateTaskName}
              onUpdateTaskProgress={handleUpdateTaskProgress}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              hoveredTaskId={hoveredTaskId}
              setHoveredTaskId={setHoveredTaskId}
              scrollRef={treeScrollRef}
            />

            {/* Right: Chart Timeline with Drag & Drop, Resize & Progress */}
            <GanttChartTimeline
              timeline={timeline}
              visibleTasks={visibleTasks}
              allTasks={tasks}
              zoom={zoom}
              calendarExceptions={calendarExceptions}
              onTaskClick={handleEditTask}
              onUpdateTaskDates={handleUpdateTaskDates}
              onUpdateTaskProgress={handleUpdateTaskProgress}
              hoveredTaskId={hoveredTaskId}
              setHoveredTaskId={setHoveredTaskId}
              scrollRef={timelineScrollRef}
            />
          </div>

          {/* Quick Summary Bar */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center gap-4">
              <span>
                Exibindo <strong className="text-white font-mono">{visibleTasks.length}</strong> de{' '}
                <strong className="text-white font-mono">{tasks.length}</strong> itens
              </span>
              <span>
                Avanço Ponderado:{' '}
                <strong className="text-emerald-400 font-mono">{metrics.overallProgress}%</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Concluído
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Em Andamento
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Atrasado
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Aguardando Material
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      <GanttTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        editingTask={editingTask}
        allTasks={tasks}
        workCenters={workCenters}
        defaultParentId={modalDefaultParentId}
        defaultLevel={modalDefaultLevel}
        defaultCode={modalDefaultCode}
        defaultName={modalDefaultName}
        defaultStartDate={modalDefaultStartDate}
        defaultEndDate={modalDefaultEndDate}
      />
    </div>
  );
};
