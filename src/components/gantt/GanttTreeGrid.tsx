import React, { useState, useRef, useEffect } from 'react';
import {
  GanttTaskNode,
  GanttItemStatus,
  GanttConstraintType,
} from '../../types/gantt';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Edit2,
  Package,
  Factory,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  CornerDownRight,
  PlusSquare,
  Copy,
  ArrowRightLeft,
  ChevronLeft,
  MoreHorizontal,
  Check,
} from 'lucide-react';

interface GanttTreeGridProps {
  visibleTasks: GanttTaskNode[];
  allTasks: GanttTaskNode[];
  onToggleExpand: (taskId: string) => void;
  onEditTask: (task: GanttTaskNode) => void;
  onAddChildTask: (parentTask: GanttTaskNode) => void;
  onAddSiblingTask: (currentTask: GanttTaskNode) => void;
  onDuplicateTask: (task: GanttTaskNode) => void;
  onIndentTask?: (task: GanttTaskNode) => void;
  onOutdentTask?: (task: GanttTaskNode) => void;
  onAddNewProject: () => void;
  onUpdateTaskName: (taskId: string, newName: string) => void;
  onUpdateTaskProgress: (taskId: string, newProgress: number) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: GanttItemStatus) => void;
  hoveredTaskId: string | null;
  setHoveredTaskId: (id: string | null) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const ROW_HEIGHT = 44; // px per task row
const HEADER_HEIGHT = 56; // px for table header

export const GanttTreeGrid: React.FC<GanttTreeGridProps> = ({
  visibleTasks,
  allTasks,
  onToggleExpand,
  onEditTask,
  onAddChildTask,
  onAddSiblingTask,
  onDuplicateTask,
  onIndentTask,
  onOutdentTask,
  onAddNewProject,
  onUpdateTaskName,
  onUpdateTaskProgress,
  onUpdateTaskStatus,
  hoveredTaskId,
  setHoveredTaskId,
  scrollRef,
}) => {
  // Inline editing state for Task Name
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Inline editing state for Progress
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);
  const [editingProgressValue, setEditingProgressValue] = useState<number>(0);
  const progressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNameId && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingNameId]);

  useEffect(() => {
    if (editingProgressId && progressInputRef.current) {
      progressInputRef.current.focus();
      progressInputRef.current.select();
    }
  }, [editingProgressId]);

  const handleStartEditName = (task: GanttTaskNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNameId(task.id);
    setEditingNameValue(task.name);
  };

  const handleSaveName = (taskId: string) => {
    if (editingNameValue.trim()) {
      onUpdateTaskName(taskId, editingNameValue.trim());
    }
    setEditingNameId(null);
  };

  const handleStartEditProgress = (task: GanttTaskNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProgressId(task.id);
    setEditingProgressValue(task.progress);
  };

  const handleSaveProgress = (taskId: string) => {
    const clamped = Math.min(100, Math.max(0, Number(editingProgressValue) || 0));
    onUpdateTaskProgress(taskId, clamped);
    setEditingProgressId(null);
  };

  // Quick cycle progress on click (0% -> 25% -> 50% -> 75% -> 100% -> 0%)
  const handleQuickCycleProgress = (task: GanttTaskNode, e: React.MouseEvent) => {
    e.stopPropagation();
    let next = 0;
    if (task.progress < 25) next = 25;
    else if (task.progress < 50) next = 50;
    else if (task.progress < 75) next = 75;
    else if (task.progress < 100) next = 100;
    else next = 0;

    onUpdateTaskProgress(task.id, next);
  };

  // Check if a task has children
  const hasChildrenMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    allTasks.forEach((t) => {
      if (t.parentId) {
        map.set(t.parentId, true);
      }
    });
    return map;
  }, [allTasks]);

  return (
    <div
      ref={scrollRef}
      className="w-[660px] shrink-0 border-r border-slate-800 bg-slate-900/95 overflow-x-auto overflow-y-auto select-none scrollbar-thin scrollbar-thumb-slate-700 flex flex-col"
    >
      <div style={{ minWidth: '660px' }}>
        {/* Table Header */}
        <div
          className="sticky top-0 z-20 flex items-center bg-slate-900 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 shadow-sm justify-between"
          style={{ height: `${HEADER_HEIGHT}px` }}
        >
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <div className="w-12 text-center shrink-0">Nível</div>
            <div className="flex-1 text-left px-2">Estrutura EAP / Descrição</div>
          </div>

          <div className="flex items-center gap-1">
            <div className="w-16 text-right pr-2 shrink-0" title="Horas Planejadas (Soma automática da hierarquia para níveis acima do N4)">Horas</div>
            <div className="w-18 text-center shrink-0">Restrição</div>
            <div className="w-16 text-center shrink-0">Prazos</div>
            <div className="w-20 text-center shrink-0">Avanço %</div>
            <div className="w-24 text-center shrink-0 flex items-center justify-end gap-1">
              <button
                onClick={onAddNewProject}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 rounded text-[10px] font-bold transition-all cursor-pointer"
                title="Cadastrar Novo Projeto Raiz (Nível 0)"
              >
                <Plus className="w-3 h-3" />
                +Projeto N0
              </button>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div>
          {visibleTasks.map((task, rowIndex) => {
            const hasChildren = hasChildrenMap.get(task.id);
            const isHovered = hoveredTaskId === task.id;
            const isProjectRoot = task.level === 0;
            const isGroup = task.level === 1;
            const isEditingThisName = editingNameId === task.id;
            const isEditingThisProgress = editingProgressId === task.id;

            return (
              <div
                key={task.id}
                style={{ height: `${ROW_HEIGHT}px` }}
                className={`flex items-center px-3 border-b border-slate-800/60 transition-colors text-xs group justify-between ${
                  isHovered ? 'bg-indigo-950/40' : rowIndex % 2 === 0 ? 'bg-slate-900/40' : 'bg-transparent'
                } ${isProjectRoot ? 'font-bold bg-indigo-950/20' : isGroup ? 'font-semibold' : ''}`}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                {/* Left Side: Level, Code, Name with tree indent & Inline Edit */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {/* Level Badge */}
                  <div className="w-12 text-center shrink-0 flex justify-center">
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        task.level === 0
                          ? 'bg-indigo-600 text-white'
                          : task.level === 1
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                          : task.level === 2
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                          : task.level === 3
                          ? 'bg-teal-600/30 text-teal-300 border border-teal-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      N{task.level}
                    </span>
                  </div>

                  {/* Name & Tree Indentation */}
                  <div
                    className="flex-1 min-w-[200px] flex items-center gap-1.5 truncate px-1"
                    style={{ paddingLeft: `${(task.treeDepth !== undefined ? task.treeDepth : task.level) * 16 + 4}px` }}
                  >
                    {/* Expand / Collapse Button */}
                    {hasChildren ? (
                      <button
                        onClick={() => onToggleExpand(task.id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        {task.expanded !== false ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}

                    {/* Icon per type */}
                    {task.type === 'project' && <span className="text-xs shrink-0">🏭</span>}
                    {task.type === 'group' && <span className="text-xs shrink-0">📦</span>}
                    {task.type === 'subgroup' && <span className="text-xs shrink-0">🧩</span>}
                    {task.type === 'item' && <span className="text-xs shrink-0">🔩</span>}
                    {task.type === 'operation' && <span className="text-xs shrink-0">⚙️</span>}
                    {task.type === 'milestone' && <span className="text-xs shrink-0">★</span>}

                    {/* Inline Editable Description */}
                    {isEditingThisName ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName(task.id);
                            if (e.key === 'Escape') setEditingNameId(null);
                          }}
                          onBlur={() => handleSaveName(task.id)}
                          className="w-full bg-slate-950 text-white font-medium px-2 py-0.5 rounded border border-indigo-500 focus:outline-none text-xs"
                        />
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSaveName(task.id);
                          }}
                          className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-500 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => handleStartEditName(task, e)}
                        className="truncate text-slate-100 hover:text-indigo-300 hover:bg-slate-800/60 px-1.5 py-0.5 rounded transition-colors cursor-text font-medium flex-1"
                        title="Clique duas vezes ou clique para alterar a descrição diretamente"
                      >
                        {task.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Hours, Constraint, Dates, Interactive Progress & Quick Action Shortcuts */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Hours (Calculated Sum for Parent levels N0..N3, direct for N4 operations) */}
                  <div className="w-16 text-right pr-2 shrink-0 font-mono text-[11px]">
                    {task.plannedHours ? (
                      <span
                        className={`font-bold ${
                          task.level === 0
                            ? 'text-amber-300'
                            : task.level === 1
                            ? 'text-indigo-300'
                            : task.level === 2
                            ? 'text-purple-300'
                            : task.level === 3
                            ? 'text-teal-300'
                            : 'text-slate-300'
                        }`}
                        title={
                          hasChildren
                            ? `Total acumulado na EAP: ${task.plannedHours.toLocaleString('pt-BR')}h (soma automática das operações filhas)`
                            : `Operação Fabril: ${task.plannedHours}h planejadas`
                        }
                      >
                        {task.plannedHours.toLocaleString('pt-BR')}h
                      </span>
                    ) : (
                      <span className="text-slate-600 font-mono text-[10px]">0h</span>
                    )}
                  </div>

                  {/* Constraint Type */}
                  <div className="w-18 text-center shrink-0 flex justify-center">
                    {task.constraintType === 'contract' && (
                      <span
                        title="Data Contratual"
                        className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.5 rounded flex items-center gap-0.5 truncate max-w-[70px]"
                      >
                        📜 Contrato
                      </span>
                    )}
                    {task.constraintType === 'capacity' && (
                      <span
                        title={task.workCenterName ? `CT: ${task.workCenterName}` : 'Capacidade do CT'}
                        className="text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 py-0.5 rounded flex items-center gap-0.5 truncate max-w-[70px]"
                      >
                        ⚙️ {task.workCenterName ? task.workCenterName.slice(0, 6) : 'CT'}
                      </span>
                    )}
                    {task.constraintType === 'material' && (
                      <span
                        title={`Material: ${task.materialName || 'Suprimento'} (${task.materialStatus || 'Pedido'})`}
                        className="text-[9px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1 py-0.5 rounded flex items-center gap-0.5 truncate max-w-[70px]"
                      >
                        📦 Mat.
                      </span>
                    )}
                    {task.constraintType === 'manual' && (
                      <span className="text-[9px] font-bold bg-slate-800 text-slate-400 px-1 py-0.5 rounded">
                        ✋ Manual
                      </span>
                    )}
                  </div>

                  {/* Dates & Duration */}
                  <div className="w-16 text-center shrink-0 text-[10px] font-mono text-slate-300 flex flex-col leading-tight">
                    <span>{task.startDate.slice(5)}</span>
                    <span className="text-slate-500">{task.endDate.slice(5)}</span>
                  </div>

                  {/* Interactive Progress (Direct Click / Edit % right in table) */}
                  <div className="w-20 text-center shrink-0 px-1">
                    {isEditingThisProgress ? (
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={progressInputRef}
                          type="number"
                          min={0}
                          max={100}
                          value={editingProgressValue}
                          onChange={(e) => setEditingProgressValue(Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveProgress(task.id);
                            if (e.key === 'Escape') setEditingProgressId(null);
                          }}
                          onBlur={() => handleSaveProgress(task.id)}
                          className="w-12 bg-slate-950 text-white font-mono font-bold text-[11px] px-1 py-0.5 rounded border border-indigo-500 focus:outline-none text-center"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">%</span>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => handleQuickCycleProgress(task, e)}
                        onDoubleClick={(e) => handleStartEditProgress(task, e)}
                        className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-800/80 cursor-pointer group/prog"
                        title="Clique para alternar avanço (+25%) ou clique duplo para digitar o valor exato"
                      >
                        <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                          <div
                            style={{ width: `${task.progress}%` }}
                            className={`h-full transition-all ${
                              task.progress === 100
                                ? 'bg-emerald-500'
                                : task.status === 'delayed'
                                ? 'bg-rose-500'
                                : 'bg-indigo-500'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] font-mono font-black text-slate-200 group-hover/prog:text-indigo-400 w-7 text-right">
                          {task.progress}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Fast Action Shortcuts: +Irmão (Same level) and +Filho (Sub-level) */}
                  <div
                    className="w-24 text-center shrink-0 flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Sibling Button (+ Mesmo Nível) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSiblingTask(task);
                      }}
                      className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-bold text-indigo-300 bg-indigo-950/70 hover:bg-indigo-600 hover:text-white border border-indigo-700/40 rounded transition-all cursor-pointer shadow-xs"
                      title="Adicionar Linha no Mesmo Nível (Irmão na hierarquia EAP)"
                    >
                      <Plus className="w-3 h-3" />
                      <span>=N{task.level ?? 1}</span>
                    </button>

                    {/* Child Button (+ Sub-nível abaixo) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddChildTask(task);
                      }}
                      className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/70 hover:bg-emerald-600 hover:text-white border border-emerald-700/40 rounded transition-all cursor-pointer shadow-xs"
                      title="Adicionar Sub-nível abaixo (Filho na hierarquia EAP)"
                    >
                      <CornerDownRight className="w-3 h-3" />
                      <span>+N{(task.level ?? 0) + 1}</span>
                    </button>

                    {/* Duplicate button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateTask(task);
                      }}
                      className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors cursor-pointer hidden group-hover:block"
                      title="Duplicar Item e toda a sua árvore de subitens (EAP)"
                    >
                      <Copy className="w-3 h-3" />
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTask(task);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                      title="Editar Propriedades Detalhadas"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
