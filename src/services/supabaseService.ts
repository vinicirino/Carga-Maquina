import { supabase, isSupabaseConfigured, getSupabase } from '../lib/supabase';
import { WorkCenter, Project, CalendarException, PlanningScenario, DEFAULT_SECTOR_GROUPS } from '../types';
import { TurbineType } from '../types/turbine';
import { GanttTaskNode } from '../types/gantt';

// ============================================================================
// CONVERTERS: DTO / Database Row <-> TypeScript Models
// ============================================================================

function mapWorkCenterFromRow(row: any): WorkCenter {
  return {
    id: row.id,
    name: row.name,
    category: row.category || 'OUTROS',
    dailyHours: Number(row.daily_hours) || 8,
    daysPerWeek: Number(row.days_per_week) || 5,
    resourcesCount: Number(row.resources_count) || 1,
    efficiencyPercentage: Number(row.efficiency_percentage) || 100,
    enabled: row.enabled !== false,
  };
}

function mapWorkCenterToRow(wc: WorkCenter) {
  return {
    id: wc.id,
    name: wc.name,
    category: wc.category || 'OUTROS',
    daily_hours: wc.dailyHours ?? 8,
    days_per_week: wc.daysPerWeek ?? 5,
    resources_count: wc.resourcesCount ?? 1,
    efficiency_percentage: wc.efficiencyPercentage ?? 100,
    enabled: wc.enabled !== false,
    updated_at: new Date().toISOString(),
  };
}

function mapProjectFromRow(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    color: row.color || '#3b82f6',
    enabled: row.enabled !== false,
    workCenterHours: row.work_center_hours || {},
    workCenterDates: row.work_center_dates || {},
    groupDates: row.group_dates || {},
    turbineConfig: row.turbine_config || undefined,
  };
}

function mapProjectToRow(p: Project) {
  return {
    id: p.id,
    name: p.name,
    start_date: p.startDate,
    end_date: p.endDate,
    color: p.color || '#3b82f6',
    enabled: p.enabled !== false,
    work_center_hours: p.workCenterHours || {},
    work_center_dates: p.workCenterDates || {},
    group_dates: p.groupDates || {},
    turbine_config: p.turbineConfig || null,
    updated_at: new Date().toISOString(),
  };
}

function mapCalendarExceptionFromRow(row: any): CalendarException {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    workCenterIds: row.work_center_ids || [],
    impactType: row.impact_type || 'full_closure',
    capacityReductionPercentage: Number(row.capacity_reduction_percentage) || 0,
    description: row.description || undefined,
    color: row.color || undefined,
  };
}

function mapCalendarExceptionToRow(c: CalendarException) {
  return {
    id: c.id,
    title: c.title,
    type: c.type,
    start_date: c.startDate,
    end_date: c.endDate,
    work_center_ids: c.workCenterIds || [],
    impact_type: c.impactType || 'full_closure',
    capacity_reduction_percentage: c.capacityReductionPercentage ?? 0,
    description: c.description || null,
    color: c.color || null,
    updated_at: new Date().toISOString(),
  };
}

function mapTurbineTypeFromRow(row: any): TurbineType {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    defaultHoursPerTurbine: Number(row.default_hours_per_turbine) || 0,
    defaultDurationDays: Number(row.default_duration_days) || 90,
    sectorCurves: row.sector_curves || {},
    isCustom: Boolean(row.is_custom),
  };
}

function mapTurbineTypeToRow(t: TurbineType) {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description || '',
    default_hours_per_turbine: t.defaultHoursPerTurbine || 0,
    default_duration_days: t.defaultDurationDays || 90,
    sector_curves: t.sectorCurves || {},
    is_custom: Boolean(t.isCustom),
    updated_at: new Date().toISOString(),
  };
}

function mapGanttTaskFromRow(row: any): GanttTaskNode {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id || null,
    level: Number(row.level) || 0,
    code: row.code || '',
    name: row.name,
    type: row.type,
    constraintType: row.constraint_type || 'manual',
    workCenterId: row.work_center_id || undefined,
    workCenterName: row.work_center_name || undefined,
    plannedHours: Number(row.planned_hours) || 0,
    actualHours: Number(row.actual_hours) || 0,
    startDate: row.start_date,
    endDate: row.end_date,
    baselineStartDate: row.baseline_start_date || undefined,
    baselineEndDate: row.baseline_end_date || undefined,
    contractDate: row.contract_date || undefined,
    materialName: row.material_name || undefined,
    materialSupplier: row.material_supplier || undefined,
    materialEtaDate: row.material_eta_date || undefined,
    materialStatus: row.material_status || undefined,
    progress: Number(row.progress) || 0,
    status: row.status || 'not_started',
    dependencies: row.dependencies || [],
    sortOrder: Number(row.sort_order) || 0,
    treeDepth: Number(row.tree_depth) || 0,
  };
}

function mapGanttTaskToRow(g: GanttTaskNode) {
  return {
    id: g.id,
    project_id: g.projectId,
    parent_id: g.parentId || null,
    level: g.level ?? 0,
    code: g.code,
    name: g.name,
    type: g.type,
    constraint_type: g.constraintType || 'manual',
    work_center_id: g.workCenterId || null,
    work_center_name: g.workCenterName || null,
    planned_hours: g.plannedHours ?? 0,
    actual_hours: g.actualHours ?? 0,
    start_date: g.startDate,
    end_date: g.endDate,
    baseline_start_date: g.baselineStartDate || null,
    baseline_end_date: g.baselineEndDate || null,
    contract_date: g.contractDate || null,
    material_name: g.materialName || null,
    material_supplier: g.materialSupplier || null,
    material_eta_date: g.materialEtaDate || null,
    material_status: g.materialStatus || null,
    progress: g.progress ?? 0,
    status: g.status || 'not_started',
    dependencies: g.dependencies || [],
    sort_order: g.sortOrder ?? 0,
    tree_depth: g.treeDepth ?? 0,
    updated_at: new Date().toISOString(),
  };
}

function mapScenarioFromRow(row: any): PlanningScenario {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isBaseline: Boolean(row.is_baseline),
    workCenters: row.work_centers_data || [],
    projects: row.projects_data || [],
    sectorGroups: row.sector_groups_data || DEFAULT_SECTOR_GROUPS,
    calendarExceptions: row.calendar_data || [],
  };
}

function mapScenarioToRow(s: PlanningScenario) {
  return {
    id: s.id,
    name: s.name,
    description: s.description || '',
    is_baseline: Boolean(s.isBaseline),
    work_centers_data: s.workCenters || [],
    projects_data: s.projects || [],
    sector_groups_data: s.sectorGroups || DEFAULT_SECTOR_GROUPS,
    calendar_data: s.calendarExceptions || [],
    created_at: s.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================================
// CRUD & API SERVICE
// ============================================================================

export const SupabaseService = {
  // --- Centros de Trabalho ---
  async fetchWorkCenters(): Promise<WorkCenter[]> {
    const client = getSupabase();
    const { data, error } = await client
      .from('work_centers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar centros de trabalho no Supabase:', error);
      throw new Error(`Falha ao carregar centros de trabalho: ${error.message}`);
    }
    return (data || []).map(mapWorkCenterFromRow);
  },

  async saveWorkCenter(wc: WorkCenter): Promise<void> {
    const client = getSupabase();
    const row = mapWorkCenterToRow(wc);
    const { error } = await client.from('work_centers').upsert(row);
    if (error) {
      console.error('Erro ao salvar centro de trabalho no Supabase:', error);
      throw new Error(`Falha ao salvar centro de trabalho: ${error.message}`);
    }
  },

  async saveAllWorkCenters(wcs: WorkCenter[]): Promise<void> {
    const client = getSupabase();
    if (wcs.length === 0) {
      const { error } = await client.from('work_centers').delete().neq('id', '');
      if (error) throw new Error(error.message);
      return;
    }
    const rows = wcs.map(mapWorkCenterToRow);
    const { error: upsertError } = await client.from('work_centers').upsert(rows);
    if (upsertError) {
      console.error('Erro ao salvar centros de trabalho:', upsertError);
      throw new Error(`Falha ao atualizar centros de trabalho: ${upsertError.message}`);
    }

    // Remover os que não estão mais presentes
    const currentIds = wcs.map((w) => w.id);
    const { error: delError } = await client
      .from('work_centers')
      .delete()
      .not('id', 'in', `(${currentIds.map((id) => `'${id}'`).join(',')})`);
    if (delError) {
      console.warn('Aviso ao remover centros excluídos:', delError);
    }
  },

  async deleteWorkCenter(id: string): Promise<void> {
    const client = getSupabase();
    const { error } = await client.from('work_centers').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir centro de trabalho:', error);
      throw new Error(`Falha ao excluir centro de trabalho: ${error.message}`);
    }
  },

  // --- Projetos ---
  async fetchProjects(): Promise<Project[]> {
    const client = getSupabase();
    const { data, error } = await client
      .from('projects')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Erro ao buscar projetos no Supabase:', error);
      throw new Error(`Falha ao carregar projetos: ${error.message}`);
    }
    return (data || []).map(mapProjectFromRow);
  },

  async saveProject(p: Project): Promise<void> {
    const client = getSupabase();
    const row = mapProjectToRow(p);
    const { error } = await client.from('projects').upsert(row);
    if (error) {
      console.error('Erro ao salvar projeto no Supabase:', error);
      throw new Error(`Falha ao salvar projeto: ${error.message}`);
    }
  },

  async saveAllProjects(projects: Project[]): Promise<void> {
    const client = getSupabase();
    if (projects.length === 0) {
      const { error } = await client.from('projects').delete().neq('id', '');
      if (error) throw new Error(error.message);
      return;
    }
    const rows = projects.map(mapProjectToRow);
    const { error: upsertError } = await client.from('projects').upsert(rows);
    if (upsertError) {
      console.error('Erro ao salvar projetos:', upsertError);
      throw new Error(`Falha ao salvar projetos: ${upsertError.message}`);
    }

    // Remover projetos que foram excluídos
    const currentIds = projects.map((p) => p.id);
    const { error: delError } = await client
      .from('projects')
      .delete()
      .not('id', 'in', `(${currentIds.map((id) => `'${id}'`).join(',')})`);
    if (delError) {
      console.warn('Aviso ao remover projetos excluídos:', delError);
    }
  },

  async deleteProject(id: string): Promise<void> {
    const client = getSupabase();
    const { error } = await client.from('projects').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir projeto:', error);
      throw new Error(`Falha ao excluir projeto: ${error.message}`);
    }
  },

  // --- Calendário e Exceções ---
  async fetchCalendarExceptions(): Promise<CalendarException[]> {
    const client = getSupabase();
    const { data, error } = await client
      .from('calendar_exceptions')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Erro ao buscar exceções de calendário no Supabase:', error);
      throw new Error(`Falha ao carregar exceções de calendário: ${error.message}`);
    }
    return (data || []).map(mapCalendarExceptionFromRow);
  },

  async saveAllCalendarExceptions(exceptions: CalendarException[]): Promise<void> {
    const client = getSupabase();
    if (exceptions.length === 0) {
      const { error } = await client.from('calendar_exceptions').delete().neq('id', '');
      if (error) throw new Error(error.message);
      return;
    }
    const rows = exceptions.map(mapCalendarExceptionToRow);
    const { error: upsertError } = await client.from('calendar_exceptions').upsert(rows);
    if (upsertError) {
      console.error('Erro ao salvar exceções de calendário:', upsertError);
      throw new Error(`Falha ao salvar calendário: ${upsertError.message}`);
    }

    const currentIds = exceptions.map((e) => e.id);
    const { error: delError } = await client
      .from('calendar_exceptions')
      .delete()
      .not('id', 'in', `(${currentIds.map((id) => `'${id}'`).join(',')})`);
    if (delError) {
      console.warn('Aviso ao remover exceções de calendário excluídas:', delError);
    }
  },

  // --- Tipos de Turbina ---
  async fetchTurbineTypes(): Promise<TurbineType[]> {
    const client = getSupabase();
    const { data, error } = await client
      .from('turbine_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar tipos de turbina no Supabase:', error);
      throw new Error(`Falha ao carregar tipos de turbina: ${error.message}`);
    }
    return (data || []).map(mapTurbineTypeFromRow);
  },

  async saveAllTurbineTypes(types: TurbineType[]): Promise<void> {
    const client = getSupabase();
    if (types.length === 0) {
      const { error } = await client.from('turbine_types').delete().neq('id', '');
      if (error) throw new Error(error.message);
      return;
    }
    const rows = types.map(mapTurbineTypeToRow);
    const { error: upsertError } = await client.from('turbine_types').upsert(rows);
    if (upsertError) {
      console.error('Erro ao salvar modelos de turbina:', upsertError);
      throw new Error(`Falha ao salvar modelos de turbina: ${upsertError.message}`);
    }

    const currentIds = types.map((t) => t.id);
    const { error: delError } = await client
      .from('turbine_types')
      .delete()
      .not('id', 'in', `(${currentIds.map((id) => `'${id}'`).join(',')})`);
    if (delError) {
      console.warn('Aviso ao remover tipos excluídos:', delError);
    }
  },

  // --- Tarefas Cronograma Gantt / EAP ---
  async fetchGanttTasks(): Promise<GanttTaskNode[]> {
    const client = getSupabase();
    const { data, error } = await client
      .from('gantt_tasks')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar tarefas do cronograma no Supabase:', error);
      throw new Error(`Falha ao carregar cronograma Gantt: ${error.message}`);
    }
    return (data || []).map(mapGanttTaskFromRow);
  },

  async saveAllGanttTasks(tasks: GanttTaskNode[]): Promise<void> {
    const client = getSupabase();
    if (tasks.length === 0) {
      const { error } = await client.from('gantt_tasks').delete().neq('id', '');
      if (error) throw new Error(error.message);
      return;
    }

    // Auto-cura: Garante que os project_ids referenciados existam na tabela projects
    // Isso evita falhas de chave estrangeira (gantt_tasks_project_id_fkey) caso a constraint ainda exista no Supabase
    try {
      const distinctProjectIds = Array.from(
        new Set(tasks.map((t) => t.projectId).filter(Boolean))
      ) as string[];

      if (distinctProjectIds.length > 0) {
        const { data: existingProjs } = await client
          .from('projects')
          .select('id')
          .in('id', distinctProjectIds);

        const existingSet = new Set((existingProjs || []).map((p: any) => p.id));
        const missingIds = distinctProjectIds.filter((id) => !existingSet.has(id));

        if (missingIds.length > 0) {
          const rootTasks = tasks.filter((t) => t.level === 0);
          const stubs = missingIds.map((id) => {
            const root = rootTasks.find((t) => t.id === id || t.projectId === id);
            return {
              id,
              name: root ? root.name : `Projeto Cronograma ${id}`,
              start_date: root ? root.startDate : new Date().toISOString().split('T')[0],
              end_date: root ? root.endDate : new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
              color: root?.color || '#4f46e5',
              enabled: true,
              work_center_hours: {},
              work_center_dates: {},
              group_dates: {},
              updated_at: new Date().toISOString(),
            };
          });

          await client.from('projects').upsert(stubs);
        }
      }
    } catch (projSyncErr) {
      console.warn('Aviso ao sincronizar projetos de suporte para o Gantt:', projSyncErr);
    }

    const rows = tasks.map(mapGanttTaskToRow);
    const { error: upsertError } = await client.from('gantt_tasks').upsert(rows);
    if (upsertError) {
      console.error('Erro ao salvar tarefas do cronograma:', upsertError);
      throw new Error(`Falha ao salvar cronograma Gantt: ${upsertError.message}`);
    }

    const currentIds = tasks.map((t) => t.id);
    const { error: delError } = await client
      .from('gantt_tasks')
      .delete()
      .not('id', 'in', `(${currentIds.map((id) => `'${id}'`).join(',')})`);
    if (delError) {
      console.warn('Aviso ao remover tarefas excluídas:', delError);
    }
  },

  // --- Cenários de Simulação ---
  async fetchScenarios(): Promise<PlanningScenario[]> {
    const client = getSupabase();
    const { data, error } = await client
      .from('scenarios')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar cenários no Supabase:', error);
      throw new Error(`Falha ao carregar cenários: ${error.message}`);
    }
    return (data || []).map(mapScenarioFromRow);
  },

  async saveScenario(scen: PlanningScenario): Promise<void> {
    const client = getSupabase();
    const row = mapScenarioToRow(scen);
    const { error } = await client.from('scenarios').upsert(row);
    if (error) {
      console.error('Erro ao salvar cenário no Supabase:', error);
      throw new Error(`Falha ao salvar cenário: ${error.message}`);
    }
  },

  async saveAllScenarios(scenarios: PlanningScenario[]): Promise<void> {
    const client = getSupabase();
    if (scenarios.length === 0) {
      const { error } = await client.from('scenarios').delete().neq('id', '');
      if (error) throw new Error(error.message);
      return;
    }
    const rows = scenarios.map(mapScenarioToRow);
    const { error: upsertError } = await client.from('scenarios').upsert(rows);
    if (upsertError) {
      console.error('Erro ao atualizar cenários:', upsertError);
      throw new Error(`Falha ao salvar lista de cenários: ${upsertError.message}`);
    }

    const currentIds = scenarios.map((s) => s.id);
    const { error: delError } = await client
      .from('scenarios')
      .delete()
      .not('id', 'in', `(${currentIds.map((id) => `'${id}'`).join(',')})`);
    if (delError) {
      console.warn('Aviso ao remover cenários excluídos:', delError);
    }
  },

  async deleteScenario(id: string): Promise<void> {
    const client = getSupabase();
    const { error } = await client.from('scenarios').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir cenário:', error);
      throw new Error(`Falha ao excluir cenário: ${error.message}`);
    }
  },

  // --- Estado Global Compartilhado do Sistema (System State) ---
  async fetchSystemState<T>(key: string, defaultValue: T): Promise<T> {
    const client = getSupabase();
    const { data, error } = await client
      .from('system_state')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.warn(`Aviso ao ler chave ${key} de system_state:`, error);
      return defaultValue;
    }
    if (!data) return defaultValue;
    return (data.value as T) ?? defaultValue;
  },

  async saveSystemState<T>(key: string, value: T): Promise<void> {
    const client = getSupabase();
    const { error } = await client.from('system_state').upsert({
      key,
      value: value as any,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error(`Erro ao salvar chave ${key} em system_state:`, error);
      throw new Error(`Falha ao sincronizar estado do sistema (${key}): ${error.message}`);
    }
  },

  // --- Inscrição em Tempo Real (Real-time Broadcast) ---
  subscribeToChanges(onTableChange: (table: string) => void): () => void {
    if (!isSupabaseConfigured || !supabase) {
      return () => {};
    }

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          onTableChange(payload.table);
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  },
};
