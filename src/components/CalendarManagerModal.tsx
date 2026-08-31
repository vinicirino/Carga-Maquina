import React, { useState } from 'react';
import { CalendarException, CalendarEventType, WorkCenter } from '../types';
import { getStandardBrazilianHolidays } from '../data/defaultCalendar';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  CalendarDays,
  Palmtree,
  Wrench,
  Coffee,
  CheckCircle2,
  Sparkles,
  Save,
  Filter,
  Layers,
  AlertTriangle,
  Factory,
  Search,
  ChevronDown,
  Info,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { DatePickerField } from './DatePickerField';

interface CalendarManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendarExceptions: CalendarException[];
  workCenters: WorkCenter[];
  onSaveCalendarExceptions: (exceptions: CalendarException[]) => void;
}

export const CalendarManagerModal: React.FC<CalendarManagerModalProps> = ({
  isOpen,
  onClose,
  calendarExceptions,
  workCenters,
  onSaveCalendarExceptions,
}) => {
  const [list, setList] = useState<CalendarException[]>(calendarExceptions || []);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedWcFilter, setSelectedWcFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State for Adding / Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<CalendarEventType>('feriado');
  const [formStartDate, setFormStartDate] = useState('2027-09-07');
  const [formEndDate, setFormEndDate] = useState('2027-09-07');
  const [formScope, setFormScope] = useState<'GLOBAL' | 'SPECIFIC'>('GLOBAL');
  const [formSelectedWcIds, setFormSelectedWcIds] = useState<string[]>([]);
  const [formImpactType, setFormImpactType] = useState<'full_closure' | 'capacity_reduction'>('full_closure');
  const [formReductionPct, setFormReductionPct] = useState<number>(50);
  const [formDescription, setFormDescription] = useState('');
  const [formWcSearch, setFormWcSearch] = useState('');

  if (!isOpen) return null;

  // Derive unique years from list for filter
  const yearsSet = new Set<string>();
  list.forEach((ex) => {
    if (ex.startDate && ex.startDate.length >= 4) {
      yearsSet.add(ex.startDate.substring(0, 4));
    }
    if (ex.endDate && ex.endDate.length >= 4) {
      yearsSet.add(ex.endDate.substring(0, 4));
    }
  });
  const years = Array.from(yearsSet).sort();

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormType('feriado');
    setFormStartDate('2027-09-07');
    setFormEndDate('2027-09-07');
    setFormScope('GLOBAL');
    setFormSelectedWcIds([]);
    setFormImpactType('full_closure');
    setFormReductionPct(50);
    setFormDescription('');
    setFormWcSearch('');
  };

  // Start editing existing event
  const handleStartEdit = (ex: CalendarException) => {
    setEditingId(ex.id);
    setFormTitle(ex.title);
    setFormType(ex.type);
    setFormStartDate(ex.startDate);
    setFormEndDate(ex.endDate || ex.startDate);
    if (ex.workCenterIds && ex.workCenterIds.length > 0) {
      setFormScope('SPECIFIC');
      setFormSelectedWcIds([...ex.workCenterIds]);
    } else {
      setFormScope('GLOBAL');
      setFormSelectedWcIds([]);
    }
    setFormImpactType(ex.impactType || 'full_closure');
    setFormReductionPct(ex.capacityReductionPercentage || 50);
    setFormDescription(ex.description || '');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formStartDate) return;

    let start = formStartDate;
    let end = formEndDate || formStartDate;
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const newEx: CalendarException = {
      id: editingId || `cal-${Date.now()}-${formTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      title: formTitle.trim(),
      type: formType,
      startDate: start,
      endDate: end,
      workCenterIds: formScope === 'SPECIFIC' && formSelectedWcIds.length > 0 ? formSelectedWcIds : undefined,
      impactType: formImpactType,
      capacityReductionPercentage: formImpactType === 'capacity_reduction' ? formReductionPct : undefined,
      description: formDescription.trim() || undefined,
      color:
        formType === 'ferias_coletivas'
          ? '#10b981'
          : formType === 'feriado'
          ? '#3b82f6'
          : formType === 'manutencao'
          ? '#f59e0b'
          : '#8b5cf6',
    };

    if (editingId) {
      setList((prev) => prev.map((item) => (item.id === editingId ? newEx : item)));
    } else {
      setList((prev) => [...prev, newEx]);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    setList((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      resetForm();
    }
  };

  const handleToggleWcSelection = (wcId: string) => {
    setFormSelectedWcIds((prev) =>
      prev.includes(wcId) ? prev.filter((id) => id !== wcId) : [...prev, wcId]
    );
  };

  const handleSelectAllWcs = () => {
    setFormSelectedWcIds(workCenters.map((wc) => wc.id));
  };

  const handleClearWcSelection = () => {
    setFormSelectedWcIds([]);
  };

  // Preset Brazilian holidays loader
  const handleLoadStandardHolidays = (year: number) => {
    const holidays = getStandardBrazilianHolidays(year);
    const existingDates = new Set(list.map((ex) => ex.startDate));
    const newItems = holidays.filter((h) => !existingDates.has(h.startDate));

    if (newItems.length > 0) {
      setList((prev) => [...prev, ...newItems]);
    }
  };

  const handleFinalSave = () => {
    onSaveCalendarExceptions(list);
    onClose();
  };

  // Filtered List
  const filteredList = list.filter((ex) => {
    if (selectedTypeFilter !== 'ALL' && ex.type !== selectedTypeFilter) {
      return false;
    }
    if (selectedYearFilter !== 'ALL') {
      const startYear = ex.startDate?.substring(0, 4);
      const endYear = ex.endDate?.substring(0, 4);
      if (startYear !== selectedYearFilter && endYear !== selectedYearFilter) {
        return false;
      }
    }
    if (selectedWcFilter !== 'ALL') {
      if (ex.workCenterIds && ex.workCenterIds.length > 0) {
        if (!ex.workCenterIds.includes(selectedWcFilter)) return false;
      }
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const titleMatch = ex.title.toLowerCase().includes(term);
      const descMatch = (ex.description || '').toLowerCase().includes(term);
      if (!titleMatch && !descMatch) return false;
    }
    return true;
  }).sort((a, b) => (a.startDate > b.startDate ? 1 : -1));

  // Type helper badge
  const getTypeBadge = (type: CalendarEventType) => {
    switch (type) {
      case 'ferias_coletivas':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Palmtree className="w-3 h-3 text-emerald-600" />
            <span>Férias Coletivas</span>
          </span>
        );
      case 'feriado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
            <CalendarDays className="w-3 h-3 text-blue-600" />
            <span>Feriado</span>
          </span>
        );
      case 'manutencao':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
            <Wrench className="w-3 h-3 text-amber-600" />
            <span>Manutenção Programada</span>
          </span>
        );
      case 'folga_parada':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
            <Coffee className="w-3 h-3 text-purple-600" />
            <span>Folga / Ponte</span>
          </span>
        );
    }
  };

  const feriadosCount = list.filter((i) => i.type === 'feriado').length;
  const feriasCount = list.filter((i) => i.type === 'ferias_coletivas').length;
  const manutencaoCount = list.filter((i) => i.type === 'manutencao').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-7xl 2xl:max-w-[96vw] overflow-hidden flex flex-col h-[94vh] max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black shadow-xs">
              <Palmtree className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                Calendário Fabril: Férias, Feriados & Paradas
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase">
                  Capacidade & Recursos
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Cadastre feriados nacionais/municipais, períodos de férias coletivas e paradas de manutenção vinculadas a todos os centros ou a centros específicos.
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

        {/* Modal Body: Left Form + Right List */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* ========================================================================= */}
          {/* LEFT SIDEBAR: CADASTRO / EDIÇÃO DE EVENTO NO CALENDÁRIO                  */}
          {/* ========================================================================= */}
          <div className="w-full lg:w-[420px] bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 flex flex-col justify-between overflow-y-auto shrink-0 text-white">
            <form onSubmit={handleSaveForm} className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>{editingId ? 'Editar Evento' : 'Novo Evento de Calendário'}</span>
                </span>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>

              {/* Título */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Título do Evento / Motivo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Férias Coletivas Fim de Ano, 07/09 Independência..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              {/* Tipo de Evento */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tipo de Evento *
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { type: 'feriado', label: 'Feriado', icon: CalendarDays, color: 'text-blue-400' },
                    { type: 'ferias_coletivas', label: 'Férias Coletivas', icon: Palmtree, color: 'text-emerald-400' },
                    { type: 'manutencao', label: 'Manutenção', icon: Wrench, color: 'text-amber-400' },
                    { type: 'folga_parada', label: 'Folga / Ponte', icon: Coffee, color: 'text-purple-400' },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSel = formType === t.type;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setFormType(t.type as CalendarEventType)}
                        className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSel
                            ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${t.color} shrink-0`} />
                        <span className="text-[11px] truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Datas: Início e Fim */}
              <div className="grid grid-cols-2 gap-2">
                <DatePickerField
                  label="Data Início *"
                  theme="dark"
                  size="sm"
                  required
                  value={formStartDate}
                  onChange={(val) => {
                    setFormStartDate(val);
                    if (formEndDate < val) {
                      setFormEndDate(val);
                    }
                  }}
                />
                <DatePickerField
                  label="Data Fim *"
                  theme="dark"
                  size="sm"
                  min={formStartDate}
                  required
                  value={formEndDate}
                  onChange={(val) => setFormEndDate(val)}
                />
              </div>

              {/* Scope: Global vs Specific Work Centers */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Abrangência nos Centros de Trabalho *
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormScope('GLOBAL')}
                    className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                      formScope === 'GLOBAL'
                        ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                    <span className="text-[11px]">Toda a Fábrica (Global)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormScope('SPECIFIC')}
                    className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                      formScope === 'SPECIFIC'
                        ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Factory className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                    <span className="text-[11px]">Centros Específicos</span>
                  </button>
                </div>

                {/* Specific Work Centers Selection Multi-box */}
                {formScope === 'SPECIFIC' && (
                  <div className="mt-2 bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Selecionados ({formSelectedWcIds.length} de {workCenters.length})
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={handleSelectAllWcs}
                          className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Marcar Todos
                        </button>
                        <button
                          type="button"
                          onClick={handleClearWcSelection}
                          className="text-slate-400 hover:text-slate-300 underline cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Buscar centro de trabalho..."
                      value={formWcSearch}
                      onChange={(e) => setFormWcSearch(e.target.value)}
                      className="w-full text-xs px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none"
                    />

                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-lg pr-1">
                      {workCenters
                        .filter((wc) =>
                          formWcSearch.trim()
                            ? wc.name.toLowerCase().includes(formWcSearch.toLowerCase())
                            : true
                        )
                        .map((wc) => {
                          const isChecked = formSelectedWcIds.includes(wc.id);
                          return (
                            <label
                              key={wc.id}
                              className="flex items-center gap-2 p-1.5 hover:bg-slate-900/80 cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleWcSelection(wc.id)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-900"
                              />
                              <span className={`font-mono text-[11px] truncate uppercase ${isChecked ? 'text-emerald-300 font-bold' : 'text-slate-300'}`}>
                                {wc.name}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Impact on Capacity */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Impacto na Capacidade Operacional
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormImpactType('full_closure')}
                    className={`p-2 rounded-lg border text-left text-[11px] transition-all cursor-pointer ${
                      formImpactType === 'full_closure'
                        ? 'bg-rose-950/60 border-rose-500 text-rose-200 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>Parada Total (0% Cap.)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormImpactType('capacity_reduction')}
                    className={`p-2 rounded-lg border text-left text-[11px] transition-all cursor-pointer ${
                      formImpactType === 'capacity_reduction'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>Redução Parcial (%)</span>
                  </button>
                </div>

                {formImpactType === 'capacity_reduction' && (
                  <div className="mt-2 flex items-center gap-2 bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-300 font-semibold">Redução de Capacidade:</span>
                    <input
                      type="number"
                      min={10}
                      max={90}
                      step={5}
                      value={formReductionPct}
                      onChange={(e) => setFormReductionPct(Number(e.target.value) || 50)}
                      className="w-16 text-center text-xs font-black bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-400"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ponto facultativo, manutenção preventiva anual..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{editingId ? 'Atualizar Evento no Calendário' : 'Adicionar ao Calendário'}</span>
              </button>
            </form>

            {/* Quick preset buttons */}
            <div className="pt-3 border-t border-slate-800 space-y-1.5 text-[10px]">
              <span className="font-bold text-slate-400 uppercase tracking-wider block">
                Carregar Feriados Padrão Brasileiros:
              </span>
              <div className="flex gap-1.5">
                {[2027, 2028, 2029].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => handleLoadStandardHolidays(yr)}
                    className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                    title={`Adicionar feriados nacionais de ${yr}`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>+ Feriados {yr}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT CONTENT: LISTA DE EVENTOS E VISUALIZAÇÃO                           */}
          {/* ========================================================================= */}
          <div className="flex-1 p-4 flex flex-col space-y-3.5 overflow-y-auto bg-slate-50 min-h-0">
            {/* Top Stats & Filters Bar */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Eventos Cadastrados ({filteredList.length} de {list.length}):
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                    {feriadosCount} Feriados
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {feriasCount} Férias Coletivas
                  </span>
                  {manutencaoCount > 0 && (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                      {manutencaoCount} Manutenções
                    </span>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Type Filter */}
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todos os Tipos</option>
                  <option value="feriado">Feriados</option>
                  <option value="ferias_coletivas">Férias Coletivas</option>
                  <option value="manutencao">Manutenções</option>
                  <option value="folga_parada">Folgas / Pontes</option>
                </select>

                {/* Year Filter */}
                {years.length > 0 && (
                  <select
                    value={selectedYearFilter}
                    onChange={(e) => setSelectedYearFilter(e.target.value)}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Todos os Anos</option>
                    {years.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                )}

                {/* Work Center Filter */}
                <select
                  value={selectedWcFilter}
                  onChange={(e) => setSelectedWcFilter(e.target.value)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none cursor-pointer max-w-[150px] truncate"
                >
                  <option value="ALL">Todos os Centros</option>
                  {workCenters.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Event Table Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex-1 overflow-x-auto overflow-y-auto max-h-[56vh]">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-32">Tipo</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Título / Motivo</th>
                    <th className="py-2.5 px-3 w-40">Período</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Centros Afetados</th>
                    <th className="py-2.5 px-3 w-28 text-center">Impacto</th>
                    <th className="py-2.5 px-3 w-20 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredList.map((ex) => {
                    const isMultiDay = ex.startDate !== ex.endDate && ex.endDate;
                    let daysDuration = 1;
                    if (isMultiDay) {
                      try {
                        daysDuration =
                          differenceInCalendarDays(parseISO(ex.endDate), parseISO(ex.startDate)) + 1;
                      } catch (err) {
                        daysDuration = 1;
                      }
                    }

                    const isSpecific = ex.workCenterIds && ex.workCenterIds.length > 0;
                    const affectedWcNames = isSpecific
                      ? workCenters
                          .filter((w) => ex.workCenterIds?.includes(w.id))
                          .map((w) => w.name)
                      : [];

                    return (
                      <tr
                        key={ex.id}
                        className={`hover:bg-indigo-50/40 transition-colors ${
                          editingId === ex.id ? 'bg-amber-50/80 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">{getTypeBadge(ex.type)}</td>

                        <td className="py-2.5 px-3">
                          <div className="font-black text-slate-900">{ex.title}</div>
                          {ex.description && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5">
                              {ex.description}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="font-mono text-slate-800 font-bold">
                            {format(parseISO(ex.startDate), 'dd/MM/yyyy')}
                            {isMultiDay && ` até ${format(parseISO(ex.endDate), 'dd/MM/yyyy')}`}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold">
                            {daysDuration} {daysDuration === 1 ? 'dia' : 'dias'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          {!isSpecific ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200">
                              <Layers className="w-3 h-3 text-indigo-500" />
                              <span>Fábrica Toda (Global)</span>
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-900 rounded text-[10px] font-bold">
                                <Factory className="w-3 h-3 text-indigo-600" />
                                <span>{affectedWcNames.length} centros</span>
                              </span>
                              {affectedWcNames.slice(0, 2).map((name) => (
                                <span
                                  key={name}
                                  className="text-[9px] bg-slate-100 text-slate-700 px-1 py-0.5 rounded uppercase font-mono truncate max-w-[100px]"
                                  title={name}
                                >
                                  {name}
                                </span>
                              ))}
                              {affectedWcNames.length > 2 && (
                                <span className="text-[9px] text-slate-400 font-bold">
                                  +{affectedWcNames.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {ex.impactType === 'full_closure' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                              Parada 100%
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                              -{ex.capacityReductionPercentage || 50}%
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(ex)}
                              className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="Editar evento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(ex.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Excluir evento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredList.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs italic">
                  Nenhum evento de calendário encontrado para os filtros selecionados.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Total: <strong className="text-slate-900">{list.length} eventos configurados</strong> no cenário ativo. A capacidade semanal dos centros de trabalho é recalculada automaticamente durante os períodos de folga/férias.
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
              onClick={handleFinalSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Calendário no Cenário</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
