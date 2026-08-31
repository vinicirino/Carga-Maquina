import React, { useState } from 'react';
import { Project, WorkCenter, DEFAULT_SECTOR_GROUPS } from '../types';
import { getWorkCenterCategory } from '../utils/categoryHelper';
import {
  clampDateString,
  clampDateRangeWithinProject,
  sanitizeProjectSchedules,
} from '../utils/dateValidation';
import { X, CalendarRange, Save, FolderTree, ShieldCheck } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { DatePickerField } from './DatePickerField';

interface ProjectEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workCenters: WorkCenter[];
  sectorGroups?: string[];
  onAddProject: (project: Project) => void;
}

export const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({
  isOpen,
  onClose,
  workCenters,
  sectorGroups = DEFAULT_SECTOR_GROUPS,
  onAddProject,
}) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('2027-08-13');
  const [endDate, setEndDate] = useState('2028-09-15');
  const [workCenterHours, setWorkCenterHours] = useState<Record<string, number>>({});
  const [groupDates, setGroupDates] = useState<
    Record<string, { startDate?: string; endDate?: string }>
  >({});
  const [workCenterDates, setWorkCenterDates] = useState<
    Record<string, { startDate?: string; endDate?: string }>
  >({});

  if (!isOpen) return null;

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val && endDate && val > endDate) {
      setEndDate(val);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (val && startDate && val < startDate) {
      setStartDate(val);
    }
  };

  const handleHourChange = (wcName: string, value: number) => {
    setWorkCenterHours((prev) => ({
      ...prev,
      [wcName]: Math.max(0, value),
    }));
  };

  const handleGroupDateChange = (groupName: string, field: 'startDate' | 'endDate', rawValue: string) => {
    let val = rawValue;
    if (val) {
      val = clampDateString(val, startDate, endDate);
    }

    setGroupDates((prev) => {
      const prevData = prev[groupName] || {};
      let start = field === 'startDate' ? val : prevData.startDate;
      let end = field === 'endDate' ? val : prevData.endDate;

      if (start && end && start > end) {
        if (field === 'startDate') end = start;
        else start = end;
      }

      return {
        ...prev,
        [groupName]: {
          startDate: start || undefined,
          endDate: end || undefined,
        },
      };
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const rawProject: Project = {
      id: `proj-${Date.now()}`,
      name: name.trim().toUpperCase(),
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      workCenterHours,
      groupDates,
      workCenterDates,
      color: randomColor,
      enabled: true,
    };

    const sanitized = sanitizeProjectSchedules(rawProject, workCenters);
    onAddProject(sanitized);

    setName('');
    setWorkCenterHours({});
    setGroupDates({});
    setWorkCenterDates({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">Cadastrar Novo Projeto</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nome do Projeto
            </label>
            <input
              type="text"
              placeholder="Ex: PROJETO USINA SANTA CATARINA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <DatePickerField
              label="Data de Início Global"
              value={startDate}
              onChange={(val) => handleStartDateChange(val)}
              required
            />

            <DatePickerField
              label="Data de Término Global"
              min={startDate}
              value={endDate}
              onChange={(val) => handleEndDateChange(val)}
              required
            />
          </div>

          {/* Group Dates Section */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-indigo-600" />
                <span>Cronograma por Agrupadores de Setores (Opcional)</span>
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Limitado a [{startDate} à {endDate}]
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Defina o período de cada agrupador (ex: CORTE, USINAGEM, SOLDA). Todos os centros do grupo herdarão essas datas limitadas pelo projeto.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border border-slate-200 p-3 rounded-xl bg-indigo-50/30">
              {sectorGroups.map((groupName) => {
                const gData = groupDates[groupName];
                return (
                  <div key={groupName} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-1">
                    <span className="font-extrabold text-indigo-950 uppercase block">{groupName}</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <DatePickerField
                        label="Início"
                        size="xs"
                        min={startDate}
                        max={gData?.endDate || endDate}
                        value={gData?.startDate || ''}
                        onChange={(val) => handleGroupDateChange(groupName, 'startDate', val)}
                        placeholder="Início..."
                      />
                      <DatePickerField
                        label="Término"
                        size="xs"
                        min={gData?.startDate || startDate}
                        max={endDate}
                        value={gData?.endDate || ''}
                        onChange={(val) => handleGroupDateChange(groupName, 'endDate', val)}
                        placeholder="Término..."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Work Center Hours Allocation */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Horas Requeridas por Centro de Trabalho
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto border border-slate-200 p-3 rounded-xl bg-slate-50">
              {workCenters
                .filter((wc) => wc.enabled !== false)
                .map((wc) => {
                  const category = getWorkCenterCategory(wc);
                  return (
                    <div
                      key={wc.id}
                      className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between shadow-2xs"
                    >
                      <div className="min-w-0 mr-2">
                        <span
                          className="text-xs font-bold text-slate-800 truncate block"
                          title={wc.name}
                        >
                          {wc.name}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          {category}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <input
                          type="number"
                          placeholder="0"
                          value={workCenterHours[wc.name] || ''}
                          onChange={(e) =>
                            handleHourChange(wc.name, parseFloat(e.target.value) || 0)
                          }
                          className="w-20 text-right text-xs font-bold border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold">h</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Cadastrar Projeto</span>
          </button>
        </div>
      </div>
    </div>
  );
};

