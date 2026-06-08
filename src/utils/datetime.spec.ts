import { describe, it, expect } from 'vitest';
import { parseUtcDate } from './datetime';

describe('parseUtcDate', () => {
  describe('Given a timezone-less ISO timestamp ("2026-06-03T14:54:00")', () => {
    it('When parsed / Then it is treated as UTC (no IST drift)', () => {
      const result = parseUtcDate('2026-06-03T14:54:00');
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
    });
  });

  describe('Given the space-separated Postgres form ("2026-06-03 14:54:00")', () => {
    it('When parsed / Then it resolves to the same UTC instant', () => {
      const result = parseUtcDate('2026-06-03 14:54:00');
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
    });
  });

  describe('Given a timestamp already carrying a trailing Z', () => {
    it('When parsed / Then it is left unchanged', () => {
      const result = parseUtcDate('2026-06-03T14:54:00Z');
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
    });
  });

  describe('Given a timestamp with an explicit +05:30 offset', () => {
    it('When parsed / Then the offset is honoured and no Z is appended', () => {
      const result = parseUtcDate('2026-06-03T14:54:00+05:30');
      // 14:54 IST == 09:24 UTC
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 9, 24, 0));
    });
  });

  describe('Given an existing Date object', () => {
    it('When parsed / Then the same Date instance is returned as-is', () => {
      const input = new Date('2026-06-03T14:54:00Z');
      const result = parseUtcDate(input);
      expect(result).toBe(input);
    });
  });

  describe('Given a date-only string ("2026-06-03")', () => {
    it('When parsed / Then it resolves to UTC midnight', () => {
      const result = parseUtcDate('2026-06-03');
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 0, 0, 0));
    });
  });
});
