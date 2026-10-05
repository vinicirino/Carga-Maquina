import { Project, WorkCenter } from '../types';

/**
 * Deduplicates workCenterHours in case both ID and Name were stored for the same work center,
 * or removes invalid zero/null entries. Guarantees that each work center only counts ONCE per project.
 */
export function deduplicateProjectWorkCenterHours(
  project: Project,
  workCenters?: WorkCenter[]
): Project {
  if (!project.workCenterHours) return project;

  const rawEntries = Object.entries(project.workCenterHours);
  if (rawEntries.length === 0) return project;

  const cleanHours: Record<string, number> = {};

  if (workCenters && workCenters.length > 0) {
    const seenWcIds = new Set<string>();

    for (const wc of workCenters) {
      if (seenWcIds.has(wc.id)) continue;
      let hrs: number | undefined = undefined;

      // 1. Try exact ID
      const valById = project.workCenterHours[wc.id];
      if (typeof valById === 'number' && !isNaN(valById) && valById > 0) {
        hrs = valById;
      }
      // 2. Try exact Name
      else if (project.workCenterHours[wc.name] !== undefined) {
        const valByName = project.workCenterHours[wc.name];
        if (typeof valByName === 'number' && !isNaN(valByName) && valByName > 0) {
          hrs = valByName;
        }
      }
      // 3. Try case-insensitive matching
      else {
        const wcNorm = wc.name.trim().toUpperCase();
        for (const [k, v] of rawEntries) {
          if (typeof v === 'number' && !isNaN(v) && v > 0 && k.trim().toUpperCase() === wcNorm) {
            hrs = v;
            break;
          }
        }
      }

      if (hrs !== undefined && hrs > 0) {
        cleanHours[wc.id] = hrs;
        seenWcIds.add(wc.id);
      }
    }

    // Keep any non-matching unmapped keys untouched
    for (const [key, hours] of rawEntries) {
      if (typeof hours === 'number' && !isNaN(hours) && hours > 0) {
        const isMatched = workCenters.some(
          (w) => w.id === key || w.name.trim().toUpperCase() === key.trim().toUpperCase()
        );
        if (!isMatched && !cleanHours[key]) {
          cleanHours[key] = hours;
        }
      }
    }
  } else {
    // Without workCenters list, copy valid entries
    for (const [key, hours] of rawEntries) {
      if (typeof hours === 'number' && !isNaN(hours) && hours > 0) {
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
 * Calculates total required hours for a project across all work centers with strict deduplication.
 */
export function getProjectTotalHours(project: Project, workCenters?: WorkCenter[]): number {
  if (!project.workCenterHours) return 0;
  if (!workCenters || workCenters.length === 0) {
    return Object.values(project.workCenterHours).reduce<number>(
      (acc, h) => acc + (Number(h) || 0),
      0
    );
  }
  let sum = 0;
  const seenWcIds = new Set<string>();
  for (const wc of workCenters) {
    if (seenWcIds.has(wc.id)) continue;
    let hrs = 0;
    if (typeof project.workCenterHours[wc.id] === 'number' && !isNaN(project.workCenterHours[wc.id])) {
      hrs = project.workCenterHours[wc.id];
    } else if (typeof project.workCenterHours[wc.name] === 'number' && !isNaN(project.workCenterHours[wc.name])) {
      hrs = project.workCenterHours[wc.name];
    } else {
      const norm = wc.name.trim().toUpperCase();
      for (const [k, v] of Object.entries(project.workCenterHours)) {
        if (typeof v === 'number' && !isNaN(v) && k.trim().toUpperCase() === norm) {
          hrs = v;
          break;
        }
      }
    }
    if (hrs > 0) {
      sum += hrs;
      seenWcIds.add(wc.id);
    }
  }
  return sum;
}

/**
 * Ensures any date representation (ISO YYYY-MM-DD, ISO timestamp with T, Brazilian DD/MM/YYYY, or Date object)
 * is safely normalized to strict ISO 'YYYY-MM-DD' format.
 */
export function ensureValidIsoDate(dateVal: any, fallback: string = '2027-08-13'): string {
  if (!dateVal) return fallback;
  const str = String(dateVal).trim();
  if (!str) return fallback;

  // 1. Already strict YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. Brazilian / European format: DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // 3. ISO timestamp format with 'T': e.g., 2027-08-13T00:00:00.000Z
  if (str.includes('T')) {
    const datePart = str.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }

  // 4. Try native Date constructor
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fallback
  }

  return fallback;
}

/**
 * Clamps a given date string (YYYY-MM-DD) between minDate and maxDate.
 */
export function clampDateString(dateStr: string, minDate: string, maxDate: string): string {
  if (!dateStr) return dateStr;
  const safeDate = ensureValidIsoDate(dateStr, minDate || '2027-08-13');
  const safeMin = minDate ? ensureValidIsoDate(minDate, safeDate) : '';
  const safeMax = maxDate ? ensureValidIsoDate(maxDate, safeDate) : '';

  if (safeMin && safeDate < safeMin) return safeMin;
  if (safeMax && safeDate > safeMax) return safeMax;
  return safeDate;
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
  const safePStart = ensureValidIsoDate(projectStart, '2027-08-13');
  const safePEnd = ensureValidIsoDate(projectEnd, safePStart);

  let cleanStart = startDate ? ensureValidIsoDate(startDate, safePStart) : undefined;
  let cleanEnd = endDate ? ensureValidIsoDate(endDate, cleanStart || safePStart) : undefined;

  if (cleanStart) {
    cleanStart = clampDateString(cleanStart, safePStart, safePEnd);
  }

  if (cleanEnd) {
    cleanEnd = clampDateString(cleanEnd, safePStart, safePEnd);
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
  const pStart = ensureValidIsoDate(project.startDate, '2027-08-13');
  let pEnd = ensureValidIsoDate(project.endDate, pStart);
  if (pEnd < pStart) {
    pEnd = pStart;
  }

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

  const safeId = project.id && String(project.id).trim()
    ? String(project.id).trim()
    : `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const baseProject: Project = {
    ...project,
    id: safeId,
    name: project.name && String(project.name).trim() ? String(project.name).trim().toUpperCase() : 'PROJETO',
    startDate: pStart,
    endDate: pEnd,
    groupDates: sanitizedGroupDates,
    workCenterDates: sanitizedWcDates,
  };

  return deduplicateProjectWorkCenterHours(baseProject, workCenters);
}
