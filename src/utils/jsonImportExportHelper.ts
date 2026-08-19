import { WorkCenter, Project, PlanningScenario, DEFAULT_SECTOR_GROUPS } from '../types';
import { initialCategorySeed, getWorkCenterCategory } from './categoryHelper';
import { sanitizeWorkCenterName } from '../data/initialData';
import { sanitizeProjectSchedules } from './dateValidation';

export type JsonStructureType = 'full_v2' | 'scenarios_bundle' | 'legacy_erp' | 'unknown';

export interface ParsedJsonResult {
  success: boolean;
  detectedFormat: JsonStructureType;
  formatDescription: string;
  error?: string;
  workCenters: WorkCenter[];
  projects: Project[];
  sectorGroups: string[];
  scenarios?: PlanningScenario[];
  activeScenarioId?: string;
  stats: {
    projectsCount: number;
    workCentersCount: number;
    sectorGroupsCount: number;
    scenariosCount: number;
    totalHours: number;
    hasGroupDates: boolean;
  };
}

const PROJECT_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#e11d48', // rose
];

/**
 * Intelligent parser that inspects any JSON input and handles:
 * 1. Full system package v2.0 (workCenters, projects with groupDates, sectorGroups, scenarios)
 * 2. Multi-scenario bundle ({ scenarios: [...] })
 * 3. Single scenario or custom object ({ workCenters: [...], projects: [...] })
 * 4. Legacy ERP Matrix ({ "PROJETO 1": [{ "TORNO CNC": 120.5 }] })
 */
export function analyzeAndParseJson(rawInput: string): ParsedJsonResult {
  const emptyStats = {
    projectsCount: 0,
    workCentersCount: 0,
    sectorGroupsCount: 0,
    scenariosCount: 0,
    totalHours: 0,
    hasGroupDates: false,
  };

  let parsed: any;
  try {
    parsed = JSON.parse(rawInput);
  } catch (err: any) {
    return {
      success: false,
      detectedFormat: 'unknown',
      formatDescription: 'JSON Inválido',
      error: `Erro de sintaxe JSON: ${err.message || 'Verifique vírgulas e aspas.'}`,
      workCenters: [],
      projects: [],
      sectorGroups: DEFAULT_SECTOR_GROUPS,
      stats: emptyStats,
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      success: false,
      detectedFormat: 'unknown',
      formatDescription: 'Formato não reconhecido',
      error: 'O JSON deve ser um objeto {...} ou matriz de dados.',
      workCenters: [],
      projects: [],
      sectorGroups: DEFAULT_SECTOR_GROUPS,
      stats: emptyStats,
    };
  }

  // Case 1: Scenarios Bundle ({ scenarios: [...] })
  if (Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0) {
    const rawScenarios: any[] = parsed.scenarios;
    const validatedScenarios: PlanningScenario[] = [];

    for (let i = 0; i < rawScenarios.length; i++) {
      const s = rawScenarios[i];
      if (!s || typeof s !== 'object') continue;

      const sectorGroups: string[] = Array.isArray(s.sectorGroups) && s.sectorGroups.length > 0
        ? s.sectorGroups.map((g: any) => String(g).trim().toUpperCase())
        : (Array.isArray(parsed.sectorGroups) ? parsed.sectorGroups : DEFAULT_SECTOR_GROUPS);

      const workCenters: WorkCenter[] = Array.isArray(s.workCenters)
        ? s.workCenters.map((wc: any, idx: number) => ({
            id: wc.id || `wc-${idx + 1}-${String(wc.name || 'centro').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            name: String(wc.name || `Centro ${idx + 1}`),
            dailyHours: Number(wc.dailyHours) > 0 ? Number(wc.dailyHours) : 8,
            daysPerWeek: Number(wc.daysPerWeek) > 0 ? Number(wc.daysPerWeek) : 5,
            resourcesCount: Number(wc.resourcesCount) > 0 ? Number(wc.resourcesCount) : 1,
            efficiencyPercentage: Number(wc.efficiencyPercentage) > 0 ? Number(wc.efficiencyPercentage) : 100,
            category: (wc.category && String(wc.category).trim())
              ? String(wc.category).trim().toUpperCase()
              : initialCategorySeed(String(wc.name || '')),
          }))
        : [];

      const projects: Project[] = Array.isArray(s.projects)
        ? s.projects.map((p: any, idx: number) =>
            sanitizeProjectSchedules({
              id: p.id || `proj-${idx + 1}-${String(p.name || 'projeto').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              name: String(p.name || `Projeto ${idx + 1}`),
              startDate: p.startDate || '2027-08-13',
              endDate: p.endDate || '2028-09-15',
              color: p.color || PROJECT_PALETTE[idx % PROJECT_PALETTE.length],
              enabled: p.enabled !== false,
              groupDates: p.groupDates && typeof p.groupDates === 'object' ? p.groupDates : undefined,
              workCenterDates: p.workCenterDates && typeof p.workCenterDates === 'object' ? p.workCenterDates : undefined,
              workCenterHours: p.workCenterHours && typeof p.workCenterHours === 'object'
                ? p.workCenterHours
                : {},
            })
          )
        : [];

      validatedScenarios.push({
        id: s.id || `scen-${i + 1}-${Date.now()}`,
        name: s.name || `Cenário ${i + 1}`,
        description: s.description || '',
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString(),
        isBaseline: !!s.isBaseline,
        workCenters,
        projects,
        sectorGroups,
      });
    }

    if (validatedScenarios.length > 0) {
      const activeScen = validatedScenarios.find((s) => s.id === parsed.activeScenarioId) || validatedScenarios[0];
      const allWcs = activeScen.workCenters;
      const allProjs = activeScen.projects;

      let totalHours = 0;
      let hasGroupDates = false;
      allProjs.forEach((p) => {
        if (p.groupDates && Object.keys(p.groupDates).length > 0) hasGroupDates = true;
        Object.values(p.workCenterHours || {}).forEach((h) => {
          totalHours += Number(h) || 0;
        });
      });

      return {
        success: true,
        detectedFormat: 'scenarios_bundle',
        formatDescription: 'Pacote Completo Multi-Cenários',
        scenarios: validatedScenarios,
        activeScenarioId: activeScen.id,
        workCenters: activeScen.workCenters,
        projects: activeScen.projects,
        sectorGroups: activeScen.sectorGroups,
        stats: {
          projectsCount: allProjs.length,
          workCentersCount: allWcs.length,
          sectorGroupsCount: activeScen.sectorGroups.length,
          scenariosCount: validatedScenarios.length,
          totalHours: Math.round(totalHours),
          hasGroupDates,
        },
      };
    }
  }

  // Case 2: Full Structured v2 ({ workCenters: [...], projects: [...] })
  if (Array.isArray(parsed.workCenters) || Array.isArray(parsed.projects)) {
    const rawWcs = Array.isArray(parsed.workCenters) ? parsed.workCenters : [];
    const rawProjs = Array.isArray(parsed.projects) ? parsed.projects : [];

    // Extract or infer sector groups
    let sectorGroups: string[] = Array.isArray(parsed.sectorGroups) && parsed.sectorGroups.length > 0
      ? parsed.sectorGroups.map((g: any) => String(g).trim().toUpperCase())
      : [...DEFAULT_SECTOR_GROUPS];

    // Collect any new categories present in workCenters
    rawWcs.forEach((wc: any) => {
      if (wc.category && typeof wc.category === 'string') {
        const cat = wc.category.trim().toUpperCase();
        if (cat && !sectorGroups.includes(cat)) {
          sectorGroups.push(cat);
        }
      }
    });

    const workCenters: WorkCenter[] = rawWcs.map((wc: any, idx: number) => ({
      id: wc.id || `wc-${idx + 1}-${String(wc.name || 'centro').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: String(wc.name || `Centro de Trabalho ${idx + 1}`).trim(),
      dailyHours: Number(wc.dailyHours) > 0 ? Number(wc.dailyHours) : 8,
      daysPerWeek: Number(wc.daysPerWeek) > 0 ? Number(wc.daysPerWeek) : 5,
      resourcesCount: Number(wc.resourcesCount) > 0 ? Number(wc.resourcesCount) : 1,
      efficiencyPercentage: Number(wc.efficiencyPercentage) > 0 ? Number(wc.efficiencyPercentage) : 100,
      category: (wc.category && String(wc.category).trim())
        ? String(wc.category).trim().toUpperCase()
        : initialCategorySeed(String(wc.name || '')),
    }));

    let totalHours = 0;
    let hasGroupDates = false;

    const projects: Project[] = rawProjs.map((p: any, idx: number) => {
      const cleanHours: Record<string, number> = {};
      if (p.workCenterHours && typeof p.workCenterHours === 'object') {
        for (const [wcName, h] of Object.entries(p.workCenterHours)) {
          const num = Number(h);
          if (!isNaN(num)) {
            cleanHours[wcName] = num;
            totalHours += num;
          }
        }
      }

      if (p.groupDates && typeof p.groupDates === 'object' && Object.keys(p.groupDates).length > 0) {
        hasGroupDates = true;
      }

      return sanitizeProjectSchedules({
        id: p.id || `proj-${idx + 1}-${String(p.name || 'projeto').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: String(p.name || `Projeto ${idx + 1}`).trim(),
        startDate: p.startDate || '2027-08-13',
        endDate: p.endDate || '2028-09-15',
        color: p.color || PROJECT_PALETTE[idx % PROJECT_PALETTE.length],
        enabled: p.enabled !== false,
        groupDates: p.groupDates && typeof p.groupDates === 'object' ? p.groupDates : undefined,
        workCenterDates: p.workCenterDates && typeof p.workCenterDates === 'object' ? p.workCenterDates : undefined,
        workCenterHours: cleanHours,
      });
    });

    return {
      success: true,
      detectedFormat: 'full_v2',
      formatDescription: 'Estrutura Completa de Planejamento (v2.0)',
      workCenters,
      projects,
      sectorGroups,
      stats: {
        projectsCount: projects.length,
        workCentersCount: workCenters.length,
        sectorGroupsCount: sectorGroups.length,
        scenariosCount: 1,
        totalHours: Math.round(totalHours),
        hasGroupDates,
      },
    };
  }

  // Case 3: Legacy ERP Hours Matrix ({ "PROJETO": [ { "CENTRO": 100 } ] } or { "PROJETO": { "CENTRO": 100 } })
  const keys = Object.keys(parsed);
  if (keys.length > 0 && typeof parsed[keys[0]] === 'object') {
    const workCenterTotalHoursMap: Record<string, number> = {};
    const projects: Project[] = [];
    let dateIdx = 0;
    const projectDates = [
      { start: '2027-08-13', end: '2028-09-15' },
      { start: '2027-09-01', end: '2028-06-30' },
      { start: '2027-10-15', end: '2028-12-31' },
      { start: '2028-01-10', end: '2028-11-30' },
    ];

    let totalHours = 0;

    for (const [projectName, projectVal] of Object.entries(parsed)) {
      let rawHoursMap: Record<string, any> = {};
      if (Array.isArray(projectVal) && projectVal.length > 0) {
        rawHoursMap = projectVal[0] || {};
      } else if (projectVal && typeof projectVal === 'object') {
        rawHoursMap = projectVal as Record<string, any>;
      } else {
        continue;
      }

      const cleanWorkCenterHours: Record<string, number> = {};
      for (const [rawWcName, hours] of Object.entries(rawHoursMap)) {
        const numHours = Number(hours);
        if (isNaN(numHours)) continue;
        const wcName = sanitizeWorkCenterName(rawWcName);
        if (!wcName) continue;

        cleanWorkCenterHours[wcName] = (cleanWorkCenterHours[wcName] || 0) + numHours;
        workCenterTotalHoursMap[wcName] = (workCenterTotalHoursMap[wcName] || 0) + numHours;
        totalHours += numHours;
      }

      const defaultDate = projectDates[dateIdx % projectDates.length];
      dateIdx++;

      projects.push({
        id: `proj-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: projectName,
        startDate: defaultDate.start,
        endDate: defaultDate.end,
        workCenterHours: cleanWorkCenterHours,
        color: PROJECT_PALETTE[projects.length % PROJECT_PALETTE.length],
        enabled: true,
      });
    }

    if (projects.length > 0 && Object.keys(workCenterTotalHoursMap).length > 0) {
      const workCenters: WorkCenter[] = Object.keys(workCenterTotalHoursMap).map((wcName, idx) => {
        const wcHours = workCenterTotalHoursMap[wcName];
        let defaultResources = 1;
        if (wcHours > 50000) defaultResources = 25;
        else if (wcHours > 20000) defaultResources = 12;
        else if (wcHours > 8000) defaultResources = 6;
        else if (wcHours > 3000) defaultResources = 3;
        else if (wcHours > 1000) defaultResources = 2;

        return {
          id: `wc-${idx + 1}-${wcName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: wcName,
          dailyHours: 8,
          daysPerWeek: 5,
          resourcesCount: defaultResources,
          efficiencyPercentage: 100,
          category: initialCategorySeed(wcName),
        };
      });

      return {
        success: true,
        detectedFormat: 'legacy_erp',
        formatDescription: 'Matriz ERP Simples de Carga por Projeto',
        workCenters,
        projects,
        sectorGroups: DEFAULT_SECTOR_GROUPS,
        stats: {
          projectsCount: projects.length,
          workCentersCount: workCenters.length,
          sectorGroupsCount: DEFAULT_SECTOR_GROUPS.length,
          scenariosCount: 1,
          totalHours: Math.round(totalHours),
          hasGroupDates: false,
        },
      };
    }
  }

  return {
    success: false,
    detectedFormat: 'unknown',
    formatDescription: 'Estrutura Não Reconhecida',
    error:
      'Não foi possível identificar a estrutura dos dados. O JSON precisa ter "workCenters" / "projects", "scenarios" ou ser uma matriz de projetos por centro de trabalho.',
    workCenters: [],
    projects: [],
    sectorGroups: DEFAULT_SECTOR_GROUPS,
    stats: emptyStats,
  };
}

/**
 * Generate full JSON export string with rich metadata
 */
export function generateFullExportJson(params: {
  workCenters: WorkCenter[];
  projects: Project[];
  sectorGroups: string[];
  scenarios?: PlanningScenario[];
  activeScenarioId?: string;
  includeAllScenarios?: boolean;
}): string {
  const {
    workCenters,
    projects,
    sectorGroups,
    scenarios,
    activeScenarioId,
    includeAllScenarios = false,
  } = params;

  if (includeAllScenarios && scenarios && scenarios.length > 0) {
    const exportBundle = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      activeScenarioId: activeScenarioId || scenarios[0]?.id,
      sectorGroups,
      scenarios,
    };
    return JSON.stringify(exportBundle, null, 2);
  }

  const exportData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    sectorGroups,
    workCenters,
    projects,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate legacy ERP hours matrix JSON
 */
export function generateErpMatrixJson(projects: Project[]): string {
  const matrix: Record<string, any[]> = {};

  projects.forEach((proj) => {
    const hoursMap: Record<string, number> = {};
    let total = 0;
    Object.entries(proj.workCenterHours || {}).forEach(([wcName, hours]) => {
      hoursMap[wcName] = hours;
      total += hours;
    });
    hoursMap['Total Geral'] = Number(total.toFixed(2));
    matrix[proj.name] = [hoursMap];
  });

  return JSON.stringify(matrix, null, 2);
}

/**
 * Templates for the user to copy or test
 */
export const JSON_TEMPLATES = {
  full_v2: `{
  "version": "2.0",
  "sectorGroups": [
    "CORTE",
    "CALDEIRARIA",
    "SOLDA",
    "USINAGEM",
    "MONTAGENS",
    "ACABAMENTOS",
    "OUTROS"
  ],
  "workCenters": [
    {
      "id": "wc-1-oxicorte",
      "name": "OXICORTE CNC MULTI THERM",
      "dailyHours": 8,
      "daysPerWeek": 5,
      "resourcesCount": 2,
      "efficiencyPercentage": 100,
      "category": "CORTE"
    },
    {
      "id": "wc-2-caldeiraria",
      "name": "CALDEIRARIA 01",
      "dailyHours": 8,
      "daysPerWeek": 5,
      "resourcesCount": 6,
      "efficiencyPercentage": 100,
      "category": "CALDEIRARIA"
    },
    {
      "id": "wc-3-torno-cnc",
      "name": "TORNO CNC VULCANIC",
      "dailyHours": 8,
      "daysPerWeek": 5,
      "resourcesCount": 3,
      "efficiencyPercentage": 100,
      "category": "USINAGEM"
    }
  ],
  "projects": [
    {
      "id": "proj-exemplo-1",
      "name": "FABRICAÇÃO ESTRUTURA TURBINA",
      "startDate": "2027-08-13",
      "endDate": "2028-06-30",
      "color": "#3b82f6",
      "enabled": true,
      "groupDates": {
        "CORTE": { "startDate": "2027-08-13", "endDate": "2027-11-30" },
        "CALDEIRARIA": { "startDate": "2027-11-01", "endDate": "2028-02-28" },
        "USINAGEM": { "startDate": "2028-01-15", "endDate": "2028-06-30" }
      },
      "workCenterHours": {
        "OXICORTE CNC MULTI THERM": 450.0,
        "CALDEIRARIA 01": 2800.0,
        "TORNO CNC VULCANIC": 1200.0
      }
    }
  ]
}`,

  legacy_erp: `{
  "PROJETO HIDRELÉTRICA CENTRAL": [
    {
      "OXICORTE CNC MULTI THERM": 350.5,
      "CALDEIRARIA 01": 2400.0,
      "SOLDAGEM 01": 3100.0,
      "TORNO VERTICAL CNC MORANDO 3000": 850.0,
      "MONTAGEM MECANICA 01": 620.0,
      "PINTURA": 400.0,
      "Total Geral": 7720.5
    }
  ],
  "PROJETO EXPANSÃO LINHA 2": [
    {
      "CALDEIRARIA 01": 1500.0,
      "SOLDAGEM 01": 1800.0,
      "TORNO CNC VULCANIC 1050": 450.0,
      "Total Geral": 3750.0
    }
  ]
}`,
};
