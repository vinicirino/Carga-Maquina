import { PlanningScenario, DEFAULT_SECTOR_GROUPS } from '../types';
import { INITIAL_DATA } from './initialData';
import { DEFAULT_CALENDAR_EXCEPTIONS } from './defaultCalendar';

export function getInitialScenarios(): PlanningScenario[] {
  const baseWcs = INITIAL_DATA.workCenters;
  const baseProjects = INITIAL_DATA.projects;
  const baseGroups = DEFAULT_SECTOR_GROUPS;
  const baseCalendarExceptions = DEFAULT_CALENDAR_EXCEPTIONS;

  // Scenario 1: Operational Baseline
  const scenario1: PlanningScenario = {
    id: 'scen-1-baseline',
    name: 'Cenário 1: Base Operacional (Atual)',
    description: 'Turno padrão de 8h/dia, 5 dias/semana. Recursos e cronogramas originais conforme planejamento fabril com calendário padrão de feriados e férias.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBaseline: true,
    workCenters: JSON.parse(JSON.stringify(baseWcs)),
    projects: JSON.parse(JSON.stringify(baseProjects)),
    sectorGroups: [...baseGroups],
    calendarExceptions: JSON.parse(JSON.stringify(baseCalendarExceptions)),
  };

  // Scenario 2: Expanded Shift & Capacity
  const scenario2Wcs = JSON.parse(JSON.stringify(baseWcs)).map((wc: any) => {
    // Increase resources or daily hours on high volume work centers
    if (
      wc.name.includes('TORNO') ||
      wc.name.includes('OXICORTE') ||
      wc.name.includes('SOLDAGEM') ||
      wc.name.includes('MONTAGEM ESTRUTURAL') ||
      wc.name.includes('CALDEIRARIA')
    ) {
      return {
        ...wc,
        dailyHours: 12, // 1.5 shifts
        resourcesCount: Math.ceil(wc.resourcesCount * 1.3),
        efficiencyPercentage: 105,
      };
    }
    return wc;
  });

  const scenario2: PlanningScenario = {
    id: 'scen-2-extra-shift',
    name: 'Cenário 2: Turno Extra & Ampliação de Recursos',
    description: 'Adição de 2º turno (12h/dia) e contratação de operadores nos centros críticos (Tornos, Oxicorte, Caldeiraria, Solda).',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workCenters: scenario2Wcs,
    projects: JSON.parse(JSON.stringify(baseProjects)),
    sectorGroups: [...baseGroups],
    calendarExceptions: JSON.parse(JSON.stringify(baseCalendarExceptions)),
  };

  // Scenario 3: Staggered Sector Schedules
  const scenario3Projects = JSON.parse(JSON.stringify(baseProjects)).map((proj: any, idx: number) => {
    // Add staggered group dates to smooth peak overlap
    return {
      ...proj,
      groupDates: {
        CORTE: { startDate: '2027-08-13', endDate: '2027-11-30' },
        CALDEIRARIA: { startDate: '2027-11-01', endDate: '2028-02-28' },
        SOLDA: { startDate: '2028-01-15', endDate: '2028-05-31' },
        USINAGEM: { startDate: '2027-09-15', endDate: '2028-06-30' },
        MONTAGENS: { startDate: '2028-04-01', endDate: '2028-08-31' },
        ACABAMENTOS: { startDate: '2028-07-01', endDate: '2028-09-15' },
      },
    };
  });

  const scenario3: PlanningScenario = {
    id: 'scen-3-staggered-dates',
    name: 'Cenário 3: Cronograma Escalonado por Setores',
    description: 'Nivelamento de prazos distribuindo as datas de execução por agrupadores de setor para evitar sobreposição de gargalos.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workCenters: JSON.parse(JSON.stringify(baseWcs)),
    projects: scenario3Projects,
    sectorGroups: [...baseGroups],
    calendarExceptions: JSON.parse(JSON.stringify(baseCalendarExceptions)),
  };

  return [scenario1, scenario2, scenario3];
}
