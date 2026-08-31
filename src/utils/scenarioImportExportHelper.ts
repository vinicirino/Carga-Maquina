import { PlanningScenario, WorkCenter, Project, DEFAULT_SECTOR_GROUPS } from '../types';
import { sanitizeProjectSchedules } from './dateValidation';
import { initialCategorySeed } from './categoryHelper';

export interface ScenarioExportEnvelope {
  format: 'pcp_scenario_v2';
  version: '2.0';
  exportedAt: string;
  system: 'PCP Análise de Carga Máquina & Capacidade';
  scenario: PlanningScenario;
  summary: {
    scenarioName: string;
    description: string;
    totalProjects: number;
    totalWorkCenters: number;
    totalDemandedHours: number;
    sectorGroupsCount: number;
    startDate?: string;
    endDate?: string;
  };
}

export interface ScenarioBundleExportEnvelope {
  format: 'pcp_scenario_bundle_v2';
  version: '2.0';
  exportedAt: string;
  system: 'PCP Análise de Carga Máquina & Capacidade';
  activeScenarioId?: string;
  sectorGroups: string[];
  scenarios: PlanningScenario[];
  summary: {
    totalScenarios: number;
    scenarioNames: string[];
  };
}

export interface ParsedScenarioResult {
  success: boolean;
  isBundle: boolean;
  formatDescription: string;
  error?: string;
  singleScenario?: PlanningScenario;
  scenarios?: PlanningScenario[];
  activeScenarioId?: string;
  stats: {
    scenarioName: string;
    description: string;
    projectsCount: number;
    workCentersCount: number;
    sectorGroupsCount: number;
    scenariosCount: number;
    totalHours: number;
    startDate?: string;
    endDate?: string;
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
 * Generate formatted JSON string for a single planning scenario
 */
export function exportSingleScenarioToJson(scenario: PlanningScenario): string {
  let totalHours = 0;
  let minStart = '';
  let maxEnd = '';

  scenario.projects.forEach((p) => {
    Object.values(p.workCenterHours || {}).forEach((h) => {
      totalHours += Number(h) || 0;
    });

    if (p.startDate && (!minStart || p.startDate < minStart)) {
      minStart = p.startDate;
    }
    if (p.endDate && (!maxEnd || p.endDate > maxEnd)) {
      maxEnd = p.endDate;
    }
  });

  const envelope: ScenarioExportEnvelope = {
    format: 'pcp_scenario_v2',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    system: 'PCP Análise de Carga Máquina & Capacidade',
    scenario: {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description || '',
      createdAt: scenario.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isBaseline: Boolean(scenario.isBaseline),
      sectorGroups: scenario.sectorGroups && scenario.sectorGroups.length > 0
        ? scenario.sectorGroups
        : DEFAULT_SECTOR_GROUPS,
      calendarExceptions: scenario.calendarExceptions || [],
      workCenters: scenario.workCenters.map((wc) => ({
        id: wc.id,
        name: wc.name,
        dailyHours: wc.dailyHours,
        daysPerWeek: wc.daysPerWeek,
        resourcesCount: wc.resourcesCount,
        efficiencyPercentage: wc.efficiencyPercentage,
        category: wc.category || initialCategorySeed(wc.name),
        enabled: wc.enabled !== false,
      })),
      projects: scenario.projects.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        color: p.color,
        enabled: p.enabled !== false,
        workCenterHours: p.workCenterHours || {},
        groupDates: p.groupDates,
        workCenterDates: p.workCenterDates,
        turbineConfig: p.turbineConfig,
      })),
    },
    summary: {
      scenarioName: scenario.name,
      description: scenario.description || '',
      totalProjects: scenario.projects.length,
      totalWorkCenters: scenario.workCenters.length,
      totalDemandedHours: Math.round(totalHours),
      sectorGroupsCount: (scenario.sectorGroups || DEFAULT_SECTOR_GROUPS).length,
      startDate: minStart || undefined,
      endDate: maxEnd || undefined,
    },
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Generate formatted JSON string for all scenarios bundle
 */
export function exportAllScenariosToJson(
  scenarios: PlanningScenario[],
  activeScenarioId?: string,
  sectorGroups?: string[]
): string {
  const envelope: ScenarioBundleExportEnvelope = {
    format: 'pcp_scenario_bundle_v2',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    system: 'PCP Análise de Carga Máquina & Capacidade',
    activeScenarioId: activeScenarioId || scenarios[0]?.id,
    sectorGroups: sectorGroups || DEFAULT_SECTOR_GROUPS,
    scenarios: scenarios.map((s) => ({
      ...s,
      updatedAt: new Date().toISOString(),
    })),
    summary: {
      totalScenarios: scenarios.length,
      scenarioNames: scenarios.map((s) => s.name),
    },
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Trigger file download directly in browser
 */
export function downloadScenarioFile(scenario: PlanningScenario): void {
  const json = exportSingleScenarioToJson(scenario);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = scenario.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `cenario_${safeName || 'pcp'}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger file download for all scenarios bundle
 */
export function downloadAllScenariosFile(
  scenarios: PlanningScenario[],
  activeScenarioId?: string,
  sectorGroups?: string[]
): void {
  const json = exportAllScenariosToJson(scenarios, activeScenarioId, sectorGroups);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `cenarios_pcp_pacote_completo_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse any scenario JSON input (single scenario envelope, bundle, or raw scenario structure)
 */
export function parseScenarioJson(rawInput: string): ParsedScenarioResult {
  const emptyStats = {
    scenarioName: '',
    description: '',
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
      isBundle: false,
      formatDescription: 'JSON Inválido',
      error: `Erro de formatação JSON: ${err.message || 'Verifique a sintaxe.'}`,
      stats: emptyStats,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      success: false,
      isBundle: false,
      formatDescription: 'Conteúdo Inválido',
      error: 'O arquivo importado precisa ser um objeto JSON válido.',
      stats: emptyStats,
    };
  }

  // 1. Check if it's a Scenario Bundle (pcp_scenario_bundle_v2 or contains scenarios array)
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
            name: String(wc.name || `Centro ${idx + 1}`).trim(),
            dailyHours: Number(wc.dailyHours) > 0 ? Number(wc.dailyHours) : 8,
            daysPerWeek: Number(wc.daysPerWeek) > 0 ? Number(wc.daysPerWeek) : 5,
            resourcesCount: Number(wc.resourcesCount) > 0 ? Number(wc.resourcesCount) : 1,
            efficiencyPercentage: Number(wc.efficiencyPercentage) > 0 ? Number(wc.efficiencyPercentage) : 100,
            category: (wc.category && String(wc.category).trim())
              ? String(wc.category).trim().toUpperCase()
              : initialCategorySeed(String(wc.name || '')),
            enabled: wc.enabled !== false,
          }))
        : [];

      const projects: Project[] = Array.isArray(s.projects)
        ? s.projects.map((p: any, idx: number) =>
            sanitizeProjectSchedules({
              id: p.id || `proj-${idx + 1}-${String(p.name || 'projeto').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              name: String(p.name || `Projeto ${idx + 1}`).trim(),
              startDate: p.startDate || '2027-08-13',
              endDate: p.endDate || '2028-09-15',
              color: p.color || PROJECT_PALETTE[idx % PROJECT_PALETTE.length],
              enabled: p.enabled !== false,
              groupDates: p.groupDates && typeof p.groupDates === 'object' ? p.groupDates : undefined,
              workCenterDates: p.workCenterDates && typeof p.workCenterDates === 'object' ? p.workCenterDates : undefined,
              workCenterHours: p.workCenterHours && typeof p.workCenterHours === 'object' ? p.workCenterHours : {},
              turbineConfig: p.turbineConfig,
            }, workCenters)
          )
        : [];

      const calendarExceptions = Array.isArray(s.calendarExceptions) ? s.calendarExceptions : [];

      validatedScenarios.push({
        id: s.id || `scen-${i + 1}-${Date.now()}`,
        name: String(s.name || `Cenário ${i + 1}`).trim(),
        description: String(s.description || ''),
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString(),
        isBaseline: Boolean(s.isBaseline),
        workCenters,
        projects,
        sectorGroups,
        calendarExceptions,
      });
    }

    if (validatedScenarios.length > 0) {
      const activeScen = validatedScenarios.find((s) => s.id === parsed.activeScenarioId) || validatedScenarios[0];
      let totalHours = 0;
      let hasGroupDates = false;
      activeScen.projects.forEach((p) => {
        if (p.groupDates && Object.keys(p.groupDates).length > 0) hasGroupDates = true;
        Object.values(p.workCenterHours || {}).forEach((h) => {
          totalHours += Number(h) || 0;
        });
      });

      return {
        success: true,
        isBundle: true,
        formatDescription: `Pacote com ${validatedScenarios.length} Cenários`,
        scenarios: validatedScenarios,
        activeScenarioId: activeScen.id,
        singleScenario: activeScen,
        stats: {
          scenarioName: activeScen.name,
          description: `Pacote contendo ${validatedScenarios.length} cenários`,
          projectsCount: activeScen.projects.length,
          workCentersCount: activeScen.workCenters.length,
          sectorGroupsCount: (activeScen.sectorGroups || DEFAULT_SECTOR_GROUPS).length,
          scenariosCount: validatedScenarios.length,
          totalHours: Math.round(totalHours),
          hasGroupDates,
        },
      };
    }
  }

  // 2. Check if it's a Single Scenario Envelope (pcp_scenario_v2 with scenario object) or raw scenario
  const rawScenObj = parsed.scenario || (parsed.workCenters || parsed.projects ? parsed : null);

  if (rawScenObj && typeof rawScenObj === 'object') {
    const rawWcs: any[] = Array.isArray(rawScenObj.workCenters) ? rawScenObj.workCenters : [];
    const rawProjs: any[] = Array.isArray(rawScenObj.projects) ? rawScenObj.projects : [];

    let sectorGroups: string[] = Array.isArray(rawScenObj.sectorGroups) && rawScenObj.sectorGroups.length > 0
      ? rawScenObj.sectorGroups.map((g: any) => String(g).trim().toUpperCase())
      : (Array.isArray(parsed.sectorGroups) ? parsed.sectorGroups : [...DEFAULT_SECTOR_GROUPS]);

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
      name: String(wc.name || `Centro ${idx + 1}`).trim(),
      dailyHours: Number(wc.dailyHours) > 0 ? Number(wc.dailyHours) : 8,
      daysPerWeek: Number(wc.daysPerWeek) > 0 ? Number(wc.daysPerWeek) : 5,
      resourcesCount: Number(wc.resourcesCount) > 0 ? Number(wc.resourcesCount) : 1,
      efficiencyPercentage: Number(wc.efficiencyPercentage) > 0 ? Number(wc.efficiencyPercentage) : 100,
      category: (wc.category && String(wc.category).trim())
        ? String(wc.category).trim().toUpperCase()
        : initialCategorySeed(String(wc.name || '')),
      enabled: wc.enabled !== false,
    }));

    let totalHours = 0;
    let hasGroupDates = false;
    let minStart = '';
    let maxEnd = '';

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

      if (p.startDate && (!minStart || p.startDate < minStart)) minStart = p.startDate;
      if (p.endDate && (!maxEnd || p.endDate > maxEnd)) maxEnd = p.endDate;

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
        turbineConfig: p.turbineConfig,
      }, workCenters);
    });

    const scenarioName = String(rawScenObj.name || parsed.summary?.scenarioName || parsed.name || 'Cenário Importado').trim();
    const scenarioDescription = String(rawScenObj.description || parsed.summary?.description || parsed.description || '');

    const calendarExceptions = Array.isArray(rawScenObj.calendarExceptions)
      ? rawScenObj.calendarExceptions
      : (Array.isArray(parsed.calendarExceptions) ? parsed.calendarExceptions : []);

    const singleScenario: PlanningScenario = {
      id: rawScenObj.id || `scen-${Date.now()}`,
      name: scenarioName,
      description: scenarioDescription,
      createdAt: rawScenObj.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isBaseline: Boolean(rawScenObj.isBaseline),
      workCenters,
      projects,
      sectorGroups,
      calendarExceptions,
    };

    return {
      success: true,
      isBundle: false,
      formatDescription: 'Cenário Individual de Planejamento',
      singleScenario,
      scenarios: [singleScenario],
      activeScenarioId: singleScenario.id,
      stats: {
        scenarioName,
        description: scenarioDescription,
        projectsCount: projects.length,
        workCentersCount: workCenters.length,
        sectorGroupsCount: sectorGroups.length,
        scenariosCount: 1,
        totalHours: Math.round(totalHours),
        startDate: minStart || undefined,
        endDate: maxEnd || undefined,
        hasGroupDates,
      },
    };
  }

  return {
    success: false,
    isBundle: false,
    formatDescription: 'Estrutura não reconhecida',
    error: 'O arquivo não contém os dados necessários de um cenário (workCenters ou projects).',
    stats: emptyStats,
  };
}
