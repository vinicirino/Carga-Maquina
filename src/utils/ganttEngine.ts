import {
  parseISO,
  format,
  differenceInDays,
  addDays,
  isWeekend,
  isWithinInterval,
  isBefore,
  isAfter,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
} from 'date-fns';
import {
  GanttTaskNode,
  GanttZoomLevel,
  GanttMetrics,
  GanttFilterOptions,
} from '../types/gantt';
import { CalendarException } from '../types';

export interface TimelineColumn {
  key: string;
  label: string;
  subLabel?: string;
  startDate: Date;
  endDate: Date;
  isHoliday?: boolean;
  isWeekend?: boolean;
  holidayTitle?: string;
}

export interface ComputedTimeline {
  columns: TimelineColumn[];
  startDate: Date;
  endDate: Date;
  totalDays: number;
  columnWidth: number;
  totalWidth: number;
  todayPositionPx: number | null;
}

/**
 * Returns a flat ordered list of visible nodes respecting parent expand/collapse state
 */
export function getFlattenedVisibleTasks(
  allTasks: GanttTaskNode[],
  filters?: Partial<GanttFilterOptions>
): GanttTaskNode[] {
  // Build a fast lookup map and parent-children map
  const taskMap = new Map<string, GanttTaskNode>();
  const childrenMap = new Map<string | null, GanttTaskNode[]>();

  allTasks.forEach((t) => {
    taskMap.set(t.id, t);
    const pId = t.parentId;
    if (!childrenMap.has(pId)) {
      childrenMap.set(pId, []);
    }
    childrenMap.get(pId)!.push(t);
  });

  // Sort roots by code or startDate
  const roots = childrenMap.get(null) || allTasks.filter((t) => !t.parentId || !taskMap.has(t.parentId));

  const visibleList: GanttTaskNode[] = [];
  const visited = new Set<string>();

  function traverse(node: GanttTaskNode, depth: number) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    // Check filter match
    let matches = true;

    if (filters) {
      if (filters.projectId && filters.projectId !== 'all' && node.projectId !== filters.projectId) {
        matches = false;
      }
      if (filters.levelFilter !== undefined && filters.levelFilter !== 'all' && node.level !== filters.levelFilter) {
        matches = false;
      }
      if (filters.constraintFilter && filters.constraintFilter !== 'all' && node.constraintType !== filters.constraintFilter) {
        matches = false;
      }
      if (filters.statusFilter && filters.statusFilter !== 'all' && node.status !== filters.statusFilter) {
        matches = false;
      }
      if (filters.workCenterFilter && filters.workCenterFilter !== 'all' && node.workCenterId !== filters.workCenterFilter) {
        matches = false;
      }
      if (filters.searchTerm && filters.searchTerm.trim().length > 0) {
        const term = filters.searchTerm.toLowerCase();
        const inName = node.name.toLowerCase().includes(term);
        const inCode = node.code.toLowerCase().includes(term);
        const inWc = (node.workCenterName || '').toLowerCase().includes(term);
        const inMat = (node.materialName || '').toLowerCase().includes(term);
        if (!inName && !inCode && !inWc && !inMat) {
          matches = false;
        }
      }
    }

    if (matches) {
      visibleList.push({
        ...node,
        treeDepth: depth,
      });
    }

    // Traverse children if node is expanded
    const children = childrenMap.get(node.id) || [];
    if (node.expanded !== false && children.length > 0) {
      children.forEach((child) => traverse(child, depth + 1));
    }
  }

  roots.forEach((root) => traverse(root, 0));
  return visibleList;
}

/**
 * Calculates overall timeline bounds across all tasks
 */
export function getTimelineBounds(
  tasks: GanttTaskNode[],
  customStart?: string,
  customEnd?: string
): { minDate: Date; maxDate: Date } {
  if (customStart && customEnd) {
    return {
      minDate: parseISO(customStart),
      maxDate: parseISO(customEnd),
    };
  }

  if (tasks.length === 0) {
    const today = new Date();
    return {
      minDate: addDays(today, -15),
      maxDate: addDays(today, 60),
    };
  }

  let minTime = Infinity;
  let maxTime = -Infinity;

  tasks.forEach((t) => {
    try {
      const s = parseISO(t.startDate).getTime();
      const e = parseISO(t.endDate).getTime();
      if (!isNaN(s) && s < minTime) minTime = s;
      if (!isNaN(e) && e > maxTime) maxTime = e;

      if (t.materialEtaDate) {
        const eta = parseISO(t.materialEtaDate).getTime();
        if (!isNaN(eta) && eta > maxTime) maxTime = eta;
      }
    } catch {}
  });

  if (minTime === Infinity || maxTime === -Infinity) {
    const today = new Date();
    return { minDate: addDays(today, -15), maxDate: addDays(today, 60) };
  }

  // Add margin padding: 7 days before and 14 days after
  const minDate = addDays(new Date(minTime), -7);
  const maxDate = addDays(new Date(maxTime), 14);

  return { minDate, maxDate };
}

/**
 * Generates timeline columns for the selected zoom level
 */
export function generateTimelineColumns(
  minDate: Date,
  maxDate: Date,
  zoom: GanttZoomLevel,
  calendarExceptions: CalendarException[] = []
): ComputedTimeline {
  const totalDays = Math.max(1, differenceInDays(maxDate, minDate) + 1);
  const columns: TimelineColumn[] = [];

  let columnWidth = 36; // default for days

  if (zoom === 'days') {
    columnWidth = 36;
    const days = eachDayOfInterval({ start: minDate, end: maxDate });

    days.forEach((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const isWk = isWeekend(day);

      // Check if holiday / shutdown
      const holiday = calendarExceptions.find((h) => {
        try {
          return isWithinInterval(day, {
            start: parseISO(h.startDate),
            end: parseISO(h.endDate),
          });
        } catch {
          return false;
        }
      });

      columns.push({
        key: dayStr,
        label: format(day, 'dd'),
        subLabel: format(day, 'EEE'),
        startDate: day,
        endDate: day,
        isWeekend: isWk,
        isHoliday: !!holiday,
        holidayTitle: holiday?.title,
      });
    });
  } else if (zoom === 'weeks') {
    columnWidth = 80;
    const weeks = eachWeekOfInterval({ start: minDate, end: maxDate }, { weekStartsOn: 1 });

    weeks.forEach((wStart) => {
      const wEnd = addDays(wStart, 6);
      const weekKey = format(wStart, 'yyyy-\'W\'ww');

      // Check if any holiday falls in this week
      const holiday = calendarExceptions.find((h) => {
        try {
          const hStart = parseISO(h.startDate);
          const hEnd = parseISO(h.endDate);
          return (
            isWithinInterval(wStart, { start: hStart, end: hEnd }) ||
            isWithinInterval(wEnd, { start: hStart, end: hEnd }) ||
            (hStart >= wStart && hEnd <= wEnd)
          );
        } catch {
          return false;
        }
      });

      columns.push({
        key: weekKey,
        label: `Sem ${format(wStart, 'w')}`,
        subLabel: `${format(wStart, 'dd/MM')} - ${format(wEnd, 'dd/MM')}`,
        startDate: wStart,
        endDate: wEnd,
        isHoliday: !!holiday,
        holidayTitle: holiday?.title,
      });
    });
  } else if (zoom === 'months') {
    columnWidth = 140;
    const months = eachMonthOfInterval({ start: minDate, end: maxDate });

    months.forEach((mStart) => {
      const mEnd = endOfMonth(mStart);
      const mKey = format(mStart, 'yyyy-MM');

      columns.push({
        key: mKey,
        label: format(mStart, 'MMMM yyyy'),
        subLabel: `${format(mStart, 'MMM').toUpperCase()}`,
        startDate: mStart,
        endDate: mEnd,
      });
    });
  } else {
    // zoom === 'years'
    columnWidth = 220;
    const months = eachMonthOfInterval({ start: minDate, end: maxDate });

    months.forEach((mStart) => {
      const mEnd = endOfMonth(mStart);
      const mKey = format(mStart, 'yyyy-MM');

      columns.push({
        key: mKey,
        label: format(mStart, 'MMM/yy').toUpperCase(),
        subLabel: `Q${Math.floor(mStart.getMonth() / 3) + 1}`,
        startDate: mStart,
        endDate: mEnd,
      });
    });
  }

  const totalWidth = columns.length * columnWidth;

  // Calculate today line position
  const today = new Date();
  let todayPositionPx: number | null = null;

  if (today >= minDate && today <= maxDate) {
    const elapsedDays = differenceInDays(today, minDate);
    const ratio = elapsedDays / totalDays;
    todayPositionPx = Math.round(ratio * totalWidth);
  }

  return {
    columns,
    startDate: minDate,
    endDate: maxDate,
    totalDays,
    columnWidth,
    totalWidth,
    todayPositionPx,
  };
}

/**
 * Calculates pixel position (X and Width) for a task date range on the timeline
 */
export function getTaskCoordinates(
  task: GanttTaskNode,
  timeline: ComputedTimeline
): { x: number; width: number; baselineX?: number; baselineWidth?: number } {
  try {
    const taskStart = parseISO(task.startDate);
    const taskEnd = parseISO(task.endDate);

    const startDiff = differenceInDays(taskStart, timeline.startDate);
    const durationDays = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);

    const dayWidth = timeline.totalWidth / timeline.totalDays;

    const x = Math.max(0, startDiff * dayWidth);
    const width = Math.max(16, durationDays * dayWidth);

    let baselineX: number | undefined;
    let baselineWidth: number | undefined;

    if (task.baselineStartDate && task.baselineEndDate) {
      const baseStart = parseISO(task.baselineStartDate);
      const baseEnd = parseISO(task.baselineEndDate);
      const baseStartDiff = differenceInDays(baseStart, timeline.startDate);
      const baseDuration = Math.max(1, differenceInDays(baseEnd, baseStart) + 1);

      baselineX = Math.max(0, baseStartDiff * dayWidth);
      baselineWidth = Math.max(12, baseDuration * dayWidth);
    }

    return { x, width, baselineX, baselineWidth };
  } catch {
    return { x: 0, width: 30 };
  }
}

/**
 * Converts a pixel X position on the timeline into an ISO date string (YYYY-MM-DD)
 */
export function getDateFromPixelX(pixelX: number, timeline: ComputedTimeline): string {
  const dayWidth = timeline.totalWidth / timeline.totalDays;
  const dayOffset = Math.round(pixelX / dayWidth);
  const clampedOffset = Math.max(0, Math.min(timeline.totalDays - 1, dayOffset));
  const targetDate = addDays(timeline.startDate, clampedOffset);
  return format(targetDate, 'yyyy-MM-dd');
}

/**
 * Calculates a fully automatic EAP (WBS) hierarchical code
 * based on selected level/type, parent item, and existing siblings in the hierarchy.
 */
export function calculateAutoEapCode(params: {
  level: number;
  type?: GanttTaskNode['type'];
  parentId: string | null;
  allTasks: GanttTaskNode[];
  currentTaskId?: string | null;
}): string {
  const { level, type, parentId, allTasks, currentTaskId } = params;

  // Root Project (Nível 0 or no parent)
  if (level === 0 || type === 'project' || !parentId) {
    const rootTasks = allTasks.filter(
      (t) => (t.level === 0 || !t.parentId) && (!currentTaskId || t.id !== currentTaskId)
    );
    let maxNum = 0;
    rootTasks.forEach((t) => {
      const codeStr = t.code || '';
      const match = codeStr.match(/^(\d+)(\.0)?$/) || codeStr.match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    const nextNum = maxNum > 0 ? maxNum + 1 : rootTasks.length + 1;
    return `${nextNum}.0`;
  }

  // Find parent task in hierarchy
  const parent = allTasks.find((t) => t.id === parentId);
  if (!parent) {
    return `${level}.1`;
  }

  // Base prefix from parent:
  // If parent is Level 0 with code "1.0", base prefix for Level 1 is "1"
  let basePrefix = (parent.code || `${parent.level || 1}`).trim();
  if (parent.level === 0 && /^\d+\.0$/.test(basePrefix)) {
    basePrefix = basePrefix.replace(/\.0$/, '');
  }

  // Direct siblings under this parent
  const siblings = allTasks.filter(
    (t) => t.parentId === parentId && (!currentTaskId || t.id !== currentTaskId)
  );

  // Milestone naming support
  if (type === 'milestone') {
    let maxMilestone = 0;
    siblings.forEach((s) => {
      if (s.type === 'milestone') {
        const codeStr = s.code || '';
        const mMatch = codeStr.match(/\.M(\d+)$/i);
        if (mMatch) {
          const n = parseInt(mMatch[1], 10);
          if (!isNaN(n) && n > maxMilestone) maxMilestone = n;
        }
      }
    });
    if (maxMilestone > 0) {
      return `${basePrefix}.M${maxMilestone + 1}`;
    }
  }

  // Find the highest direct child index under this parent
  let maxChildNum = 0;
  siblings.forEach((s) => {
    const code = (s.code || '').trim();
    if (code.startsWith(`${basePrefix}.`)) {
      const remainder = code.slice(basePrefix.length + 1);
      // Grab first segment after the parent prefix
      const firstSegment = remainder.split('.')[0];
      const match = firstSegment.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (!isNaN(n) && n > maxChildNum) {
          maxChildNum = n;
        }
      }
    }
  });

  const nextIndex = maxChildNum > 0 ? maxChildNum + 1 : siblings.length + 1;
  return `${basePrefix}.${nextIndex}`;
}

/**
 * Calculates a smart auto-incremented code and metadata for a new sibling or child task
 */
export function generateSmartTaskCode(
  targetTask: GanttTaskNode | null,
  allTasks: GanttTaskNode[],
  isChild: boolean
): { code: string; level: number; parentId: string | null; projectId: string; type: GanttTaskNode['type'] } {
  if (!targetTask) {
    const code = calculateAutoEapCode({
      level: 0,
      type: 'project',
      parentId: null,
      allTasks,
    });
    return {
      code,
      level: 0,
      parentId: null,
      projectId: `proj-${Date.now()}`,
      type: 'project',
    };
  }

  if (isChild) {
    const childLevel = targetTask.level + 1;
    let suggestedType: GanttTaskNode['type'] = 'operation';
    if (childLevel === 1) suggestedType = 'group';
    else if (childLevel === 2) suggestedType = 'subgroup';
    else if (childLevel === 3) suggestedType = 'item';
    else suggestedType = 'operation';

    const code = calculateAutoEapCode({
      level: childLevel,
      type: suggestedType,
      parentId: targetTask.id,
      allTasks,
    });

    return {
      code,
      level: childLevel,
      parentId: targetTask.id,
      projectId: targetTask.projectId,
      type: suggestedType,
    };
  } else {
    // Sibling: same level, same parentId
    const siblingLevel = targetTask.level;
    const parentId = targetTask.parentId;

    const code = calculateAutoEapCode({
      level: siblingLevel,
      type: targetTask.type,
      parentId,
      allTasks,
    });

    return {
      code,
      level: siblingLevel,
      parentId,
      projectId: targetTask.projectId,
      type: targetTask.type,
    };
  }
}

/**
 * Automatically recalculates plannedHours, actualHours, and weighted progress for all parent items
 * based on the sum of their descendant level 4 / leaf manufacturing operations.
 * Projects (N0) = sum of Groups (N1)
 * Groups (N1) = sum of Subgroups (N2)
 * Subgroups (N2) = sum of Items (N3) and/or direct operations (N4)
 * Items (N3) = sum of child operations (N4)
 */
export function recalculateHierarchyRollup(tasks: GanttTaskNode[]): GanttTaskNode[] {
  if (!tasks || tasks.length === 0) return tasks;

  // Build a map of children by parentId
  const childrenMap = new Map<string, GanttTaskNode[]>();
  tasks.forEach((t) => {
    if (t.parentId) {
      if (!childrenMap.has(t.parentId)) {
        childrenMap.set(t.parentId, []);
      }
      childrenMap.get(t.parentId)!.push(t);
    }
  });

  const computedDataMap = new Map<
    string,
    { plannedHours: number; actualHours: number; progress: number }
  >();

  // Post-order traversal to compute bottom-up with cycle prevention
  const visiting = new Set<string>();

  function computeNode(task: GanttTaskNode): {
    plannedHours: number;
    actualHours: number;
    progress: number;
  } {
    if (computedDataMap.has(task.id)) {
      return computedDataMap.get(task.id)!;
    }

    if (visiting.has(task.id)) {
      return {
        plannedHours: task.plannedHours || 0,
        actualHours: task.actualHours || 0,
        progress: task.progress ?? 0,
      };
    }

    visiting.add(task.id);
    const children = childrenMap.get(task.id) || [];

    // Leaf node: has no children in hierarchy
    if (children.length === 0) {
      const result = {
        plannedHours: task.plannedHours || 0,
        actualHours: task.actualHours || 0,
        progress: task.progress ?? 0,
      };
      visiting.delete(task.id);
      computedDataMap.set(task.id, result);
      return result;
    }

    // Non-leaf node: sum from all children
    let sumPlannedHours = 0;
    let sumActualHours = 0;
    let weightedProgressSum = 0;
    let totalWeight = 0;

    children.forEach((child) => {
      const childData = computeNode(child);
      sumPlannedHours += childData.plannedHours;
      sumActualHours += childData.actualHours;

      const weight = childData.plannedHours > 0 ? childData.plannedHours : 1;
      weightedProgressSum += childData.progress * weight;
      totalWeight += weight;
    });

    const computedProgress =
      totalWeight > 0 ? Math.round(weightedProgressSum / totalWeight) : 0;

    const result = {
      plannedHours: sumPlannedHours,
      actualHours: sumActualHours,
      progress: computedProgress,
    };

    visiting.delete(task.id);
    computedDataMap.set(task.id, result);
    return result;
  }

  // Pre-calculate all tasks
  tasks.forEach((t) => computeNode(t));

  return tasks.map((task) => {
    const children = childrenMap.get(task.id);
    if (!children || children.length === 0) {
      return task;
    }

    const rollup = computedDataMap.get(task.id);
    if (!rollup) return task;

    const updatedProgress = rollup.progress;
    let updatedStatus = task.status;
    if (updatedProgress >= 100) {
      updatedStatus = 'completed';
    } else if (updatedProgress > 0 && updatedStatus === 'not_started') {
      updatedStatus = 'in_progress';
    }

    return {
      ...task,
      plannedHours: rollup.plannedHours,
      actualHours: rollup.actualHours,
      progress: updatedProgress,
      status: updatedStatus,
    };
  });
}

/**
 * Calculates overall metrics and KPIs for the Gantt Dashboard
 */
export function calculateGanttMetrics(tasks: GanttTaskNode[]): GanttMetrics {
  const totalTasks = tasks.length;
  let completedTasks = 0;
  let inProgressTasks = 0;
  let delayedTasks = 0;
  let waitingMaterialTasks = 0;
  let notStartedTasks = 0;

  let totalPlannedHours = 0;
  let totalActualHours = 0;
  let weightedProgressSum = 0;
  let weightSum = 0;

  let contractMilestonesCount = 0;
  let contractMilestonesDelayed = 0;

  let materialsTotal = 0;
  let materialsReceived = 0;
  let materialsDelayed = 0;

  const today = new Date();

  // Root projects (level 0) or leaf tasks for total portfolio hours
  const rootProjects = tasks.filter((t) => t.level === 0 || !t.parentId);
  if (rootProjects.length > 0) {
    rootProjects.forEach((p) => {
      totalPlannedHours += p.plannedHours || 0;
      totalActualHours += p.actualHours || 0;
    });
  } else {
    // If no root projects, sum leaf operations
    const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
    tasks.forEach((t) => {
      if (!parentIds.has(t.id)) {
        totalPlannedHours += t.plannedHours || 0;
        totalActualHours += t.actualHours || 0;
      }
    });
  }

  tasks.forEach((t) => {
    // Check status
    if (t.progress >= 100 || t.status === 'completed') {
      completedTasks++;
    } else if (t.status === 'delayed') {
      delayedTasks++;
    } else if (t.status === 'waiting_material') {
      waitingMaterialTasks++;
    } else if (t.progress > 0 || t.status === 'in_progress') {
      inProgressTasks++;
    } else {
      notStartedTasks++;
    }

    // Weight progress by plannedHours for root projects (or all tasks if no root projects)
    if (t.level === 0 || !t.parentId || rootProjects.length === 0) {
      const weight = t.plannedHours && t.plannedHours > 0 ? t.plannedHours : 10;
      weightedProgressSum += t.progress * weight;
      weightSum += weight;
    }

    // Contract milestones
    if (t.type === 'milestone' || t.constraintType === 'contract') {
      contractMilestonesCount++;
      if (t.contractDate) {
        const cDate = parseISO(t.contractDate);
        if (isBefore(cDate, today) && t.progress < 100) {
          contractMilestonesDelayed++;
        }
      }
    }

    // Materials
    if (t.materialName || t.constraintType === 'material') {
      materialsTotal++;
      if (t.materialStatus === 'received') {
        materialsReceived++;
      } else if (t.materialStatus === 'delayed') {
        materialsDelayed++;
      }
    }
  });

  const overallProgress = weightSum > 0 ? Math.round(weightedProgressSum / weightSum) : 0;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    delayedTasks,
    waitingMaterialTasks,
    notStartedTasks,
    overallProgress,
    totalPlannedHours,
    totalActualHours,
    contractMilestonesCount,
    contractMilestonesDelayed,
    materialsTotal,
    materialsReceived,
    materialsDelayed,
  };
}

/**
 * Recursively retrieves all descendant tasks (children, grandchildren, etc.) of a given task ID.
 * Returns them in hierarchical order.
 */
export function getAllDescendants(
  rootTaskId: string,
  allTasks: GanttTaskNode[]
): GanttTaskNode[] {
  const result: GanttTaskNode[] = [];
  const childrenMap = new Map<string, GanttTaskNode[]>();

  allTasks.forEach((t) => {
    if (t.parentId) {
      if (!childrenMap.has(t.parentId)) {
        childrenMap.set(t.parentId, []);
      }
      childrenMap.get(t.parentId)!.push(t);
    }
  });

  function traverse(parentId: string) {
    const children = childrenMap.get(parentId) || [];
    for (const child of children) {
      result.push(child);
      traverse(child.id);
    }
  }

  traverse(rootTaskId);
  return result;
}

/**
 * Duplicates a task and all its recursive descendant tasks,
 * correctly re-mapping IDs, parent IDs, project IDs, internal dependency links,
 * and recalculating EAP codes for the entire cloned subtree.
 */
export function duplicateTaskSubtree(
  rootTaskId: string,
  allTasks: GanttTaskNode[]
): GanttTaskNode[] {
  const rootTask = allTasks.find((t) => t.id === rootTaskId);
  if (!rootTask) return allTasks;

  const descendants = getAllDescendants(rootTaskId, allTasks);
  const oldSubtree = [rootTask, ...descendants];
  const oldIds = new Set(oldSubtree.map((t) => t.id));

  // Calculate new code for root clone
  const newRootCode = calculateAutoEapCode({
    level: rootTask.level,
    type: rootTask.type,
    parentId: rootTask.parentId,
    allTasks,
  });

  // Unique ID generator map
  const idMap = new Map<string, string>();
  const timestamp = Date.now();
  oldSubtree.forEach((t, idx) => {
    idMap.set(t.id, `g-task-${timestamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`);
  });

  const isRootProject = rootTask.level === 0 || rootTask.type === 'project';
  const newProjectId = isRootProject ? idMap.get(rootTask.id)! : rootTask.projectId;

  // Determine prefix transformation for EAP codes
  let oldPrefix = rootTask.code.trim();
  let newPrefix = newRootCode.trim();
  if (isRootProject) {
    if (oldPrefix.endsWith('.0')) oldPrefix = oldPrefix.replace(/\.0$/, '');
    if (newPrefix.endsWith('.0')) newPrefix = newPrefix.replace(/\.0$/, '');
  }

  // Clone all tasks in the subtree
  const clonedTasks: GanttTaskNode[] = oldSubtree.map((t, idx) => {
    const isRoot = idx === 0;
    const newId = idMap.get(t.id)!;
    const newParentId = isRoot
      ? t.parentId
      : t.parentId && idMap.has(t.parentId)
      ? idMap.get(t.parentId)!
      : t.parentId;

    // Compute updated code
    let computedCode = t.code;
    if (isRoot) {
      computedCode = newRootCode;
    } else {
      if (isRootProject) {
        if (computedCode.startsWith(`${oldPrefix}.`)) {
          computedCode = `${newPrefix}.${computedCode.slice(oldPrefix.length + 1)}`;
        }
      } else {
        if (computedCode === oldPrefix) {
          computedCode = newPrefix;
        } else if (computedCode.startsWith(`${oldPrefix}.`)) {
          computedCode = `${newPrefix}.${computedCode.slice(oldPrefix.length + 1)}`;
        }
      }
    }

    // Remap internal dependencies (dependencies that pointed to tasks inside the cloned subtree)
    const remappedDependencies = t.dependencies
      ? t.dependencies.map((depId) => (idMap.has(depId) ? idMap.get(depId)! : depId))
      : undefined;

    return {
      ...t,
      id: newId,
      projectId: isRootProject ? newProjectId : t.projectId,
      parentId: newParentId,
      code: computedCode,
      name: isRoot ? `${t.name} (Cópia)` : t.name,
      progress: 0,
      status: 'not_started',
      dependencies: remappedDependencies,
      expanded: true,
    };
  });

  // Find insertion point: right after the last descendant of rootTask in the original array
  let lastSubtreeIndex = allTasks.findIndex((t) => t.id === rootTaskId);
  allTasks.forEach((t, i) => {
    if (oldIds.has(t.id) && i > lastSubtreeIndex) {
      lastSubtreeIndex = i;
    }
  });

  const updatedTasks = [...allTasks];
  if (lastSubtreeIndex !== -1) {
    updatedTasks.splice(lastSubtreeIndex + 1, 0, ...clonedTasks);
  } else {
    updatedTasks.push(...clonedTasks);
  }

  return updatedTasks;
}

/**
 * Deletes a task and all its recursive descendants.
 */
export function deleteTaskSubtree(
  taskId: string,
  allTasks: GanttTaskNode[]
): GanttTaskNode[] {
  const descendants = getAllDescendants(taskId, allTasks);
  const idsToDelete = new Set([taskId, ...descendants.map((d) => d.id)]);

  return allTasks.filter((t) => !idsToDelete.has(t.id));
}

/**
 * Generates an SVG path connecting a predecessor task to a successor task
 */
export function generateDependencyPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): string {
  const deltaX = toX - fromX;
  const isForward = deltaX > 20;

  if (isForward) {
    const midX = fromX + (deltaX / 2);
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  } else {
    // Loop around back if successor starts before predecessor ends
    const loopOut = fromX + 15;
    const loopBack = toX - 15;
    return `M ${fromX} ${fromY} H ${loopOut} V ${fromY + 14} H ${loopBack} V ${toY} H ${toX}`;
  }
}
