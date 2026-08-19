import React, { useState } from 'react';
import { WorkCenter } from '../types';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import { X, Plus, Trash2, Factory, Save, FolderTree, Tag, Filter, Layers, CheckCircle } from 'lucide-react';

interface WorkCenterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workCenters: WorkCenter[];
  sectorGroups: string[];
  onAddSectorGroup: (name: string) => void;
  onDeleteSectorGroup: (name: string) => void;
  onSaveWorkCenters: (wcs: WorkCenter[]) => void;
}

export const WorkCenterManagerModal: React.FC<WorkCenterManagerModalProps> = ({
  isOpen,
  onClose,
  workCenters,
  sectorGroups,
  onAddSectorGroup,
  onDeleteSectorGroup,
  onSaveWorkCenters,
}) => {
  const [list, setList] = useState<WorkCenter[]>(workCenters);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [newWcName, setNewWcName] = useState('');
  const [newWcCategory, setNewWcCategory] = useState<string>(
    sectorGroups.length > 0 ? sectorGroups[0] : 'CORTE'
  );
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');

  if (!isOpen) return null;

  const handleCreateGroup = () => {
    if (!newGroupInput.trim()) return;
    const trimmed = newGroupInput.trim().toUpperCase();
    onAddSectorGroup(trimmed);
    setNewGroupInput('');
    if (!newWcCategory) {
      setNewWcCategory(trimmed);
    }
  };

  const handleUpdate = (id: string, field: keyof WorkCenter, value: any) => {
    setList((prev) =>
      prev.map((wc) => (wc.id === id ? { ...wc, [field]: value } : wc))
    );
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setList((prev) => prev.filter((wc) => wc.id !== id));
  };

  const handleAdd = () => {
    if (!newWcName.trim()) return;
    const cat = newWcCategory || (sectorGroups.length > 0 ? sectorGroups[0] : 'OUTROS');
    const newWc: WorkCenter = {
      id: `wc-${Date.now()}-${newWcName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: newWcName.trim().toUpperCase(),
      dailyHours: 8,
      daysPerWeek: 5,
      resourcesCount: 1,
      efficiencyPercentage: 100,
      category: cat,
    };
    setList((prev) => [...prev, newWc]);
    setNewWcName('');
  };

  const handleSave = () => {
    for (const wc of list) {
      if (!wc.name.trim()) return;
      if (!wc.dailyHours || wc.dailyHours <= 0) return;
      if (!wc.daysPerWeek || wc.daysPerWeek <= 0) return;
      if (!wc.resourcesCount || wc.resourcesCount <= 0) return;
      if (!wc.efficiencyPercentage || wc.efficiencyPercentage <= 0) return;
    }
    onSaveWorkCenters(list);
    onClose();
  };

  const filteredList = list.filter((wc) => {
    if (selectedGroupFilter === 'ALL') return true;
    return getWorkCenterCategory(wc) === selectedGroupFilter;
  });

  const totalWeeklyCapacity = list.reduce((acc, wc) => {
    return (
      acc +
      (wc.dailyHours || 0) *
        (wc.daysPerWeek || 0) *
        (wc.resourcesCount || 0) *
        ((wc.efficiencyPercentage || 0) / 100)
    );
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-[92vh] max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-xs">
              <Factory className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                Gerenciador de Agrupadores & Centros de Trabalho
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold uppercase">
                  Capacidade & Recursos
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Organize os centros em agrupadores setoriais, ajuste jornadas, quantidade de recursos e eficiências operacionais.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Sidebar (Dark Blue) + Right Content (Light) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* ========================================================================= */}
          {/* LEFT SIDEBAR (DARK BLUE): AGRUPADORES DE CENTROS & CRIAÇÃO               */}
          {/* ========================================================================= */}
          <div className="w-full md:w-72 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-3.5 flex flex-col justify-between overflow-y-auto shrink-0 text-white">
            <div className="space-y-3">
              {/* Header of Sidebar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Agrupadores ({sectorGroups.length})</span>
                </span>
              </div>

              {/* Form to Create New Group */}
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Criar Novo Agrupador
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Nome (ex: CORTE, SOLDA)..."
                    value={newGroupInput}
                    onChange={(e) => setNewGroupInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-bold uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Agrupador</span>
                  </button>
                </div>
              </div>

              {/* Agrupadores List / Quick Filters */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1 pb-0.5">
                  Filtrar / Visualizar
                </div>

                {/* All Groups Button */}
                <button
                  type="button"
                  onClick={() => setSelectedGroupFilter('ALL')}
                  className={`w-full p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                    selectedGroupFilter === 'ALL'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-bold truncate">Todos os Agrupadores</span>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      selectedGroupFilter === 'ALL'
                        ? 'bg-indigo-700 text-indigo-100'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {list.length}
                  </span>
                </button>

                {/* Individual Group Badges/Cards */}
                {sectorGroups.map((group) => {
                  const count = list.filter((wc) => getWorkCenterCategory(wc) === group).length;
                  const isSelected = selectedGroupFilter === group;

                  return (
                    <div
                      key={group}
                      onClick={() => setSelectedGroupFilter(group)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                          : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        <Tag className="w-3 h-3 shrink-0 text-indigo-300" />
                        <span className="text-xs font-bold truncate uppercase">{group}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-indigo-700 text-indigo-100'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {count}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSectorGroup(group);
                            if (selectedGroupFilter === group) {
                              setSelectedGroupFilter('ALL');
                            }
                          }}
                          title={`Excluir agrupador ${group}`}
                          className="p-1 text-slate-400 hover:text-rose-300 hover:bg-slate-700/80 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Summary Footer */}
            <div className="pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Centros Cadastrados:</span>
                <strong className="text-white font-mono">{list.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Capacidade Total:</span>
                <strong className="text-indigo-300 font-mono">{totalWeeklyCapacity.toFixed(1)}h/sem</strong>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT MAIN AREA (LIGHT THEME): CADASTRO & TABELA DE CENTROS              */}
          {/* ========================================================================= */}
          <div className="flex-1 p-4 flex flex-col space-y-3.5 overflow-y-auto bg-slate-50 min-h-0">
            {/* Section 1: Cadastrar Novo Centro de Trabalho */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cadastrar Novo Centro de Trabalho</span>
              </h4>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome do Centro de Trabalho (ex: TORNO CNC MULTITASK)..."
                  value={newWcName}
                  onChange={(e) => setNewWcName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  className="flex-1 text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white font-bold text-slate-900 placeholder:text-slate-400 uppercase transition-colors"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-600">Agrupador:</span>
                  <select
                    value={newWcCategory}
                    onChange={(e) => setNewWcCategory(e.target.value)}
                    className="text-xs font-bold px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 uppercase cursor-pointer"
                  >
                    {sectorGroups.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Centro</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Tabela de Centros de Trabalho */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      Lista de Centros & Parâmetros Operacionais (
                      {selectedGroupFilter === 'ALL'
                        ? `${list.length} centros no total`
                        : `${filteredList.length} em ${selectedGroupFilter}`}
                      )
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Defina horas por dia, dias de jornada semanal, quantidade de postos/recursos e eficiência.
                  </p>
                </div>

                {/* Filter Table by Group */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">Filtrar:</span>
                  <select
                    value={selectedGroupFilter}
                    onChange={(e) => setSelectedGroupFilter(e.target.value)}
                    className="text-xs font-bold px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">Todos os Agrupadores ({list.length})</option>
                    {sectorGroups.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto overflow-y-auto border border-slate-200 rounded-xl flex-1 max-h-[48vh]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Centro de Trabalho</th>
                      <th className="py-2.5 px-2">Agrupador (Setor)</th>
                      <th className="py-2.5 px-2 text-center">Horas/Dia</th>
                      <th className="py-2.5 px-2 text-center">Dias/Semana</th>
                      <th className="py-2.5 px-2 text-center">Nº Recursos</th>
                      <th className="py-2.5 px-2 text-center">Eficiência %</th>
                      <th className="py-2.5 px-2 text-right">Cap. Semanal</th>
                      <th className="py-2.5 px-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredList.map((wc) => {
                      const cap =
                        (wc.dailyHours || 0) *
                        (wc.daysPerWeek || 0) *
                        (wc.resourcesCount || 0) *
                        ((wc.efficiencyPercentage || 0) / 100);

                      const currentCategory = getWorkCenterCategory(wc);

                      return (
                        <tr key={wc.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={wc.name}
                              onChange={(e) => handleUpdate(wc.id, 'name', e.target.value)}
                              className="w-full font-black text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none text-xs uppercase"
                            />
                          </td>

                          <td className="py-2 px-2">
                            <select
                              value={currentCategory}
                              onChange={(e) => handleUpdate(wc.id, 'category', e.target.value)}
                              className="text-xs font-black text-indigo-950 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer uppercase"
                            >
                              {sectorGroups.map((grp) => (
                                <option key={grp} value={grp}>
                                  {grp}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step={0.5}
                              min={1}
                              value={wc.dailyHours === 0 ? '' : wc.dailyHours}
                              onChange={(e) =>
                                handleUpdate(wc.id, 'dailyHours', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
                              }
                              placeholder="0"
                              className={`w-16 text-center text-xs border rounded px-1 py-0.5 transition-colors font-bold ${
                                !wc.dailyHours || wc.dailyHours <= 0
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min={1}
                              max={7}
                              value={wc.daysPerWeek === 0 ? '' : wc.daysPerWeek}
                              onChange={(e) =>
                                handleUpdate(wc.id, 'daysPerWeek', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)
                              }
                              placeholder="0"
                              className={`w-14 text-center text-xs border rounded px-1 py-0.5 transition-colors font-bold ${
                                !wc.daysPerWeek || wc.daysPerWeek <= 0
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min={1}
                              value={wc.resourcesCount === 0 ? '' : wc.resourcesCount}
                              onChange={(e) =>
                                handleUpdate(wc.id, 'resourcesCount', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)
                              }
                              placeholder="0"
                              className={`w-14 text-center text-xs font-black border rounded px-1 py-0.5 transition-colors ${
                                !wc.resourcesCount || wc.resourcesCount <= 0
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step={1}
                              min={1}
                              max={200}
                              value={wc.efficiencyPercentage === 0 ? '' : Math.round(wc.efficiencyPercentage)}
                              onChange={(e) =>
                                handleUpdate(
                                  wc.id,
                                  'efficiencyPercentage',
                                  e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                                )
                              }
                              placeholder="0"
                              className={`w-14 text-center text-xs border rounded px-1 py-0.5 transition-colors font-bold ${
                                !wc.efficiencyPercentage || wc.efficiencyPercentage <= 0
                                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="py-2 px-2 text-right font-black text-indigo-700 font-mono">
                            {cap.toFixed(1)}h
                          </td>

                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => handleDelete(wc.id, e)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Remover Centro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredList.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  Nenhum centro de trabalho cadastrado para o agrupador selecionado.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Total: <strong className="text-slate-900">{list.length} centros</strong> em{' '}
              <strong className="text-slate-900">{sectorGroups.length} agrupadores</strong> | Capacidade Global:{' '}
              <strong className="text-indigo-700 font-mono">{totalWeeklyCapacity.toFixed(1)}h/semana</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
