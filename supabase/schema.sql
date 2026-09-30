-- ==============================================================================
-- SCHEMA POSTGRESQL / SUPABASE - PCP & ANÁLISE DE CARGA MÁQUINA
-- ==============================================================================
-- Script 100% idempotente (pode ser executado com banco limpo ou tabelas pré-existentes).
-- Adiciona automaticamente colunas faltantes (como 'is_baseline' na tabela 'scenarios').
-- Todos os dados são compartilhados entre estações de trabalho (sem filtros por auth.uid).
-- ==============================================================================

-- Habilita extensão para geração de UUID caso necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELA: CENTROS DE TRABALHO (WORK CENTERS)
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

-- Garante colunas caso a tabela já existisse com estrutura antiga
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'OUTROS';
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS daily_hours NUMERIC(5, 2) NOT NULL DEFAULT 8.00;
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS days_per_week NUMERIC(3, 1) NOT NULL DEFAULT 5.0;
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS resources_count NUMERIC(5, 2) NOT NULL DEFAULT 1.00;
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS efficiency_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00;
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.work_centers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_work_centers_category ON public.work_centers(category);
CREATE INDEX IF NOT EXISTS idx_work_centers_enabled ON public.work_centers(enabled);

-- ------------------------------------------------------------------------------
-- 2. TABELA: CALENDÁRIO FABRIL & EXCEÇÕES (FERIADOS, FÉRIAS COLETIVAS, PARADAS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_exceptions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'feriado',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    work_center_ids TEXT[] DEFAULT '{}',
    impact_type TEXT NOT NULL DEFAULT 'full_closure',
    capacity_reduction_percentage NUMERIC(5, 2) DEFAULT 0.00,
    description TEXT,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'feriado';
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS work_center_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS impact_type TEXT NOT NULL DEFAULT 'full_closure';
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS capacity_reduction_percentage NUMERIC(5, 2) DEFAULT 0.00;
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.calendar_exceptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_dates ON public.calendar_exceptions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_type ON public.calendar_exceptions(type);

-- ------------------------------------------------------------------------------
-- 3. TABELA: MODELOS / TIPOS DE TURBINA PADRÃO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.turbine_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'HYDRO',
    description TEXT,
    default_hours_per_turbine NUMERIC(10, 2) NOT NULL DEFAULT 0,
    default_duration_days INTEGER NOT NULL DEFAULT 90,
    sector_curves JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_custom BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'HYDRO';
ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS default_hours_per_turbine NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS default_duration_days INTEGER NOT NULL DEFAULT 90;
ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS sector_curves JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.turbine_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 4. TABELA: PROJETOS (PROJECTS)
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#3b82f6';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS work_center_hours JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS work_center_dates JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS group_dates JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS turbine_config JSONB;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_projects_dates ON public.projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_projects_enabled ON public.projects(enabled);

-- ------------------------------------------------------------------------------
-- 5. TABELA: TAREFAS CRONOGRAMA GANTT / EAP (ESTRUTURA ANALÍTICA DE PROJETO)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gantt_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,
    level INTEGER NOT NULL DEFAULT 0,
    code TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'operation',
    constraint_type TEXT NOT NULL DEFAULT 'manual',
    work_center_id TEXT,
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
    material_status TEXT,
    progress NUMERIC(5, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'not_started',
    dependencies TEXT[] DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    tree_depth INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'operation';
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS constraint_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS work_center_id TEXT;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS work_center_name TEXT;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS planned_hours NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS baseline_start_date DATE;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS baseline_end_date DATE;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS contract_date DATE;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS material_name TEXT;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS material_supplier TEXT;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS material_eta_date DATE;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS material_status TEXT;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS progress NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS dependencies TEXT[] DEFAULT '{}';
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS tree_depth INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_gantt_tasks_project ON public.gantt_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_parent ON public.gantt_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_level ON public.gantt_tasks(level);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_work_center ON public.gantt_tasks(work_center_id);

-- ------------------------------------------------------------------------------
-- 6. TABELA: CENÁRIOS DE SIMULAÇÃO (PLANNING SCENARIOS)
-- NOTA: Aqui adicionamos explicitamente 'is_baseline' caso a tabela já existisse
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

-- Adiciona colunas que possam faltar em instâncias já existentes
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS work_centers_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS projects_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS calendar_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS sector_groups_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- O índice agora pode ser criado com segurança total
CREATE INDEX IF NOT EXISTS idx_scenarios_is_baseline ON public.scenarios(is_baseline);

-- ------------------------------------------------------------------------------
-- 7. TABELA: ESTADO CENTRAL COMPARTILHADO DO SISTEMA (SYSTEM STATE)
-- Armazena configurações globais compartilhadas (cenário ativo, baseline oficial, etc.)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.system_state ADD COLUMN IF NOT EXISTS value JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.system_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

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
