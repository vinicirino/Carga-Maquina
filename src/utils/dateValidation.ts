import { Project, WorkCenter } from '../types';

/**
 * Deduplicates workCenterHours in case both ID and Name were stored for the same work center,
 * or removes invalid zero/null entries.
 */
export function deduplicateProjectWorkCenterHours(
  project: Project,
  workCenters?: WorkCenter[]
): Project {
  if (!project.workCenterHours) return project;

  const rawEntries = Object.entries(project.workCenterHours);
  if (rawEntries.length === 0) return project;

  const cleanHours: Record<string, number> = {};
  const seenWcIds = new Set<string>();

  if (workCenters && workCenters.length > 0) {
    // 1. Pass 1: IDs
    for (const [key, hours] of rawEntries) {
      if (hours === undefined || hours === null || isNaN(hours) || hours <= 0) continue;
      const wcById = workCenters.find((w) => w.id === key);
      if (wcById) {
        cleanHours[wcById.id] = (cleanHours[wcById.id] || 0) + hours;
        seenWcIds.add(wcById.id);
      }
    }

    // 2. Pass 2: Names (only add if the work center ID wasn't already mapped)
    for (const [key, hours] of rawEntries) {
      if (hours === undefined || hours === null || isNaN(hours) || hours <= 0) continue;
      const wcById = workCenters.find((w) => w.id === key);
      if (wcById) continue; // Handled in pass 1

      const wcByName = workCenters.find(
        (w) => w.name.trim().toUpperCase() === key.trim().toUpperCase()
      );
      if (wcByName) {
        if (!seenWcIds.has(wcByName.id)) {
          cleanHours[wcByName.id] = hours;
          seenWcIds.add(wcByName.id);
        }
        // If seenWcIds already has wcByName.id, it was a duplicate key! We omit it.
      } else {
        cleanHours[key] = hours;
      }
    }
  } else {
    // Without workCenters list, simply copy valid entries
    for (const [key, hours] of rawEntries) {
      if (hours !== undefined && hours !== null && !isNaN(hours) && hours > 0) {
        cleanHours[key] = hours;
      }
    }
  }

  return {
    ...project,
    workCenterHours: cleanHours,
  };
}

/**
 * Clamps a given date string (YYYY-MM-DD) between minDate and maxDate.
 */
export function clampDateString(dateStr: string, minDate: string, maxDate: string): string {
  if (!dateStr) return dateStr;
  if (minDate && dateStr < minDate) return minDate;
  if (maxDate && dateStr > maxDate) return maxDate;
  return dateStr;
}

/**
 * Validates and clamps a date range to ensure it stays strictly within the project global boundaries [projectStart, projectEnd].
 */
export function clampDateRangeWithinProject(
  startDate: string | undefined,
  endDate: string | undefined,
  projectStart: string,
  projectEnd: string
): { startDate?: string; endDate?: string } {
  let cleanStart = startDate;
  let cleanEnd = endDate;

  if (cleanStart) {
    cleanStart = clampDateString(cleanStart, projectStart, projectEnd);
  }

  if (cleanEnd) {
    cleanEnd = clampDateString(cleanEnd, projectStart, projectEnd);
  }

  // Ensure start is not after end if both are present
  if (cleanStart && cleanEnd && cleanStart > cleanEnd) {
    cleanEnd = cleanStart;
  }

  return {
    startDate: cleanStart,
    endDate: cleanEnd,
  };
}

/**
 * Sanitizes all sub-schedules (groupDates and workCenterDates) within a project,
 * guaranteeing none of them fall outside the global project start and end dates.
 */
export function sanitizeProjectSchedules(project: Project, workCenters?: WorkCenter[]): Project {
  const pStart = project.startDate;
  const pEnd = project.endDate < project.startDate ? project.startDate : project.endDate;

  let sanitizedGroupDates: Record<string, { startDate?: string; endDate?: string }> | undefined = undefined;
  if (project.groupDates) {
    sanitizedGroupDates = {};
    for (const [groupName, dates] of Object.entries(project.groupDates)) {
      if (!dates) continue;
      const clamped = clampDateRangeWithinProject(dates.startDate, dates.endDate, pStart, pEnd);
      if (clamped.startDate || clamped.endDate) {
        sanitizedGroupDates[groupName] = clamped;
      }
    }
  }

  let sanitizedWcDates: Record<string, { startDate?: string; endDate?: string }> | undefined = undefined;
  if (project.workCenterDates) {
    sanitizedWcDates = {};
    for (const [wcKey, dates] of Object.entries(project.workCenterDates)) {
      if (!dates) continue;
      const clamped = clampDateRangeWithinProject(dates.startDate, dates.endDate, pStart, pEnd);
      if (clamped.startDate || clamped.endDate) {
        sanitizedWcDates[wcKey] = clamped;
      }
    }
  }

  const baseProject = {
    ...project,
    startDate: pStart,
    endDate: pEnd,
    groupDates: sanitizedGroupDates,
    workCenterDates: sanitizedWcDates,
  };

  return deduplicateProjectWorkCenterHours(baseProject, workCenters);
}
