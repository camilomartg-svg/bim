import { addDays, isWeekend, format, startOfDay, addBusinessDays, isSameDay } from 'date-fns';

// Helper to get Easter Sunday for a given year (Meeus/Jones/Butcher algorithm)
function getEaster(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getNextMonday(date: Date) {
  const day = date.getDay();
  if (day === 1) return date; // Already Monday
  const diff = (day === 0 ? 1 : 8 - day);
  return addDays(date, diff);
}

export function getColombianHolidays(year: number): Date[] {
  const holidays: Date[] = [];
  const easter = getEaster(year);

  // Fixed date holidays
  holidays.push(startOfDay(new Date(year, 0, 1)));   // Jan 1
  holidays.push(startOfDay(new Date(year, 4, 1)));   // May 1
  holidays.push(startOfDay(new Date(year, 6, 20)));  // Jul 20
  holidays.push(startOfDay(new Date(year, 7, 7)));   // Aug 7
  holidays.push(startOfDay(new Date(year, 11, 8)));  // Dec 8
  holidays.push(startOfDay(new Date(year, 11, 25))); // Dec 25

  // Emiliani Law Holidays (Moved to next Monday)
  holidays.push(getNextMonday(new Date(year, 0, 6)));    // Jan 6
  holidays.push(getNextMonday(new Date(year, 2, 19)));   // Mar 19
  holidays.push(getNextMonday(new Date(year, 5, 29)));   // Jun 29
  holidays.push(getNextMonday(new Date(year, 7, 15)));   // Aug 15
  holidays.push(getNextMonday(new Date(year, 9, 12)));   // Oct 12
  holidays.push(getNextMonday(new Date(year, 10, 1)));   // Nov 1
  holidays.push(getNextMonday(new Date(year, 10, 11)));  // Nov 11

  // Religious Movable Holidays
  holidays.push(addDays(easter, -3)); // Jueves Santo
  holidays.push(addDays(easter, -2)); // Viernes Santo
  holidays.push(getNextMonday(addDays(easter, 39))); // Ascensión
  holidays.push(getNextMonday(addDays(easter, 60))); // Corpus Christi
  holidays.push(getNextMonday(addDays(easter, 68))); // Sagrado Corazón

  return holidays;
}

export type DayType = 'OFICINA' | 'OBRA' | 'CALENDARIO';

export function calculateDueDate(startDate: Date, daysCount: number, type: DayType): Date {
  let currentDate = startOfDay(startDate);
  let addedDays = 0;
  const holidays = getColombianHolidays(startDate.getFullYear());
  
  // Cache for holidays of next year too just in case
  const nextYearHolidays = getColombianHolidays(startDate.getFullYear() + 1);
  const allHolidays = [...holidays, ...nextYearHolidays];

  while (addedDays < daysCount) {
    currentDate = addDays(currentDate, 1);
    const dayOfWeek = currentDate.getDay();
    const isHoliday = allHolidays.some(h => isSameDay(h, currentDate));

    let shouldCount = false;
    if (type === 'CALENDARIO') {
      shouldCount = !isHoliday;
    } else if (type === 'OFICINA') {
      // Mon-Fri, excluding holidays
      shouldCount = dayOfWeek >= 1 && dayOfWeek <= 5 && !isHoliday;
    } else if (type === 'OBRA') {
      // Mon-Sat, excluding holidays
      shouldCount = dayOfWeek >= 1 && dayOfWeek <= 6 && !isHoliday;
    }

    if (shouldCount) {
      addedDays++;
    }
  }

  return currentDate;
}
