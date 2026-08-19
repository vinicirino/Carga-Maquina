import * as XLSX from 'xlsx';
import { WorkCenter, Project } from '../types';
import { TurbineType } from '../types/turbine';
import { DEFAULT_TURBINE_TYPES } from '../data/defaultTurbines';
import { calculateTurbineProject, buildProjectFromTurbineConfig } from './turbineCalculator';
import { getWorkCenterCategory } from './categoryHelper';
import { addWeeks, format, parseISO } from 'date-fns';

export interface MatrixColumnMapping {
  rawHeader: string;
  cleanName: string;
  code?: string;
  action: 'MAP_EXISTING' | 'CREATE_NEW' | 'IGNORE';
  targetWorkCenterId?: string; // If mapping to existing
  newCenterCategory?: string;  // If creating new (which sector group)
  newCenterDailyHours: number;
  newCenterDaysPerWeek: number;
  newCenterResourcesCount: number;
  newCenterEfficiencyPercentage: number;
  isExistingMatch: boolean;
  matchedWorkCenter?: WorkCenter;
  totalHoursInColumn: number;
}

export interface MatrixProjectRow {
  rowIndex: number;
  rawName: string;
  projectName: string;
  startDate: string;
  endDate: string;
  turbineTypeId: string;
  totalHours: number;
  workCenterHours: Record<string, number>; // rawHeader -> hours
}

export interface MatrixParsedData {
  headers: string[];
  rawRows: Array<{ name: string; values: Record<string, number> }>;
  columnMappings: MatrixColumnMapping[];
  projectRows: MatrixProjectRow[];
  totalProjects: number;
  totalColumns: number;
  totalHoursSum: number;
  detectedDelimiter: string;
}

// Clean number parser for pt-BR currency/numbers (e.g. "107,74", "4.259,92", "4259.92", 107.74)
export function parseMatrixNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let str = String(val).trim();
  if (!str) return 0;

  // If format is 4.259,92
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  // Remove any remaining invalid characters except digits, minus, and dot
  str = str.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Normalize strings for fuzzy matching
export function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match column header to existing work centers
export function findMatchingWorkCenter(header: string, workCenters: WorkCenter[]): WorkCenter | undefined {
  const normHeader = normalizeString(header);
  if (!normHeader) return undefined;

  // 1. Exact ID or Name match
  const exact = workCenters.find(
    (wc) =>
      wc.id.trim().toUpperCase() === header.trim().toUpperCase() ||
      wc.name.trim().toUpperCase() === header.trim().toUpperCase() ||
      normalizeString(wc.name) === normHeader
  );
  if (exact) return exact;

  // 2. Extract leading numeric code (e.g., "10010" from "10010 MANDRILHADORA CNC WOTAN M3")
  const codeMatch = header.match(/^(\d{4,6})\b/);
  if (codeMatch) {
    const code = codeMatch[1];
    const matchByCode = workCenters.find((wc) => {
      const wcNorm = normalizeString(wc.name);
      return wcNorm.includes(code) || wc.id.includes(code);
    });
    if (matchByCode) return matchByCode;
  }

  // 3. Substring inclusion
  const partial = workCenters.find((wc) => {
    const normWc = normalizeString(wc.name);
    return normHeader.includes(normWc) || normWc.includes(normHeader);
  });
  if (partial) return partial;

  return undefined;
}

// Guess appropriate category/sector group from header text
export function guessCategoryFromHeader(header: string, sectorGroups: string[]): string {
  const norm = normalizeString(header);
  
  if (norm.includes('SOLDA') || norm.includes('SOLDAGEM')) return 'SOLDA';
  if (norm.includes('CALDEIRARIA') || norm.includes('ROBO CALDEIRARIA')) return 'CALDEIRARIA';
  if (
    norm.includes('TORNO') ||
    norm.includes('FRESADORA') ||
    norm.includes('MANDRILHADORA') ||
    norm.includes('USINAGEM') ||
    norm.includes('RETIFICA')
  ) {
    return 'USINAGEM';
  }
  if (norm.includes('CORTE') || norm.includes('PLASMA') || norm.includes('OXICORTE') || norm.includes('OXIPIRA')) {
    return 'CORTE';
  }
  if (norm.includes('MONTAGEM')) return 'MONTAGEM';
  if (norm.includes('PINTURA') || norm.includes('JATEAMENTO') || norm.includes('LIXAMENTO') || norm.includes('METALIZACAO')) {
    return 'PINTURA';
  }
  if (norm.includes('QUALIDADE') || norm.includes('GARANTIA')) return 'QUALIDADE';
  if (norm.includes('PROJETO') || norm.includes('ENGENHARIA')) return 'ENGENHARIA';

  // Check if any sector group name is part of the header
  for (const group of sectorGroups) {
    if (norm.includes(normalizeString(group))) {
      return group;
    }
  }

  return sectorGroups[0] || 'OUTROS';
}

// Parse text input (CSV, TSV, Semicolon-delimited)
export function parseMatrixCsvText(
  csvText: string,
  existingWorkCenters: WorkCenter[],
  existingSectorGroups: string[],
  defaultTurbineTypeId: string = 'francis',
  defaultStartDate: string = format(new Date(), 'yyyy-MM-dd')
): MatrixParsedData {
  const cleanText = csvText.replace(/^\uFEFF/, '').trim(); // Remove UTF-8 BOM
  if (!cleanText) {
    return {
      headers: [],
      rawRows: [],
      columnMappings: [],
      projectRows: [],
      totalProjects: 0,
      totalColumns: 0,
      totalHoursSum: 0,
      detectedDelimiter: ';',
    };
  }

  // Detect delimiter (; or , or \t)
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  let delimiter = ';';
  const countSemi = (firstLine.match(/;/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;
  const countTab = (firstLine.match(/\t/g) || []).length;

  if (countTab >= countSemi && countTab >= countComma && countTab > 0) {
    delimiter = '\t';
  } else if (countSemi >= countComma && countSemi > 0) {
    delimiter = ';';
  } else if (countComma > 0) {
    delimiter = ',';
  }

  // Use SheetJS/XLSX or robust CSV splitter
  const workbook = XLSX.read(cleanText, { type: 'string', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawJsonMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  return processRawMatrixRows(
    rawJsonMatrix,
    existingWorkCenters,
    existingSectorGroups,
    defaultTurbineTypeId,
    defaultStartDate,
    delimiter
  );
}

// Parse Binary File (XLSX / XLS / CSV ArrayBuffer)
export function parseMatrixBinaryFile(
  fileBuffer: ArrayBuffer,
  existingWorkCenters: WorkCenter[],
  existingSectorGroups: string[],
  defaultTurbineTypeId: string = 'francis',
  defaultStartDate: string = format(new Date(), 'yyyy-MM-dd')
): MatrixParsedData {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawJsonMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  return processRawMatrixRows(
    rawJsonMatrix,
    existingWorkCenters,
    existingSectorGroups,
    defaultTurbineTypeId,
    defaultStartDate,
    'xlsx'
  );
}

// Core processing of 2D Array matrix (Row 0 = headers, Rows 1..N = Projects)
function processRawMatrixRows(
  rows: any[][],
  existingWorkCenters: WorkCenter[],
  existingSectorGroups: string[],
  defaultTurbineTypeId: string,
  defaultStartDate: string,
  delimiter: string
): MatrixParsedData {
  if (!rows || rows.length < 2) {
    return {
      headers: [],
      rawRows: [],
      columnMappings: [],
      projectRows: [],
      totalProjects: 0,
      totalColumns: 0,
      totalHoursSum: 0,
      detectedDelimiter: delimiter,
    };
  }

  // Row 0: Headers (Col 0 is "Rotulos de Linha" / Project Name column, Col 1..N are WorkCenters)
  const headerRow = rows[0].map((c) => String(c || '').trim());
  const columnHeaders = headerRow.slice(1).filter((h) => h.length > 0);

  // Column hours accumulator to calculate total hours per column
  const columnTotalHours: Record<string, number> = {};
  columnHeaders.forEach((h) => {
    columnTotalHours[h] = 0;
  });

  const parsedRawRows: Array<{ name: string; values: Record<string, number> }> = [];
  const projectRows: MatrixProjectRow[] = [];
  let totalHoursSum = 0;

  // Process data rows
  const parsedStartDate = parseISO(defaultStartDate);
  const defaultDurationWeeks = 16;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawProjectName = String(row[0] || '').trim();
    if (!rawProjectName) continue; // Skip empty rows

    const values: Record<string, number> = {};
    let projectTotalHours = 0;

    for (let c = 0; c < columnHeaders.length; c++) {
      const header = columnHeaders[c];
      const cellVal = row[c + 1];
      const hours = parseMatrixNumber(cellVal);
      if (hours > 0) {
        values[header] = hours;
        projectTotalHours += hours;
        columnTotalHours[header] = (columnTotalHours[header] || 0) + hours;
      }
    }

    parsedRawRows.push({
      name: rawProjectName,
      values,
    });

    totalHoursSum += projectTotalHours;

    // Calculate sequential default dates (staggered by 2 weeks per project)
    const pStart = addWeeks(parsedStartDate, (r - 1) * 2);
    const pEnd = addWeeks(pStart, defaultDurationWeeks);

    projectRows.push({
      rowIndex: r - 1,
      rawName: rawProjectName,
      projectName: rawProjectName.toUpperCase(),
      startDate: format(pStart, 'yyyy-MM-dd'),
      endDate: format(pEnd, 'yyyy-MM-dd'),
      turbineTypeId: defaultTurbineTypeId,
      totalHours: projectTotalHours,
      workCenterHours: values,
    });
  }

  // Build Column Mappings & Detection
  const columnMappings: MatrixColumnMapping[] = columnHeaders.map((rawHeader) => {
    const matchedWc = findMatchingWorkCenter(rawHeader, existingWorkCenters);
    const isMatched = !!matchedWc;
    const totalHours = columnTotalHours[rawHeader] || 0;
    const guessedCategory = guessCategoryFromHeader(rawHeader, existingSectorGroups);

    return {
      rawHeader,
      cleanName: rawHeader.trim(),
      action: isMatched ? 'MAP_EXISTING' : 'CREATE_NEW',
      targetWorkCenterId: isMatched ? matchedWc.id : undefined,
      matchedWorkCenter: matchedWc,
      isExistingMatch: isMatched,
      newCenterCategory: isMatched ? getWorkCenterCategory(matchedWc) : guessedCategory,
      newCenterDailyHours: 8,
      newCenterDaysPerWeek: 5,
      newCenterResourcesCount: 1,
      newCenterEfficiencyPercentage: 85,
      totalHoursInColumn: totalHours,
    };
  });

  return {
    headers: columnHeaders,
    rawRows: parsedRawRows,
    columnMappings,
    projectRows,
    totalProjects: projectRows.length,
    totalColumns: columnHeaders.length,
    totalHoursSum,
    detectedDelimiter: delimiter,
  };
}

// Generate the final Projects and WorkCenters to import
export interface GeneratedMatrixImportResult {
  updatedWorkCenters: WorkCenter[];
  updatedSectorGroups: string[];
  generatedProjects: Project[];
  newWorkCentersCount: number;
  mappedExistingCount: number;
}

export function compileMatrixImport(
  parsedData: MatrixParsedData,
  currentWorkCenters: WorkCenter[],
  currentSectorGroups: string[],
  turbineTypes: TurbineType[]
): GeneratedMatrixImportResult {
  const finalWorkCenters: WorkCenter[] = [...currentWorkCenters];
  const finalSectorGroups = new Set<string>([...currentSectorGroups]);

  // Map from rawHeader -> final work center ID
  const headerToWcIdMap: Record<string, string> = {};
  let newWorkCentersCount = 0;
  let mappedExistingCount = 0;

  // 1. Process column mappings (create new work centers or map to existing)
  for (const mapping of parsedData.columnMappings) {
    if (mapping.action === 'IGNORE') {
      continue;
    }

    if (mapping.action === 'MAP_EXISTING' && mapping.targetWorkCenterId) {
      headerToWcIdMap[mapping.rawHeader] = mapping.targetWorkCenterId;
      mappedExistingCount++;
    } else if (mapping.action === 'CREATE_NEW') {
      const category = (mapping.newCenterCategory || 'OUTROS').trim().toUpperCase();
      finalSectorGroups.add(category);

      // Check if already in finalWorkCenters
      const existingWc = finalWorkCenters.find(
        (wc) => wc.name.trim().toUpperCase() === mapping.cleanName.trim().toUpperCase()
      );

      if (existingWc) {
        headerToWcIdMap[mapping.rawHeader] = existingWc.id;
        mappedExistingCount++;
      } else {
        const newId = `wc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newWc: WorkCenter = {
          id: newId,
          name: mapping.cleanName.trim().toUpperCase(),
          category,
          dailyHours: mapping.newCenterDailyHours || 8,
          daysPerWeek: mapping.newCenterDaysPerWeek || 5,
          resourcesCount: mapping.newCenterResourcesCount || 1,
          efficiencyPercentage: mapping.newCenterEfficiencyPercentage || 85,
        };
        finalWorkCenters.push(newWc);
        headerToWcIdMap[mapping.rawHeader] = newId;
        newWorkCentersCount++;
      }
    }
  }

  // 2. Generate Projects with Curve S & Dates
  const generatedProjects: Project[] = [];

  const defaultColors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#6366f1',
    '#14b8a6',
    '#f97316',
    '#84cc16',
  ];

  for (let idx = 0; idx < parsedData.projectRows.length; idx++) {
    const pRow = parsedData.projectRows[idx];

    // Build workCenterHours mapped to actual work center IDs and Names
    const finalWcHours: Record<string, number> = {};
    for (const [rawHeader, hours] of Object.entries(pRow.workCenterHours)) {
      const targetWcId = headerToWcIdMap[rawHeader];
      if (targetWcId && hours > 0) {
        finalWcHours[targetWcId] = (finalWcHours[targetWcId] || 0) + hours;
        // Also map by name for backward compatibility
        const foundWc = finalWorkCenters.find((w) => w.id === targetWcId);
        if (foundWc) {
          finalWcHours[foundWc.name] = (finalWcHours[foundWc.name] || 0) + hours;
        }
      }
    }

    // Find turbine type
    const turbineType =
      turbineTypes.find((t) => t.id === pRow.turbineTypeId) ||
      DEFAULT_TURBINE_TYPES.find((t) => t.id === pRow.turbineTypeId) ||
      turbineTypes[0] ||
      DEFAULT_TURBINE_TYPES[0];

    // Build custom sector curves from the turbine type weights & mapped project hours
    const totalProjHours = pRow.totalHours > 0 ? pRow.totalHours : 10000;
    const customSectorCurves: Record<string, any> = {};

    Array.from(finalSectorGroups).forEach((grp) => {
      // Find default curve config from turbine type
      const defaultCurve = turbineType.sectorCurves ? turbineType.sectorCurves[grp] : undefined;

      // Sum hours in this sector for this project
      const wcsInSector = finalWorkCenters.filter(
        (wc) => (wc.category || 'OUTROS').trim().toUpperCase() === grp.trim().toUpperCase()
      );
      const sectorHours = wcsInSector.reduce((sum, wc) => sum + (finalWcHours[wc.id] || 0), 0);
      const calculatedPct = totalProjHours > 0 ? Math.round((sectorHours / totalProjHours) * 100) : 0;

      customSectorCurves[grp] = {
        sectorName: grp,
        percentage: calculatedPct > 0 ? calculatedPct : (defaultCurve?.percentage || 10),
        startPct: defaultCurve?.startPct ?? 10,
        endPct: defaultCurve?.endPct ?? 70,
        curveShape: defaultCurve?.curveShape || 's-curve',
        volumeGain: defaultCurve?.volumeGain || 1.0,
      };
    });

    const turbineConfig = {
      projectName: pRow.projectName.trim().toUpperCase(),
      turbineTypeId: turbineType.id,
      quantity: 1,
      hoursPerTurbine: totalProjHours,
      totalHours: totalProjHours,
      startDate: pRow.startDate,
      endDate: pRow.endDate,
      staggeringMode: 'STAGGERED' as const,
      staggerOffsetWeeks: 4,
      customSectorCurves,
    };

    // Calculate timeline and date distribution using turbine calculator
    const calcResult = calculateTurbineProject(turbineConfig, turbineType, finalWorkCenters);

    // Merge calculated dates and final workCenterHours
    const color = defaultColors[idx % defaultColors.length];
    const project: Project = {
      id: `proj-matrix-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      name: pRow.projectName.trim().toUpperCase(),
      startDate: pRow.startDate || calcResult.startDate,
      endDate: pRow.endDate || calcResult.endDate,
      workCenterHours: finalWcHours,
      groupDates: calcResult.groupDates,
      workCenterDates: calcResult.workCenterDates,
      color,
      enabled: true,
      turbineConfig,
    };

    generatedProjects.push(project);
  }

  return {
    updatedWorkCenters: finalWorkCenters,
    updatedSectorGroups: Array.from(finalSectorGroups),
    generatedProjects,
    newWorkCentersCount,
    mappedExistingCount,
  };
}
