import { describe, it, expect } from 'vitest';
import { totalDayToCalendar, isGameOver, isYearEnd, isSeasonChange, isInPlantingWindow } from '../../src/engine/calendar.ts';

describe('Calendar', () => {
  describe('totalDayToCalendar', () => {
    it('day 0 is January 1, Year 1, winter', () => {
      const cal = totalDayToCalendar(0);
      expect(cal.day).toBe(1);
      expect(cal.month).toBe(1);
      expect(cal.season).toBe('winter');
      expect(cal.year).toBe(1);
      expect(cal.totalDay).toBe(0);
    });

    it('day 59 is March 1, Year 1, spring', () => {
      const cal = totalDayToCalendar(59); // 0-indexed: 31 (Jan) + 28 (Feb) = 59
      expect(cal.day).toBe(60); // 1-indexed day-of-year
      expect(cal.month).toBe(3);
      expect(cal.season).toBe('spring');
    });

    it('day 151 is June 1, Year 1, summer', () => {
      const cal = totalDayToCalendar(151);
      expect(cal.month).toBe(6);
      expect(cal.season).toBe('summer');
    });

    it('day 243 is September 1, Year 1, fall', () => {
      const cal = totalDayToCalendar(243);
      expect(cal.month).toBe(9);
      expect(cal.season).toBe('fall');
    });

    it('day 334 is December 1, Year 1, winter', () => {
      const cal = totalDayToCalendar(334);
      expect(cal.month).toBe(12);
      expect(cal.season).toBe('winter');
    });

    it('day 364 is December 31, Year 1', () => {
      const cal = totalDayToCalendar(364);
      expect(cal.day).toBe(365);
      expect(cal.month).toBe(12);
      expect(cal.year).toBe(1);
    });

    it('day 365 is January 1, Year 2', () => {
      const cal = totalDayToCalendar(365);
      expect(cal.day).toBe(1);
      expect(cal.month).toBe(1);
      expect(cal.year).toBe(2);
    });

    it('end of Year 30 is day 10949', () => {
      const cal = totalDayToCalendar(10949);
      expect(cal.year).toBe(30);
      expect(cal.day).toBe(365);
    });
  });

  describe('isGameOver', () => {
    it('returns false for day 10949 (last day of Year 30)', () => {
      expect(isGameOver(10949)).toBe(false);
    });

    it('returns true for day 10950 (past Year 30)', () => {
      expect(isGameOver(10950)).toBe(true);
    });

    it('returns false for day 0', () => {
      expect(isGameOver(0)).toBe(false);
    });
  });

  describe('isYearEnd', () => {
    it('day 364 is end of Year 1', () => {
      expect(isYearEnd(364)).toBe(true);
    });

    it('day 363 is not end of year', () => {
      expect(isYearEnd(363)).toBe(false);
    });

    it('day 729 is end of Year 2', () => {
      expect(isYearEnd(729)).toBe(true);
    });
  });

  describe('isSeasonChange', () => {
    it('detects winter → spring boundary', () => {
      // Feb 28 (day 59, 0-indexed 58) → Mar 1 (day 60, 0-indexed 59)
      expect(isSeasonChange(58, 59)).toBe(true);
    });

    it('no change within same season', () => {
      expect(isSeasonChange(60, 61)).toBe(false);
    });
  });

  describe('isInPlantingWindow', () => {
    it('March is in March–May window', () => {
      expect(isInPlantingWindow(3, 3, 5)).toBe(true);
    });

    it('June is not in March–May window', () => {
      expect(isInPlantingWindow(6, 3, 5)).toBe(false);
    });

    it('October is in October–November window', () => {
      expect(isInPlantingWindow(10, 10, 11)).toBe(true);
    });

    it('September is not in October–November window', () => {
      expect(isInPlantingWindow(9, 10, 11)).toBe(false);
    });
  });
});
