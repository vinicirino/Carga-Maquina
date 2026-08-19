import { WorkCenter, Project } from '../types';
import { initialCategorySeed } from '../utils/categoryHelper';

export const RAW_INITIAL_JSON = {
  "CARGA ITUPORANGA+GUARAU": [
    {
      "ALMOXARIFADO": 10.02,
      "CALDEIRARIA 01": 3611.55,
      "CENTRO DE USINAGEM GROB G500 - 5 EIXOS": 20.51,
      "CENTRO DE USINAGEM HAAS 4 EIXOS VF - 9/50": 139.98,
      "CENTRO DISTRIBUICAO": 8.9,
      "CHANFRAMENTO": 376.48,
      "CONFORMACAO MECANICA": 363.68,
      "FORNOS": 0.22,
      "FRESADORA CNC MILLMASTER C 1000 L": 126.9,
      "FRESADORA CNC MILLMASTER F-1250": 19.4,
      "FRESADORA CNC MILLMASTER F-1500  {31}": 65.89,
      "FRESADORA CNC PETRUS 8013R": 14.87,
      "FRESADORA CNC PETRUS 90250R  {31}": 2.4,
      "FRESADORA CNC ROUTER RC6090": 2.97,
      "FRESADORA CNC SUNLIKE BT-3000": 180.57,
      "FRESADORA CNC SUNLIKE S 2063": 43.7,
      "FRESADORA CNC SUNLIKE S3092": 24.74,
      "FRESADORA CNC SUNLIKE VMC 2063": 9.25,
      "FRESADORAS CNC": 243.47,
      "FRESADORAS ROUTER": 144.04,
      "FURADEIRA RADIAL STANKOIMPORT": 32.4,
      "GARANTIA DA QUALIDADE": 28.55,
      "JATEAMENTO": 543.48,
      "JATEAMENTO GRANDE PORTE": 99.7,
      "LIXAMENTO": 372.61,
      "MANDRILHADORA CNC DIPLOMAT TK 6511B": 193.43,
      "MANDRILHADORA CNC WOTAN CUTMAX 2 TT": 775.32,
      "MANDRILHADORA CNC WOTAN M3": 1152.81,
      "MARCENARIA": 8.5,
      "METALIZACAO": 128.39,
      "MODELAGEM": 129.27,
      "MONTAGEM DE PROCESSO": 329.94,
      "MONTAGEM DISTRIBUIDORES": 20.36,
      "MONTAGEM ELETRICA": 45.07,
      "MONTAGEM GERADORES": 53.03,
      "MONTAGEM HIDRAULICA": 332.16,
      "MONTAGEM MANCAIS": 172.64,
      "MONTAGEM MECANICA 01": 328.97,
      "MONTAGEM ROTORES": 42.61,
      "MONTAGENS ESPECIAIS": 112.52,
      "MONTAGENS ESPECIAIS MECANICA": 0.06,
      "OXICORTE CNC MULTI THERM 4000": 442.4,
      "OXIPIRA PLASMA": 4.17,
      "PINTURA": 556.19,
      "PROGRAMACAO MAQUINAS CNC": 76.56,
      "PROGRAMACAO OXIPLASMA CNC": 0.04,
      "PROJETO": 1446.51,
      "REBARBAMENTO": 382.37,
      "RETIFICA ROTATIVA": 14.34,
      "ROBO CALDEIRARIA": 175.66,
      "ROBO DE POLIMENTO": 151.27,
      "ROBO DE SOLDAGEM": 380.02,
      "ROSQUEAMENTO": 400.31,
      "SERRAS": 295.46,
      "SERVIÇOS DE TERCEIROS": 0.18,
      "SOLDAGEM 01": 4975.81,
      "SOLDAGEM 02": 59.24,
      "TERCEIRIZADOS": 2.54,
      "TORNO CNC LOGIC 500": 86.44,
      "TORNO CNC VULCANIC 1050": 221.25,
      "TORNO CNC VULCANIC 550": 80.84,
      "TORNO NARDINI AM 650 D": 106.41,
      "TORNO ROMI 30 B": 66.15,
      "TORNO VERTICAL CNC CHINES D2M": 42.62,
      "TORNO VERTICAL CNC D1M": 80.43,
      "TORNO VERTICAL CNC HACKER 6000": 248.44,
      "TORNO VERTICAL CNC MORANDO 3000": 345.47,
      "TORNO VERTICAL CNC WOTAN TWTVI-2000": 135.93,
      "TORNOS NARDINI 325": 200.6,
      "Total Geral": 21289.05
    }
  ],
  "OUTROS PROJETOS": [
    {
      "MANDRILHADORA CNC WOTAN M3": 420.31,
      "MANDRILHADORA CNC WOTAN CUTMAX 2 TT": 622.99,
      "MANDRILHADORA CNC DIPLOMAT TK 6511B": 227.26,
      "CENTRO DE USINAGEM GROB G500 5 EIXOS": 342.08,
      "CENTRO DE USINAGEM HAAS 4 EIXOS VF - 9/50": 280.43,
      "TORNO CNC LOGIC 500": 212.06,
      "TORNO VERTICAL CNC D1M": 560.29,
      "TORNO CNC VULCANIC 550": 488.22,
      "TORNO CNC VULCANIC 1050": 442.2,
      "TORNO VERTICAL CNC WOTAN TWTVI-2000": 643.5,
      "TORNO VERTICAL CNC HACKER 6000": 328.22,
      "TORNO VERTICAL CNC MORANDO 3000": 244.7,
      "TORNO VERTICAL CNC CHINES D2M": 278.11,
      "TORNO CNC ATLASMAQ TCGA-CK62145": 171.52,
      "FRESADORA CNC PETRUS 90250R": 145.36,
      "FRESADORA CNC SUNLIKE S3092": 87.47,
      "FRESADORA CNC PETRUS 8013R": 66.17,
      "FRESADORA CNC SUNLIKE S 2063": 550.1,
      "FRESADORA CNC SUNLIKE BT-3000": 87.96,
      "FRESADORA CNC MILLMASTER F-1250": 305.23,
      "FRESADORA CNC MILLMASTER F-1500": 562.12,
      "FRESADORA CNC MILLMASTER C 1000 L": 452.44,
      "FRESADORA CNC ROUTER RC6090 ": 215.98,
      "TORNO ROMI 30 B": 298.08,
      "TORNO NARDINI AM 650 D": 331.26,
      "ALMOXARIFADO": 24321.03,
      "CALDEIRARIA 01": 679.74,
      "CALDEIRARIA 02": 3.33,
      "CENTRO DISTRIBUICAO": 34.08,
      "CHANFRAMENTO": 134.67,
      "CONFORMACAO MECANICA": 311.39,
      "FORNOS": 2304.0,
      "FRESADORAS ROUTER": 566.81,
      "FURADEIRA RADIAL STANKOIMPORT": 233.68,
      "GARANTIA DA QUALIDADE": 735.57,
      "GARANTIA DA QUALIDADE, GARANTIA DA QUALIDADE": 0.12,
      "JATEAMENTO GRANDE PORTE": 16.93,
      "JATEAMENTO": 717.86,
      "LIXAMENTO": 718.67,
      "MARCENARIA": 170.14,
      "METALIZACAO": 452.43,
      "MODELAGEM": 225.35,
      "MONTAGEM DE PROCESSO": 346.01,
      "MONTAGEM DISTRIBUIDORES": 1642.75,
      "MONTAGEM ELETRICA": 488.01,
      "MONTAGEM GERADORES": 1391.53,
      "MONTAGEM HIDRAULICA": 1368.32,
      "MONTAGEM MANCAIS": 577.78,
      "MONTAGEM MECANICA 01": 1532.13,
      "MONTAGEM ROTORES": 486.26,
      "MONTAGENS ESPECIAIS": 469.13,
      "OXICORTE CNC MULTI THERM 4000": 56.02,
      "OXIPIRA PLASMA HPR 400 XD": 257.73,
      "PINTURA": 1699.12,
      "PROJETO": 17.39,
      "REBARBAMENTO": 337.27,
      "RETIFICA BRAZMAC RT-250": 31.23,
      "RETIFICA ROTATIVA": 526.28,
      "ROBO CALDEIRARIA": 13.89,
      "ROBO DE POLIMENTO": 412.93,
      "ROBO DE SOLDAGEM": 199.56,
      "ROSQUEAMENTO": 1740.12,
      "SERRAS": 311.46,
      "SERVIÇOS DE TERCEIROS": 34993.77,
      "SOLDAGEM 01": 2361.59,
      "SOLDAGEM 02": 0.32,
      "SOLDAGEM LASER": 50.78,
      "SOLDAGEM POSICIONADOR DE SOLDA": 10.0,
      "TERCEIRIZADOS": 21.84,
      "TORNOS NARDINI 325": 407.49
    }
  ],
  "NOVA ERECHIM": [
    {
      "MANDRILHADORA CNC WOTAN M3": 1017.16,
      "MANDRILHADORA CNC WOTAN CUTMAX 2 TT": 990.47,
      "MANDRILHADORA CNC DIPLOMAT TK 6511B": 752.27,
      "CENTRO DE USINAGEM GROB G500 5 EIXOS": 1336.2,
      "CENTRO DE USINAGEM HAAS 4 EIXOS VF - 9/50": 1143.56,
      "TORNO CNC LOGIC 500": 241.25,
      "TORNO VERTICAL CNC D1M": 616.16,
      "TORNO CNC VULCANIC 550": 125.27,
      "TORNO CNC VULCANIC 1050": 259.47,
      "TORNO VERTICAL CNC WOTAN TWTVI-2000": 1698.17,
      "TORNO VERTICAL CNC HACKER 6000": 761.37,
      "TORNO VERTICAL CNC MORANDO 3000": 750.84,
      "TORNO VERTICAL CNC CHINES D2M": 613.27,
      "TORNO CNC ATLASMAQ TCGA-CK62145": 743.4,
      "FRESADORA CNC PETRUS 90250R": 248.84,
      "FRESADORA CNC SUNLIKE S3092": 877.17,
      "FRESADORA CNC PETRUS 8013R": 234.3,
      "FRESADORA CNC SUNLIKE S 2063": 245.8,
      "FRESADORA CNC SUNLIKE BT-3000": 663.21,
      "FRESADORA CNC MILLMASTER F-1250": 467.87,
      "FRESADORA CNC MILLMASTER F-1500": 964.79,
      "FRESADORA CNC MILLMASTER C 1000 L": 372.87,
      "FRESADORA CNC ROUTER RC6090 ": 30.4,
      "TORNO ROMI 30 B": 59.88,
      "TORNO NARDINI AM 650 D": 984.88,
      "ALMOXARIFADO": 59725.66,
      "CALDEIRARIA 01": 5680.77,
      "CALDEIRARIA 02": 22.05,
      "CENTRO DISTRIBUICAO": 23.97,
      "CHANFRAMENTO": 767.95,
      "CONFORMACAO MECANICA": 906.39,
      "FORNOS": 1327.42,
      "FRESADORAS ROUTER": 187.33,
      "FURADEIRA RADIAL STANKOIMPORT": 649.56,
      "GARANTIA DA QUALIDADE": 646.75,
      "JATEAMENTO GRANDE PORTE": 83.49,
      "JATEAMENTO": 1008.86,
      "LIXAMENTO": 434.1,
      "MARCENARIA": 39.67,
      "METALIZACAO": 725.69,
      "MODELAGEM": 76.59,
      "MONTAGEM DE PROCESSO": 545.1,
      "MONTAGEM DISTRIBUIDORES": 1090.27,
      "MONTAGEM ELETRICA": 385.52,
      "MONTAGEM GERADORES": 1402.73,
      "MONTAGEM HIDRAULICA": 540.11,
      "MONTAGEM MANCAIS": 391.51,
      "MONTAGEM MECANICA 01": 1271.3,
      "MONTAGEM ROTORES": 496.65,
      "MONTAGENS ESPECIAIS": 113.26,
      "OXICORTE CNC MULTI THERM 4000": 1003.88,
      "OXIPIRA PLASMA HPR 400 XD": 211.11,
      "PINTURA": 1978.69,
      "PROJETO": 0.15,
      "REBARBAMENTO": 819.45,
      "RETIFICA BRAZMAC RT-250": 5.98,
      "RETIFICA ROTATIVA": 244.88,
      "ROBO CALDEIRARIA": 1283.85,
      "ROBO DE POLIMENTO": 279.93,
      "ROBO DE SOLDAGEM": 355.59,
      "ROSQUEAMENTO": 2616.73,
      "SERRAS": 258.65,
      "SERVIÇOS DE TERCEIROS": 53183.16,
      "SOLDAGEM 01": 8865.0,
      "SOLDAGEM 02": 46.96,
      "SOLDAGEM POSICIONADOR DE SOLDA": 417.68,
      "TERCEIRIZADOS": 36.6,
      "TORNO VERTICAL MORANDO  (INATIVO)": 50.0,
      "TORNOS NARDINI 325": 196.45
    }
  ]
};

// Helper function to normalize Work Center names (trimming extra whitespace or special markers)
export function sanitizeWorkCenterName(name: string): string {
  let cleaned = name.trim();
  // If it ends with "Total Geral", ignore
  if (cleaned.toLowerCase() === 'total geral') return '';
  // Remove trailing bracket annotations like {31} if desired, or keep clean string
  cleaned = cleaned.replace(/\s*\{\d+\}\s*/g, '');
  // Clean duplicate repeated names like "GARANTIA DA QUALIDADE, GARANTIA DA QUALIDADE"
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(s => s.trim());
    if (parts[0] === parts[1]) cleaned = parts[0];
  }
  return cleaned;
}

// Parses a JSON structure like the one provided by user and returns initial WorkCenters and Projects
export function parseJsonToState(jsonData: Record<string, any[]>) {
  const workCenterTotalHoursMap: Record<string, number> = {};
  const projects: Project[] = [];

  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];

  let colorIdx = 0;

  // Project date defaults
  const projectDates = [
    { start: '2027-08-13', end: '2028-09-15' },
    { start: '2027-09-01', end: '2028-06-30' },
    { start: '2027-10-15', end: '2028-12-31' },
  ];

  let dateIdx = 0;

  for (const [projectName, projectList] of Object.entries(jsonData)) {
    if (!Array.isArray(projectList) || projectList.length === 0) continue;

    const rawHoursMap = projectList[0] || {};
    const cleanWorkCenterHours: Record<string, number> = {};

    for (const [rawWcName, hours] of Object.entries(rawHoursMap)) {
      if (typeof hours !== 'number' || isNaN(hours)) continue;
      const wcName = sanitizeWorkCenterName(rawWcName);
      if (!wcName) continue; // Skip "Total Geral"

      cleanWorkCenterHours[wcName] = (cleanWorkCenterHours[wcName] || 0) + hours;
      workCenterTotalHoursMap[wcName] = (workCenterTotalHoursMap[wcName] || 0) + hours;
    }

    const defaultDate = projectDates[dateIdx % projectDates.length];
    dateIdx++;

    projects.push({
      id: `proj-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: projectName,
      startDate: defaultDate.start,
      endDate: defaultDate.end,
      workCenterHours: cleanWorkCenterHours,
      color: colors[colorIdx % colors.length],
      enabled: true,
    });
    colorIdx++;
  }

  // Create WorkCenter objects with intelligent initial resource counts
  const workCenters: WorkCenter[] = Object.keys(workCenterTotalHoursMap).map((wcName, idx) => {
    const totalHours = workCenterTotalHoursMap[wcName];
    // Default 52 weeks in project window (~1 year). A single worker working 40h/week yields ~2080 hours/year.
    // Assign sensible default resources count based on volume
    let defaultResources = 1;
    if (totalHours > 50000) defaultResources = 25;
    else if (totalHours > 20000) defaultResources = 12;
    else if (totalHours > 8000) defaultResources = 6;
    else if (totalHours > 3000) defaultResources = 3;
    else if (totalHours > 1000) defaultResources = 2;

    return {
      id: `wc-${idx + 1}-${wcName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: wcName,
      dailyHours: 8,
      daysPerWeek: 5,
      resourcesCount: defaultResources,
      efficiencyPercentage: 100,
      category: initialCategorySeed(wcName),
    };
  });

  return { workCenters, projects };
}

export const INITIAL_DATA = parseJsonToState(RAW_INITIAL_JSON);
