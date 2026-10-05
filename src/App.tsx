import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkCenter, Project, DEFAULT_SECTOR_GROUPS, PlanningScenario, CalendarException } from './types';
import { INITIAL_DATA, RAW_INITIAL_JSON, parseJsonToState } from './data/initialData';
import { getInitialScenarios } from './data/initialScenarios';
import { DEFAULT_CALENDAR_EXCEPTIONS } from './data/defaultCalendar';
import { generateWeeklySchedule } from './utils/calculator';
import { sanitizeProjectSchedules } from './utils/dateValidation';
import { Sidebar } from './components/Sidebar';
import { KPIs } from './components/KPIs';
import { OverviewDashboard } from './components/OverviewDashboard';
import { WorkCenterAnalysis } from './components/WorkCenterAnalysis';
import { ProjectTimeline } from './components/ProjectTimeline';
import { CapacityHeatmap } from './components/CapacityHeatmap';
import { SimulationsPanel } from './components/SimulationsPanel';
import { JsonImportExportModal, ImportPayload } from './components/JsonImportExportModal';
import { MatrixImportModal, MatrixImportPayload } from './components/MatrixImportModal';
import { WorkCenterManagerModal } from './components/WorkCenterManagerModal';
import { TurbineTypeManagerModal } from './components/TurbineTypeManagerModal';
import { ProjectEditorModal } from './components/ProjectEditorModal';
import { CustomTurbineProjectModal } from './components/CustomTurbineProjectModal';
import { NewScenarioModal } from './components/NewScenarioModal';
import { ScenarioManagerModal } from './components/ScenarioManagerModal';
import { ScenarioComparisonModal } from './components/ScenarioComparisonModal';
import { DatabaseResetModal } from './components/DatabaseResetModal';
import { PrintReportModal } from './components/PrintReportModal';
import { CalendarManagerModal } from './components/CalendarManagerModal';
import { ScenarioImportExportModal, ScenarioImportPayload } from './components/ScenarioImportExportModal';
import { TurbineType } from './types/turbine';
import { DEFAULT_TURBINE_TYPES } from './data/defaultTurbines';
import { GanttTaskNode } from './types/gantt';
import { INITIAL_GANTT_TASKS } from './data/defaultGanttData';
import { recalculateHierarchyRollup } from './utils/ganttEngine';
import { GanttModuleView } from './components/gantt/GanttModuleView';
import {
  Layers,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BarChart2,
  Factory,
  Star,
  CheckCircle,
  Info,
  X,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabase';
import { SupabaseService } from './services/supabaseService';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 5 KPI Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-200 rounded"></div>
              <div className="w-8 h-8 rounded-xl bg-slate-100"></div>
            </div>
            <div className="h-7 w-28 bg-slate-200 rounded"></div>
            <div className="h-3 w-24 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>

      {/* Alert Banner Skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100"></div>
          <div className="space-y-1.5">
            <div className="h-4 w-64 bg-slate-200 rounded"></div>
            <div className="h-3 w-96 bg-slate-100 rounded"></div>
          </div>
        </div>
        <div className="h-9 w-32 bg-slate-100 rounded-xl"></div>
      </div>

      {/* Chart Card Skeleton */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="space-y-1.5">
            <div className="h-5 w-72 bg-slate-200 rounded"></div>
            <div className="h-3 w-96 bg-slate-100 rounded"></div>
          </div>
          <div className="h-9 w-28 bg-slate-100 rounded-xl"></div>
        </div>
        <div className="h-72 w-full bg-slate-50 rounded-xl flex items-end justify-between p-6 gap-2">
          {[40, 60, 45, 80, 70, 95, 65, 85, 90, 75, 60, 50, 65, 70, 80, 90, 85, 75].map((h, idx) => (
            <div
              key={idx}
              className="flex-1 bg-slate-200/70 rounded-t"
              style={{ height: `${h}%` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SESSION_CACHE_KEY = 'pcp_app_session_cache_v2';

interface AppSessionCache {
  scenarios?: PlanningScenario[];
  activeScenarioId?: string;
  workCenters?: WorkCenter[];
  projects?: Project[];
  sectorGroups?: string[];
  calendarExceptions?: CalendarException[];
  turbineTypes?: TurbineType[];
  ganttTasks?: GanttTaskNode[];
}

function getAppSessionCache(): AppSessionCache | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Check localStorage first (persists across tabs, browser restarts and Vercel reloads)
    const local = localStorage.getItem(SESSION_CACHE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
    // 2. Check sessionStorage fallback
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function saveAppSessionCache(partial: Partial<AppSessionCache>) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getAppSessionCache() || {};
    const updated = { ...existing, ...partial };
    const serialized = JSON.stringify(updated);
    try { localStorage.setItem(SESSION_CACHE_KEY, serialized); } catch {}
    try { sessionStorage.setItem(SESSION_CACHE_KEY, serialized); } catch {}
  } catch (e) {
    // ignore
  }
}

export default function App() {
  // Lock ref and timestamp to ignore real-time echo broadcasts when saving from THIS client tab
  const isSavingRef = useRef(false);
  const lastLocalSaveTimeRef = useRef(0);

  // Read session cache once on initial mount to prevent demo data flash on F5
  const initialCache = useMemo(() => getAppSessionCache(), []);

  // Active Module State (Carga Máquina vs Gantt EAP)
  const [activeModule, setActiveModule] = useState<'capacity' | 'gantt'>('capacity');

  // Scenarios State - Loaded from session cache or Supabase, fallback to in-memory clean defaults
  const [scenarios, setScenarios] = useState<PlanningScenario[]>(() => {
    if (initialCache?.scenarios && Array.isArray(initialCache.scenarios) && initialCache.scenarios.length > 0) {
      return initialCache.scenarios;
    }
    return getInitialScenarios();
  });
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    if (initialCache?.activeScenarioId) {
      return initialCache.activeScenarioId;
    }
    return 'scen-1-base-oficial';
  });

  const activeScenario = useMemo(() => {
    return (
      scenarios.find((s) => s.id === activeScenarioId) ||
      scenarios[0] ||
      getInitialScenarios()[0]
    );
  }, [scenarios, activeScenarioId]);

  // Active Data State (WorkCenters, Projects, SectorGroups, CalendarExceptions)
  const [sectorGroups, setSectorGroups] = useState<string[]>(() => {
    if (initialCache?.sectorGroups && initialCache.sectorGroups.length > 0) {
      return initialCache.sectorGroups;
    }
    if (activeScenario?.sectorGroups && activeScenario.sectorGroups.length > 0) {
      return activeScenario.sectorGroups;
    }
    return DEFAULT_SECTOR_GROUPS;
  });
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(() => {
    if (initialCache?.workCenters && Array.isArray(initialCache.workCenters)) {
      return initialCache.workCenters;
    }
    if (activeScenario?.workCenters && Array.isArray(activeScenario.workCenters)) {
      return activeScenario.workCenters;
    }
    return [];
  });
  const [projects, setProjects] = useState<Project[]>(() => {
    if (initialCache?.projects && Array.isArray(initialCache.projects)) {
      return initialCache.projects;
    }
    if (activeScenario?.projects && Array.isArray(activeScenario.projects)) {
      return activeScenario.projects;
    }
    return [];
  });
  const [calendarExceptions, setCalendarExceptions] = useState<CalendarException[]>(() => {
    if (initialCache?.calendarExceptions && Array.isArray(initialCache.calendarExceptions)) {
      return initialCache.calendarExceptions;
    }
    if (activeScenario?.calendarExceptions && Array.isArray(activeScenario.calendarExceptions)) {
      return activeScenario.calendarExceptions;
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<
    'overview' | 'workcenters' | 'projects' | 'heatmap' | 'simulation'
  >('overview');

  // Turbine Types State
  const [turbineTypes, setTurbineTypes] = useState<TurbineType[]>(() => {
    if (initialCache?.turbineTypes && initialCache.turbineTypes.length > 0) {
      return initialCache.turbineTypes;
    }
    return DEFAULT_TURBINE_TYPES;
  });

  const handleSaveTurbineTypes = (updated: TurbineType[]) => {
    setTurbineTypes(updated);
    saveAppSessionCache({ turbineTypes: updated });
    if (isSupabaseConfigured) {
      SupabaseService.saveAllTurbineTypes(updated).catch((err) => {
        showToast(`Erro ao salvar modelos de turbina no Supabase: ${err.message}`, 'info');
      });
    }
  };

  // Gantt Tasks State (WBS 0..N Hierarchy)
  const [ganttTasks, setGanttTasks] = useState<GanttTaskNode[]>(() => {
    if (initialCache?.ganttTasks && initialCache.ganttTasks.length > 0) {
      return recalculateHierarchyRollup(initialCache.ganttTasks);
    }
    return recalculateHierarchyRollup(INITIAL_GANTT_TASKS);
  });

  const handleUpdateGanttTasks = (updated: GanttTaskNode[]) => {
    const rolledUp = recalculateHierarchyRollup(updated);
    setGanttTasks(rolledUp);
    saveAppSessionCache({ ganttTasks: rolledUp });
    if (isSupabaseConfigured) {
      SupabaseService.saveAllGanttTasks(rolledUp).catch((err) => {
        showToast(`Erro ao salvar cronograma Gantt no Supabase: ${err.message}`, 'info');
      });
    }
  };

  // Modal States
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [isWcModalOpen, setIsWcModalOpen] = useState(false);
  const [isTurbineTypesModalOpen, setIsTurbineTypesModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isTurbineProjectModalOpen, setIsTurbineProjectModalOpen] = useState(false);
  const [isNewScenarioModalOpen, setIsNewScenarioModalOpen] = useState(false);
  const [isScenarioManagerModalOpen, setIsScenarioManagerModalOpen] = useState(false);
  const [isScenarioCompareModalOpen, setIsScenarioCompareModalOpen] = useState(false);
  const [isScenarioImportExportModalOpen, setIsScenarioImportExportModalOpen] = useState(false);
  const [scenarioImportExportTab, setScenarioImportExportTab] = useState<'export' | 'import'>('export');
  const [isDbResetModalOpen, setIsDbResetModalOpen] = useState(false);
  const [isPrintReportModalOpen, setIsPrintReportModalOpen] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(isSupabaseConfigured);
  // Only display skeleton on initial cloud load if we don't have session cache yet
  const [isInitialLoading, setIsInitialLoading] = useState(
    Boolean(isSupabaseConfigured && (!initialCache || !initialCache.workCenters?.length))
  );

  // Sync state changes to session cache to guarantee zero-flash across F5 reloads
  useEffect(() => {
    saveAppSessionCache({
      scenarios,
      activeScenarioId,
      workCenters,
      projects,
      sectorGroups,
      calendarExceptions,
      turbineTypes,
      ganttTasks,
    });
  }, [
    scenarios,
    activeScenarioId,
    workCenters,
    projects,
    sectorGroups,
    calendarExceptions,
    turbineTypes,
    ganttTasks,
  ]);

  const handleOpenScenarioImportExportModal = (tab: 'export' | 'import' = 'export') => {
    setScenarioImportExportTab(tab);
    setIsScenarioImportExportModalOpen(true);
  };

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Official Baseline check (reactive across all scenarios)
  const hasOfficialBaseline = useMemo(() => {
    return scenarios.some((s) => s.isBaseline);
  }, [scenarios]);

  // Initial Data Load & Realtime Sync from Supabase Cloud
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsCloudLoading(false);
      setIsInitialLoading(false);
      return;
    }

    let isMounted = true;

    async function loadCloudData() {
      setIsCloudLoading(true);
      try {
        const [
          cloudWcs,
          cloudProjects,
          cloudExceptions,
          cloudTurbines,
          cloudGantt,
          cloudScenarios,
          savedActiveScenId,
          savedSectorGroups,
        ] = await Promise.all([
          SupabaseService.fetchWorkCenters(),
          SupabaseService.fetchProjects(),
          SupabaseService.fetchCalendarExceptions(),
          SupabaseService.fetchTurbineTypes(),
          SupabaseService.fetchGanttTasks(),
          SupabaseService.fetchScenarios(),
          SupabaseService.fetchSystemState<string>('active_scenario_id', ''),
          SupabaseService.fetchSystemState<string[]>('sector_groups', DEFAULT_SECTOR_GROUPS),
        ]);

        if (!isMounted) return;

        // If the Supabase database has no scenarios yet, initialize a single clean baseline scenario
        if (cloudScenarios.length === 0) {
          const initScens = getInitialScenarios();
          await Promise.all([
            SupabaseService.saveAllScenarios(initScens),
            SupabaseService.saveSystemState('active_scenario_id', initScens[0].id),
            SupabaseService.saveSystemState('sector_groups', DEFAULT_SECTOR_GROUPS),
          ]);

          setWorkCenters(cloudWcs);
          setProjects(cloudProjects);
          setCalendarExceptions(cloudExceptions);
          setTurbineTypes(cloudTurbines);
          setGanttTasks(recalculateHierarchyRollup(cloudGantt));
          setScenarios(initScens);
          setActiveScenarioId(initScens[0].id);
          setSectorGroups(DEFAULT_SECTOR_GROUPS);

          saveAppSessionCache({
            scenarios: initScens,
            activeScenarioId: initScens[0].id,
            workCenters: cloudWcs,
            projects: cloudProjects,
            sectorGroups: DEFAULT_SECTOR_GROUPS,
            calendarExceptions: cloudExceptions,
            turbineTypes: cloudTurbines,
            ganttTasks: cloudGantt,
          });
        } else {
          // Cloud database already has records - load them into state directly
          setTurbineTypes(cloudTurbines);
          setGanttTasks(recalculateHierarchyRollup(cloudGantt));

          setScenarios(cloudScenarios);
          const activeId =
            savedActiveScenId && cloudScenarios.some((s) => s.id === savedActiveScenId)
              ? savedActiveScenId
              : cloudScenarios[0].id;
          setActiveScenarioId(activeId);

          const activeScen = cloudScenarios.find((s) => s.id === activeId) || cloudScenarios[0];
          if (activeScen) {
            // Priority: scenario data if present and non-empty, otherwise table data (NEVER lose projects!)
            const nextWcs = Array.isArray(activeScen.workCenters) && activeScen.workCenters.length > 0
              ? activeScen.workCenters
              : (cloudWcs && cloudWcs.length > 0 ? cloudWcs : []);

            const nextProjects = Array.isArray(activeScen.projects) && activeScen.projects.length > 0
              ? activeScen.projects
              : (cloudProjects && cloudProjects.length > 0 ? cloudProjects : []);

            const nextGroups =
              Array.isArray(activeScen.sectorGroups) && activeScen.sectorGroups.length > 0
                ? activeScen.sectorGroups
                : savedSectorGroups && savedSectorGroups.length > 0
                ? savedSectorGroups
                : DEFAULT_SECTOR_GROUPS;

            const nextExceptions = Array.isArray(activeScen.calendarExceptions) && activeScen.calendarExceptions.length > 0
              ? activeScen.calendarExceptions
              : (cloudExceptions && cloudExceptions.length > 0 ? cloudExceptions : []);

            // If active scenario in scenarios table had empty projects but cloudProjects had them, sync activeScen
            if ((!activeScen.projects || activeScen.projects.length === 0) && nextProjects.length > 0) {
              activeScen.projects = nextProjects;
            }
            if ((!activeScen.workCenters || activeScen.workCenters.length === 0) && nextWcs.length > 0) {
              activeScen.workCenters = nextWcs;
            }

            setWorkCenters(nextWcs);
            setProjects(nextProjects);
            setSectorGroups(nextGroups);
            setCalendarExceptions(nextExceptions);

            saveAppSessionCache({
              scenarios: cloudScenarios,
              activeScenarioId: activeId,
              workCenters: nextWcs,
              projects: nextProjects,
              sectorGroups: nextGroups,
              calendarExceptions: nextExceptions,
              turbineTypes: cloudTurbines,
              ganttTasks: cloudGantt,
            });
          } else {
            setWorkCenters(cloudWcs);
            setProjects(cloudProjects);
            setCalendarExceptions(cloudExceptions);
            if (savedSectorGroups && savedSectorGroups.length > 0) setSectorGroups(savedSectorGroups);
            saveAppSessionCache({
              workCenters: cloudWcs,
              projects: cloudProjects,
              calendarExceptions: cloudExceptions,
              sectorGroups: savedSectorGroups && savedSectorGroups.length > 0 ? savedSectorGroups : undefined,
              turbineTypes: cloudTurbines,
              ganttTasks: cloudGantt,
            });
          }
        }
      } catch (err: any) {
        console.error('Falha ao sincronizar dados do Supabase:', err);
        showToast(`Erro ao carregar dados do Supabase: ${err.message}. Verifique a conexão e RLS.`, 'info');
      } finally {
        if (isMounted) {
          setIsCloudLoading(false);
          setIsInitialLoading(false);
        }
      }
    }

    loadCloudData();

    // Listen to real-time database changes from any other computer/browser
    const unsubscribe = SupabaseService.subscribeToChanges((table) => {
      // Do not allow local saves to be overwritten by real-time echo broadcasts (guard for 4 seconds)
      if (isSavingRef.current || (Date.now() - lastLocalSaveTimeRef.current < 4000)) {
        return;
      }
      console.log(`[Supabase Realtime] Tabela atualizada: ${table}`);
      if (table === 'work_centers') {
        SupabaseService.fetchWorkCenters().then((wcs) => {
          if (isMounted && !isSavingRef.current && (Date.now() - lastLocalSaveTimeRef.current >= 4000) && wcs && wcs.length > 0) {
            setWorkCenters(wcs);
          }
        }).catch(console.error);
      } else if (table === 'projects') {
        SupabaseService.fetchProjects().then((projs) => {
          if (isMounted && !isSavingRef.current && (Date.now() - lastLocalSaveTimeRef.current >= 4000) && projs && projs.length > 0) {
            setProjects(projs);
            setScenarios((prev) =>
              prev.map((s) => (s.id === activeScenarioId ? { ...s, projects: projs } : s))
            );
          }
        }).catch(console.error);
      } else if (table === 'calendar_exceptions') {
        SupabaseService.fetchCalendarExceptions().then((cal) => {
          if (isMounted && !isSavingRef.current && (Date.now() - lastLocalSaveTimeRef.current >= 4000)) {
            setCalendarExceptions(cal);
          }
        }).catch(console.error);
      } else if (table === 'turbine_types') {
        SupabaseService.fetchTurbineTypes().then((types) => {
          if (isMounted && !isSavingRef.current && (Date.now() - lastLocalSaveTimeRef.current >= 4000) && types && types.length > 0) {
            setTurbineTypes(types);
          }
        }).catch(console.error);
      } else if (table === 'gantt_tasks') {
        SupabaseService.fetchGanttTasks().then((tasks) => {
          if (isMounted && !isSavingRef.current && (Date.now() - lastLocalSaveTimeRef.current >= 4000)) {
            setGanttTasks(recalculateHierarchyRollup(tasks));
          }
        }).catch(console.error);
      } else if (table === 'scenarios') {
        SupabaseService.fetchScenarios().then((scens) => {
          if (isMounted && !isSavingRef.current && (Date.now() - lastLocalSaveTimeRef.current >= 4000) && scens && scens.length > 0) {
            setScenarios(scens);
            const active = scens.find((s) => s.id === activeScenarioId) || scens[0];
            if (active && Array.isArray(active.projects) && active.projects.length > 0) {
              setProjects(active.projects);
            }
            if (active && Array.isArray(active.workCenters) && active.workCenters.length > 0) {
              setWorkCenters(active.workCenters);
            }
          }
        }).catch(console.error);
      } else if (table === 'system_state') {
        SupabaseService.fetchSystemState<string>('active_scenario_id', '').then((id) => {
          if (isMounted && !isSavingRef.current && (Date.now() - lastLocalSaveTimeRef.current >= 4000) && id) {
            setActiveScenarioId(id);
          }
        }).catch(console.error);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Check if current state differs from the active saved scenario state
  const isScenarioModified = useMemo(() => {
    if (!activeScenario) return false;
    const wcDiff = JSON.stringify(workCenters) !== JSON.stringify(activeScenario.workCenters);
    const projDiff = JSON.stringify(projects) !== JSON.stringify(activeScenario.projects);
    const grpDiff = JSON.stringify(sectorGroups) !== JSON.stringify(activeScenario.sectorGroups);
    const calDiff = JSON.stringify(calendarExceptions) !== JSON.stringify(activeScenario.calendarExceptions || []);
    return wcDiff || projDiff || grpDiff || calDiff;
  }, [workCenters, projects, sectorGroups, calendarExceptions, activeScenario]);

  // Scenario Management Handlers
  const handleSelectScenario = async (id: string) => {
    if (id === activeScenarioId) return;

    // Snapshot current active scenario data
    const updatedScenarios = scenarios.map((s) => {
      if (s.id === activeScenarioId) {
        return {
          ...s,
          workCenters: JSON.parse(JSON.stringify(workCenters)),
          projects: JSON.parse(JSON.stringify(projects)),
          sectorGroups: JSON.parse(JSON.stringify(sectorGroups)),
          calendarExceptions: JSON.parse(JSON.stringify(calendarExceptions)),
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });

    const target = updatedScenarios.find((s) => s.id === id);
    if (!target) return;

    setScenarios(updatedScenarios);
    setActiveScenarioId(id);
    setWorkCenters(JSON.parse(JSON.stringify(target.workCenters)));
    setProjects(JSON.parse(JSON.stringify(target.projects)));
    setSectorGroups(JSON.parse(JSON.stringify(target.sectorGroups || DEFAULT_SECTOR_GROUPS)));
    setCalendarExceptions(JSON.parse(JSON.stringify(target.calendarExceptions || DEFAULT_CALENDAR_EXCEPTIONS)));

    saveAppSessionCache({
      scenarios: updatedScenarios,
      activeScenarioId: id,
      workCenters: target.workCenters,
      projects: target.projects,
      sectorGroups: target.sectorGroups || DEFAULT_SECTOR_GROUPS,
      calendarExceptions: target.calendarExceptions || DEFAULT_CALENDAR_EXCEPTIONS,
    });

    if (isSupabaseConfigured) {
      try {
        isSavingRef.current = true;
        lastLocalSaveTimeRef.current = Date.now();
        await Promise.all([
          SupabaseService.saveAllScenarios(updatedScenarios),
          SupabaseService.saveSystemState('active_scenario_id', id),
          SupabaseService.saveAllWorkCenters(target.workCenters),
          SupabaseService.saveAllProjects(target.projects),
          SupabaseService.saveAllCalendarExceptions(target.calendarExceptions || []),
          SupabaseService.saveSystemState('sector_groups', target.sectorGroups || DEFAULT_SECTOR_GROUPS),
        ]);
      } catch (err: any) {
        showToast(`Erro ao sincronizar cenário ativo no Supabase: ${err.message}`, 'info');
      } finally {
        setTimeout(() => { isSavingRef.current = false; }, 3500);
      }
    }
  };

  const handleSaveCurrentScenario = async () => {
    isSavingRef.current = true;
    lastLocalSaveTimeRef.current = Date.now();
    try {
      const sanitizedCurrentProjects = projects.map((p) => sanitizeProjectSchedules(p, workCenters));
      const sanitizedCurrentWcs = workCenters.map((w) => ({
        ...w,
        id: w.id || `wc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: w.name || 'Centro Sem Nome',
      }));

      const updatedScenarios = scenarios.map((scen) => {
        if (scen.id === activeScenarioId) {
          return {
            ...scen,
            workCenters: JSON.parse(JSON.stringify(sanitizedCurrentWcs)),
            projects: JSON.parse(JSON.stringify(sanitizedCurrentProjects)),
            sectorGroups: JSON.parse(JSON.stringify(sectorGroups)),
            calendarExceptions: JSON.parse(JSON.stringify(calendarExceptions)),
            updatedAt: new Date().toISOString(),
          };
        }
        return scen;
      });

      setProjects(sanitizedCurrentProjects);
      setWorkCenters(sanitizedCurrentWcs);
      setScenarios(updatedScenarios);

      // Persist locally immediately (guarantees data persistence across reloads/restarts)
      saveAppSessionCache({
        scenarios: updatedScenarios,
        activeScenarioId,
        workCenters: sanitizedCurrentWcs,
        projects: sanitizedCurrentProjects,
        sectorGroups,
        calendarExceptions,
        turbineTypes,
        ganttTasks,
      });

      if (isSupabaseConfigured) {
        await Promise.all([
          SupabaseService.saveAllScenarios(updatedScenarios),
          SupabaseService.saveSystemState('active_scenario_id', activeScenarioId),
          SupabaseService.saveAllWorkCenters(sanitizedCurrentWcs),
          SupabaseService.saveAllProjects(sanitizedCurrentProjects),
          SupabaseService.saveAllCalendarExceptions(calendarExceptions),
          SupabaseService.saveSystemState('sector_groups', sectorGroups),
        ]);
        showToast('✅ Alterações do cenário salvas e sincronizadas no Supabase!', 'success');
      } else {
        showToast('✅ Alterações salvas no cenário com sucesso!', 'success');
      }
    } catch (err: any) {
      console.error('Erro ao salvar cenário:', err);
      showToast(`Aviso ao persistir cenário: ${err.message}`, 'info');
    } finally {
      setTimeout(() => {
        isSavingRef.current = false;
      }, 3500);
    }
  };

  const handleCreateScenario = async (name: string, description: string, sourceScenarioId: string) => {
    let sourceWcs = workCenters;
    let sourceProjects = projects;
    let sourceGroups = sectorGroups;
    let sourceCalendar = calendarExceptions;

    if (sourceScenarioId === 'blank') {
      // Cenário em branco: 0 projetos cadastrados, mantendo a estrutura dos centros de trabalho
      sourceProjects = [];
      sourceWcs = JSON.parse(JSON.stringify(workCenters));
      sourceGroups = JSON.parse(JSON.stringify(sectorGroups));
      sourceCalendar = JSON.parse(JSON.stringify(calendarExceptions));
    } else if (sourceScenarioId === 'current') {
      sourceProjects = JSON.parse(JSON.stringify(projects));
      sourceWcs = JSON.parse(JSON.stringify(workCenters));
      sourceGroups = JSON.parse(JSON.stringify(sectorGroups));
      sourceCalendar = JSON.parse(JSON.stringify(calendarExceptions));
    } else {
      const src = scenarios.find((s) => s.id === sourceScenarioId);
      if (src) {
        sourceWcs = JSON.parse(JSON.stringify(src.workCenters));
        sourceProjects = JSON.parse(JSON.stringify(src.projects));
        sourceGroups = JSON.parse(JSON.stringify(src.sectorGroups || sectorGroups));
        sourceCalendar = JSON.parse(JSON.stringify(src.calendarExceptions || calendarExceptions));
      }
    }

    // Snapshot current active scenario before creating the new one
    const currentScenariosSnapshot = scenarios.map((s) => {
      if (s.id === activeScenarioId) {
        return {
          ...s,
          workCenters: JSON.parse(JSON.stringify(workCenters)),
          projects: JSON.parse(JSON.stringify(projects)),
          sectorGroups: JSON.parse(JSON.stringify(sectorGroups)),
          calendarExceptions: JSON.parse(JSON.stringify(calendarExceptions)),
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });

    const newScen: PlanningScenario = {
      id: `scen-${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workCenters: JSON.parse(JSON.stringify(sourceWcs)),
      projects: JSON.parse(JSON.stringify(sourceProjects)),
      sectorGroups: JSON.parse(JSON.stringify(sourceGroups)),
      calendarExceptions: JSON.parse(JSON.stringify(sourceCalendar)),
    };

    const nextScenarios = [...currentScenariosSnapshot, newScen];
    setScenarios(nextScenarios);
    setActiveScenarioId(newScen.id);
    setWorkCenters(newScen.workCenters);
    setProjects(newScen.projects);
    setSectorGroups(newScen.sectorGroups);
    setCalendarExceptions(newScen.calendarExceptions || []);

    if (isSupabaseConfigured) {
      try {
        await Promise.all([
          SupabaseService.saveAllScenarios(nextScenarios),
          SupabaseService.saveSystemState('active_scenario_id', newScen.id),
          SupabaseService.saveAllWorkCenters(newScen.workCenters),
          SupabaseService.saveAllProjects(newScen.projects),
          SupabaseService.saveAllCalendarExceptions(newScen.calendarExceptions || []),
          SupabaseService.saveSystemState('sector_groups', newScen.sectorGroups),
        ]);
        showToast(`✅ Cenário "${newScen.name}" criado e sincronizado no Supabase!`, 'success');
      } catch (err: any) {
        console.error('Erro ao persistir novo cenário no Supabase:', err);
      }
    }
  };

  const handleDuplicateScenario = async (id: string) => {
    // Snapshot current active scenario
    const currentScenariosSnapshot = scenarios.map((s) => {
      if (s.id === activeScenarioId) {
        return {
          ...s,
          workCenters: JSON.parse(JSON.stringify(workCenters)),
          projects: JSON.parse(JSON.stringify(projects)),
          sectorGroups: JSON.parse(JSON.stringify(sectorGroups)),
          calendarExceptions: JSON.parse(JSON.stringify(calendarExceptions)),
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });

    const target = currentScenariosSnapshot.find((s) => s.id === id) || {
      id,
      name: 'Cenário',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workCenters,
      projects,
      sectorGroups,
      calendarExceptions,
    };

    const dupScen: PlanningScenario = {
      ...JSON.parse(JSON.stringify(target)),
      id: `scen-${Date.now()}`,
      name: `${target.name} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isBaseline: false,
    };

    const nextScenarios = [...currentScenariosSnapshot, dupScen];
    setScenarios(nextScenarios);
    setActiveScenarioId(dupScen.id);
    setWorkCenters(dupScen.workCenters);
    setProjects(dupScen.projects);
    setSectorGroups(dupScen.sectorGroups);
    setCalendarExceptions(dupScen.calendarExceptions || []);

    if (isSupabaseConfigured) {
      try {
        await Promise.all([
          SupabaseService.saveAllScenarios(nextScenarios),
          SupabaseService.saveSystemState('active_scenario_id', dupScen.id),
          SupabaseService.saveAllWorkCenters(dupScen.workCenters),
          SupabaseService.saveAllProjects(dupScen.projects),
          SupabaseService.saveAllCalendarExceptions(dupScen.calendarExceptions || []),
          SupabaseService.saveSystemState('sector_groups', dupScen.sectorGroups),
        ]);
        showToast(`✅ Cenário "${dupScen.name}" duplicado e salvo no Supabase!`, 'success');
      } catch (err: any) {
        console.error('Erro ao persistir cenário duplicado no Supabase:', err);
      }
    }
  };

  const handleUpdateScenarioInfo = async (id: string, name: string, description: string) => {
    const updated = scenarios.map((s) =>
      s.id === id
        ? { ...s, name, description, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updated);

    if (isSupabaseConfigured) {
      try {
        const target = updated.find((s) => s.id === id);
        if (target) {
          await SupabaseService.saveScenario(target);
        }
      } catch (err: any) {
        console.error('Erro ao atualizar informações do cenário:', err);
      }
    }
  };

  const handleSetBaselineScenario = async (id: string) => {
    const targetScen = scenarios.find((s) => s.id === id);
    const updatedScenarios = scenarios.map((s) => ({
      ...s,
      isBaseline: s.id === id,
    }));
    setScenarios(updatedScenarios);

    if (targetScen) {
      if (isSupabaseConfigured) {
        try {
          await Promise.all([
            SupabaseService.saveAllScenarios(updatedScenarios),
            SupabaseService.saveSystemState('primary_baseline', {
              savedAt: new Date().toISOString(),
              activeScenarioId: id,
              workCenters: targetScen.workCenters,
              projects: targetScen.projects,
              sectorGroups: targetScen.sectorGroups,
              scenarios: updatedScenarios,
            }),
          ]);
        } catch (e: any) {
          console.error('Erro ao definir baseline no Supabase:', e);
          showToast(`Erro ao definir baseline no Supabase: ${e.message}`, 'info');
        }
      }
      showToast(`⭐ Cenário "${targetScen.name}" definido como a Base Primária Oficial (Baseline do PCP)!`);
    }
  };

  const handleSaveAsPrimaryBaseline = async () => {
    // 1. Synchronize current state to active scenario
    const updatedScenarios = scenarios.map((scen) => {
      if (scen.id === activeScenarioId) {
        return {
          ...scen,
          isBaseline: true,
          workCenters: JSON.parse(JSON.stringify(workCenters)),
          projects: JSON.parse(JSON.stringify(projects)),
          sectorGroups: JSON.parse(JSON.stringify(sectorGroups)),
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...scen,
        isBaseline: false,
      };
    });

    setScenarios(updatedScenarios);

    // 2. Persist to Supabase
    if (isSupabaseConfigured) {
      try {
        await Promise.all([
          SupabaseService.saveAllScenarios(updatedScenarios),
          SupabaseService.saveSystemState('active_scenario_id', activeScenarioId),
          SupabaseService.saveAllWorkCenters(workCenters),
          SupabaseService.saveAllProjects(projects),
          SupabaseService.saveSystemState('sector_groups', sectorGroups),
          SupabaseService.saveSystemState('primary_baseline', {
            savedAt: new Date().toISOString(),
            activeScenarioId,
            workCenters,
            projects,
            sectorGroups,
            scenarios: updatedScenarios,
          }),
        ]);
      } catch (e: any) {
        console.error('Erro ao salvar baseline primária no Supabase:', e);
        showToast(`Erro ao persistir baseline no Supabase: ${e.message}`, 'info');
      }
    }

    const currentName = activeScenario?.name || 'Cenário Ativo';
    showToast(`⭐ Base Primária Oficial Fixada! O estado atual de "${currentName}" é a referência padrão do PCP.`);
  };

  const handleDeleteScenario = async (id: string) => {
    const remaining = scenarios.filter((s) => s.id !== id);
    let fallbackScenarios = remaining;
    let nextActiveId = activeScenarioId;

    if (remaining.length === 0) {
      const cleanWcs = workCenters.map((wc) => ({
        ...wc,
        resourcesCount: 1,
        dailyHours: 8,
        daysPerWeek: 5,
        efficiencyPercentage: 100,
      }));
      const fallback: PlanningScenario = {
        id: `scen-${Date.now()}`,
        name: 'Cenário Principal (PCP)',
        description: 'Cenário limpo de planejamento',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBaseline: true,
        workCenters: cleanWcs,
        projects: [],
        sectorGroups: sectorGroups.length > 0 ? sectorGroups : DEFAULT_SECTOR_GROUPS,
      };
      fallbackScenarios = [fallback];
      nextActiveId = fallback.id;
      setScenarios(fallbackScenarios);
      setActiveScenarioId(nextActiveId);
      setWorkCenters(cleanWcs);
      setProjects([]);
      setSectorGroups(fallback.sectorGroups);
    } else {
      const hasBaseline = remaining.some((s) => s.isBaseline);
      fallbackScenarios = !hasBaseline
        ? remaining.map((s, idx) => (idx === 0 ? { ...s, isBaseline: true } : s))
        : remaining;

      setScenarios(fallbackScenarios);
      if (activeScenarioId === id) {
        const fallback = fallbackScenarios[0];
        nextActiveId = fallback.id;
        setActiveScenarioId(fallback.id);
        setWorkCenters(JSON.parse(JSON.stringify(fallback.workCenters)));
        setProjects(JSON.parse(JSON.stringify(fallback.projects)));
        setSectorGroups(JSON.parse(JSON.stringify(fallback.sectorGroups)));
        setCalendarExceptions(JSON.parse(JSON.stringify(fallback.calendarExceptions || [])));
      }
    }

    if (isSupabaseConfigured) {
      try {
        await Promise.all([
          SupabaseService.deleteScenario(id),
          SupabaseService.saveAllScenarios(fallbackScenarios),
          SupabaseService.saveSystemState('active_scenario_id', nextActiveId),
        ]);
        showToast('Cenário excluído e sincronizado no Supabase.', 'info');
      } catch (err: any) {
        console.error('Erro ao excluir cenário no Supabase:', err);
      }
    }
  };

  const handleAddSectorGroup = async (groupName: string) => {
    const trimmed = groupName.trim().toUpperCase();
    if (!trimmed) return;
    if (!sectorGroups.includes(trimmed)) {
      const next = [...sectorGroups, trimmed];
      setSectorGroups(next);
      const updatedScenarios = scenarios.map((s) =>
        s.id === activeScenarioId
          ? { ...s, sectorGroups: next, updatedAt: new Date().toISOString() }
          : s
      );
      setScenarios(updatedScenarios);

      if (isSupabaseConfigured) {
        try {
          const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
          await Promise.all([
            SupabaseService.saveSystemState('sector_groups', next),
            activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
          ]);
        } catch (err: any) {
          console.error('Erro ao salvar agrupadores no Supabase:', err);
        }
      }
    }
  };

  const handleDeleteSectorGroup = async (groupName: string) => {
    if (sectorGroups.length <= 1) {
      showToast('É necessário ter ao menos um agrupador cadastrado.', 'info');
      return;
    }
    const nextGroups = sectorGroups.filter((g) => g !== groupName);
    const fallback = nextGroups.find((g) => g !== groupName) || 'OUTROS';
    const nextWcs = workCenters.map((wc) =>
      wc.category === groupName ? { ...wc, category: fallback } : wc
    );
    setSectorGroups(nextGroups);
    setWorkCenters(nextWcs);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, sectorGroups: nextGroups, workCenters: nextWcs, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          SupabaseService.saveSystemState('sector_groups', nextGroups),
          SupabaseService.saveAllWorkCenters(nextWcs),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
      } catch (err: any) {
        console.error('Erro ao excluir agrupador no Supabase:', err);
      }
    }
  };

  // Execute Capacity & Workload Calculation Engine (with dynamic holiday/vacation capacity adjustments)
  const calculationResult = useMemo(() => {
    return generateWeeklySchedule(projects, workCenters, calendarExceptions);
  }, [projects, workCenters, calendarExceptions]);

  const {
    weeklyBuckets,
    workCenterSummaries,
    overloadAlerts,
    recommendations,
    kpis,
  } = calculationResult;

  // Handlers
  const handleSaveCalendarExceptions = async (newExceptions: CalendarException[]) => {
    setCalendarExceptions(newExceptions);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, calendarExceptions: newExceptions, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          SupabaseService.saveAllCalendarExceptions(newExceptions),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
        showToast(`📅 Calendário Fabril atualizado (${newExceptions.length} eventos sincronizados no Supabase)!`, 'success');
      } catch (err: any) {
        console.error('Erro ao salvar calendário no Supabase:', err);
        showToast(`Erro ao sincronizar calendário no Supabase: ${err.message}`, 'info');
      }
    } else {
      showToast(`📅 Calendário Fabril atualizado (${newExceptions.length} eventos configurados)!`);
    }
  };

  const handleUpdateWorkCenter = async (updated: WorkCenter) => {
    const next = workCenters.map((wc) => (wc.id === updated.id ? updated : wc));
    setWorkCenters(next);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, workCenters: next, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          SupabaseService.saveWorkCenter(updated),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
      } catch (err: any) {
        console.error('Erro ao atualizar centro de trabalho no Supabase:', err);
      }
    }
  };

  const handleSaveWorkCenters = async (newWcs: WorkCenter[]) => {
    setWorkCenters(newWcs);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, workCenters: newWcs, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          SupabaseService.saveAllWorkCenters(newWcs),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
        showToast(`✅ ${newWcs.length} centros de trabalho salvos e sincronizados no Supabase!`, 'success');
      } catch (err: any) {
        console.error('Erro ao salvar centros de trabalho no Supabase:', err);
        showToast(`Erro ao sincronizar centros de trabalho: ${err.message}`, 'info');
      }
    }
  };

  const handleUpdateProject = async (updated: Project) => {
    const cleanProject = sanitizeProjectSchedules(updated, workCenters);
    const next = projects.map((p) => (p.id === cleanProject.id ? cleanProject : p));
    setProjects(next);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, projects: next, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          SupabaseService.saveProject(cleanProject),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
      } catch (err: any) {
        console.error('Erro ao atualizar projeto no Supabase:', err);
      }
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const targetProj = projects.find((p) => p.id === projectId);
    const next = projects.filter((p) => p.id !== projectId);
    setProjects(next);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, projects: next, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          SupabaseService.deleteProject(projectId),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
        showToast(`Projeto "${targetProj?.name || projectId}" removido e sincronizado!`, 'info');
      } catch (err: any) {
        console.error('Erro ao remover projeto no Supabase:', err);
      }
    }
  };

  const handleAddProject = async (newProject: Project) => {
    const cleanProject = sanitizeProjectSchedules(newProject, workCenters);
    const next = [...projects, cleanProject];
    setProjects(next);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, projects: next, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          SupabaseService.saveProject(cleanProject),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
        showToast(`✅ Projeto "${cleanProject.name}" salvo no Supabase!`, 'success');
      } catch (err: any) {
        console.error('Erro ao salvar projeto no Supabase:', err);
        showToast(`Aviso: Projeto cadastrado localmente. Erro no Supabase: ${err.message}`, 'info');
      }
    } else {
      showToast(`Projeto "${cleanProject.name}" adicionado com sucesso!`, 'success');
    }
  };

  const handleImportComplete = async (payload: ImportPayload) => {
    const {
      mode,
      workCenters: newWcs,
      projects: newProjects,
      sectorGroups: newSectorGroups,
      scenarios: newScenarios,
      activeScenarioId: newActiveId,
      scenarioName,
    } = payload;

    const validatedGroups = newSectorGroups && newSectorGroups.length > 0
      ? newSectorGroups
      : DEFAULT_SECTOR_GROUPS;

    if (mode === 'replace_all_scenarios' && newScenarios && newScenarios.length > 0) {
      setScenarios(newScenarios);
      const targetId = newActiveId || newScenarios[0]?.id;
      setActiveScenarioId(targetId);
      const activeTarget = newScenarios.find((s) => s.id === targetId) || newScenarios[0];
      setWorkCenters(activeTarget.workCenters);
      setProjects(activeTarget.projects);
      setSectorGroups(activeTarget.sectorGroups || validatedGroups);

      saveAppSessionCache({
        scenarios: newScenarios,
        activeScenarioId: targetId,
        workCenters: activeTarget.workCenters,
        projects: activeTarget.projects,
        sectorGroups: activeTarget.sectorGroups || validatedGroups,
      });

      if (isSupabaseConfigured) {
        try {
          isSavingRef.current = true;
          lastLocalSaveTimeRef.current = Date.now();
          await Promise.all([
            SupabaseService.saveAllScenarios(newScenarios),
            SupabaseService.saveSystemState('active_scenario_id', targetId),
            SupabaseService.saveAllWorkCenters(activeTarget.workCenters),
            SupabaseService.saveAllProjects(activeTarget.projects),
            SupabaseService.saveSystemState('sector_groups', activeTarget.sectorGroups || validatedGroups),
          ]);
        } catch (err: any) {
          console.error('Erro ao salvar cenários importados no Supabase:', err);
        } finally {
          setTimeout(() => { isSavingRef.current = false; }, 3500);
        }
      }
      return;
    }

    if (mode === 'create_new_scenario') {
      const sanitizedProjects = newProjects.map((p) => sanitizeProjectSchedules(p, newWcs));
      const newScen: PlanningScenario = {
        id: `scen-${Date.now()}`,
        name: scenarioName || 'Cenário Importado',
        description: `Importado em ${new Date().toLocaleDateString('pt-BR')} via JSON Estrutura v2.0`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workCenters: newWcs,
        projects: sanitizedProjects,
        sectorGroups: validatedGroups,
      };
      const nextScens = [...scenarios, newScen];
      setScenarios(nextScens);
      setActiveScenarioId(newScen.id);
      setWorkCenters(newWcs);
      setProjects(sanitizedProjects);
      setSectorGroups(validatedGroups);

      saveAppSessionCache({
        scenarios: nextScens,
        activeScenarioId: newScen.id,
        workCenters: newWcs,
        projects: sanitizedProjects,
        sectorGroups: validatedGroups,
      });

      if (isSupabaseConfigured) {
        try {
          isSavingRef.current = true;
          lastLocalSaveTimeRef.current = Date.now();
          await Promise.all([
            SupabaseService.saveAllScenarios(nextScens),
            SupabaseService.saveSystemState('active_scenario_id', newScen.id),
            SupabaseService.saveAllWorkCenters(newWcs),
            SupabaseService.saveAllProjects(sanitizedProjects),
            SupabaseService.saveSystemState('sector_groups', validatedGroups),
          ]);
        } catch (err: any) {
          console.error('Erro ao salvar novo cenário importado no Supabase:', err);
        } finally {
          setTimeout(() => { isSavingRef.current = false; }, 3500);
        }
      }
      return;
    }

    // Default mode: 'replace_current'
    const sanitizedProjects = newProjects.map((p) => sanitizeProjectSchedules(p, newWcs));
    setWorkCenters(newWcs);
    setProjects(sanitizedProjects);
    setSectorGroups(validatedGroups);
    const nextScens = scenarios.map((s) =>
      s.id === activeScenarioId
        ? {
            ...s,
            workCenters: newWcs,
            projects: sanitizedProjects,
            sectorGroups: validatedGroups,
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    setScenarios(nextScens);

    saveAppSessionCache({
      scenarios: nextScens,
      activeScenarioId,
      workCenters: newWcs,
      projects: sanitizedProjects,
      sectorGroups: validatedGroups,
    });

    if (isSupabaseConfigured) {
      try {
        isSavingRef.current = true;
        lastLocalSaveTimeRef.current = Date.now();
        await Promise.all([
          SupabaseService.saveAllScenarios(nextScens),
          SupabaseService.saveSystemState('active_scenario_id', activeScenarioId),
          SupabaseService.saveAllWorkCenters(newWcs),
          SupabaseService.saveAllProjects(sanitizedProjects),
          SupabaseService.saveSystemState('sector_groups', validatedGroups),
        ]);
      } catch (err: any) {
        console.error('Erro ao atualizar cenário corrente importado no Supabase:', err);
      } finally {
        setTimeout(() => { isSavingRef.current = false; }, 3500);
      }
    }
  };

  const handleMatrixImportComplete = async (payload: MatrixImportPayload) => {
    const {
      mode,
      workCenters: newWcs,
      projects: newProjects,
      sectorGroups: newSectorGroups,
      scenarioName,
    } = payload;

    const validatedGroups =
      newSectorGroups && newSectorGroups.length > 0
        ? newSectorGroups
        : DEFAULT_SECTOR_GROUPS;

    if (mode === 'new_scenario') {
      const sanitizedProjects = newProjects.map((p) => sanitizeProjectSchedules(p, newWcs));
      const newScen: PlanningScenario = {
        id: `scen-${Date.now()}`,
        name: scenarioName || 'Cenário Importado Planilha',
        description: `Importado em ${new Date().toLocaleDateString('pt-BR')} via Matriz CSV/Excel (${sanitizedProjects.length} projetos)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workCenters: newWcs,
        projects: sanitizedProjects,
        sectorGroups: validatedGroups,
      };
      const nextScens = [...scenarios, newScen];
      setScenarios(nextScens);
      setActiveScenarioId(newScen.id);
      setWorkCenters(newWcs);
      setProjects(sanitizedProjects);
      setSectorGroups(validatedGroups);
      setActiveTab('projects');

      saveAppSessionCache({
        scenarios: nextScens,
        activeScenarioId: newScen.id,
        workCenters: newWcs,
        projects: sanitizedProjects,
        sectorGroups: validatedGroups,
      });

      if (isSupabaseConfigured) {
        try {
          isSavingRef.current = true;
          lastLocalSaveTimeRef.current = Date.now();
          await Promise.all([
            SupabaseService.saveAllScenarios(nextScens),
            SupabaseService.saveSystemState('active_scenario_id', newScen.id),
            SupabaseService.saveAllWorkCenters(newWcs),
            SupabaseService.saveAllProjects(sanitizedProjects),
            SupabaseService.saveSystemState('sector_groups', validatedGroups),
          ]);
          showToast(`✅ Novo Cenário "${newScen.name}" criado com ${sanitizedProjects.length} projetos!`, 'success');
        } catch (err: any) {
          console.error('Erro ao salvar planilha no Supabase:', err);
          showToast(`Aviso: Cenário criado localmente. Erro no Supabase: ${err.message}`, 'info');
        } finally {
          setTimeout(() => { isSavingRef.current = false; }, 3500);
        }
      } else {
        showToast(`✅ Novo Cenário "${newScen.name}" criado com ${sanitizedProjects.length} projetos!`, 'success');
      }
      return;
    }

    if (mode === 'replace_projects') {
      const sanitizedProjects = newProjects.map((p) => sanitizeProjectSchedules(p, newWcs));
      setWorkCenters(newWcs);
      setProjects(sanitizedProjects);
      setSectorGroups(validatedGroups);
      const nextScens = scenarios.map((s) =>
        s.id === activeScenarioId
          ? {
              ...s,
              workCenters: newWcs,
              projects: sanitizedProjects,
              sectorGroups: validatedGroups,
              updatedAt: new Date().toISOString(),
            }
          : s
      );
      setScenarios(nextScens);
      setActiveTab('projects');

      saveAppSessionCache({
        scenarios: nextScens,
        activeScenarioId,
        workCenters: newWcs,
        projects: sanitizedProjects,
        sectorGroups: validatedGroups,
      });

      if (isSupabaseConfigured) {
        try {
          isSavingRef.current = true;
          lastLocalSaveTimeRef.current = Date.now();
          await Promise.all([
            SupabaseService.saveAllScenarios(nextScens),
            SupabaseService.saveSystemState('active_scenario_id', activeScenarioId),
            SupabaseService.saveAllWorkCenters(newWcs),
            SupabaseService.saveAllProjects(sanitizedProjects),
            SupabaseService.saveSystemState('sector_groups', validatedGroups),
          ]);
          showToast(`✅ Carteira substituída por ${sanitizedProjects.length} projetos da planilha!`, 'success');
        } catch (err: any) {
          console.error('Erro ao atualizar projetos importados no Supabase:', err);
          showToast(`Aviso: Projetos atualizados localmente. Erro no Supabase: ${err.message}`, 'info');
        } finally {
          setTimeout(() => { isSavingRef.current = false; }, 3500);
        }
      } else {
        showToast(`✅ Carteira substituída por ${sanitizedProjects.length} projetos da planilha!`, 'success');
      }
      return;
    }

    // Default mode: 'append' (replace existing projects with same name to prevent duplicates, or append new ones)
    const sanitizedNewProjects = newProjects.map((p) => sanitizeProjectSchedules(p, newWcs));
    const currentExistingProjects = projects.length > 0 ? projects : (activeScenario?.projects || []);
    const projectMap = new Map<string, Project>();
    // Existing projects keyed by ID and Name
    currentExistingProjects.forEach((p) => {
      projectMap.set(p.id, sanitizeProjectSchedules(p, newWcs));
    });
    // Overwrite / Add imported projects (match by name case-insensitively or by id)
    sanitizedNewProjects.forEach((p) => {
      let existingId: string | undefined;
      for (const [id, existingP] of projectMap.entries()) {
        if (existingP.name.trim().toUpperCase() === p.name.trim().toUpperCase() || id === p.id) {
          existingId = id;
          break;
        }
      }
      if (existingId) {
        projectMap.set(existingId, { ...p, id: existingId });
      } else {
        projectMap.set(p.id, p);
      }
    });
    const mergedProjects = Array.from(projectMap.values());

    setWorkCenters(newWcs);
    setProjects(mergedProjects);
    setSectorGroups(validatedGroups);
    const nextScens = scenarios.map((s) =>
      s.id === activeScenarioId
        ? {
            ...s,
            workCenters: newWcs,
            projects: mergedProjects,
            sectorGroups: validatedGroups,
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    setScenarios(nextScens);
    setActiveTab('projects');

    saveAppSessionCache({
      scenarios: nextScens,
      activeScenarioId,
      workCenters: newWcs,
      projects: mergedProjects,
      sectorGroups: validatedGroups,
    });

    if (isSupabaseConfigured) {
      try {
        isSavingRef.current = true;
        lastLocalSaveTimeRef.current = Date.now();
        await Promise.all([
          SupabaseService.saveAllScenarios(nextScens),
          SupabaseService.saveSystemState('active_scenario_id', activeScenarioId),
          SupabaseService.saveAllWorkCenters(newWcs),
          SupabaseService.saveAllProjects(mergedProjects),
          SupabaseService.saveSystemState('sector_groups', validatedGroups),
        ]);
        showToast(`✅ ${sanitizedNewProjects.length} projetos adicionados ao cenário com sucesso!`, 'success');
      } catch (err: any) {
        console.error('Erro ao anexar projetos importados no Supabase:', err);
        showToast(`Aviso: Projetos adicionados localmente. Erro no Supabase: ${err.message}`, 'info');
      } finally {
        setTimeout(() => { isSavingRef.current = false; }, 3500);
      }
    } else {
      showToast(`✅ ${sanitizedNewProjects.length} projetos adicionados ao cenário com sucesso!`, 'success');
    }
  };

  const handleScenarioImport = async (payload: ScenarioImportPayload) => {
    const { mode, scenario, scenarios: importedScenarios, activeScenarioId: newActiveId, customScenarioName } = payload;

    if (mode === 'replace_all_scenarios' && importedScenarios && importedScenarios.length > 0) {
      setScenarios(importedScenarios);
      const targetId = newActiveId || importedScenarios[0]?.id;
      setActiveScenarioId(targetId);
      const activeTarget = importedScenarios.find((s) => s.id === targetId) || importedScenarios[0];
      setWorkCenters(activeTarget.workCenters);
      setProjects(activeTarget.projects);
      setSectorGroups(activeTarget.sectorGroups || DEFAULT_SECTOR_GROUPS);
      setCalendarExceptions(activeTarget.calendarExceptions || DEFAULT_CALENDAR_EXCEPTIONS);
      showToast(`📦 Pacote com ${importedScenarios.length} cenários restaurado com sucesso!`);

      saveAppSessionCache({
        scenarios: importedScenarios,
        activeScenarioId: targetId,
        workCenters: activeTarget.workCenters,
        projects: activeTarget.projects,
        sectorGroups: activeTarget.sectorGroups || DEFAULT_SECTOR_GROUPS,
        calendarExceptions: activeTarget.calendarExceptions || DEFAULT_CALENDAR_EXCEPTIONS,
      });

      if (isSupabaseConfigured) {
        try {
          isSavingRef.current = true;
          lastLocalSaveTimeRef.current = Date.now();
          await Promise.all([
            SupabaseService.saveAllScenarios(importedScenarios),
            SupabaseService.saveSystemState('active_scenario_id', targetId),
            SupabaseService.saveAllWorkCenters(activeTarget.workCenters),
            SupabaseService.saveAllProjects(activeTarget.projects),
            SupabaseService.saveAllCalendarExceptions(activeTarget.calendarExceptions || []),
            SupabaseService.saveSystemState('sector_groups', activeTarget.sectorGroups || DEFAULT_SECTOR_GROUPS),
          ]);
        } catch (err: any) {
          console.error('Erro ao restaurar cenários no Supabase:', err);
        } finally {
          setTimeout(() => { isSavingRef.current = false; }, 3500);
        }
      }
      return;
    }

    if (mode === 'append_scenarios' && importedScenarios && importedScenarios.length > 0) {
      const nextScens = [...scenarios, ...importedScenarios];
      setScenarios(nextScens);
      const targetId = newActiveId || importedScenarios[0]?.id;
      setActiveScenarioId(targetId);
      const activeTarget = importedScenarios.find((s) => s.id === targetId) || importedScenarios[0];
      setWorkCenters(activeTarget.workCenters);
      setProjects(activeTarget.projects);
      setSectorGroups(activeTarget.sectorGroups || DEFAULT_SECTOR_GROUPS);
      setCalendarExceptions(activeTarget.calendarExceptions || DEFAULT_CALENDAR_EXCEPTIONS);
      showToast(`✨ ${importedScenarios.length} cenários adicionados à biblioteca!`);

      saveAppSessionCache({
        scenarios: nextScens,
        activeScenarioId: targetId,
        workCenters: activeTarget.workCenters,
        projects: activeTarget.projects,
        sectorGroups: activeTarget.sectorGroups || DEFAULT_SECTOR_GROUPS,
        calendarExceptions: activeTarget.calendarExceptions || DEFAULT_CALENDAR_EXCEPTIONS,
      });

      if (isSupabaseConfigured) {
        try {
          isSavingRef.current = true;
          lastLocalSaveTimeRef.current = Date.now();
          await Promise.all([
            SupabaseService.saveAllScenarios(nextScens),
            SupabaseService.saveSystemState('active_scenario_id', targetId),
            SupabaseService.saveAllWorkCenters(activeTarget.workCenters),
            SupabaseService.saveAllProjects(activeTarget.projects),
            SupabaseService.saveAllCalendarExceptions(activeTarget.calendarExceptions || []),
            SupabaseService.saveSystemState('sector_groups', activeTarget.sectorGroups || DEFAULT_SECTOR_GROUPS),
          ]);
        } catch (err: any) {
          console.error('Erro ao adicionar cenários no Supabase:', err);
        } finally {
          setTimeout(() => { isSavingRef.current = false; }, 3500);
        }
      }
      return;
    }

    if (scenario) {
      const scenarioName = customScenarioName || scenario.name || 'Cenário Importado';
      const scenarioGroups = scenario.sectorGroups && scenario.sectorGroups.length > 0
        ? scenario.sectorGroups
        : sectorGroups;
      const scenarioCalendar = scenario.calendarExceptions && scenario.calendarExceptions.length > 0
        ? scenario.calendarExceptions
        : calendarExceptions;

      if (mode === 'create_new_scenario') {
        const newScen: PlanningScenario = {
          ...scenario,
          id: `scen-${Date.now()}`,
          name: scenarioName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isBaseline: false,
          sectorGroups: scenarioGroups,
          calendarExceptions: scenarioCalendar,
        };

        const nextScens = [...scenarios, newScen];
        setScenarios(nextScens);
        setActiveScenarioId(newScen.id);
        setWorkCenters(newScen.workCenters);
        setProjects(newScen.projects);
        setSectorGroups(scenarioGroups);
        setCalendarExceptions(scenarioCalendar);
        showToast(`✅ Novo Cenário "${scenarioName}" importado e ativado com sucesso!`);

        saveAppSessionCache({
          scenarios: nextScens,
          activeScenarioId: newScen.id,
          workCenters: newScen.workCenters,
          projects: newScen.projects,
          sectorGroups: scenarioGroups,
          calendarExceptions: scenarioCalendar,
        });

        if (isSupabaseConfigured) {
          try {
            isSavingRef.current = true;
            lastLocalSaveTimeRef.current = Date.now();
            await Promise.all([
              SupabaseService.saveAllScenarios(nextScens),
              SupabaseService.saveSystemState('active_scenario_id', newScen.id),
              SupabaseService.saveAllWorkCenters(newScen.workCenters),
              SupabaseService.saveAllProjects(newScen.projects),
              SupabaseService.saveAllCalendarExceptions(scenarioCalendar),
              SupabaseService.saveSystemState('sector_groups', scenarioGroups),
            ]);
          } catch (err: any) {
            console.error('Erro ao salvar cenário importado no Supabase:', err);
          } finally {
            setTimeout(() => { isSavingRef.current = false; }, 3500);
          }
        }
        return;
      }

      if (mode === 'replace_current') {
        setWorkCenters(scenario.workCenters);
        setProjects(scenario.projects);
        setSectorGroups(scenarioGroups);
        setCalendarExceptions(scenarioCalendar);
        const nextScens = scenarios.map((s) =>
          s.id === activeScenarioId
            ? {
                ...s,
                name: customScenarioName || s.name,
                workCenters: scenario.workCenters,
                projects: scenario.projects,
                sectorGroups: scenarioGroups,
                calendarExceptions: scenarioCalendar,
                updatedAt: new Date().toISOString(),
              }
            : s
        );
        setScenarios(nextScens);
        showToast(`✅ Cenário ativo atualizado exatamente com os dados do arquivo importado!`);

        saveAppSessionCache({
          scenarios: nextScens,
          activeScenarioId,
          workCenters: scenario.workCenters,
          projects: scenario.projects,
          sectorGroups: scenarioGroups,
          calendarExceptions: scenarioCalendar,
        });

        if (isSupabaseConfigured) {
          try {
            isSavingRef.current = true;
            lastLocalSaveTimeRef.current = Date.now();
            await Promise.all([
              SupabaseService.saveAllScenarios(nextScens),
              SupabaseService.saveSystemState('active_scenario_id', activeScenarioId),
              SupabaseService.saveAllWorkCenters(scenario.workCenters),
              SupabaseService.saveAllProjects(scenario.projects),
              SupabaseService.saveAllCalendarExceptions(scenarioCalendar),
              SupabaseService.saveSystemState('sector_groups', scenarioGroups),
            ]);
          } catch (err: any) {
            console.error('Erro ao substituir cenário no Supabase:', err);
          } finally {
            setTimeout(() => { isSavingRef.current = false; }, 3500);
          }
        }
      }
    }
  };

  const handleResetData = () => {
    setIsDbResetModalOpen(true);
  };

  const handleResetToDemo = () => {
    const inits = getInitialScenarios();
    setScenarios(inits);
    const first = inits[0];
    setActiveScenarioId(first.id);
    setWorkCenters(first.workCenters);
    setProjects(first.projects);
    setSectorGroups(first.sectorGroups);
  };

  const handleResetToCleanCompanyState = () => {
    const cleanScenarios = getInitialScenarios();
    setScenarios(cleanScenarios);
    setActiveScenarioId('scen-1-base-oficial');
    setWorkCenters([]);
    setProjects([]);
    setSectorGroups(DEFAULT_SECTOR_GROUPS);
    setCalendarExceptions([]);

    saveAppSessionCache({
      scenarios: cleanScenarios,
      activeScenarioId: 'scen-1-base-oficial',
      workCenters: [],
      projects: [],
      sectorGroups: DEFAULT_SECTOR_GROUPS,
      calendarExceptions: [],
    });

    if (isSupabaseConfigured) {
      Promise.all([
        SupabaseService.saveAllWorkCenters([]),
        SupabaseService.saveAllProjects([]),
        SupabaseService.saveAllCalendarExceptions([]),
        SupabaseService.saveAllScenarios(cleanScenarios),
        SupabaseService.saveSystemState('active_scenario_id', 'scen-1-base-oficial'),
        SupabaseService.saveSystemState('sector_groups', DEFAULT_SECTOR_GROUPS),
      ]).then(() => {
        showToast('Base operacional limpa e zerada sincronizada no Supabase!', 'success');
      }).catch((e) => {
        showToast(`Erro ao sincronizar base limpa no Supabase: ${e.message}`, 'info');
      });
    }
  };

  const handleRestoreOfficialBaseline = async () => {
    if (isSupabaseConfigured) {
      try {
        const saved = await SupabaseService.fetchSystemState<any>('primary_baseline', null);
        if (saved && saved.scenarios && saved.scenarios.length > 0) {
          setScenarios(saved.scenarios);
          const targetId = saved.activeScenarioId || saved.scenarios[0].id;
          setActiveScenarioId(targetId);
          const target = saved.scenarios.find((s: any) => s.id === targetId) || saved.scenarios[0];
          setWorkCenters(target.workCenters || []);
          setProjects(target.projects || []);
          setSectorGroups(target.sectorGroups || DEFAULT_SECTOR_GROUPS);
          showToast('⭐ Linha de base oficial restaurada do Supabase com sucesso!', 'success');
          return;
        }
      } catch (e: any) {
        console.error('Erro ao carregar baseline do Supabase:', e);
        showToast(`Erro ao carregar baseline do Supabase: ${e.message}`, 'info');
        return;
      }
    }

    const baselineScen = scenarios.find((s) => s.isBaseline);
    if (baselineScen) {
      setActiveScenarioId(baselineScen.id);
      setWorkCenters(baselineScen.workCenters || []);
      setProjects(baselineScen.projects || []);
      setSectorGroups(baselineScen.sectorGroups || DEFAULT_SECTOR_GROUPS);
      showToast(`⭐ Restaurado para o cenário baseline: "${baselineScen.name}"!`);
    } else {
      showToast('Nenhuma baseline oficial encontrada no banco de dados.', 'info');
    }
  };

  const handleHardClearStorage = async () => {
    try {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
      sessionStorage.clear();
      localStorage.clear();
      const cleanScens = getInitialScenarios();
      if (isSupabaseConfigured) {
        await SupabaseService.wipeAllDatabaseData();
        await Promise.all([
          SupabaseService.saveAllScenarios(cleanScens),
          SupabaseService.saveSystemState('active_scenario_id', cleanScens[0].id),
          SupabaseService.saveSystemState('sector_groups', DEFAULT_SECTOR_GROUPS),
        ]);
      }
      setWorkCenters([]);
      setProjects([]);
      setCalendarExceptions([]);
      setTurbineTypes([]);
      setGanttTasks([]);
      setScenarios(cleanScens);
      setActiveScenarioId(cleanScens[0].id);
      setSectorGroups(DEFAULT_SECTOR_GROUPS);
      saveAppSessionCache({
        scenarios: cleanScens,
        activeScenarioId: cleanScens[0].id,
        workCenters: [],
        projects: [],
        sectorGroups: DEFAULT_SECTOR_GROUPS,
        calendarExceptions: [],
        turbineTypes: [],
        ganttTasks: [],
      });
      showToast('✅ Banco de dados e armazenamento zerados com sucesso! Todos os cadastros começam do 0.', 'success');
    } catch (e: any) {
      showToast(`Erro ao limpar dados no Supabase: ${e.message}`, 'info');
    }
  };

  const handleApplySingleRecommendation = async (wcId: string, newResources: number) => {
    const next = workCenters.map((wc) => (wc.id === wcId ? { ...wc, resourcesCount: newResources } : wc));
    setWorkCenters(next);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, workCenters: next, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const targetWc = next.find((w) => w.id === wcId);
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          targetWc ? SupabaseService.saveWorkCenter(targetWc) : Promise.resolve(),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
      } catch (err: any) {
        console.error('Erro ao salvar recomendação no Supabase:', err);
      }
    }
  };

  const handleApplyAllRecommendations = async () => {
    const recMap = new Map(recommendations.map((r) => [r.workCenterId, r.recommendedResources]));
    const next = workCenters.map((wc) => {
      const recRecs = recMap.get(wc.id);
      return recRecs ? { ...wc, resourcesCount: recRecs } : wc;
    });
    setWorkCenters(next);
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId
        ? { ...s, workCenters: next, updatedAt: new Date().toISOString() }
        : s
    );
    setScenarios(updatedScenarios);

    if (isSupabaseConfigured) {
      try {
        const activeScen = updatedScenarios.find((s) => s.id === activeScenarioId);
        await Promise.all([
          SupabaseService.saveAllWorkCenters(next),
          activeScen ? SupabaseService.saveScenario(activeScen) : Promise.resolve(),
        ]);
      } catch (err: any) {
        console.error('Erro ao salvar recomendações no Supabase:', err);
      }
    }
    showToast('Todos os recursos foram reajustados para cobrir a demanda máxima de cada centro de trabalho!');
  };

  const activeProjectsCount = projects.filter((p) => p.enabled !== false).length;

  const [targetSectorFilter, setTargetSectorFilter] = useState<string | undefined>(undefined);
  const [targetWcId, setTargetWcId] = useState<string | undefined>(undefined);

  const handleNavigateToWorkCenters = (sectorGroup?: string, wcId?: string) => {
    setTargetSectorFilter(sectorGroup);
    setTargetWcId(wcId);
    setActiveTab('workcenters');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row antialiased">
      {/* Sidebar Navigation (Side Menu) */}
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenJsonModal={() => setIsJsonModalOpen(true)}
        onOpenMatrixModal={() => setIsMatrixModalOpen(true)}
        onOpenWorkCenterModal={() => setIsWcModalOpen(true)}
        onOpenTurbineTypesModal={() => setIsTurbineTypesModalOpen(true)}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        calendarEventsCount={calendarExceptions.length}
        onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
        onOpenTurbineProjectModal={() => setIsTurbineProjectModalOpen(true)}
        onOpenPrintReportModal={() => setIsPrintReportModalOpen(true)}
        onResetData={handleResetData}
        onSaveAsBaseline={handleSaveAsPrimaryBaseline}
        overloadCount={kpis.overloadedWorkCentersCount}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        isScenarioModified={isScenarioModified}
        onSelectScenario={handleSelectScenario}
        onSaveCurrentScenario={handleSaveCurrentScenario}
        onOpenNewScenarioModal={() => setIsNewScenarioModalOpen(true)}
        onDuplicateCurrentScenario={() => handleDuplicateScenario(activeScenarioId)}
        onOpenCompareModal={() => setIsScenarioCompareModalOpen(true)}
        onOpenManagerModal={() => setIsScenarioManagerModalOpen(true)}
        onOpenScenarioImportExportModal={handleOpenScenarioImportExportModal}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Main Container */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
          {/* Cloud Sync Status Indicator */}
          {isSupabaseConfigured ? (
            <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-900 px-4 py-2 rounded-xl flex items-center justify-between text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Nuvem Supabase Ativa:</strong> {isInitialLoading ? 'Conectando e carregando dados reais da fábrica...' : 'Dados compartilhados em tempo real entre todos os computadores e navegadores.'}
                </span>
              </div>
              {(isCloudLoading || isInitialLoading) && (
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isInitialLoading ? 'Carregando banco...' : 'Sincronizando...'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Persistência em Nuvem (Supabase):</strong> Para sincronizar alterações entre computadores em tempo real, configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no arquivo <code>.env</code>.
                </span>
              </div>
            </div>
          )}

        {/* SKELETON ENQUANTO CARREGA OS DADOS REAIS DO SUPABASE */}
        {isInitialLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* MODULE 2: GANTT WBS MULTINÍVEL */}
            {activeModule === 'gantt' && (
              <GanttModuleView
                tasks={ganttTasks}
                onUpdateTasks={handleUpdateGanttTasks}
                workCenters={workCenters}
                projects={projects}
                calendarExceptions={calendarExceptions}
              />
            )}

        {/* MODULE 1: CARGA MÁQUINA */}
        {activeModule === 'capacity' && (
          <>
            {/* Overview Tab (Visão Geral & KPIs: Macro / Executiva / Global) */}
            {activeTab === 'overview' && (
              <OverviewDashboard
                kpis={kpis}
                workCenters={workCenters}
                summaries={workCenterSummaries}
                weeklyBuckets={weeklyBuckets}
                projects={projects}
                sectorGroups={sectorGroups}
                recommendations={recommendations}
                onOpenPrintReportModal={() => setIsPrintReportModalOpen(true)}
                onNavigateToWorkCenters={handleNavigateToWorkCenters}
                onNavigateToProjects={() => setActiveTab('projects')}
                onNavigateToSimulation={() => setActiveTab('simulation')}
              />
            )}

            {/* Work Centers Tab (Centros de Trabalho: Micro / Operacional / Diagnóstico Individual) */}
            {activeTab === 'workcenters' && (
              <WorkCenterAnalysis
                key={`${targetSectorFilter || 'all'}-${targetWcId || 'none'}`}
                workCenters={workCenters}
                summaries={workCenterSummaries}
                weeklyBuckets={weeklyBuckets}
                projects={projects}
                sectorGroups={sectorGroups}
                initialSectorFilter={targetSectorFilter}
                initialWcId={targetWcId}
                onUpdateWorkCenter={handleUpdateWorkCenter}
                onUpdateProject={handleUpdateProject}
                onOpenPrintReportModal={() => setIsPrintReportModalOpen(true)}
                onSelectWorkCenterForSimulation={() => setActiveTab('simulation')}
              />
            )}

            {/* Projects & Schedule Tab */}
            {activeTab === 'projects' && (
              <ProjectTimeline
                projects={projects}
                workCenters={workCenters}
                sectorGroups={sectorGroups}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
                onOpenTurbineProjectModal={() => setIsTurbineProjectModalOpen(true)}
                onOpenMatrixModal={() => setIsMatrixModalOpen(true)}
              />
            )}

            {/* Heatmap Tab */}
            {activeTab === 'heatmap' && (
              <CapacityHeatmap
                workCenters={workCenters}
                weeklyBuckets={weeklyBuckets}
              />
            )}

            {/* Simulation / AI Optimization Tab */}
            {activeTab === 'simulation' && (
              <SimulationsPanel
                recommendations={recommendations}
                overloadAlerts={overloadAlerts}
                workCenters={workCenters}
                onApplyAllRecommendations={handleApplyAllRecommendations}
                onApplySingleRecommendation={handleApplySingleRecommendation}
              />
            )}
          </>
        )}
        </>
      )}
      </main>

        {/* Compact Footer */}
        <footer className="bg-slate-900 text-slate-400 text-xs py-3 px-6 border-t border-slate-800 mt-auto">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Sistema PCP - Análise de Carga Máquina & Capacidade Instalada
            </span>
            <span className="text-slate-400 text-[11px]">
              Cenário Ativo: <strong className="text-slate-200">{activeScenario.name}</strong> ({workCenterSummaries.length} Centros em uso de {workCenters.length} cadastrados | {projects.length} Projetos)
            </span>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <JsonImportExportModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        workCenters={workCenters}
        projects={projects}
        sectorGroups={sectorGroups}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onImportComplete={handleImportComplete}
        onOpenMatrixModal={() => setIsMatrixModalOpen(true)}
      />

      <MatrixImportModal
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
        workCenters={workCenters}
        projects={projects}
        sectorGroups={sectorGroups}
        turbineTypes={turbineTypes}
        onImportComplete={handleMatrixImportComplete}
      />

      <WorkCenterManagerModal
        isOpen={isWcModalOpen}
        onClose={() => setIsWcModalOpen(false)}
        workCenters={workCenters}
        sectorGroups={sectorGroups}
        turbineTypes={turbineTypes}
        projects={projects}
        calendarExceptions={calendarExceptions}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        onAddSectorGroup={handleAddSectorGroup}
        onDeleteSectorGroup={handleDeleteSectorGroup}
        onSaveWorkCenters={handleSaveWorkCenters}
        onUpdateTurbineTypes={handleSaveTurbineTypes}
      />

      <CalendarManagerModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        calendarExceptions={calendarExceptions}
        workCenters={workCenters}
        onSaveCalendarExceptions={handleSaveCalendarExceptions}
      />

      <TurbineTypeManagerModal
        isOpen={isTurbineTypesModalOpen}
        onClose={() => setIsTurbineTypesModalOpen(false)}
        turbineTypes={turbineTypes}
        onSaveTurbineTypes={handleSaveTurbineTypes}
        sectorGroups={sectorGroups}
        workCenters={workCenters}
      />

      <ProjectEditorModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        workCenters={workCenters}
        sectorGroups={sectorGroups}
        onAddProject={handleAddProject}
      />

      <CustomTurbineProjectModal
        isOpen={isTurbineProjectModalOpen}
        onClose={() => setIsTurbineProjectModalOpen(false)}
        workCenters={workCenters}
        sectorGroups={sectorGroups}
        onAddProject={handleAddProject}
        turbineTypes={turbineTypes}
        onSaveTurbineTypes={handleSaveTurbineTypes}
      />

      <NewScenarioModal
        isOpen={isNewScenarioModalOpen}
        onClose={() => setIsNewScenarioModalOpen(false)}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onCreateScenario={handleCreateScenario}
      />

      <ScenarioManagerModal
        isOpen={isScenarioManagerModalOpen}
        onClose={() => setIsScenarioManagerModalOpen(false)}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectScenario}
        onUpdateScenarioInfo={handleUpdateScenarioInfo}
        onSetBaselineScenario={handleSetBaselineScenario}
        onDuplicateScenario={handleDuplicateScenario}
        onDeleteScenario={handleDeleteScenario}
        onSaveCurrentAsPrimaryBaseline={handleSaveAsPrimaryBaseline}
        onOpenNewScenarioModal={() => setIsNewScenarioModalOpen(true)}
        onOpenImportExportModal={handleOpenScenarioImportExportModal}
      />

      <ScenarioComparisonModal
        isOpen={isScenarioCompareModalOpen}
        onClose={() => setIsScenarioCompareModalOpen(false)}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectScenario}
      />

      <ScenarioImportExportModal
        isOpen={isScenarioImportExportModalOpen}
        onClose={() => setIsScenarioImportExportModalOpen(false)}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        currentWorkCenters={workCenters}
        currentProjects={projects}
        currentSectorGroups={sectorGroups}
        onImportScenario={handleScenarioImport}
        initialTab={scenarioImportExportTab}
      />

      <DatabaseResetModal
        isOpen={isDbResetModalOpen}
        onClose={() => setIsDbResetModalOpen(false)}
        onResetToDemo={handleResetToDemo}
        onResetToCleanCompanyState={handleResetToCleanCompanyState}
        onRestoreOfficialBaseline={handleRestoreOfficialBaseline}
        onHardClearStorage={handleHardClearStorage}
        hasOfficialBaseline={hasOfficialBaseline}
        currentProjectsCount={projects.length}
        currentWorkCentersCount={workCenters.length}
      />

      <PrintReportModal
        isOpen={isPrintReportModalOpen}
        onClose={() => setIsPrintReportModalOpen(false)}
        kpis={kpis}
        workCenters={workCenters}
        summaries={workCenterSummaries}
        weeklyBuckets={weeklyBuckets}
        projects={projects}
        activeScenario={activeScenario}
        sectorGroups={sectorGroups}
        recommendations={recommendations}
      />

      {/* Floating Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
              {toastMessage.type === 'success' ? (
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              ) : (
                <Info className="w-5 h-5 text-indigo-400" />
              )}
            </div>
            <p className="text-xs font-semibold text-slate-100 flex-1 leading-snug">
              {toastMessage.text}
            </p>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

