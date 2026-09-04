import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Trash2,
  Calendar,
  Layers,
  Factory,
  Package,
  FileCheck2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  ArrowRight,
  GitFork,
  FileText,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  GanttTaskNode,
  GanttItemType,
  GanttConstraintType,
  GanttItemStatus,
  MaterialDeliveryStatus,
} from '../../types/gantt';
import { WorkCenter } from '../../types';
import { DatePickerField } from '../DatePickerField';
import { calculateAutoEapCode, getAllDescendants } from '../../utils/ganttEngine';
import { format } from 'date-fns';

interface GanttTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: GanttTaskNode) => void;
  onDelete?: (taskId: string) => void;
  editingTask: GanttTaskNode | null;
  allTasks: GanttTaskNode[];
  workCenters: WorkCenter[];
  defaultParentId?: string | null;
  defaultLevel?: number;
  defaultCode?: string;
  defaultName?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

// Unified Classification Options combining Level + Element Type
const CLASSIFICATION_OPTIONS = [
  { level: 0, type: 'project' as GanttItemType, label: 'Nível 0 — Turbina / Projeto Raiz', badge: '🏭 Turbina / Projeto' },
  { level: 1, type: 'group' as GanttItemType, label: 'Nível 1 — Conjunto Principal', badge: '📦 Conjunto' },
  { level: 2, type: 'subgroup' as GanttItemType, label: 'Nível 2 — Subconjunto', badge: '🧩 Subconjunto' },
  { level: 3, type: 'item' as GanttItemType, label: 'Nível 3 — Item / Peça / Componente', badge: '🔩 Item / Peça' },
  { level: 4, type: 'operation' as GanttItemType, label: 'Nível 4 — Operação Fabril (Usinagem / Solda / Montagem)', badge: '⚙️ Operação Fabril' },
  { level: 5, type: 'operation' as GanttItemType, label: 'Nível 5 — Sub-Operação Detalhada', badge: '⚙️ Sub-Operação' },
  { level: 3, type: 'milestone' as GanttItemType, label: 'Marco / Inspeção / Ponto de Controle (Milestone)', badge: '★ Marco / Inspeção' },
];

export const GanttTaskModal: React.FC<GanttTaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingTask,
  allTasks,
  workCenters,
  defaultParentId = null,
  defaultLevel = 1,
  defaultCode = '',
  defaultName = '',
  defaultStartDate,
  defaultEndDate,
}) => {
  const isEditing = !!editingTask;

  // Unified level and type
  const [selectedClassificationIndex, setSelectedClassificationIndex] = useState<number>(0);
  const [parentId, setParentId] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [constraintType, setConstraintType] = useState<GanttConstraintType>('capacity');
  const [workCenterId, setWorkCenterId] = useState<string>('');
  const [plannedHours, setPlannedHours] = useState<number>(40);
  const [actualHours, setActualHours] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [baselineStartDate, setBaselineStartDate] = useState<string>('');
  const [baselineEndDate, setBaselineEndDate] = useState<string>('');
  const [contractDate, setContractDate] = useState<string>('');

  // Material fields
  const [materialName, setMaterialName] = useState<string>('');
  const [materialSupplier, setMaterialSupplier] = useState<string>('');
  const [materialEtaDate, setMaterialEtaDate] = useState<string>('');
  const [materialStatus, setMaterialStatus] = useState<MaterialDeliveryStatus>('ordered');

  // Status & Progress
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<GanttItemStatus>('not_started');
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [assignee, setAssignee] = useState<string>('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Find index in CLASSIFICATION_OPTIONS
  const findClassificationIndex = (lvl: number, t: GanttItemType) => {
    if (t === 'milestone') return 6;
    if (lvl === 0) return 0;
    if (lvl === 1) return 1;
    if (lvl === 2) return 2;
    if (lvl === 3) return 3;
    if (lvl === 4) return 4;
    return 5;
  };

  useEffect(() => {
    if (editingTask) {
      const idx = findClassificationIndex(editingTask.level, editingTask.type);
      setSelectedClassificationIndex(idx);
      setParentId(editingTask.parentId);
      setCode(editingTask.code);
      setName(editingTask.name);
      setConstraintType(editingTask.constraintType);
      setWorkCenterId(editingTask.workCenterId ?? '');
      setPlannedHours(editingTask.plannedHours ?? 0);
      setActualHours(editingTask.actualHours ?? 0);
      setStartDate(editingTask.startDate);
      setEndDate(editingTask.endDate);
      setBaselineStartDate(editingTask.baselineStartDate ?? editingTask.startDate);
      setBaselineEndDate(editingTask.baselineEndDate ?? editingTask.endDate);
      setContractDate(editingTask.contractDate ?? '');
      setMaterialName(editingTask.materialName ?? '');
      setMaterialSupplier(editingTask.materialSupplier ?? '');
      setMaterialEtaDate(editingTask.materialEtaDate ?? '');
      setMaterialStatus(editingTask.materialStatus ?? 'ordered');
      setProgress(editingTask.progress);
      setStatus(editingTask.status);
      setSelectedDependencies(editingTask.dependencies ?? []);
      setNotes(editingTask.notes ?? '');
      setAssignee(editingTask.assignee ?? '');
    } else {
      const defaultType: GanttItemType =
        defaultLevel === 0 ? 'project' : defaultLevel === 1 ? 'group' : defaultLevel === 2 ? 'subgroup' : defaultLevel === 3 ? 'item' : 'operation';
      const idx = findClassificationIndex(defaultLevel, defaultType);
      setSelectedClassificationIndex(idx);
      setParentId(defaultParentId);

      const autoCode = defaultCode || calculateAutoEapCode({
        level: defaultLevel,
        type: defaultType,
        parentId: defaultParentId,
        allTasks,
        currentTaskId: null,
      });
      setCode(autoCode);
      setName(defaultName);
      setConstraintType(defaultLevel === 0 ? 'contract' : 'capacity');
      setWorkCenterId(workCenters[0]?.id || '');
      setPlannedHours(40);
      setActualHours(0);

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const startStr = defaultStartDate || todayStr;
      const endStr = defaultEndDate || todayStr;
      setStartDate(startStr);
      setEndDate(endStr);
      setBaselineStartDate(startStr);
      setBaselineEndDate(endStr);
      setContractDate('');
      setMaterialName('');
      setMaterialSupplier('');
      setMaterialEtaDate('');
      setMaterialStatus('ordered');
      setProgress(0);
      setStatus('not_started');
      setSelectedDependencies([]);
      setNotes('');
      setAssignee('');
    }
    setIsConfirmingDelete(false);
  }, [
    editingTask,
    isOpen,
    defaultParentId,
    defaultLevel,
    defaultCode,
    defaultName,
    defaultStartDate,
    defaultEndDate,
    workCenters,
    allTasks,
  ]);

  const currentClassification = CLASSIFICATION_OPTIONS[selectedClassificationIndex] || CLASSIFICATION_OPTIONS[4];
  const isOperation = currentClassification.type === 'operation';
  const isProjectRoot = currentClassification.level === 0;

  // Auto-calculated sum of all descendant operations hours if this is a parent container
  const descendantRollup = useMemo(() => {
    if (isOperation || !editingTask) {
      return { totalHours: 0, count: 0 };
    }
    const descendants = getAllDescendants(editingTask.id, allTasks);
    // Find leaf operations or tasks with hours
    const operations = descendants.filter(
      (d) => d.type === 'operation' || d.level >= 4 || !allTasks.some((t) => t.parentId === d.id)
    );
    const totalHours = operations.reduce((sum, d) => sum + (d.plannedHours || 0), 0);
    return {
      totalHours: totalHours || editingTask.plannedHours || 0,
      count: operations.length,
    };
  }, [isOperation, editingTask, allTasks]);

  const childSumHours = descendantRollup.totalHours;

  const descendantIds = useMemo(() => {
    if (!editingTask) return new Set<string>();
    return new Set(getAllDescendants(editingTask.id, allTasks).map((d) => d.id));
  }, [editingTask, allTasks]);

  // Strict Rule: Parent level MUST be strictly less than child level (parent.level < currentClassification.level)
  const potentialParents = useMemo(() => {
    return allTasks
      .filter((t) => {
        if (editingTask && (t.id === editingTask.id || descendantIds.has(t.id))) {
          return false;
        }
        return t.level < currentClassification.level;
      })
      .sort((a, b) => {
        if (a.projectId !== b.projectId) return a.projectId.localeCompare(b.projectId);
        return a.level - b.level;
      });
  }, [allTasks, editingTask, descendantIds, currentClassification.level]);

  const potentialPredecessors = useMemo(() => {
    return allTasks.filter((t) => !editingTask || t.id !== editingTask.id);
  }, [allTasks, editingTask]);

  // Helper to calculate auto code for current state
  const generateCode = (lvl: number, t: GanttItemType, pId: string | null) => {
    return calculateAutoEapCode({
      level: lvl,
      type: t,
      parentId: lvl === 0 ? null : pId,
      allTasks,
      currentTaskId: editingTask?.id || null,
    });
  };

  const handleClassificationChange = (newIndex: number) => {
    setSelectedClassificationIndex(newIndex);
    const selected = CLASSIFICATION_OPTIONS[newIndex];
    if (selected.level === 0) {
      setParentId(null);
      setConstraintType('contract');
      const autoCode = generateCode(0, 'project', null);
      setCode(autoCode);
    } else {
      if (selected.type === 'operation') {
        setConstraintType('capacity');
      }

      // Check if current parent is valid for the new level (must have parent.level < selected.level)
      const currentParent = allTasks.find((t) => t.id === parentId);
      let effectiveParentId = parentId;

      if (!currentParent || currentParent.level >= selected.level) {
        // Auto-select best valid parent
        const validParents = allTasks
          .filter((t) => !editingTask || (t.id !== editingTask.id && !descendantIds.has(t.id)))
          .filter((t) => t.level < selected.level);

        const bestParent =
          [...validParents].sort((a, b) => b.level - a.level)[0];
        effectiveParentId = bestParent?.id || null;
        setParentId(effectiveParentId);
      }

      const autoCode = generateCode(selected.level, selected.type, effectiveParentId);
      setCode(autoCode);
    }
  };

  const handleParentChange = (newParentId: string | null) => {
    setParentId(newParentId);
    const selected = currentClassification;
    const autoCode = generateCode(selected.level, selected.type, newParentId);
    setCode(autoCode);
  };

  const handleRecalculateCode = () => {
    const selected = currentClassification;
    const autoCode = generateCode(selected.level, selected.type, parentId);
    setCode(autoCode);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const selected = currentClassification;
    const selectedWc = workCenters.find((w) => w.id === workCenterId);

    // Validate parent level < child level
    if (selected.level > 0 && parentId) {
      const parentTask = allTasks.find((t) => t.id === parentId);
      if (parentTask && parentTask.level >= selected.level) {
        alert('O item pai deve obrigatoriamente possuir nível menor que o item atual.');
        return;
      }
    }

    // Auto-resolve root project ID
    let rootProjectId = editingTask?.projectId;
    if (!rootProjectId) {
      if (selected.level === 0) {
        rootProjectId = editingTask?.id || `g-proj-${Date.now()}`;
      } else if (parentId) {
        const parent = allTasks.find((t) => t.id === parentId);
        rootProjectId = parent?.projectId || allTasks[0]?.projectId || 'g-proj-1';
      } else {
        rootProjectId = allTasks[0]?.projectId || 'g-proj-1';
      }
    }

    const taskNode: GanttTaskNode = {
      id: editingTask?.id || `g-task-${Date.now()}`,
      projectId: rootProjectId,
      parentId: selected.level === 0 ? null : parentId,
      level: selected.level,
      code: code.trim() || `${selected.level}.0`,
      name: name.trim() || 'Nova Operação / Item',
      type: selected.type,
      constraintType,
      workCenterId: isOperation && (constraintType === 'capacity' || workCenterId) ? workCenterId : undefined,
      workCenterName: isOperation ? selectedWc?.name : undefined,
      plannedHours: isOperation ? (Number(plannedHours) || 0) : (childSumHours || editingTask?.plannedHours || 0),
      actualHours: isOperation ? (Number(actualHours) || 0) : (editingTask?.actualHours || 0),
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      baselineStartDate: baselineStartDate || startDate,
      baselineEndDate: baselineEndDate || endDate,
      contractDate: contractDate || undefined,
      materialName: materialName.trim() || undefined,
      materialSupplier: materialSupplier.trim() || undefined,
      materialEtaDate: materialEtaDate || undefined,
      materialStatus: materialName.trim() ? materialStatus : undefined,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      status,
      dependencies: selectedDependencies.length > 0 ? selectedDependencies : undefined,
      expanded: editingTask?.expanded ?? true,
      notes: notes.trim() || undefined,
      assignee: assignee.trim() || undefined,
    };

    onSave(taskNode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-200 animate-in fade-in zoom-in duration-150 my-6">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black text-sm">
              N{currentClassification.level}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {isEditing ? 'Editar Item da Estrutura (EAP)' : 'Novo Item / Operação no Cronograma'}
              </h2>
              <span className="text-[11px] text-slate-400">
                {currentClassification.badge}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Unified Classification & Parent Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Classificação na EAP *
              </label>
              <select
                value={selectedClassificationIndex}
                onChange={(e) => handleClassificationChange(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {CLASSIFICATION_OPTIONS.map((opt, idx) => (
                  <option key={idx} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {!isProjectRoot && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Item Pai na Hierarquia *
                </label>
                <select
                  value={parentId || ''}
                  onChange={(e) => handleParentChange(e.target.value || null)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Selecione o Pai --</option>
                  {potentialParents.map((t) => (
                    <option key={t.id} value={t.id}>
                      {'—'.repeat(Math.max(0, Math.floor(t.level || 0)))} [{t.code || ''}] {t.name} (N{t.level ?? 0})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Code & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Código EAP *
                </label>
                <button
                  type="button"
                  onClick={handleRecalculateCode}
                  className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition-colors"
                  title="Recalcular código automático com base no pai e nível"
                >
                  <Sparkles className="w-3 h-3" /> Auto
                </button>
              </div>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: 1.2.1"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 inline-block" />
                Auto-calculado pela EAP
              </p>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Descrição do Item / Operação *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Usinagem de Palhetas Fixas / Montagem do Rotor"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Factory Operation Section (Hours & Work Center) - ONLY VISIBLE IF OPERATION */}
          {isOperation ? (
            <div className="bg-indigo-950/20 border border-indigo-500/30 p-3.5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Factory className="w-3.5 h-3.5 text-indigo-400" /> Detalhamento da Operação Fabril
                </span>
                <span className="text-[10px] text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-700/50 font-bold">
                  Gera Carga Máquina
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Centro de Trabalho Alocado (CT) *
                  </label>
                  <select
                    value={workCenterId}
                    onChange={(e) => setWorkCenterId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Selecione o Centro de Trabalho --</option>
                    {workCenters.map((wc) => (
                      <option key={wc.id} value={wc.id}>
                        {wc.name} ({wc.dailyHours * wc.resourcesCount * wc.daysPerWeek}h/sem)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Horas Planejadas *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={plannedHours}
                      onChange={(e) => setPlannedHours(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-8"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-mono">
                      h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Summary note for Non-Operations */
            <div className="bg-indigo-950/30 border border-indigo-500/30 px-3.5 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Nível Estrutural (Sintético):</strong> O valor em horas é calculado automaticamente pela soma das operações fabris (Nível 4) vinculadas a esta hierarquia da EAP.
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <span className="bg-indigo-900/60 text-indigo-200 font-mono font-bold px-2.5 py-1 rounded-lg text-xs border border-indigo-700/50 flex items-center gap-1 shadow-xs">
                  <span>⚡ Total:</span>
                  <span className="text-amber-300 font-black">{childSumHours}h</span>
                  {descendantRollup.count > 0 && (
                    <span className="text-[10px] text-indigo-300 font-normal">({descendantRollup.count} op.)</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Dates & Scheduling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
            <DatePickerField
              label="Data Início *"
              theme="dark"
              size="sm"
              required
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                if (!baselineStartDate) setBaselineStartDate(val);
              }}
            />
            <DatePickerField
              label="Data Término *"
              theme="dark"
              size="sm"
              min={startDate}
              required
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                if (!baselineEndDate) setBaselineEndDate(val);
              }}
            />
          </div>

          {/* Progress & Quick Status */}
          <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" /> Avanço Concluído & Situação
              </span>
              <span className="text-sm font-black text-indigo-400 font-mono">{progress}%</span>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setProgress(val);
                  if (val === 100) setStatus('completed');
                  else if (val > 0 && status === 'not_started') setStatus('in_progress');
                }}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />

              {/* Status Chips */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                {(
                  [
                    { id: 'not_started', label: 'Não Iniciado', color: 'bg-slate-800 text-slate-300 border-slate-700' },
                    { id: 'in_progress', label: 'Em Andamento', color: 'bg-indigo-950/80 text-indigo-300 border-indigo-700' },
                    { id: 'completed', label: 'Concluído', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-700' },
                    { id: 'delayed', label: 'Atrasado', color: 'bg-rose-950/80 text-rose-300 border-rose-700' },
                    { id: 'waiting_material', label: 'Aguardando Mat.', color: 'bg-amber-950/80 text-amber-300 border-amber-700' },
                    { id: 'blocked', label: 'Bloqueado', color: 'bg-purple-950/80 text-purple-300 border-purple-700' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStatus(s.id);
                      if (s.id === 'completed') setProgress(100);
                      else if (s.id === 'not_started') setProgress(0);
                    }}
                    className={`py-1 px-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer truncate ${
                      status === s.id
                        ? `${s.color} ring-2 ring-indigo-400 font-black`
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Predecessors / Dependencies */}
          {potentialPredecessors.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Tarefas Predecessoras (Vínculos de Dependência)
              </label>
              <div className="max-h-28 overflow-y-auto bg-slate-950/60 border border-slate-800 rounded-xl p-2 space-y-1">
                {potentialPredecessors.map((p) => {
                  const isSelected = selectedDependencies.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 p-1 rounded-lg text-xs cursor-pointer hover:bg-slate-800/80 transition-colors ${
                        isSelected ? 'bg-indigo-950/60 text-indigo-300 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDependencies([...selectedDependencies, p.id]);
                          } else {
                            setSelectedDependencies(selectedDependencies.filter((id) => id !== p.id));
                          }
                        }}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>[{p.code}] {p.name} ({p.startDate} a {p.endDate})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {isEditing && onDelete ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-600/80 px-3 py-1.5 rounded-xl animate-in fade-in duration-150">
                  <span className="text-xs font-bold text-rose-200">Confirmar exclusão?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(editingTask.id);
                      setIsConfirmingDelete(false);
                      onClose();
                    }}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow"
                  >
                    Sim, excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              )
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-900/40 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
