import { CalendarException } from '../types';

export const DEFAULT_CALENDAR_EXCEPTIONS: CalendarException[] = [];

export function getStandardBrazilianHolidays(year: number): CalendarException[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = (m: number, day: number) => `${year}-${pad(m)}-${pad(day)}`;

  return [
    {
      id: `cal-${year}-01-01`,
      title: 'Confraternização Universal (Ano Novo)',
      type: 'feriado',
      startDate: d(1, 1),
      endDate: d(1, 1),
      impactType: 'full_closure',
      description: 'Feriado Nacional',
      color: '#3b82f6',
    },
    {
      id: `cal-${year}-04-21`,
      title: 'Tiradentes',
      type: 'feriado',
      startDate: d(4, 21),
      endDate: d(4, 21),
      impactType: 'full_closure',
      description: 'Feriado Nacional',
      color: '#3b82f6',
    },
    {
      id: `cal-${year}-05-01`,
      title: 'Dia do Trabalho',
      type: 'feriado',
      startDate: d(5, 1),
      endDate: d(5, 1),
      impactType: 'full_closure',
      description: 'Feriado Nacional',
      color: '#3b82f6',
    },
    {
      id: `cal-${year}-09-07`,
      title: 'Independência do Brasil',
      type: 'feriado',
      startDate: d(9, 7),
      endDate: d(9, 7),
      impactType: 'full_closure',
      description: 'Feriado Nacional',
      color: '#3b82f6',
    },
    {
      id: `cal-${year}-10-12`,
      title: 'Nossa Senhora Aparecida',
      type: 'feriado',
      startDate: d(10, 12),
      endDate: d(10, 12),
      impactType: 'full_closure',
      description: 'Feriado Nacional / Padroeira do Brasil',
      color: '#3b82f6',
    },
    {
      id: `cal-${year}-11-02`,
      title: 'Finados',
      type: 'feriado',
      startDate: d(11, 2),
      endDate: d(11, 2),
      impactType: 'full_closure',
      description: 'Feriado Nacional',
      color: '#3b82f6',
    },
    {
      id: `cal-${year}-11-15`,
      title: 'Proclamação da República',
      type: 'feriado',
      startDate: d(11, 15),
      endDate: d(11, 15),
      impactType: 'full_closure',
      description: 'Feriado Nacional',
      color: '#3b82f6',
    },
    {
      id: `cal-${year}-11-20`,
      title: 'Dia da Consciência Negra',
      type: 'feriado',
      startDate: d(11, 20),
      endDate: d(11, 20),
      impactType: 'full_closure',
      description: 'Feriado Nacional',
      color: '#3b82f6',
    },
    {
      id: `cal-${year}-12-25`,
      title: 'Natal',
      type: 'feriado',
      startDate: d(12, 25),
      endDate: d(12, 25),
      impactType: 'full_closure',
      description: 'Feriado Nacional',
      color: '#3b82f6',
    },
  ];
}
