import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseNaturalDate, formatDateRange } from '../dates';

describe('Natural Date Parser', () => {
  // Mock current date to January 15, 2026 for consistent tests
  // Use explicit year/month/day to avoid UTC parsing issues
  const mockDate = new Date(2026, 0, 15, 12, 0, 0); // Jan 15, 2026 at noon local time

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Relative dates', () => {
    it('parses "tomorrow"', () => {
      const result = parseNaturalDate('tomorrow');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-16');
      expect(result.endDate).toBe('2026-01-22'); // 7-day default
    });

    it('parses "today"', () => {
      const result = parseNaturalDate('today');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-15');
      expect(result.endDate).toBe('2026-01-21');
    });

    it('parses "next week"', () => {
      const result = parseNaturalDate('next week');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-19'); // Monday
      expect(result.endDate).toBe('2026-01-25'); // Sunday
    });

    it('parses "this weekend"', () => {
      const result = parseNaturalDate('this weekend');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-17'); // Saturday
      expect(result.endDate).toBe('2026-01-18'); // Sunday
    });

    it('parses "in 3 days"', () => {
      const result = parseNaturalDate('in 3 days');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-18');
      expect(result.endDate).toBe('2026-01-24');
    });

    it('parses "5 days from now"', () => {
      const result = parseNaturalDate('5 days from now');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-20');
    });
  });

  describe('Date ranges', () => {
    it('parses "January 20-27"', () => {
      const result = parseNaturalDate('January 20-27');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-20');
      expect(result.endDate).toBe('2026-01-27');
    });

    it('parses "Jan 20 to Jan 27"', () => {
      const result = parseNaturalDate('Jan 20 to Jan 27');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-20');
      expect(result.endDate).toBe('2026-01-27');
    });

    it('parses "1/20 - 1/27"', () => {
      const result = parseNaturalDate('1/20 - 1/27');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-20');
      expect(result.endDate).toBe('2026-01-27');
    });

    it('parses "February 1 for 7 days"', () => {
      const result = parseNaturalDate('February 1 for 7 days');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-02-01');
      expect(result.endDate).toBe('2026-02-07');
    });
  });

  describe('Single dates', () => {
    it('parses "January 20"', () => {
      const result = parseNaturalDate('January 20');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-01-20');
      expect(result.endDate).toBe('2026-01-26'); // 7-day default
    });

    it('parses "Feb 1st"', () => {
      const result = parseNaturalDate('Feb 1st');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-02-01');
    });

    it('parses "2/15"', () => {
      const result = parseNaturalDate('2/15');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-02-15');
    });
  });

  describe('ISO format', () => {
    it('parses "2026-02-01"', () => {
      const result = parseNaturalDate('2026-02-01');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-02-01');
      expect(result.endDate).toBe('2026-02-07');
    });

    it('parses "2026-02-01 to 2026-02-15"', () => {
      const result = parseNaturalDate('2026-02-01 to 2026-02-15');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-02-01');
      expect(result.endDate).toBe('2026-02-15');
    });
  });

  describe('Past date handling', () => {
    it('rejects dates in the past', () => {
      const result = parseNaturalDate('2026-01-10');
      expect(result.success).toBe(false);
      expect(result.error).toContain('past');
    });

    it('rolls over year for past month dates', () => {
      // If we're in January 2026, "December 20" should be 2026-12-20
      const result = parseNaturalDate('December 20');
      expect(result.success).toBe(true);
      expect(result.startDate).toBe('2026-12-20');
    });
  });

  describe('Invalid inputs', () => {
    it('returns error for gibberish', () => {
      const result = parseNaturalDate('asdfasdf');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error for empty string', () => {
      const result = parseNaturalDate('');
      expect(result.success).toBe(false);
    });
  });
});

describe('formatDateRange', () => {
  it('formats date range correctly', () => {
    const result = formatDateRange('2026-01-20', '2026-01-27');
    expect(result).toBe('Jan 20 - Jan 27, 2026');
  });
});
