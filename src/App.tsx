import React, { useState, useEffect, useMemo } from 'react';
import { WorkCenter, Project, DEFAULT_SECTOR_GROUPS, PlanningScenario } from './types';
import { INITIAL_DATA, RAW_INITIAL_JSON, parseJsonToState } from './data/initialData';
import { getInitialScenarios } from './data/initialScenarios';
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
import { TurbineType } from './types/turbine';
import { DEFAULT_TURBINE_TYPES } from './data/defaultTurbines';
import {
  Layers,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BarChart2,
  Factory,
} from 'lucide-react';

const STORAGE_KEY_WORKCENTERS = 'carga_maquina_workcenters_v1';
const STORAGE_KEY_PROJECTS = 'carga_maquina_projects_v1';
const STORAGE_KEY_SECTOR_GROUPS = 'carga_maquina_sector_groups_v1';
const STORAGE_KEY_TURBINE_TYPES = 'carga_maquina_turbine_types_v1';
const STORAGE_KEY_SCENARIOS = 'carga_maquina_scenarios_v1';
const STORAGE_KEY_ACTIVE_SCENARIO_ID = 'carga_maquina_active_scenario_id_v1';

export default function App() {
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

  // Active Data State (WorkCenters, Projects, SectorGroups) initialized from active scenario or localStorage fallback
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

  // Modal States
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [isWcModalOpen, setIsWcModalOpen] = useState(false);
  const [isTurbineTypesModalOpen, setIsTurbineTypesModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isTurbineProjectModalOpen, setIsTurbineProjectModalOpen] = useState(false);
  const [isNewScenarioModalOpen, setIsNewScenarioModalOpen] = useState(false);
  const [isScenarioManagerModalOpen, setIsScenarioManagerModalOpen] = useState(false);
  const [isScenarioCompareModalOpen, setIsScenarioCompareModalOpen] = useState(false);

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

  // Check if current state differs from the active saved scenario state
  const isScenarioModified = useMemo(() => {
    if (!activeScenario) return false;
    const wcDiff = JSON.stringify(workCenters) !== JSON.stringify(activeScenario.workCenters);
    const projDiff = JSON.stringify(projects) !== JSON.stringify(activeScenario.projects);
    const grpDiff = JSON.stringify(sectorGroups) !== JSON.stringify(activeScenario.sectorGroups);
    return wcDiff || projDiff || grpDiff;
  }, [workCenters, projects, sectorGroups, activeScenario]);

  // Scenario Management Handlers
  const handleSelectScenario = (id: string) => {
    const target = scenarios.find((s) => s.id === id);
    if (!target) return;
    setActiveScenarioId(id);
    setWorkCenters(JSON.parse(JSON.stringify(target.workCenters)));
    setProjects(JSON.parse(JSON.stringify(target.projects)));
    setSectorGroups(JSON.parse(JSON.stringify(target.sectorGroups || DEFAULT_SECTOR_GROUPS)));
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

    if (sourceScenarioId !== 'current') {
      const src = scenarios.find((s) => s.id === sourceScenarioId);
      if (src) {
        sourceWcs = src.workCenters;
        sourceProjects = src.projects;
        sourceGroups = src.sectorGroups;
      }
    }

    const newScen: PlanningScenario = {
      id: `scen-${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workCenters: JSON.parse(JSON.stringify(sourceWcs)),
      projects: JSON.parse(JSON.stringify(sourceProjects)),
      sectorGroups: JSON.parse(JSON.stringify(sourceGroups)),
    };

    setScenarios((prev) => [...prev, newScen]);
    setActiveScenarioId(newScen.id);
    setWorkCenters(newScen.workCenters);
    setProjects(newScen.projects);
    setSectorGroups(newScen.sectorGroups);
  };

  const handleDuplicateScenario = (id: string) => {
    const target = scenarios.find((s) => s.id === id) || activeScenario;
    if (!target) return;

    const dupScen: PlanningScenario = {
      ...JSON.parse(JSON.stringify(target)),
      id: `scen-${Date.now()}`,
      name: `${target.name} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isBaseline: false,
    };

    setScenarios((prev) => [...prev, dupScen]);
    setActiveScenarioId(dupScen.id);
    setWorkCenters(dupScen.workCenters);
    setProjects(dupScen.projects);
    setSectorGroups(dupScen.sectorGroups);
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
    setScenarios((prev) =>
      prev.map((s) => ({
        ...s,
        isBaseline: s.id === id,
      }))
    );
  };

  const handleDeleteScenario = (id: string) => {
    if (scenarios.length <= 1) {
      alert('É necessário manter pelo menos um cenário no sistema.');
      return;
    }
    const remaining = scenarios.filter((s) => s.id !== id);
    setScenarios(remaining);
    if (activeScenarioId === id) {
      const fallback = remaining[0];
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
      setSectorGroups((prev) => [...prev, trimmed]);
    }
  };

  const handleDeleteSectorGroup = (groupName: string) => {
    if (sectorGroups.length <= 1) {
      alert('É necessário ter ao menos um agrupador cadastrado.');
      return;
    }
    setSectorGroups((prev) => prev.filter((g) => g !== groupName));
    const fallback = sectorGroups.find((g) => g !== groupName) || 'OUTROS';
    setWorkCenters((prev) =>
      prev.map((wc) => (wc.category === groupName ? { ...wc, category: fallback } : wc))
    );
  };

  // Execute Capacity & Workload Calculation Engine
  const calculationResult = useMemo(() => {
    return generateWeeklySchedule(projects, workCenters);
  }, [projects, workCenters]);

  const {
    weeklyBuckets,
    workCenterSummaries,
    overloadAlerts,
    recommendations,
    kpis,
  } = calculationResult;

  // Handlers
  const handleUpdateWorkCenter = (updated: WorkCenter) => {
    setWorkCenters((prev) =>
      prev.map((wc) => (wc.id === updated.id ? updated : wc))
    );
  };

  const handleUpdateProject = (updated: Project) => {
    const cleanProject = sanitizeProjectSchedules(updated);
    setProjects((prev) =>
      prev.map((p) => (p.id === cleanProject.id ? cleanProject : p))
    );
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const handleAddProject = (newProject: Project) => {
    const cleanProject = sanitizeProjectSchedules(newProject);
    setProjects((prev) => [...prev, cleanProject]);
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

  const handleResetData = () => {
    if (
      window.confirm(
        'Deseja restaurar os cenários padrão de fábrica com os dados originais?'
      )
    ) {
      const inits = getInitialScenarios();
      setScenarios(inits);
      const first = inits[0];
      setActiveScenarioId(first.id);
      setWorkCenters(first.workCenters);
      setProjects(first.projects);
      setSectorGroups(first.sectorGroups);
    }
  };

  const handleApplySingleRecommendation = (wcId: string, newResources: number) => {
    setWorkCenters((prev) =>
      prev.map((wc) => (wc.id === wcId ? { ...wc, resourcesCount: newResources } : wc))
    );
  };

  const handleApplyAllRecommendations = () => {
    const recMap = new Map(recommendations.map((r) => [r.workCenterId, r.recommendedResources]));
    setWorkCenters((prev) =>
      prev.map((wc) => {
        const recRecs = recMap.get(wc.id);
        return recRecs ? { ...wc, resourcesCount: recRecs } : wc;
      })
    );
    alert('Todos os recursos foram reajustados para cobrir a demanda máxima de cada centro de trabalho!');
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
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenJsonModal={() => setIsJsonModalOpen(true)}
        onOpenMatrixModal={() => setIsMatrixModalOpen(true)}
        onOpenWorkCenterModal={() => setIsWcModalOpen(true)}
        onOpenTurbineTypesModal={() => setIsTurbineTypesModalOpen(true)}
        onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
        onOpenTurbineProjectModal={() => setIsTurbineProjectModalOpen(true)}
        onResetData={handleResetData}
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Main Container */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
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
      </main>

        {/* Compact Footer */}
        <footer className="bg-slate-900 text-slate-400 text-xs py-3 px-6 border-t border-slate-800 mt-auto">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Sistema PCP - Análise de Carga Máquina & Capacidade Instalada
            </span>
            <span className="text-slate-400 text-[11px]">
              Cenário Ativo: <strong className="text-slate-200">{activeScenario.name}</strong> ({workCenters.length} Centros | {projects.length} Projetos)
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
        onAddSectorGroup={handleAddSectorGroup}
        onDeleteSectorGroup={handleDeleteSectorGroup}
        onSaveWorkCenters={setWorkCenters}
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
      />

      <ScenarioComparisonModal
        isOpen={isScenarioCompareModalOpen}
        onClose={() => setIsScenarioCompareModalOpen(false)}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectScenario}
      />
    </div>
  );
}

