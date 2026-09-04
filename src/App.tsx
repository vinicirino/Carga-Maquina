import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';

const STORAGE_KEY_WORKCENTERS = 'carga_maquina_workcenters_v1';
const STORAGE_KEY_PROJECTS = 'carga_maquina_projects_v1';
const STORAGE_KEY_SECTOR_GROUPS = 'carga_maquina_sector_groups_v1';
const STORAGE_KEY_CALENDAR_EXCEPTIONS = 'carga_maquina_calendar_exceptions_v1';
const STORAGE_KEY_TURBINE_TYPES = 'carga_maquina_turbine_types_v1';
const STORAGE_KEY_SCENARIOS = 'carga_maquina_scenarios_v1';
const STORAGE_KEY_ACTIVE_SCENARIO_ID = 'carga_maquina_active_scenario_id_v1';
const STORAGE_KEY_GANTT_TASKS = 'carga_maquina_gantt_tasks_v1';

export default function App() {
  // Active Module State (Carga Máquina vs Gantt EAP)
  const [activeModule, setActiveModule] = useState<'capacity' | 'gantt'>('capacity');

  // Scenarios State
  const [scenarios, setScenarios] = useState<PlanningScenario[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCENARIOS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load scenarios from localStorage', e);
    }
    return getInitialScenarios();
  });

  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_SCENARIO_ID);
      if (savedId && scenarios.some((s) => s.id === savedId)) return savedId;
    } catch (e) {
      console.error('Failed to load active scenario ID', e);
    }
    return scenarios[0]?.id || 'scen-1-baseline';
  });

  const activeScenario = useMemo(() => {
    return (
      scenarios.find((s) => s.id === activeScenarioId) ||
      scenarios[0] ||
      getInitialScenarios()[0]
    );
  }, [scenarios, activeScenarioId]);

  // Active Data State (WorkCenters, Projects, SectorGroups, CalendarExceptions) initialized from active scenario or localStorage fallback
  const [sectorGroups, setSectorGroups] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SECTOR_GROUPS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load sector groups from localStorage', e);
    }
    return activeScenario?.sectorGroups || DEFAULT_SECTOR_GROUPS;
  });

  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WORKCENTERS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load work centers from localStorage', e);
    }
    return activeScenario?.workCenters || INITIAL_DATA.workCenters;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load projects from localStorage', e);
    }
    return activeScenario?.projects || INITIAL_DATA.projects;
  });

  const [calendarExceptions, setCalendarExceptions] = useState<CalendarException[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CALENDAR_EXCEPTIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load calendar exceptions from localStorage', e);
    }
    return activeScenario?.calendarExceptions || DEFAULT_CALENDAR_EXCEPTIONS;
  });

  const [activeTab, setActiveTab] = useState<
    'overview' | 'workcenters' | 'projects' | 'heatmap' | 'simulation'
  >('overview');

  // Turbine Types State
  const [turbineTypes, setTurbineTypes] = useState<TurbineType[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TURBINE_TYPES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load turbine types from localStorage', e);
    }
    return DEFAULT_TURBINE_TYPES;
  });

  const handleSaveTurbineTypes = (updated: TurbineType[]) => {
    setTurbineTypes(updated);
    localStorage.setItem(STORAGE_KEY_TURBINE_TYPES, JSON.stringify(updated));
  };

  // Gantt Tasks State (WBS 0..N Hierarchy)
  const [ganttTasks, setGanttTasks] = useState<GanttTaskNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GANTT_TASKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return recalculateHierarchyRollup(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load gantt tasks from localStorage', e);
    }
    return recalculateHierarchyRollup(INITIAL_GANTT_TASKS);
  });

  const handleUpdateGanttTasks = (updated: GanttTaskNode[]) => {
    const rolledUp = recalculateHierarchyRollup(updated);
    setGanttTasks(rolledUp);
    try {
      localStorage.setItem(STORAGE_KEY_GANTT_TASKS, JSON.stringify(rolledUp));
    } catch (e) {
      console.error('Failed to save gantt tasks to localStorage', e);
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

  // Check if an official baseline exists in localStorage
  const hasOfficialBaseline = useMemo(() => {
    try {
      const saved = localStorage.getItem('carga_maquina_primary_baseline_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed && parsed.scenarios && parsed.scenarios.length > 0);
      }
    } catch {
      return false;
    }
    return false;
  }, [scenarios]);

  // Save scenarios array to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SCENARIOS, JSON.stringify(scenarios));
  }, [scenarios]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_SCENARIO_ID, activeScenarioId);
  }, [activeScenarioId]);

  // Save to localStorage whenever workCenters, projects or sectorGroups change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WORKCENTERS, JSON.stringify(workCenters));
  }, [workCenters]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SECTOR_GROUPS, JSON.stringify(sectorGroups));
  }, [sectorGroups]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CALENDAR_EXCEPTIONS, JSON.stringify(calendarExceptions));
  }, [calendarExceptions]);

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
  const handleSelectScenario = (id: string) => {
    if (id === activeScenarioId) return;

    // 1. Snapshot current active scenario data into scenarios array so changes are preserved
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
  };

  const handleSaveCurrentScenario = () => {
    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id === activeScenarioId) {
          return {
            ...scen,
            workCenters: JSON.parse(JSON.stringify(workCenters)),
            projects: JSON.parse(JSON.stringify(projects)),
            sectorGroups: JSON.parse(JSON.stringify(sectorGroups)),
            calendarExceptions: JSON.parse(JSON.stringify(calendarExceptions)),
            updatedAt: new Date().toISOString(),
          };
        }
        return scen;
      })
    );
  };

  const handleCreateScenario = (name: string, description: string, sourceScenarioId: string) => {
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
  };

  const handleDuplicateScenario = (id: string) => {
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
  };

  const handleUpdateScenarioInfo = (id: string, name: string, description: string) => {
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, name, description, updatedAt: new Date().toISOString() }
          : s
      )
    );
  };

  const handleSetBaselineScenario = (id: string) => {
    const targetScen = scenarios.find((s) => s.id === id);
    const updatedScenarios = scenarios.map((s) => ({
      ...s,
      isBaseline: s.id === id,
    }));
    setScenarios(updatedScenarios);

    if (targetScen) {
      try {
        localStorage.setItem(STORAGE_KEY_SCENARIOS, JSON.stringify(updatedScenarios));
        localStorage.setItem(
          'carga_maquina_primary_baseline_v1',
          JSON.stringify({
            savedAt: new Date().toISOString(),
            activeScenarioId: id,
            workCenters: targetScen.workCenters,
            projects: targetScen.projects,
            sectorGroups: targetScen.sectorGroups,
            scenarios: updatedScenarios,
          })
        );
      } catch (e) {
        console.error('Error setting baseline scenario:', e);
      }
      showToast(`⭐ Cenário "${targetScen.name}" definido como a Base Primária Oficial (Baseline do PCP)!`);
    }
  };

  const handleSaveAsPrimaryBaseline = () => {
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

    // 2. Persist to primary baseline storage keys
    try {
      localStorage.setItem(STORAGE_KEY_SCENARIOS, JSON.stringify(updatedScenarios));
      localStorage.setItem(STORAGE_KEY_ACTIVE_SCENARIO_ID, activeScenarioId);
      localStorage.setItem(STORAGE_KEY_WORKCENTERS, JSON.stringify(workCenters));
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
      localStorage.setItem(STORAGE_KEY_SECTOR_GROUPS, JSON.stringify(sectorGroups));
      localStorage.setItem(
        'carga_maquina_primary_baseline_v1',
        JSON.stringify({
          savedAt: new Date().toISOString(),
          activeScenarioId,
          workCenters,
          projects,
          sectorGroups,
          scenarios: updatedScenarios,
        })
      );
    } catch (e) {
      console.error('Error saving primary baseline:', e);
    }

    const currentName = activeScenario?.name || 'Cenário Ativo';
    showToast(`⭐ Base Primária Oficial Fixada! O estado atual de "${currentName}" é a referência padrão do PCP.`);
  };

  const handleDeleteScenario = (id: string) => {
    const remaining = scenarios.filter((s) => s.id !== id);
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
      setScenarios([fallback]);
      setActiveScenarioId(fallback.id);
      setWorkCenters(cleanWcs);
      setProjects([]);
      setSectorGroups(fallback.sectorGroups);
      return;
    }

    const hasBaseline = remaining.some((s) => s.isBaseline);
    const updatedRemaining = !hasBaseline
      ? remaining.map((s, idx) => (idx === 0 ? { ...s, isBaseline: true } : s))
      : remaining;

    setScenarios(updatedRemaining);
    if (activeScenarioId === id) {
      const fallback = updatedRemaining[0];
      setActiveScenarioId(fallback.id);
      setWorkCenters(JSON.parse(JSON.stringify(fallback.workCenters)));
      setProjects(JSON.parse(JSON.stringify(fallback.projects)));
      setSectorGroups(JSON.parse(JSON.stringify(fallback.sectorGroups)));
    }
  };

  const handleAddSectorGroup = (groupName: string) => {
    const trimmed = groupName.trim().toUpperCase();
    if (!trimmed) return;
    if (!sectorGroups.includes(trimmed)) {
      const next = [...sectorGroups, trimmed];
      setSectorGroups(next);
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === activeScenarioId
            ? { ...s, sectorGroups: next, updatedAt: new Date().toISOString() }
            : s
        )
      );
    }
  };

  const handleDeleteSectorGroup = (groupName: string) => {
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
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === activeScenarioId
          ? { ...s, sectorGroups: nextGroups, workCenters: nextWcs, updatedAt: new Date().toISOString() }
          : s
      )
    );
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
  const handleSaveCalendarExceptions = (newExceptions: CalendarException[]) => {
    setCalendarExceptions(newExceptions);
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === activeScenarioId
          ? { ...s, calendarExceptions: newExceptions, updatedAt: new Date().toISOString() }
          : s
      )
    );
    showToast(`📅 Calendário Fabril atualizado (${newExceptions.length} eventos configurados)!`);
  };
  const handleUpdateWorkCenter = (updated: WorkCenter) => {
    setWorkCenters((prev) => {
      const next = prev.map((wc) => (wc.id === updated.id ? updated : wc));
      setScenarios((scenPrev) =>
        scenPrev.map((s) =>
          s.id === activeScenarioId
            ? { ...s, workCenters: next, updatedAt: new Date().toISOString() }
            : s
        )
      );
      return next;
    });
  };

  const handleSaveWorkCenters = (newWcs: WorkCenter[]) => {
    setWorkCenters(newWcs);
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === activeScenarioId
          ? { ...s, workCenters: newWcs, updatedAt: new Date().toISOString() }
          : s
      )
    );
  };

  const handleUpdateProject = (updated: Project) => {
    const cleanProject = sanitizeProjectSchedules(updated, workCenters);
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === cleanProject.id ? cleanProject : p));
      setScenarios((scenPrev) =>
        scenPrev.map((s) =>
          s.id === activeScenarioId
            ? { ...s, projects: next, updatedAt: new Date().toISOString() }
            : s
        )
      );
      return next;
    });
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId);
      setScenarios((scenPrev) =>
        scenPrev.map((s) =>
          s.id === activeScenarioId
            ? { ...s, projects: next, updatedAt: new Date().toISOString() }
            : s
        )
      );
      return next;
    });
  };

  const handleAddProject = (newProject: Project) => {
    const cleanProject = sanitizeProjectSchedules(newProject, workCenters);
    setProjects((prev) => {
      const next = [...prev, cleanProject];
      setScenarios((scenPrev) =>
        scenPrev.map((s) =>
          s.id === activeScenarioId
            ? { ...s, projects: next, updatedAt: new Date().toISOString() }
            : s
        )
      );
      return next;
    });
  };

  const handleImportComplete = (payload: ImportPayload) => {
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
      return;
    }

    if (mode === 'create_new_scenario') {
      const newScen: PlanningScenario = {
        id: `scen-${Date.now()}`,
        name: scenarioName || 'Cenário Importado',
        description: `Importado em ${new Date().toLocaleDateString('pt-BR')} via JSON Estrutura v2.0`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workCenters: newWcs,
        projects: newProjects,
        sectorGroups: validatedGroups,
      };
      setScenarios((prev) => [...prev, newScen]);
      setActiveScenarioId(newScen.id);
      setWorkCenters(newWcs);
      setProjects(newProjects);
      setSectorGroups(validatedGroups);
      return;
    }

    // Default mode: 'replace_current'
    setWorkCenters(newWcs);
    setProjects(newProjects);
    setSectorGroups(validatedGroups);
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === activeScenarioId
          ? {
              ...s,
              workCenters: newWcs,
              projects: newProjects,
              sectorGroups: validatedGroups,
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
  };

  const handleMatrixImportComplete = (payload: MatrixImportPayload) => {
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
      setScenarios((prev) => [...prev, newScen]);
      setActiveScenarioId(newScen.id);
      setWorkCenters(newWcs);
      setProjects(sanitizedProjects);
      setSectorGroups(validatedGroups);
      setActiveTab('projects');
      return;
    }

    if (mode === 'replace_projects') {
      const sanitizedProjects = newProjects.map((p) => sanitizeProjectSchedules(p, newWcs));
      setWorkCenters(newWcs);
      setProjects(sanitizedProjects);
      setSectorGroups(validatedGroups);
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === activeScenarioId
            ? {
                ...s,
                workCenters: newWcs,
                projects: sanitizedProjects,
                sectorGroups: validatedGroups,
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );
      setActiveTab('projects');
      return;
    }

    // Default mode: 'append' (replace existing projects with same name to prevent duplicates, or append new ones)
    const sanitizedNewProjects = newProjects.map((p) => sanitizeProjectSchedules(p, newWcs));
    const projectMap = new Map<string, Project>();
    // Existing projects
    projects.forEach((p) => {
      projectMap.set(p.name.trim().toUpperCase(), sanitizeProjectSchedules(p, newWcs));
    });
    // Overwrite / Add imported projects (unique by project name)
    sanitizedNewProjects.forEach((p) => {
      projectMap.set(p.name.trim().toUpperCase(), p);
    });
    const mergedProjects = Array.from(projectMap.values());

    setWorkCenters(newWcs);
    setProjects(mergedProjects);
    setSectorGroups(validatedGroups);
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === activeScenarioId
          ? {
              ...s,
              workCenters: newWcs,
              projects: mergedProjects,
              sectorGroups: validatedGroups,
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
    setActiveTab('projects');
  };

  const handleScenarioImport = (payload: ScenarioImportPayload) => {
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
      return;
    }

    if (mode === 'append_scenarios' && importedScenarios && importedScenarios.length > 0) {
      setScenarios((prev) => [...prev, ...importedScenarios]);
      const targetId = newActiveId || importedScenarios[0]?.id;
      setActiveScenarioId(targetId);
      const activeTarget = importedScenarios.find((s) => s.id === targetId) || importedScenarios[0];
      setWorkCenters(activeTarget.workCenters);
      setProjects(activeTarget.projects);
      setSectorGroups(activeTarget.sectorGroups || DEFAULT_SECTOR_GROUPS);
      setCalendarExceptions(activeTarget.calendarExceptions || DEFAULT_CALENDAR_EXCEPTIONS);
      showToast(`✨ ${importedScenarios.length} cenários adicionados à biblioteca!`);
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

        setScenarios((prev) => [...prev, newScen]);
        setActiveScenarioId(newScen.id);
        setWorkCenters(newScen.workCenters);
        setProjects(newScen.projects);
        setSectorGroups(scenarioGroups);
        setCalendarExceptions(scenarioCalendar);
        showToast(`✅ Novo Cenário "${scenarioName}" importado e ativado com sucesso!`);
        return;
      }

      if (mode === 'replace_current') {
        setWorkCenters(scenario.workCenters);
        setProjects(scenario.projects);
        setSectorGroups(scenarioGroups);
        setCalendarExceptions(scenarioCalendar);
        setScenarios((prev) =>
          prev.map((s) =>
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
          )
        );
        showToast(`✅ Cenário ativo atualizado exatamente com os dados do arquivo importado!`);
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
    const cleanWcs = INITIAL_DATA.workCenters.map((wc) => ({
      ...wc,
      resourcesCount: 1,
      dailyHours: 8,
      daysPerWeek: 5,
      efficiencyPercentage: 100,
    }));
    const cleanProjects: Project[] = [];
    const cleanScenarios: PlanningScenario[] = [
      {
        id: 'scen-1-empresa-base',
        name: 'Cenário 1: Base Operacional da Empresa (Principal)',
        description: 'Base limpa e oficial para cadastro e importação dos projetos e centros de trabalho da empresa.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBaseline: true,
        workCenters: cleanWcs,
        projects: cleanProjects,
        sectorGroups: DEFAULT_SECTOR_GROUPS,
      },
      {
        id: 'scen-2-expansao-turno',
        name: 'Cenário 2: Turno Extra / Expansão',
        description: 'Cenário de simulação para turno estendido ou acréscimo de postos.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workCenters: cleanWcs,
        projects: cleanProjects,
        sectorGroups: DEFAULT_SECTOR_GROUPS,
      },
      {
        id: 'scen-3-simulacao-prazos',
        name: 'Cenário 3: Simulação de Prazos & Setores',
        description: 'Cenário de simulação para ajuste de datas e balanceamento de gargalos.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workCenters: cleanWcs,
        projects: cleanProjects,
        sectorGroups: DEFAULT_SECTOR_GROUPS,
      },
    ];
    setScenarios(cleanScenarios);
    setActiveScenarioId('scen-1-empresa-base');
    setWorkCenters(cleanWcs);
    setProjects(cleanProjects);
    setSectorGroups(DEFAULT_SECTOR_GROUPS);
  };

  const handleRestoreOfficialBaseline = () => {
    try {
      const saved = localStorage.getItem('carga_maquina_primary_baseline_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.scenarios && parsed.scenarios.length > 0) {
          setScenarios(parsed.scenarios);
          const targetId = parsed.activeScenarioId || parsed.scenarios[0].id;
          setActiveScenarioId(targetId);
          const target = parsed.scenarios.find((s: any) => s.id === targetId) || parsed.scenarios[0];
          setWorkCenters(target.workCenters);
          setProjects(target.projects);
          setSectorGroups(target.sectorGroups || DEFAULT_SECTOR_GROUPS);
        }
      }
    } catch (e) {
      console.error('Error loading baseline', e);
    }
  };

  const handleHardClearStorage = () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleApplySingleRecommendation = (wcId: string, newResources: number) => {
    setWorkCenters((prev) => {
      const next = prev.map((wc) => (wc.id === wcId ? { ...wc, resourcesCount: newResources } : wc));
      setScenarios((scenPrev) =>
        scenPrev.map((s) =>
          s.id === activeScenarioId
            ? { ...s, workCenters: next, updatedAt: new Date().toISOString() }
            : s
        )
      );
      return next;
    });
  };

  const handleApplyAllRecommendations = () => {
    const recMap = new Map(recommendations.map((r) => [r.workCenterId, r.recommendedResources]));
    setWorkCenters((prev) => {
      const next = prev.map((wc) => {
        const recRecs = recMap.get(wc.id);
        return recRecs ? { ...wc, resourcesCount: recRecs } : wc;
      });
      setScenarios((scenPrev) =>
        scenPrev.map((s) =>
          s.id === activeScenarioId
            ? { ...s, workCenters: next, updatedAt: new Date().toISOString() }
            : s
        )
      );
      return next;
    });
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

