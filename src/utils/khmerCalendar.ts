const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

const KHMER_WEEKDAYS = [
  'អាទិត្យ',
  'ចន្ទ',
  'អង្គារ',
  'ពុធ',
  'ព្រហស្បតិ៍',
  'សុក្រ',
  'សៅរ៍',
];

const KHMER_SOLAR_MONTHS = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
];

const KHMER_ANIMALS = [
  'ជូត',
  'ឆ្លូវ',
  'ខាល',
  'ថោះ',
  'រោង',
  'ម្សាញ់',
  'មមី',
  'មមែ',
  'វក',
  'រកា',
  'ច',
  'កុរ',
];

const KHMER_SAKS = [
  'សំរឹទ្ធិស័ក',
  'ឯកស័ក',
  'ទោស័ក',
  'ត្រីស័ក',
  'ចត្វាស័ក',
  'បញ្ចស័ក',
  'ឆស័ក',
  'សប្តស័ក',
  'អដ្ឋស័ក',
  'នព្វស័ក',
];

export function toKhmerDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => KHMER_DIGITS[Number(d)] ?? d);
}

// Cambodian Chhankitek (ប្រតិទិនចន្ទគតិ) astronomical constants
function getAharkun(beYear: number): number {
  return Math.floor((beYear * 292207 + 499) / 800) + 4;
}

function getKromathupul(beYear: number): number {
  return 800 - ((beYear * 292207 + 499) % 800);
}

function isKhmerSolarLeap(beYear: number): boolean {
  return getKromathupul(beYear) <= 207;
}

function getAvoman(beYear: number): number {
  return (getAharkun(beYear) * 11 + 25) % 692;
}

function getBodithey(beYear: number): number {
  const a = getAharkun(beYear);
  return (Math.floor((a * 11 + 25) / 692) + a + 29) % 30;
}

function isRawBoditheyLeap(beYear: number): boolean {
  const by = getBodithey(beYear);
  const byNext = getBodithey(beYear + 1);
  const byPrev = getBodithey(beYear - 1);
  if (by === 25 && byNext === 5) return false;
  if (by === 24 && byPrev === 25) return true;
  return by >= 25 || by <= 5;
}

function isRawAvomanLeap(beYear: number): boolean {
  const av = getAvoman(beYear);
  return isKhmerSolarLeap(beYear) ? av < 127 : av < 138;
}

function getYearLeapType(beYear: number): {
  adhikameas: boolean;
  chandrathimeas: boolean;
} {
  const adhikameas = isRawBoditheyLeap(beYear);
  let chandrathimeas = false;
  if (!adhikameas) {
    if (isRawAvomanLeap(beYear)) {
      chandrathimeas = true;
    } else if (isRawBoditheyLeap(beYear - 1) && isRawAvomanLeap(beYear - 1)) {
      chandrathimeas = true;
    }
  }
  return { adhikameas, chandrathimeas };
}

interface LunarMonthDef {
  name: string;
  days: number;
}

function getLunarMonthsForYear(beYear: number): LunarMonthDef[] {
  const { adhikameas, chandrathimeas } = getYearLeapType(beYear);
  const months: LunarMonthDef[] = [
    { name: 'មិគសិរ', days: 29 },
    { name: 'បុស្ស', days: 30 },
    { name: 'មាឃ', days: 29 },
    { name: 'ផល្គុន', days: 30 },
    { name: 'ចេត្រ', days: 29 },
    { name: 'ពិសាខ', days: 30 },
    { name: 'ជេស្ឋ', days: chandrathimeas ? 30 : 29 },
  ];

  if (adhikameas) {
    months.push({ name: 'បឋមាសាឍ', days: 30 });
    months.push({ name: 'ទុតិយាសាឍ', days: 30 });
  } else {
    months.push({ name: 'អាសាឍ', days: 30 });
  }

  months.push({ name: 'ស្រាពណ៍', days: 29 });
  months.push({ name: 'ភទ្របទ', days: 30 });
  months.push({ name: 'អស្សុជ', days: 29 });
  months.push({ name: 'កត្តិក', days: 30 });

  return months;
}

// Verified anchor: 2023-12-13 (UTC) = ១កើត ខែមិគសិរ ព.ស.២៥៦៧ (start of B.E. 2568 lunar cycle)
const CHHANKITEK_ANCHOR_UTC = Date.UTC(2023, 11, 13);
const CHHANKITEK_ANCHOR_BE = 2568;

export interface KhmerCalendarDate {
  weekday: string;
  lunarDay: number;
  lunarPhase: 'កើត' | 'រោច';
  lunarMonth: string;
  animalYear: string;
  sak: string;
  beYear: number;
  solarDay: number;
  solarMonth: string;
  solarYear: number;
  lunarLine: string;
  solarLine: string;
}

export function formatKhmerOfficialDate(date: Date = new Date()): KhmerCalendarDate {
  const year = date.getFullYear();
  const monthIndex = date.getMonth(); // 0..11
  const day = date.getDate();
  const weekday = KHMER_WEEKDAYS[date.getDay()] ?? 'ចន្ទ';

  const targetUtc = Date.UTC(year, monthIndex, day);
  let diff = Math.round((targetUtc - CHHANKITEK_ANCHOR_UTC) / 86400000);
  let be = CHHANKITEK_ANCHOR_BE;

  while (diff < 0) {
    be--;
    const prevMonths = getLunarMonthsForYear(be);
    diff += prevMonths.reduce((sum, m) => sum + m.days, 0);
  }

  let lunarDay = 1;
  let lunarPhase: 'កើត' | 'រោច' = 'កើត';
  let lunarMonth = 'មិគសិរ';
  let displayBe = be;

  while (true) {
    const months = getLunarMonthsForYear(be);
    const totalDays = months.reduce((sum, m) => sum + m.days, 0);
    if (diff < totalDays) {
      for (let i = 0; i < months.length; i++) {
        const m = months[i];
        if (diff < m.days) {
          const dayOfMonth = diff + 1;
          const isWaxing = dayOfMonth <= 15;
          lunarDay = isWaxing ? dayOfMonth : dayOfMonth - 15;
          lunarPhase = isWaxing ? 'កើត' : 'រោច';
          lunarMonth = m.name;
          // Buddhist Era increments on ១រោច ខែពិសាខ
          displayBe = i < 5 || (i === 5 && isWaxing) ? be - 1 : be;
          break;
        }
        diff -= m.days;
      }
      break;
    }
    diff -= totalDays;
    be++;
  }

  // Chulasakaraj (animal year & sak) transitions on Khmer New Year Lerng Sak (~April 16)
  const isAfterLerngSak = monthIndex > 3 || (monthIndex === 3 && day >= 16);
  const jsYear = isAfterLerngSak ? year - 638 : year - 639;
  const animalYear = KHMER_ANIMALS[((jsYear + 10) % 12 + 12) % 12];
  const sak = KHMER_SAKS[((jsYear % 10) + 10) % 10];
  const solarMonth = KHMER_SOLAR_MONTHS[monthIndex] ?? '';

  const lunarLine = `ថ្ងៃ${weekday} ${toKhmerDigits(lunarDay)}${lunarPhase} ខែ${lunarMonth} ឆ្នាំ${animalYear} ${sak} ព.ស.${toKhmerDigits(displayBe)}`;
  const solarLine = `ថ្ងៃទី${toKhmerDigits(day)} ខែ${solarMonth} ឆ្នាំ${toKhmerDigits(year)}`;

  return {
    weekday,
    lunarDay,
    lunarPhase,
    lunarMonth,
    animalYear,
    sak,
    beYear: displayBe,
    solarDay: day,
    solarMonth,
    solarYear: year,
    lunarLine,
    solarLine,
  };
}
