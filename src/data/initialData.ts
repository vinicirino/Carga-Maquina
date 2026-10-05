import { WorkCenter, Project } from '../types';

export const RAW_INITIAL_JSON = {};

export function parseJsonToState(_raw: any): { workCenters: WorkCenter[]; projects: Project[] } {
  return { workCenters: [], projects: [] };
}

export function sanitizeWorkCenterName(name: string): string {
  if (!name) return '';
  return name.trim().toUpperCase();
}

export const INITIAL_DATA: { workCenters: WorkCenter[]; projects: Project[] } = {
  workCenters: [],
  projects: [],
};
