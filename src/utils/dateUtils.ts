export interface DOBParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

/**
 * Parses DOB string directly without UTC or Date object timezone shifting.
 * Supports canonical 'YYYY-MM-DD' and Indian display format 'DD-MM-YYYY'.
 */
export function parseDOBParts(dobString: string): DOBParts | null {
  if (!dobString || typeof dobString !== 'string') return null;
  const clean = dobString.trim();

  // Case 1: YYYY-MM-DD (Canonical ISO format e.g. 2003-12-05)
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { year: y, month: m, day: d };
    }
  }

  // Case 2: DD-MM-YYYY (Indian display format e.g. 05-12-2003)
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { year: y, month: m, day: d };
    }
  }

  // Case 3: YYYY/MM/DD or DD/MM/YYYY
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('/').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { year: y, month: m, day: d };
    }
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { year: y, month: m, day: d };
    }
  }

  return null;
}

/**
 * Returns canonical storage DOB string (YYYY-MM-DD e.g. 2003-12-05).
 */
export function formatDOBToCanonical(dobString: string): string {
  if (!dobString) return '';
  const parts = parseDOBParts(dobString);
  if (!parts) return dobString;
  const yyyy = String(parts.year);
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats canonical DOB string into Indian display format (DD-MM-YYYY e.g. 05-12-2003).
 */
export function formatDOBForDisplay(dobString: string): string {
  if (!dobString) return 'N/A';
  const parts = parseDOBParts(dobString);
  if (!parts) return dobString;
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  const yyyy = String(parts.year);
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Returns local today's date formatted as YYYY-MM-DD without UTC timezone offset shifting.
 */
export function getLocalTodayISO(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Validates DOB calendar parts vs current local date.
 */
export function isValidDOB(dobString: string): boolean {
  const parts = parseDOBParts(dobString);
  if (!parts) return false;

  const { year, month, day } = parts;
  const testDate = new Date(year, month - 1, day);
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  if (year > todayYear) return false;
  if (year === todayYear && month > todayMonth) return false;
  if (year === todayYear && month === todayMonth && day > todayDay) return false;

  return true;
}

/**
 * Calculates completed age in years from DOB parts.
 */
export function calculateAgeFromDOB(dobString: string): number {
  const parts = parseDOBParts(dobString);
  if (!parts) return 0;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  let age = currentYear - parts.year;

  if (
    currentMonth < parts.month ||
    (currentMonth === parts.month && currentDay < parts.day)
  ) {
    age--;
  }

  return Math.max(0, age);
}

/**
 * General helper for formatting ISO dates or timestamps to readable format.
 */
export function formatDateString(dateString: string): string {
  if (!dateString) return '';
  const parts = parseDOBParts(dateString);
  if (parts) {
    const dd = String(parts.day).padStart(2, '0');
    const mm = String(parts.month).padStart(2, '0');
    return `${dd}-${mm}-${parts.year}`;
  }
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

