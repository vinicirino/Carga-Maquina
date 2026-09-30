-- ==============================================================================
-- SCHEMA POSTGRESQL / SUPABASE - PCP & ANÁLISE DE CARGA MÁQUINA
-- ==============================================================================
-- Este esquema contempla todas as estruturas de dados compartilhadas do PCP:
-- Centros de Trabalho, Calendário Fabril, Modelos de Turbina, Projetos, Tarefas
-- Gantt/EAP, Cenários de Simulação e Estado Central do Sistema (System State).
-- Todos os dados são sincronizados em nuvem entre diferentes dispositivos e navegadores.
-- ==============================================================================

-- Habilita extensão para geração de UUID caso necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. CENTROS DE TRABALHO (WORK CENTERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_centers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'OUTROS',
    daily_hours NUMERIC(5, 2) NOT NULL DEFAULT 8.00,
    days_per_week NUMERIC(3, 1) NOT NULL DEFAULT 5.0,
    resources_count NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    efficiency_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_work_centers_category ON public.work_centers(category);
CREATE INDEX IF NOT EXISTS idx_work_centers_enabled ON public.work_centers(enabled);

-- ------------------------------------------------------------------------------
-- 2. CALENDÁRIO FABRIL & EXCEÇÕES (FERIADOS, FÉRIAS COLETIVAS, PARADAS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_exceptions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('feriado', 'ferias_coletivas', 'manutencao', 'folga_parada')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    work_center_ids TEXT[] DEFAULT '{}',
    impact_type TEXT NOT NULL DEFAULT 'full_closure' CHECK (impact_type IN ('full_closure', 'capacity_reduction')),
    capacity_reduction_percentage NUMERIC(5, 2) DEFAULT 0.00,
    description TEXT,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_calendar_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_dates ON public.calendar_exceptions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_type ON public.calendar_exceptions(type);

-- ------------------------------------------------------------------------------
-- 3. MODELOS / TIPOS DE TURBINA PADRÃO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.turbine_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('HYDRO', 'STEAM', 'WIND', 'CUSTOM')),
    description TEXT,
    default_hours_per_turbine NUMERIC(10, 2) NOT NULL DEFAULT 0,
    default_duration_days INTEGER NOT NULL DEFAULT 90,
    sector_curves JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_custom BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. PROJETOS (PROJECTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    enabled BOOLEAN NOT NULL DEFAULT true,
    work_center_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    work_center_dates JSONB NOT NULL DEFAULT '{}'::jsonb,
    group_dates JSONB NOT NULL DEFAULT '{}'::jsonb,
    turbine_config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_project_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_projects_dates ON public.projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_projects_enabled ON public.projects(enabled);

-- ------------------------------------------------------------------------------
-- 5. TAREFAS CRONOGRAMA GANTT / EAP (ESTRUTURA ANALÍTICA DE PROJETO)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gantt_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES public.gantt_tasks(id) ON DELETE SET NULL,
    level INTEGER NOT NULL DEFAULT 0,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('project', 'group', 'subgroup', 'item', 'operation', 'milestone')),
    constraint_type TEXT NOT NULL DEFAULT 'manual' CHECK (constraint_type IN ('contract', 'capacity', 'material', 'manual')),
    work_center_id TEXT REFERENCES public.work_centers(id) ON DELETE SET NULL,
    work_center_name TEXT,
    planned_hours NUMERIC(10, 2) DEFAULT 0,
    actual_hours NUMERIC(10, 2) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    baseline_start_date DATE,
    baseline_end_date DATE,
    contract_date DATE,
    material_name TEXT,
    material_supplier TEXT,
    material_eta_date DATE,
    material_status TEXT CHECK (material_status IS NULL OR material_status IN ('not_ordered', 'ordered', 'in_transit', 'received', 'delayed')),
    progress NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'delayed', 'waiting_material', 'blocked')),
    dependencies TEXT[] DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    tree_depth INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_gantt_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_gantt_tasks_project ON public.gantt_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_parent ON public.gantt_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_level ON public.gantt_tasks(level);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_work_center ON public.gantt_tasks(work_center_id);

-- ------------------------------------------------------------------------------
-- 6. CENÁRIOS DE SIMULAÇÃO (PLANNING SCENARIOS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_baseline BOOLEAN NOT NULL DEFAULT false,
    work_centers_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    calendar_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    sector_groups_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_scenarios_is_baseline ON public.scenarios(is_baseline);

-- ------------------------------------------------------------------------------
-- 7. ESTADO CENTRAL COMPARTILHADO DO SISTEMA (SYSTEM STATE)
-- Armazena configurações globais compartilhadas (cenário ativo, baseline, etc.)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 8. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_work_centers_updated_at ON public.work_centers;
CREATE TRIGGER trigger_work_centers_updated_at
    BEFORE UPDATE ON public.work_centers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_calendar_exceptions_updated_at ON public.calendar_exceptions;
CREATE TRIGGER trigger_calendar_exceptions_updated_at
    BEFORE UPDATE ON public.calendar_exceptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_turbine_types_updated_at ON public.turbine_types;
CREATE TRIGGER trigger_turbine_types_updated_at
    BEFORE UPDATE ON public.turbine_types
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_gantt_tasks_updated_at ON public.gantt_tasks;
CREATE TRIGGER trigger_gantt_tasks_updated_at
    BEFORE UPDATE ON public.gantt_tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_scenarios_updated_at ON public.scenarios;
CREATE TRIGGER trigger_scenarios_updated_at
    BEFORE UPDATE ON public.scenarios
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_system_state_updated_at ON public.system_state;
CREATE TRIGGER trigger_system_state_updated_at
    BEFORE UPDATE ON public.system_state
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 9. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS COMPARTILHADO)
-- Regra de negócio: Todos os usuários autorizados compartilham os mesmos dados
-- operacionais da fábrica. NÃO há isolamento por auth.uid().
-- ------------------------------------------------------------------------------
ALTER TABLE public.work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turbine_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gantt_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;

-- Removendo policies antigas caso existam
DROP POLICY IF EXISTS "Shared access for all users on work_centers" ON public.work_centers;
DROP POLICY IF EXISTS "Shared access for all users on calendar_exceptions" ON public.calendar_exceptions;
DROP POLICY IF EXISTS "Shared access for all users on turbine_types" ON public.turbine_types;
DROP POLICY IF EXISTS "Shared access for all users on projects" ON public.projects;
DROP POLICY IF EXISTS "Shared access for all users on gantt_tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Shared access for all users on scenarios" ON public.scenarios;
DROP POLICY IF EXISTS "Shared access for all users on system_state" ON public.system_state;

CREATE POLICY "Shared access for all users on work_centers" ON public.work_centers
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Shared access for all users on calendar_exceptions" ON public.calendar_exceptions
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Shared access for all users on turbine_types" ON public.turbine_types
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Shared access for all users on projects" ON public.projects
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Shared access for all users on gantt_tasks" ON public.gantt_tasks
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Shared access for all users on scenarios" ON public.scenarios
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Shared access for all users on system_state" ON public.system_state
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 10. PUBLICAÇÃO REAL-TIME SUPABASE (Sincronização imediata entre computadores)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_centers;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_exceptions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.turbine_types;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gantt_tasks;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scenarios;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_state;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
