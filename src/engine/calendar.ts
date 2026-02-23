import type { CalendarDate, Season } from './types.ts';
import { DAYS_PER_YEAR, MAX_YEARS } from './types.ts';

/** Month boundaries: day-of-year where each month starts (1-indexed months). */
const MONTH_START_DAYS: readonly number[] = [
  0,   // placeholder for index 0
  1,   // Jan 1
  32,  // Feb 1
  60,  // Mar 1
  91,  // Apr 1
  121, // May 1
  152, // Jun 1
  182, // Jul 1
  213, // Aug 1
  244, // Sep 1
  274, // Oct 1
  305, // Nov 1
  335, // Dec 1
];

const SEASON_MAP: Record<number, Season> = {
  1: 'winter', 2: 'winter',
  3: 'spring', 4: 'spring', 5: 'spring',
  6: 'summer', 7: 'summer', 8: 'summer',
  9: 'fall', 10: 'fall', 11: 'fall',
  12: 'winter',
};

export function totalDayToCalendar(totalDay: number): CalendarDate {
  const year = Math.floor(totalDay / DAYS_PER_YEAR) + 1;
  const day = (totalDay % DAYS_PER_YEAR) + 1; // 1-365

  let month = 12;
  for (let m = 12; m >= 1; m--) {
    if (day >= MONTH_START_DAYS[m]) {
      month = m;
      break;
    }
  }

  const season = SEASON_MAP[month];

  return { day, month, season, year, totalDay };
}

export function isGameOver(totalDay: number): boolean {
  return totalDay >= MAX_YEARS * DAYS_PER_YEAR;
}

export function isYearEnd(totalDay: number): boolean {
  return (totalDay + 1) % DAYS_PER_YEAR === 0;
}

export function isSeasonChange(prevTotalDay: number, currentTotalDay: number): boolean {
  const prev = totalDayToCalendar(prevTotalDay);
  const curr = totalDayToCalendar(currentTotalDay);
  return prev.season !== curr.season;
}

export function getSeasonName(season: Season): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

export function getMonthName(month: number): string {
  const names = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return names[month] ?? '';
}

export function isInPlantingWindow(currentMonth: number, startMonth: number, endMonth: number): boolean {
  if (startMonth <= endMonth) {
    return currentMonth >= startMonth && currentMonth <= endMonth;
  }
  // Window wraps around year end (e.g., Oct–Nov is straightforward, but Oct–Feb would wrap)
  return currentMonth >= startMonth || currentMonth <= endMonth;
}
