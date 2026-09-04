export type GanttItemType =
  | 'project' // Nível 0: TURBINA / PROJETO
  | 'group' // Nível 1: Conjunto
  | 'subgroup' // Nível 2: Subconjunto
  | 'item' // Nível 3: Item / Componente
  | 'operation' // Nível 4+: Operação / Tarefa Fabril
  | 'milestone'; // Marco Contratual / Ponto de Controle

export type GanttConstraintType =
  | 'contract' // Data Contratual / Marco Fixo
  | 'capacity' // Capacidade do Centro de Trabalho (CT)
  | 'material' // Dependência de Compra de Materiais / Suprimentos
  | 'manual'; // Agendamento Manual / Engenharia

export type GanttItemStatus =
  | 'not_started' // Não Iniciado
  | 'in_progress' // Em Andamento
  | 'completed' // Concluído
  | 'delayed' // Atrasado
  | 'waiting_material' // Aguardando Material
  | 'blocked'; // Bloqueado

export type MaterialDeliveryStatus =
  | 'not_ordered' // Não Solicitado
  | 'ordered' // Pedido Colocado
  | 'in_transit' // Em Trânsito
  | 'received' // Recebido / Em Estoque
  | 'delayed'; // Em Atraso

export type GanttZoomLevel = 'days' | 'weeks' | 'months' | 'years';

export interface GanttTaskNode {
  id: string;
  projectId: string; // ID do projeto raiz (nível 0)
  parentId: string | null; // ID do pai imediato na árvore (ou null se for raiz nível 0)
  level: number; // 0, 1, 2, 3, 4, ... N
  code: string; // Ex: "1.0", "1.1", "1.1.2", "1.1.2.1"
  name: string; // Ex: "Conjunto Rotor Francis", "Usinagem de Palhetas"
  type: GanttItemType;
  constraintType: GanttConstraintType;
  workCenterId?: string; // Vínculo ao Centro de Trabalho existente
  workCenterName?: string; // Nome cacheado para facilidade de exibição
  plannedHours?: number; // Horas planejadas de máquina / mão de obra
  actualHours?: number; // Horas reais apontadas
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  baselineStartDate?: string; // YYYY-MM-DD (Linha de base original)
  baselineEndDate?: string; // YYYY-MM-DD (Linha de base original)
  contractDate?: string; // YYYY-MM-DD (Data contratual fixada se houver)
  // Campos de Material / Suprimentos
  materialName?: string; // Nome da matéria prima / peça comprada
  materialSupplier?: string; // Fornecedor
  materialEtaDate?: string; // Data prevista de chegada do material (YYYY-MM-DD)
  materialStatus?: MaterialDeliveryStatus;
  // Progresso & Status
  progress: number; // 0 a 100%
  status: GanttItemStatus;
  dependencies?: string[]; // IDs de tarefas predecessoras (Término-Início)
  expanded?: boolean; // Estado de expansão na árvore
  treeDepth?: number; // Profundidade hierárquica calculada na árvore (0 = raiz, 1 = filho direto de N0, etc.)
  notes?: string;
  assignee?: string;
  color?: string;
  customFields?: Record<string, any>;
}

export interface GanttFilterOptions {
  projectId: string; // 'all' ou ID específico
  levelFilter: number | 'all'; // 0, 1, 2, 3, 4 ou 'all'
  constraintFilter: GanttConstraintType | 'all';
  statusFilter: GanttItemStatus | 'all';
  workCenterFilter: string | 'all';
  searchTerm: string;
  startDateFilter?: string;
  endDateFilter?: string;
}

export interface GanttMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  delayedTasks: number;
  waitingMaterialTasks: number;
  notStartedTasks: number;
  overallProgress: number; // % ponderado
  totalPlannedHours: number;
  totalActualHours: number;
  contractMilestonesCount: number;
  contractMilestonesDelayed: number;
  materialsTotal: number;
  materialsReceived: number;
  materialsDelayed: number;
}
