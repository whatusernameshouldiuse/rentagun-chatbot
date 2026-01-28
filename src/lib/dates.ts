/**
 * Natural Language Date Parser
 * Parses human-friendly date expressions into start/end date pairs
 */

import {
  addDays,
  addWeeks,
  startOfWeek,
  endOfWeek,
  nextSaturday,
  nextSunday,
  parse,
  format,
  isValid,
  isBefore,
  startOfDay,
} from 'date-fns';

export interface DateParseResult {
  success: boolean;
  startDate?: string;
  endDate?: string;
  error?: string;
}

/**
 * Parse natural language date expression
 * Supports:
 * - "tomorrow" / "today"
 * - "next week" / "this week"
 * - "this weekend" / "next weekend"
 * - "in X days" / "X days from now"
 * - "January 20" / "Jan 20" / "1/20"
 * - "January 20-27" / "Jan 20 to Jan 27"
 * - "January 20 for 7 days"
 * - "2026-01-20" (ISO format)
 */
export function parseNaturalDate(input: string): DateParseResult {
  const normalized = input.toLowerCase().trim();
  const today = startOfDay(new Date());

  // Check for past dates flag
  const validateNotPast = (date: Date): DateParseResult | null => {
    if (isBefore(date, today)) {
      return {
        success: false,
        error: "That date is in the past. Please choose a future date.",
      };
    }
    return null;
  };

  // Today
  if (normalized === 'today') {
    return {
      success: true,
      startDate: formatDate(today),
      endDate: formatDate(addDays(today, 6)), // 7-day default
    };
  }

  // Tomorrow
  if (normalized === 'tomorrow') {
    const start = addDays(today, 1);
    return {
      success: true,
      startDate: formatDate(start),
      endDate: formatDate(addDays(start, 6)),
    };
  }

  // This week
  if (normalized === 'this week') {
    const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
    const actualStart = isBefore(start, today) ? today : start;
    return {
      success: true,
      startDate: formatDate(actualStart),
      endDate: formatDate(end),
    };
  }

  // Next week
  if (normalized === 'next week') {
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
    return {
      success: true,
      startDate: formatDate(nextWeekStart),
      endDate: formatDate(nextWeekEnd),
    };
  }

  // This weekend
  if (normalized === 'this weekend') {
    const saturday = nextSaturday(today);
    const sunday = nextSunday(today);
    return {
      success: true,
      startDate: formatDate(saturday),
      endDate: formatDate(sunday),
    };
  }

  // Next weekend
  if (normalized === 'next weekend') {
    const saturday = nextSaturday(addWeeks(today, 1));
    const sunday = addDays(saturday, 1);
    return {
      success: true,
      startDate: formatDate(saturday),
      endDate: formatDate(sunday),
    };
  }

  // "in X days" or "X days from now"
  const inDaysMatch = normalized.match(/in\s+(\d+)\s+days?/);
  const daysFromNowMatch = normalized.match(/(\d+)\s+days?\s+from\s+now/);
  const daysMatch = inDaysMatch || daysFromNowMatch;

  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const start = addDays(today, days);
    return {
      success: true,
      startDate: formatDate(start),
      endDate: formatDate(addDays(start, 6)),
    };
  }

  // Date range: "January 20-27" or "Jan 20 to Jan 27" or "1/20 - 1/27"
  const rangePatterns = [
    // "January 20-27" or "January 20 - 27"
    /^([a-z]+)\s+(\d{1,2})\s*[-–to]+\s*(\d{1,2})$/,
    // "Jan 20 to Jan 27" or "January 20 to January 27"
    /^([a-z]+)\s+(\d{1,2})\s*(?:to|-)\s*([a-z]+)\s+(\d{1,2})$/,
    // "1/20 - 1/27" or "1/20-1/27"
    /^(\d{1,2})\/(\d{1,2})\s*[-–to]+\s*(\d{1,2})\/(\d{1,2})$/,
  ];

  for (const pattern of rangePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      try {
        let startDate: Date;
        let endDate: Date;

        if (pattern === rangePatterns[0]) {
          // "January 20-27"
          const month = match[1];
          const startDay = match[2];
          const endDay = match[3];
          const year = new Date().getFullYear();

          startDate = parseMonthDay(month, startDay, year);
          endDate = parseMonthDay(month, endDay, year);
        } else if (pattern === rangePatterns[1]) {
          // "Jan 20 to Jan 27"
          const startMonth = match[1];
          const startDay = match[2];
          const endMonth = match[3];
          const endDay = match[4];
          const year = new Date().getFullYear();

          startDate = parseMonthDay(startMonth, startDay, year);
          endDate = parseMonthDay(endMonth, endDay, year);
        } else {
          // "1/20 - 1/27"
          const startMonth = match[1];
          const startDay = match[2];
          const endMonth = match[3];
          const endDay = match[4];
          const year = new Date().getFullYear();

          startDate = new Date(year, parseInt(startMonth) - 1, parseInt(startDay));
          endDate = new Date(year, parseInt(endMonth) - 1, parseInt(endDay));
        }

        if (!isValid(startDate) || !isValid(endDate)) {
          continue;
        }

        // Handle year rollover
        if (isBefore(startDate, today)) {
          startDate = addYearIfPast(startDate, today);
          endDate = addYearIfPast(endDate, today);
        }

        const pastCheck = validateNotPast(startDate);
        if (pastCheck) return pastCheck;

        return {
          success: true,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        };
      } catch {
        continue;
      }
    }
  }

  // Single date with duration: "January 20 for 7 days"
  const durationMatch = normalized.match(
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+for\s+(\d+)\s+days?$/
  );
  if (durationMatch) {
    try {
      const month = durationMatch[1];
      const day = durationMatch[2];
      const duration = parseInt(durationMatch[3], 10);
      const year = new Date().getFullYear();

      let startDate = parseMonthDay(month, day, year);
      if (isBefore(startDate, today)) {
        startDate = addYearIfPast(startDate, today);
      }

      const pastCheck = validateNotPast(startDate);
      if (pastCheck) return pastCheck;

      return {
        success: true,
        startDate: formatDate(startDate),
        endDate: formatDate(addDays(startDate, duration - 1)),
      };
    } catch {
      // Fall through
    }
  }

  // Single date: "January 20" or "Jan 20" or "1/20"
  const singleDatePatterns = [
    // "January 20" or "Jan 20"
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/,
    // "1/20" or "01/20"
    /^(\d{1,2})\/(\d{1,2})$/,
  ];

  for (const pattern of singleDatePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      try {
        let startDate: Date;
        const year = new Date().getFullYear();

        if (pattern === singleDatePatterns[0]) {
          startDate = parseMonthDay(match[1], match[2], year);
        } else {
          startDate = new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
        }

        if (!isValid(startDate)) continue;

        if (isBefore(startDate, today)) {
          startDate = addYearIfPast(startDate, today);
        }

        const pastCheck = validateNotPast(startDate);
        if (pastCheck) return pastCheck;

        return {
          success: true,
          startDate: formatDate(startDate),
          endDate: formatDate(addDays(startDate, 6)), // 7-day default
        };
      } catch {
        continue;
      }
    }
  }

  // ISO format: "2026-01-20" or "2026-01-20 to 2026-01-27"
  const isoMatch = normalized.match(
    /^(\d{4}-\d{2}-\d{2})(?:\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2}))?$/
  );
  if (isoMatch) {
    // Parse ISO date as local date to avoid timezone issues
    const startDate = parseISOAsLocal(isoMatch[1]);
    const endDate = isoMatch[2]
      ? parseISOAsLocal(isoMatch[2])
      : addDays(startDate, 6);

    if (!isValid(startDate) || !isValid(endDate)) {
      return {
        success: false,
        error: 'Invalid date format.',
      };
    }

    const pastCheck = validateNotPast(startDate);
    if (pastCheck) return pastCheck;

    return {
      success: true,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  }

  return {
    success: false,
    error:
      "I couldn't understand those dates. Try something like 'next week', 'January 20-27', or 'tomorrow'.",
  };
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse month name and day into Date
 */
function parseMonthDay(month: string, day: string, year: number): Date {
  const months: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };

  const monthNum = months[month.toLowerCase()];
  if (monthNum === undefined) {
    throw new Error(`Invalid month: ${month}`);
  }

  return new Date(year, monthNum, parseInt(day, 10));
}

/**
 * Add a year if date is in the past
 */
function addYearIfPast(date: Date, reference: Date): Date {
  if (isBefore(date, reference)) {
    return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
  }
  return date;
}

/**
 * Parse ISO date string as local date (avoid timezone issues)
 * Input: "2026-02-01" -> Local date Feb 1, 2026
 */
function parseISOAsLocal(dateString: string): Date {
  const parts = dateString.split('-');
  return new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
}

/**
 * Get human-readable date range
 */
export function formatDateRange(startDate: string, endDate: string): string {
  // Parse as local dates to avoid timezone issues
  const start = parseISOAsLocal(startDate);
  const end = parseISOAsLocal(endDate);

  const startFormatted = format(start, 'MMM d');
  const endFormatted = format(end, 'MMM d, yyyy');

  return `${startFormatted} - ${endFormatted}`;
}
