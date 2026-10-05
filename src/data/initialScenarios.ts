import { PlanningScenario, DEFAULT_SECTOR_GROUPS } from '../types';

export const CLEAN_INITIAL_SCENARIO: PlanningScenario = {
  id: 'scen-1-base-oficial',
  name: 'Cenário 1: Base Operacional (Principal)',
  description: 'Cenário oficial da fábrica para planejamento e controle da capacidade fabril.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isBaseline: true,
  workCenters: [],
  projects: [],
  sectorGroups: DEFAULT_SECTOR_GROUPS,
  calendarExceptions: [],
};

export function getInitialScenarios(): PlanningScenario[] {
  return [CLEAN_INITIAL_SCENARIO];
}
