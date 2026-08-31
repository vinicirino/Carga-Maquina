import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Palmtree,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  setYear,
  setMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarException } from '../types';

interface DatePickerFieldProps {
  id?: string;
  value: string; // 'yyyy-MM-dd' or empty
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  calendarExceptions?: CalendarException[];
  size?: 'sm' | 'md' | 'xs';
  theme?: 'light' | 'dark';
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  id,
  value,
  onChange,
  label,
  placeholder = 'Selecione uma data...',
  min,
  max,
  disabled = false,
  required = false,
  className = '',
  calendarExceptions = [],
  size = 'md',
  theme = 'light',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parsed current selected date
  const parsedValue = value ? parseISO(value) : null;
  const validValue = parsedValue && isValid(parsedValue) ? parsedValue : null;

  // Currently viewed month in the calendar view
  const [currentViewDate, setCurrentViewDate] = useState<Date>(() => {
    return validValue || new Date();
  });

  // Keep view date synced when external value changes
  useEffect(() => {
    if (validValue) {
      setCurrentViewDate(validValue);
    }
  }, [value]);

  // Close calendar popover on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Navigate months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentViewDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentViewDate((prev) => addMonths(prev, 1));
  };

  // Quick year & month change
  const handleMonthSelect = (mIndex: number) => {
    setCurrentViewDate((prev) => setMonth(prev, mIndex));
  };

  const handleYearSelect = (yNum: number) => {
    setCurrentViewDate((prev) => setYear(prev, yNum));
  };

  // Generate days grid for current view month (Monday start)
  const monthStart = startOfMonth(currentViewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays: Date[] = [];
  let dayCursor = startDate;
  while (dayCursor <= endDate) {
    calendarDays.push(dayCursor);
    dayCursor = addDays(dayCursor, 1);
  }

  // Min / Max constraints
  const minDate = min ? parseISO(min) : null;
  const maxDate = max ? parseISO(max) : null;

  const isDayDisabled = (day: Date): boolean => {
    const dayStr = format(day, 'yyyy-MM-dd');
    if (min && dayStr < min) return true;
    if (max && dayStr > max) return true;
    return false;
  };

  // Check if a day has holiday or collective vacation
  const getDayException = (day: Date): CalendarException | undefined => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return calendarExceptions.find((ex) => {
      if (!ex.startDate || !ex.endDate) return false;
      return dayStr >= ex.startDate && dayStr <= ex.endDate;
    });
  };

  const handleSelectDay = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDayDisabled(day)) return;

    const formatted = format(day, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    if (isDayDisabled(today)) return;
    const formatted = format(today, 'yyyy-MM-dd');
    onChange(formatted);
    setCurrentViewDate(today);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Formatted display text
  const displayFormatted = validValue
    ? format(validValue, 'dd/MM/yyyy')
    : '';

  const activeExceptionForSelected = validValue ? getDayException(validValue) : undefined;

  // Year list for dropdown (current view year - 5 to + 10)
  const currentYear = currentViewDate.getFullYear();
  const yearOptions: number[] = [];
  for (let y = currentYear - 5; y <= currentYear + 10; y++) {
    yearOptions.push(y);
  }

  // Theme & Size classes
  const isDark = theme === 'dark';
  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-1 text-[11px] h-7'
      : size === 'sm'
      ? 'px-2.5 py-1.5 text-xs h-8'
      : 'px-3 py-2 text-xs h-9';

  return (
    <div className={`relative ${className}`} ref={containerRef} id={id ? `${id}-container` : undefined}>
      {label && (
        <label className={`block font-bold uppercase tracking-wider mb-1 ${
          size === 'xs' ? 'text-[9px]' : 'text-[10px]'
        } ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Main Trigger Button styled like a high-end calendar input */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-lg border transition-all cursor-pointer select-none font-semibold ${sizeClasses} ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-300 text-slate-400'
            : isDark
            ? isOpen
              ? 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20 text-white'
              : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-200'
            : isOpen
            ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 text-slate-900 shadow-sm'
            : 'bg-white border-slate-300 hover:border-slate-400 text-slate-800 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <CalendarIcon
            className={`shrink-0 ${
              size === 'xs' ? 'w-3 h-3' : 'w-4 h-4'
            } ${
              isDark
                ? isOpen ? 'text-emerald-400' : 'text-slate-400'
                : isOpen ? 'text-indigo-600' : 'text-slate-500'
            }`}
          />
          {displayFormatted ? (
            <span className="font-mono font-bold tracking-tight">
              {displayFormatted}
            </span>
          ) : (
            <span className={isDark ? 'text-slate-500 font-normal italic' : 'text-slate-400 font-normal italic'}>
              {placeholder}
            </span>
          )}

          {/* If the chosen date is a holiday/vacation, show a small badge */}
          {activeExceptionForSelected && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                activeExceptionForSelected.type === 'ferias_coletivas'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
              title={activeExceptionForSelected.title}
            >
              {activeExceptionForSelected.type === 'ferias_coletivas' ? '🏖️ Férias' : '🎉 Feriado'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {validValue && !disabled && !required && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-rose-500 rounded transition-colors"
              title="Limpar data"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>▼</span>
        </div>
      </div>

      {/* Hidden native input for seamless form compatibility */}
      <input
        type="hidden"
        name={id}
        value={value || ''}
        required={required}
      />

      {/* ========================================================================= */}
      {/* FLOATING CALENDAR POPOVER                                                 */}
      {/* ========================================================================= */}
      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-1.5 z-50 w-72 p-3 rounded-xl border shadow-2xl animate-in fade-in zoom-in-95 duration-100 ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-white'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
          style={{ minWidth: '280px' }}
        >
          {/* Header Month / Year Navigation */}
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Quick selectors for Month & Year */}
            <div className="flex items-center gap-1">
              <select
                value={currentViewDate.getMonth()}
                onChange={(e) => handleMonthSelect(Number(e.target.value))}
                className={`text-xs font-bold py-1 px-1.5 rounded-md border cursor-pointer focus:outline-none ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={currentViewDate.getFullYear()}
                onChange={(e) => handleYearSelect(Number(e.target.value))}
                className={`text-xs font-bold py-1 px-1.5 rounded-md border cursor-pointer focus:outline-none ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((w, idx) => (
              <span
                key={w}
                className={`text-[10px] font-bold py-0.5 ${
                  idx >= 5
                    ? 'text-rose-500 dark:text-rose-400'
                    : isDark
                    ? 'text-slate-400'
                    : 'text-slate-500'
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          {/* Calendar Days Matrix */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isSelected = validValue && isSameDay(day, validValue);
              const isCurrMonth = isSameMonth(day, currentViewDate);
              const disabledDay = isDayDisabled(day);
              const isTodayDate = isToday(day);
              const exception = getDayException(day);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              let btnClasses = '';
              if (isSelected) {
                btnClasses = isDark
                  ? 'bg-emerald-600 text-white font-black shadow-md ring-2 ring-emerald-400'
                  : 'bg-indigo-600 text-white font-black shadow-md ring-2 ring-indigo-400';
              } else if (disabledDay) {
                btnClasses = isDark
                  ? 'text-slate-600 cursor-not-allowed opacity-30'
                  : 'text-slate-300 cursor-not-allowed opacity-40';
              } else if (!isCurrMonth) {
                btnClasses = isDark
                  ? 'text-slate-600 hover:bg-slate-800/50'
                  : 'text-slate-300 hover:bg-slate-50';
              } else if (exception) {
                btnClasses =
                  exception.type === 'ferias_coletivas'
                    ? isDark
                      ? 'bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-600/40 hover:bg-emerald-900/80'
                      : 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 hover:bg-emerald-100'
                    : isDark
                    ? 'bg-blue-950/60 text-blue-300 font-bold border border-blue-600/40 hover:bg-blue-900/80'
                    : 'bg-blue-50 text-blue-800 font-bold border border-blue-300 hover:bg-blue-100';
              } else if (isWeekend) {
                btnClasses = isDark
                  ? 'text-slate-400 hover:bg-slate-800/80'
                  : 'text-slate-500 hover:bg-slate-100';
              } else {
                btnClasses = isDark
                  ? 'text-slate-200 hover:bg-slate-800 font-medium'
                  : 'text-slate-800 hover:bg-indigo-50 hover:text-indigo-900 font-medium';
              }

              return (
                <button
                  key={dayStr}
                  type="button"
                  disabled={disabledDay}
                  onClick={(e) => handleSelectDay(day, e)}
                  title={exception ? `${exception.title} (${format(day, 'dd/MM')})` : undefined}
                  className={`relative h-7 w-full rounded-md text-xs transition-all flex items-center justify-center cursor-pointer ${btnClasses} ${
                    isTodayDate && !isSelected ? 'border border-amber-400 font-bold' : ''
                  }`}
                >
                  <span>{format(day, 'd')}</span>

                  {/* Holiday / Vacation Dot Indicator */}
                  {exception && !isSelected && (
                    <span
                      className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                        exception.type === 'ferias_coletivas'
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Footer Action Bar */}
          <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[10px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className={`font-bold px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                isDark ? 'text-amber-400 hover:bg-slate-800' : 'text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Hoje ({format(new Date(), 'dd/MM')})</span>
            </button>

            {calendarExceptions.length > 0 && (
              <div className="flex items-center gap-2 text-[9px] text-slate-400">
                <span className="inline-flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Férias
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Feriado
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
