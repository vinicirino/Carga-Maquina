import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  GanttTaskNode,
  GanttZoomLevel,
  GanttItemStatus,
} from '../../types/gantt';
import { CalendarException } from '../../types';
import {
  ComputedTimeline,
  getTaskCoordinates,
  generateDependencyPath,
} from '../../utils/ganttEngine';
import {
  Package,
  Factory,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Move,
} from 'lucide-react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';

interface GanttChartTimelineProps {
  timeline: ComputedTimeline;
  visibleTasks: GanttTaskNode[];
  allTasks: GanttTaskNode[];
  zoom: GanttZoomLevel;
  calendarExceptions: CalendarException[];
  onTaskClick: (task: GanttTaskNode) => void;
  onUpdateTaskDates: (taskId: string, newStartDate: string, newEndDate: string) => void;
  onUpdateTaskProgress: (taskId: string, newProgress: number) => void;
  hoveredTaskId: string | null;
  setHoveredTaskId: (id: string | null) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

interface DragState {
  type: 'move' | 'resize-start' | 'resize-end' | 'progress';
  taskId: string;
  initialMouseX: number;
  initialX: number;
  initialWidth: number;
  origStartDate: string;
  origEndDate: string;
  origProgress: number;
  currentX: number;
  currentWidth: number;
  currentProgress: number;
  previewStartDate: string;
  previewEndDate: string;
  deltaDays: number;
}

const ROW_HEIGHT = 44; // px per task row
const HEADER_HEIGHT = 56; // px for timeline header

export const GanttChartTimeline: React.FC<GanttChartTimelineProps> = ({
  timeline,
  visibleTasks,
  allTasks,
  zoom,
  calendarExceptions,
  onTaskClick,
  onUpdateTaskDates,
  onUpdateTaskProgress,
  hoveredTaskId,
  setHoveredTaskId,
  scrollRef,
}) => {
  // Drag & Resize & Progress State
  const [dragState, setDragState] = useState<DragState | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragOccurredRef = useRef<boolean>(false);

  // Map tasks to their index in visibleTasks for SVG coordinates
  const taskRowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleTasks.forEach((t, idx) => {
      map.set(t.id, idx);
    });
    return map;
  }, [visibleTasks]);

  // Compute all dependency lines
  const dependencyLines = useMemo(() => {
    const lines: Array<{
      fromId: string;
      toId: string;
      path: string;
      isHighlighted: boolean;
    }> = [];

    visibleTasks.forEach((targetTask, targetRow) => {
      if (!targetTask.dependencies || targetTask.dependencies.length === 0) return;

      const targetCoords = getTaskCoordinates(targetTask, timeline);
      const toX = targetCoords.x;
      const toY = targetRow * ROW_HEIGHT + ROW_HEIGHT / 2;

      targetTask.dependencies.forEach((fromId) => {
        const fromRow = taskRowIndexMap.get(fromId);
        if (fromRow === undefined) return;

        const sourceTask = allTasks.find((t) => t.id === fromId);
        if (!sourceTask) return;

        const sourceCoords = getTaskCoordinates(sourceTask, timeline);
        const fromX = sourceCoords.x + sourceCoords.width;
        const fromY = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        const path = generateDependencyPath(fromX, fromY, toX, toY);
        const isHighlighted =
          hoveredTaskId === fromId || hoveredTaskId === targetTask.id;

        lines.push({
          fromId,
          toId: targetTask.id,
          path,
          isHighlighted,
        });
      });
    });

    return lines;
  }, [visibleTasks, allTasks, timeline, taskRowIndexMap, hoveredTaskId]);

  // Global mouse handlers for Drag, Resize and Progress
  useEffect(() => {
    if (!dragState) return;

    const dayWidth = timeline.totalWidth / timeline.totalDays;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.initialMouseX;
      if (Math.abs(deltaX) > 2) {
        dragOccurredRef.current = true;
      }

      if (dragState.type === 'progress') {
        const barWidth = Math.max(1, dragState.initialWidth);
        const mouseOffsetInBar = e.clientX - (dragState.initialX + (dragState.initialMouseX - dragState.initialX)); // relative movement
        const progressDelta = (deltaX / barWidth) * 100;
        const newProgress = Math.min(100, Math.max(0, Math.round(dragState.origProgress + progressDelta)));

        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentProgress: newProgress,
              }
            : null
        );
        return;
      }

      const deltaDays = Math.round(deltaX / dayWidth);

      if (dragState.type === 'move') {
        const origStart = parseISO(dragState.origStartDate);
        const origEnd = parseISO(dragState.origEndDate);
        const duration = differenceInDays(origEnd, origStart);

        const newStart = addDays(origStart, deltaDays);
        const newEnd = addDays(newStart, duration);

        const newStartStr = format(newStart, 'yyyy-MM-dd');
        const newEndStr = format(newEnd, 'yyyy-MM-dd');

        const newX = Math.max(0, dragState.initialX + deltaX);

        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentX: newX,
                previewStartDate: newStartStr,
                previewEndDate: newEndStr,
                deltaDays,
              }
            : null
        );
      } else if (dragState.type === 'resize-start') {
        const origStart = parseISO(dragState.origStartDate);
        const origEnd = parseISO(dragState.origEndDate);

        const newStart = addDays(origStart, deltaDays);
        if (newStart <= origEnd) {
          const newStartStr = format(newStart, 'yyyy-MM-dd');
          const newX = Math.max(0, dragState.initialX + deltaX);
          const newWidth = Math.max(16, dragState.initialWidth - deltaX);

          setDragState((prev) =>
            prev
              ? {
                  ...prev,
                  currentX: newX,
                  currentWidth: newWidth,
                  previewStartDate: newStartStr,
                  deltaDays,
                }
              : null
          );
        }
      } else if (dragState.type === 'resize-end') {
        const origStart = parseISO(dragState.origStartDate);
        const origEnd = parseISO(dragState.origEndDate);

        const newEnd = addDays(origEnd, deltaDays);
        if (newEnd >= origStart) {
          const newEndStr = format(newEnd, 'yyyy-MM-dd');
          const newWidth = Math.max(16, dragState.initialWidth + deltaX);

          setDragState((prev) =>
            prev
              ? {
                  ...prev,
                  currentWidth: newWidth,
                  previewEndDate: newEndStr,
                  deltaDays,
                }
              : null
          );
        }
      }
    };

    const handleMouseUp = () => {
      if (dragState && dragOccurredRef.current) {
        if (dragState.type === 'progress') {
          onUpdateTaskProgress(dragState.taskId, dragState.currentProgress);
        } else {
          onUpdateTaskDates(
            dragState.taskId,
            dragState.previewStartDate,
            dragState.previewEndDate
          );
        }
      }

      // Reset
      setTimeout(() => {
        isDraggingRef.current = false;
        dragOccurredRef.current = false;
      }, 50);
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, timeline, onUpdateTaskDates, onUpdateTaskProgress]);

  // Start Move Handler
  const handleStartMove = (e: React.MouseEvent, task: GanttTaskNode, coords: { x: number; width: number }) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragOccurredRef.current = false;

    setDragState({
      type: 'move',
      taskId: task.id,
      initialMouseX: e.clientX,
      initialX: coords.x,
      initialWidth: coords.width,
      origStartDate: task.startDate,
      origEndDate: task.endDate,
      origProgress: task.progress,
      currentX: coords.x,
      currentWidth: coords.width,
      currentProgress: task.progress,
      previewStartDate: task.startDate,
      previewEndDate: task.endDate,
      deltaDays: 0,
    });
  };

  // Start Resize Start (Left Edge)
  const handleStartResizeStart = (e: React.MouseEvent, task: GanttTaskNode, coords: { x: number; width: number }) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragOccurredRef.current = false;

    setDragState({
      type: 'resize-start',
      taskId: task.id,
      initialMouseX: e.clientX,
      initialX: coords.x,
      initialWidth: coords.width,
      origStartDate: task.startDate,
      origEndDate: task.endDate,
      origProgress: task.progress,
      currentX: coords.x,
      currentWidth: coords.width,
      currentProgress: task.progress,
      previewStartDate: task.startDate,
      previewEndDate: task.endDate,
      deltaDays: 0,
    });
  };

  // Start Resize End (Right Edge)
  const handleStartResizeEnd = (e: React.MouseEvent, task: GanttTaskNode, coords: { x: number; width: number }) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragOccurredRef.current = false;

    setDragState({
      type: 'resize-end',
      taskId: task.id,
      initialMouseX: e.clientX,
      initialX: coords.x,
      initialWidth: coords.width,
      origStartDate: task.startDate,
      origEndDate: task.endDate,
      origProgress: task.progress,
      currentX: coords.x,
      currentWidth: coords.width,
      currentProgress: task.progress,
      previewStartDate: task.startDate,
      previewEndDate: task.endDate,
      deltaDays: 0,
    });
  };

  // Start Progress Drag Handle
  const handleStartProgressDrag = (e: React.MouseEvent, task: GanttTaskNode, coords: { x: number; width: number }) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragOccurredRef.current = false;

    setDragState({
      type: 'progress',
      taskId: task.id,
      initialMouseX: e.clientX,
      initialX: coords.x,
      initialWidth: coords.width,
      origStartDate: task.startDate,
      origEndDate: task.endDate,
      origProgress: task.progress,
      currentX: coords.x,
      currentWidth: coords.width,
      currentProgress: task.progress,
      previewStartDate: task.startDate,
      previewEndDate: task.endDate,
      deltaDays: 0,
    });
  };

  // Quick cycle progress on clicking percentage badge in bar
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

  const handleBarClick = (task: GanttTaskNode) => {
    if (!dragOccurredRef.current && !isDraggingRef.current) {
      onTaskClick(task);
    }
  };

  return (
    <div
      ref={scrollRef}
      className={`flex-1 overflow-x-auto overflow-y-auto bg-slate-950/80 select-none relative scrollbar-thin scrollbar-thumb-slate-700 ${
        dragState ? 'cursor-grabbing' : ''
      }`}
    >
      <div
        style={{ width: `${timeline.totalWidth}px`, minHeight: '100%' }}
        className="relative"
      >
        {/* Timeline Header */}
        <div
          className="sticky top-0 z-20 flex bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300 shadow-sm"
          style={{ height: `${HEADER_HEIGHT}px` }}
        >
          {timeline.columns.map((col) => {
            return (
              <div
                key={col.key}
                style={{ width: `${timeline.columnWidth}px` }}
                className={`shrink-0 border-r border-slate-800/80 flex flex-col items-center justify-center py-1 text-center transition-colors ${
                  col.isHoliday
                    ? 'bg-amber-950/40 text-amber-300'
                    : col.isWeekend
                    ? 'bg-slate-950/50 text-slate-500'
                    : 'hover:bg-slate-800/40'
                }`}
                title={col.holidayTitle ? `🏖️ ${col.holidayTitle}` : undefined}
              >
                <span className="text-[11px] font-bold tracking-tight leading-tight">
                  {col.label}
                </span>
                {col.subLabel && (
                  <span className="text-[9px] text-slate-400 font-mono leading-none">
                    {col.subLabel}
                  </span>
                )}
                {col.isHoliday && (
                  <span className="text-[8px] text-amber-400 leading-none">🏖️</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Timeline Grid Background & Columns */}
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none flex"
          style={{
            width: `${timeline.totalWidth}px`,
            top: `${HEADER_HEIGHT}px`,
            height: `${visibleTasks.length * ROW_HEIGHT}px`,
          }}
        >
          {timeline.columns.map((col) => (
            <div
              key={`bg-${col.key}`}
              style={{ width: `${timeline.columnWidth}px` }}
              className={`shrink-0 border-r border-slate-800/40 h-full ${
                col.isHoliday
                  ? 'bg-amber-950/15'
                  : col.isWeekend
                  ? 'bg-slate-950/30'
                  : ''
              }`}
            />
          ))}
        </div>

        {/* Today Marker Line */}
        {timeline.todayPositionPx !== null && (
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none border-l-2 border-dashed border-rose-500 flex flex-col items-center"
            style={{
              left: `${timeline.todayPositionPx}px`,
              height: `${HEADER_HEIGHT + visibleTasks.length * ROW_HEIGHT}px`,
            }}
          >
            <div className="sticky top-0 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-md mt-1 z-40">
              HOJE
            </div>
          </div>
        )}

        {/* SVG Layer for Dependency Connectors */}
        <svg
          className="absolute left-0 top-0 pointer-events-none z-10"
          style={{
            width: `${timeline.totalWidth}px`,
            height: `${HEADER_HEIGHT + visibleTasks.length * ROW_HEIGHT}px`,
            marginTop: `${HEADER_HEIGHT}px`,
          }}
        >
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748b" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#818cf8" />
            </marker>
          </defs>

          {dependencyLines.map((line, idx) => (
            <path
              key={`dep-${idx}`}
              d={line.path}
              fill="none"
              stroke={line.isHighlighted ? '#818cf8' : '#64748b'}
              strokeWidth={line.isHighlighted ? 2.5 : 1.5}
              strokeDasharray={line.isHighlighted ? 'none' : '4,2'}
              markerEnd={line.isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-default)'}
              className="transition-all duration-150"
            />
          ))}
        </svg>

        {/* Task Rows & Interactive Bars */}
        <div className="relative z-10">
          {visibleTasks.map((task, rowIndex) => {
            const rawCoords = getTaskCoordinates(task, timeline);
            const isBeingDragged = dragState?.taskId === task.id;

            const coords = {
              x: isBeingDragged && dragState.type !== 'progress' ? dragState.currentX : rawCoords.x,
              width: isBeingDragged && dragState.type !== 'progress' ? dragState.currentWidth : rawCoords.width,
              baselineX: rawCoords.baselineX,
              baselineWidth: rawCoords.baselineWidth,
            };

            const currentTaskProgress = isBeingDragged && dragState.type === 'progress' ? dragState.currentProgress : task.progress;

            const isHovered = hoveredTaskId === task.id;
            const isMilestone = task.type === 'milestone';
            const isProjectRoot = task.level === 0;
            const isGroup = task.level === 1;

            // Bar background color based on status and constraint
            let barBgClass = 'bg-slate-700 border-slate-600';
            let progressFillClass = 'bg-indigo-500';

            if (task.status === 'completed' || currentTaskProgress === 100) {
              barBgClass = 'bg-emerald-950/80 border-emerald-600 text-emerald-100';
              progressFillClass = 'bg-emerald-500';
            } else if (task.status === 'delayed') {
              barBgClass = 'bg-rose-950/80 border-rose-600 text-rose-100';
              progressFillClass = 'bg-rose-500';
            } else if (task.status === 'waiting_material') {
              barBgClass = 'bg-amber-950/80 border-amber-600 text-amber-100';
              progressFillClass = 'bg-amber-500';
            } else if (task.status === 'in_progress' || currentTaskProgress > 0) {
              barBgClass = 'bg-indigo-950/80 border-indigo-500 text-indigo-100';
              progressFillClass = 'bg-indigo-500';
            } else {
              barBgClass = 'bg-slate-800/90 border-slate-600 text-slate-300';
              progressFillClass = 'bg-slate-500';
            }

            return (
              <div
                key={task.id}
                style={{ height: `${ROW_HEIGHT}px` }}
                className={`relative flex items-center border-b border-slate-800/60 transition-colors ${
                  isHovered ? 'bg-indigo-950/30' : rowIndex % 2 === 0 ? 'bg-slate-900/10' : 'bg-transparent'
                }`}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                {/* Baseline Marker (if exists) */}
                {coords.baselineX !== undefined && coords.baselineWidth !== undefined && (
                  <div
                    style={{
                      left: `${coords.baselineX}px`,
                      width: `${coords.baselineWidth}px`,
                      top: '28px',
                      height: '4px',
                    }}
                    className="absolute bg-slate-600/70 rounded-full z-0 pointer-events-none"
                    title={`Linha de Base Original: ${task.baselineStartDate} a ${task.baselineEndDate}`}
                  />
                )}

                {/* Milestone Rendering (Diamond) */}
                {isMilestone ? (
                  <div
                    style={{ left: `${coords.x}px` }}
                    onClick={() => handleBarClick(task)}
                    onMouseDown={(e) => handleStartMove(e, task, rawCoords)}
                    className="absolute z-20 cursor-grab active:cursor-grabbing group flex items-center gap-2"
                  >
                    <div
                      className={`w-6 h-6 rotate-45 border-2 shadow-lg transition-transform group-hover:scale-125 flex items-center justify-center ${
                        task.status === 'completed'
                          ? 'bg-emerald-500 border-white'
                          : task.constraintType === 'contract'
                          ? 'bg-amber-500 border-white'
                          : 'bg-indigo-600 border-white'
                      }`}
                    >
                      <span className="-rotate-45 text-[9px] font-black text-white">★</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-200 whitespace-nowrap bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700 shadow-sm pointer-events-none">
                      {task.name} ({isBeingDragged ? dragState.previewEndDate : task.endDate})
                    </span>
                  </div>
                ) : (
                  /* Standard Task / Group / Project Interactive Bar */
                  <div
                    style={{
                      left: `${coords.x}px`,
                      width: `${coords.width}px`,
                      height: isProjectRoot ? '24px' : isGroup ? '22px' : '20px',
                    }}
                    onClick={() => handleBarClick(task)}
                    onMouseDown={(e) => handleStartMove(e, task, rawCoords)}
                    className={`absolute rounded-lg border shadow-md flex items-center overflow-hidden cursor-grab active:cursor-grabbing group transition-all duration-75 ${barBgClass} ${
                      isHovered || isBeingDragged ? 'ring-2 ring-indigo-400 scale-[1.01] z-30' : 'z-10'
                    } ${isProjectRoot ? 'font-black' : ''}`}
                    title="Arraste o centro para deslocar na linha do tempo, as bordas para redimensionar, ou a alça central para alterar o % concluído"
                  >
                    {/* Left Resize Handle (Adjust Start Date) */}
                    <div
                      onMouseDown={(e) => handleStartResizeStart(e, task, rawCoords)}
                      className="absolute left-0 top-0 bottom-0 w-2.5 z-30 cursor-ew-resize hover:bg-white/40 group-hover:bg-white/20 transition-colors flex items-center justify-center"
                      title="Redimensionar data de início"
                    >
                      <div className="w-0.5 h-3 bg-white/60 rounded-full" />
                    </div>

                    {/* Progress Fill Sub-Bar */}
                    {currentTaskProgress > 0 && (
                      <div
                        style={{ width: `${currentTaskProgress}%` }}
                        className={`h-full ${progressFillClass} opacity-80 pointer-events-none relative`}
                      />
                    )}

                    {/* Progress Drag Handle (draggable point on progress boundary) */}
                    <div
                      style={{ left: `calc(${currentTaskProgress}% - 4px)` }}
                      onMouseDown={(e) => handleStartProgressDrag(e, task, rawCoords)}
                      className="absolute top-0 bottom-0 w-2.5 z-35 cursor-col-resize hover:bg-white/80 transition-colors flex items-center justify-center group-hover:opacity-100 opacity-0"
                      title={`Arraste para ajustar o avanço (Atual: ${currentTaskProgress}%)`}
                    >
                      <div className="w-1.5 h-3.5 bg-white rounded-xs shadow-md border border-slate-900" />
                    </div>

                    {/* Content inside / over the bar */}
                    <div className="absolute inset-0 px-3 flex items-center justify-between text-[10px] font-semibold truncate pointer-events-none">
                      <div className="flex items-center gap-1.5 truncate">
                        {task.constraintType === 'contract' && (
                          <span title="Data Contratual" className="text-amber-300">📜</span>
                        )}
                        {task.constraintType === 'material' && (
                          <span title="Dependência de Material" className="text-amber-400">📦</span>
                        )}
                        {task.workCenterName && (
                          <span title={`CT: ${task.workCenterName}`} className="text-indigo-300">⚙️</span>
                        )}
                        <span className="truncate text-white font-bold drop-shadow-xs">
                          {task.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 pl-2 font-mono text-[9px] shrink-0 pointer-events-auto">
                        {task.plannedHours ? (
                          <span className="text-slate-300 bg-slate-950/60 px-1 rounded pointer-events-none">
                            {task.plannedHours}h
                          </span>
                        ) : null}
                        
                        {/* Clickable Progress Badge right in bar */}
                        <button
                          type="button"
                          onClick={(e) => handleQuickCycleProgress(task, e)}
                          className={`px-1.5 py-0.5 rounded font-bold transition-transform hover:scale-110 cursor-pointer shadow-xs ${
                            currentTaskProgress === 100
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-slate-950/80 text-slate-100 hover:bg-indigo-600 hover:text-white border border-slate-700'
                          }`}
                          title="Clique para alternar o avanço (+25%) ou arraste a alça do progresso"
                        >
                          {currentTaskProgress}%
                        </button>
                      </div>
                    </div>

                    {/* Right Resize Handle (Adjust End Date / Duration) */}
                    <div
                      onMouseDown={(e) => handleStartResizeEnd(e, task, rawCoords)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 z-30 cursor-ew-resize hover:bg-white/40 group-hover:bg-white/20 transition-colors flex items-center justify-center"
                      title="Redimensionar data de término (duração)"
                    >
                      <div className="w-0.5 h-3 bg-white/60 rounded-full" />
                    </div>

                    {/* Live Dragging Floating Tooltip */}
                    {isBeingDragged && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 border border-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xl whitespace-nowrap z-50 flex items-center gap-1 font-mono pointer-events-none">
                        {dragState.type === 'progress' ? (
                          <span>⚡ Avanço: {dragState.currentProgress}%</span>
                        ) : (
                          <>
                            <span>📅 {dragState.previewStartDate} a {dragState.previewEndDate}</span>
                            {dragState.deltaDays !== 0 && (
                              <span className={`px-1 rounded text-[9px] ${dragState.deltaDays > 0 ? 'bg-amber-600' : 'bg-blue-600'}`}>
                                {dragState.deltaDays > 0 ? `+${dragState.deltaDays}d` : `${dragState.deltaDays}d`}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
