import { Project } from '../types';

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
export function sanitizeProjectSchedules(project: Project): Project {
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

  return {
    ...project,
    startDate: pStart,
    endDate: pEnd,
    groupDates: sanitizedGroupDates,
    workCenterDates: sanitizedWcDates,
  };
}
