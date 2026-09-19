/**
 * Bikram Sambat (BS) <-> Gregorian (AD) Date Utility
 * Fully modular, typed, and independent helper for Nepali Calendar integration.
 */

export interface BikramSambatDate {
  year: number;
  month: number; // 1 to 12
  day: number;   // 1 to 32
  monthName: string;
  monthNameNp: string;
  formattedBs: string;
  formattedBsNp: string;
}

export interface BSMonthInfo {
  id: number;
  en: string;
  np: string;
}

export const BS_MONTHS: BSMonthInfo[] = [
  { id: 1, en: 'Baisakh', np: 'बैशाख' },
  { id: 2, en: 'Jestha', np: 'जेठ' },
  { id: 3, en: 'Ashadh', np: 'असार' },
  { id: 4, en: 'Shrawan', np: 'साउन' },
  { id: 5, en: 'Bhadra', np: 'भदौ' },
  { id: 6, en: 'Ashwin', np: 'असोज' },
  { id: 7, en: 'Kartik', np: 'कात्तिक' },
  { id: 8, en: 'Mangsir', np: 'मंसिर' },
  { id: 9, en: 'Poush', np: 'पुष' },
  { id: 10, en: 'Magh', np: 'माघ' },
  { id: 11, en: 'Falgun', np: 'फागुन' },
  { id: 12, en: 'Chaitra', np: 'चैत' }
];

export const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export function toNepaliDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => NEPALI_DIGITS[parseInt(d, 10)]);
}

// Complete BS Month Days Data Mapping for BS Years 2000 to 2090
// Each array represents days in months [Baisakh, Jestha, Ashadh, Shrawan, Bhadra, Ashwin, Kartik, Mangsir, Poush, Magh, Falgun, Chaitra]
const BS_CALENDAR_DATA: Record<number, number[]> = {
  2000: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2003: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2004: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2005: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2006: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2007: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2008: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2009: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2010: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2011: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2012: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2013: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2014: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2015: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2016: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2017: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2018: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2019: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2020: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2021: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2022: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2023: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2024: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2025: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2026: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2027: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2028: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2029: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2030: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2031: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2032: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2033: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2034: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2035: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2036: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2037: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2038: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2039: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2040: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2041: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2042: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2043: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2044: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2045: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2046: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2047: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2048: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2049: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2050: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2051: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2052: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2053: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2054: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2055: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2056: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2057: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2058: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2059: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2060: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2061: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2062: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2063: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2064: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2065: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2066: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2067: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2068: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2069: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2070: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2073: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2074: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2075: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2078: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2079: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2081: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2083: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2086: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2089: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2090: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]
};

// Reference Date: AD 1943-04-14 corresponds to BS 2000-01-01
const REF_AD_TIME = new Date(1943, 3, 14).getTime();
const REF_BS_YEAR = 2000;
const REF_BS_MONTH = 1;
const REF_BS_DAY = 1;

/**
 * Converts Gregorian AD Date to Bikram Sambat (BS) Date
 */
export function adToBs(adInput: Date | string | number): BikramSambatDate {
  const adDate = new Date(adInput);
  if (isNaN(adDate.getTime())) {
    return createEmptyBsDate();
  }

  // Calculate day difference from reference date (1943-04-14 / BS 2000-01-01)
  const targetTime = new Date(adDate.getFullYear(), adDate.getMonth(), adDate.getDate()).getTime();
  let dayDiff = Math.floor((targetTime - REF_AD_TIME) / (1000 * 60 * 60 * 24));

  let bsYear = REF_BS_YEAR;
  let bsMonth = REF_BS_MONTH;
  let bsDay = REF_BS_DAY;

  if (dayDiff >= 0) {
    while (dayDiff > 0) {
      const monthDays = getMonthDays(bsYear, bsMonth);
      if (dayDiff >= monthDays) {
        dayDiff -= monthDays;
        bsMonth++;
        if (bsMonth > 12) {
          bsMonth = 1;
          bsYear++;
        }
      } else {
        bsDay += dayDiff;
        dayDiff = 0;
      }
    }
  } else {
    while (dayDiff < 0) {
      bsMonth--;
      if (bsMonth < 1) {
        bsMonth = 12;
        bsYear--;
      }
      const monthDays = getMonthDays(bsYear, bsMonth);
      dayDiff += monthDays;
    }
    bsDay += dayDiff;
  }

  const monthObj = BS_MONTHS[bsMonth - 1] || BS_MONTHS[0];
  const padDay = String(bsDay).padStart(2, '0');
  const padMonth = String(bsMonth).padStart(2, '0');

  const formattedBs = `${bsYear}-${padMonth}-${padDay}`;
  const formattedBsNp = `${toNepaliDigits(bsYear)} ${monthObj.np} ${toNepaliDigits(bsDay)} गते`;

  return {
    year: bsYear,
    month: bsMonth,
    day: bsDay,
    monthName: monthObj.en,
    monthNameNp: monthObj.np,
    formattedBs,
    formattedBsNp
  };
}

/**
 * Converts Bikram Sambat (BS) Date to Gregorian AD Date
 */
export function bsToAd(bsYear: number, bsMonth: number, bsDay: number): Date {
  let totalDays = 0;

  // Validate bounds
  const validYear = Math.max(2000, Math.min(2090, bsYear));
  const validMonth = Math.max(1, Math.min(12, bsMonth));
  const maxDays = getMonthDays(validYear, validMonth);
  const validDay = Math.max(1, Math.min(maxDays, bsDay));

  // Count total days from BS 2000-01-01 to target BS date
  for (let y = REF_BS_YEAR; y < validYear; y++) {
    const yearDays = (BS_CALENDAR_DATA[y] || BS_CALENDAR_DATA[2080]).reduce((a, b) => a + b, 0);
    totalDays += yearDays;
  }

  for (let m = 1; m < validMonth; m++) {
    totalDays += getMonthDays(validYear, m);
  }

  totalDays += (validDay - 1);

  const resultTime = REF_AD_TIME + totalDays * (1000 * 60 * 60 * 24);
  return new Date(resultTime);
}

/**
 * Gets total days in a specific BS year and month
 */
export function getMonthDays(year: number, month: number): number {
  const yearData = BS_CALENDAR_DATA[year] || BS_CALENDAR_DATA[2080];
  return yearData[month - 1] || 30;
}

/**
 * Returns available BS years array for dropdowns (e.g. 2000 to 2090 BS)
 */
export function getAvailableBsYears(): number[] {
  const years: number[] = [];
  for (let y = 2000; y <= 2090; y++) {
    years.push(y);
  }
  return years;
}

function createEmptyBsDate(): BikramSambatDate {
  return {
    year: 2082,
    month: 1,
    day: 1,
    monthName: 'Baisakh',
    monthNameNp: 'बैशाख',
    formattedBs: '2082-01-01',
    formattedBsNp: '२०८२ बैशाख ०१ गते'
  };
}
