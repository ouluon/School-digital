export type CompetencyType = 'skills' | 'attitude';

export type CompetencyStatus = 'not_started' | 'in_progress' | 'completed';

export interface SkillActivityItem {
  id: string;
  order: number;
  label: string;
}

export interface AttitudeIndicatorItem {
  id: string;
  order: number;
  label: string;
}

export interface AttitudeSection {
  key: string;
  title: string;
  items: AttitudeIndicatorItem[];
}

export const COMPETENCY_STATUS_LABELS: Record<CompetencyStatus, string> = {
  not_started: 'មិនទាន់រៀបចំ',
  in_progress: 'កំពុងរៀបចំ',
  completed: 'រួចរាល់',
};

export const SKILL_SCALE_OPTIONS: { value: number; label: string; shortLabel: string }[] = [
  { value: 0, label: 'មិនមាន', shortLabel: '0' },
  { value: 1, label: 'តិចតួច', shortLabel: '1' },
  { value: 2, label: 'មធ្យម', shortLabel: '2' },
  { value: 3, label: 'បង្គួរ', shortLabel: '3' },
  { value: 4, label: 'ញឹកញាប់', shortLabel: '4' },
];

export const ATTITUDE_SCALE_OPTIONS: { value: number; label: string; shortLabel: string }[] = [
  { value: 0, label: 'មិនបានអនុវត្ត (០)', shortLabel: '0' },
  { value: 1, label: 'បានអនុវត្ត (១)', shortLabel: '1' },
];

// 18 items from បំណិនសម្បទា.pdf (scale 0..4)
export const SKILL_COMPETENCY_ACTIVITIES: SkillActivityItem[] = [
  { id: 'sk_1', order: 1, label: 'ការរៀនភាសាបរទេស' },
  { id: 'sk_2', order: 2, label: 'ការប្រកួតប្រជែងអំណាន និងគណិតវិទ្យា' },
  { id: 'sk_3', order: 3, label: 'ការបង្កើតក្លឹបសិក្សា និងការដាក់កិច្ចការផ្ទះ' },
  { id: 'sk_4', order: 4, label: 'ការរៀបចំពិព័រណ៍ស្នាដៃសិស្ស' },
  { id: 'sk_5', order: 5, label: 'ការរៀបចំព្រឹត្តិការណ៍ជំនួបជាមួយអ្នកអាណាព្យាបាល' },
  { id: 'sk_6', order: 6, label: 'កម្មវិធីបំណិនរកចំណូល' },
  { id: 'sk_7', order: 7, label: 'កម្មវិធីវិនិយោគ និងសន្សំប្រាក់' },
  { id: 'sk_8', order: 8, label: 'ការបណ្តុះមូលដ្ឋានសហគ្រិនភាព' },
  { id: 'sk_9', order: 9, label: 'ការអប់រំកាយ និងកីឡា ការអប់រំសិល្បៈ និងការសម្តែង' },
  { id: 'sk_10', order: 10, label: 'ការបង្កើតផលិតផល' },
  { id: 'sk_11', order: 11, label: 'ការបង្រៀនកុំព្យូទ័រ' },
  {
    id: 'sk_12',
    order: 12,
    label: 'ការសិក្សាអំណានទាំងបួននៅបណ្ណាល័យ (អំណានឮ អំណានចូលរួម អំណានដៃគូ និងអំណានបុគ្គល)',
  },
  { id: 'sk_13', order: 13, label: 'ការអប់រំសុខភាពបន្តពូជ អនាម័យ និងជំងឺឆ្លងផ្សេងៗ' },
  { id: 'sk_14', order: 14, label: 'ការអប់រំអំពីគ្រោះថ្នាក់គ្រាប់មីន និងគ្រាប់មិនទាន់ផ្ទុះ' },
  { id: 'sk_15', order: 15, label: 'ការអប់រំអំពីអំពើហិង្សា' },
  { id: 'sk_16', order: 16, label: 'ការអប់រំសីលធម៌ (ស្តាប់ធម៌ទេសនា)' },
  { id: 'sk_17', order: 17, label: 'ការអប់រំច្បាប់ចរាចរណ៍' },
  { id: 'sk_18', order: 18, label: 'ដំណើរទស្សនកិច្ចសិក្សា' },
];

export const SKILL_ITEM_IDS = SKILL_COMPETENCY_ACTIVITIES.map((a) => a.id);

// 78 items across 5 sections from ចរិយាសម្បទា.pdf (scale 0..1)
export const ATTITUDE_COMPETENCY_SECTIONS: AttitudeSection[] = [
  {
    key: 'clean',
    title: 'ស្អាត',
    items: [
      { id: 'att_clean_1', order: 1, label: 'ការធ្វើអនាម័យខ្លួនប្រាណជាប្រចាំ' },
      { id: 'att_clean_2', order: 2, label: 'កាត់ក្រចកដៃ - ជើង' },
      { id: 'att_clean_3', order: 3, label: 'ដុសសម្អាតមាត់ ធ្មេញជាប្រចាំ' },
      { id: 'att_clean_4', order: 4, label: 'ការធ្វើអនាម័យទីកន្លែងរស់នៅជាប្រចាំ' },
      { id: 'att_clean_5', order: 5, label: 'ការដុសសម្អាតទ្រនាប់ជើងស្ងួត ទ្រនាប់ជើងស្អាតជាប្រចាំ' },
      { id: 'att_clean_6', order: 6, label: 'សម្លៀកបំពាក់សិស្សស្អាតជាប្រចាំ' },
      { id: 'att_clean_7', order: 7, label: 'ចេះទុកដាក់សំរាមដោយខ្លួនឯង' },
      { id: 'att_clean_8', order: 8, label: 'សម្អាតបន្ទប់ទឹកជាប្រចាំ' },
      { id: 'att_clean_9', order: 9, label: 'សម្អាតថ្នាក់រៀនជាប្រចាំ' },
      { id: 'att_clean_10', order: 10, label: 'សម្អាតបរិស្ថានសាលារៀនជាប្រចាំ' },
      { id: 'att_clean_11', order: 11, label: 'ស្រឡាញ់ភាពស្អាត និងប្រកាន់ឥរិយាបថស្អាតជាប្រចាំ' },
      { id: 'att_clean_12', order: 12, label: 'សម្អាតសម្ភារៈសិក្សា ដូចជាក្តារឆ្នួន កាតាប សៀវភៅជាប្រចាំ' },
      { id: 'att_clean_13', order: 13, label: 'មិនខាកស្តោះផ្តេសផ្តាសតាមទីសាធារណៈ' },
      { id: 'att_clean_14', order: 14, label: 'មិនបន្ទោបង់ក្រៅបង្គន់' },
      { id: 'att_clean_15', order: 15, label: 'បរិភោគចំណីអាហារដែលមានសុវត្ថិភាពជាប្រចាំ' },
      { id: 'att_clean_16', order: 16, label: 'ប្រើប្រាស់ និងទទួលទានទឹកស្អាតជាប្រចាំ' },
    ],
  },
  {
    key: 'polite',
    title: 'សុភាព',
    items: [
      { id: 'att_polite_1', order: 1, label: 'ប្រើប្រាស់ពាក្យសម្តីពិរោះ រាបសា ចេះគួរសម និងផ្តល់ស្នាមញញឹមដាក់គ្នា' },
      { id: 'att_polite_2', order: 2, label: 'ញញឹមស្រស់' },
      { id: 'att_polite_3', order: 3, label: 'ប្រតិបត្តិល្អចំពោះមិត្តភក្តិ' },
      { id: 'att_polite_4', order: 4, label: 'ប្រតិបត្តិល្អចំពោះចាស់ព្រឹទ្ធាចារ្យ' },
      { id: 'att_polite_5', order: 5, label: 'ប្រតិបត្តិល្អចំពោះម្តាយឪពុក' },
      { id: 'att_polite_6', order: 6, label: 'ប្រតិបត្តិល្អចំពោះលោកគ្រូ អ្នកគ្រូ នាយក នាយិកា' },
      { id: 'att_polite_7', order: 7, label: 'ប្រតិបត្តិល្អចំពោះព្រះសង្ឃ' },
      {
        id: 'att_polite_8',
        order: 8,
        label: 'ការសំពះ ដើម្បីបង្ហាញការគោរព និងការគួរសមដូចជា៖ ការសំពះបួងសួងដល់ទេវតាវត្ថុសក្តិសិទ្ធិ ព្រះសង្ឃ ចាស់ព្រឹទ្ធាចារ្យ លោកគ្រូ អ្នកគ្រូ ឪពុកម្តាយ បងប្រុស ស្រី អ្នកមានអាយុច្រើនជាងមិត្តភក្តិ និងអ្នកមានអាយុស្មើគ្នា',
      },
      { id: 'att_polite_9', order: 9, label: 'មិត្តជួយអប់រំមិត្ត និងគោរពគ្នាទៅវិញទៅមក' },
      { id: 'att_polite_10', order: 10, label: 'មិនពោលពាក្យមិនល្អ' },
      { id: 'att_polite_11', order: 11, label: 'មិនមានការច្រណែនឈ្នានីសអ្នកដទៃ' },
      { id: 'att_polite_12', order: 12, label: 'សុំអនុញ្ញាតពីគ្រូ មាតាបិតា ចាស់ព្រឹទ្ធាចារ្យមុននឹងធ្វើអ្វីមួយ' },
      { id: 'att_polite_13', order: 13, label: 'ចេះជួយយកអាសាអ្នកដទៃ' },
      { id: 'att_polite_14', order: 14, label: 'ចៀសវាងពាក់មួកក្នុងបរិវេណសាលារៀន វត្តអារាម' },
      { id: 'att_polite_15', order: 15, label: 'ដោះមួកគោរពគ្រូ ចាស់ព្រឹទ្ធាចារ្យ ព្រះសង្ឃ' },
      { id: 'att_polite_16', order: 16, label: 'ចេះលើកដៃសំពះសុំទោសពេលខ្លួនមានកំហុស' },
      { id: 'att_polite_17', order: 17, label: 'ចៀសវាងលេងហ្គេម អាន ឬមើលរឿងអាសអាភាស' },
      { id: 'att_polite_18', order: 18, label: 'មានចរិតស្លូតបូត' },
      { id: 'att_polite_19', order: 19, label: 'ស្មោះត្រង់ មិននិយាយកុហក' },
      { id: 'att_polite_20', order: 20, label: 'មិនយករបស់ទ្រព្យមិត្តភក្តិ ឬអ្នកដទៃ' },
      { id: 'att_polite_21', order: 21, label: 'មិនសេពគប់ជាមួយមិត្តខិលខូច' },
      { id: 'att_polite_22', order: 22, label: 'មិនពាក់គ្រឿងអលង្ការ តែងខ្លួនឆើតឆាយ' },
    ],
  },
  {
    key: 'orderly',
    title: 'របៀប',
    items: [
      { id: 'att_order_1', order: 1, label: 'ការទុកដាក់សម្ភារៈសិក្សាត្រឹមត្រូវ' },
      { id: 'att_order_2', order: 2, label: 'ទុកដាក់ស្បែកជើងនៅមុខ ឬក្រៅថ្នាក់ (បើមាន)' },
      { id: 'att_order_3', order: 3, label: 'ការឈរតម្រង់ជួរមានសណ្តាប់ធ្នាប់' },
      { id: 'att_order_4', order: 4, label: 'ការទុកដាក់កង់ ឬម៉ូតូត្រូវតាមកន្លែង' },
      { id: 'att_order_5', order: 5, label: 'មិនជជែក ឬប្រឡែងគ្នាពេលគោរពទង់ជាតិ' },
      { id: 'att_order_6', order: 6, label: 'មិនជជែក ឬប្រឡែងគ្នាពេលកំពុងរៀន មិនជាន់លើតុ កៅអី' },
      { id: 'att_order_7', order: 7, label: 'មិនជិះកង់ ឬម៉ូតូក្នុងបរិវេណសាលារៀន' },
      { id: 'att_order_8', order: 8, label: 'មិនធ្វើឱ្យខូចខាតទ្រព្យរបស់ផ្សេងៗ' },
      { id: 'att_order_9', order: 9, label: 'ឡើងដើមឈើ ទីខ្ពស់ផ្តេសផ្តាស ឬដោយគ្មានការអនុញ្ញាត' },
      { id: 'att_order_10', order: 10, label: 'ជម្រាបសួរ ជម្រាបលា ឪពុកម្តាយ អ្នកអាណាព្យាបាលមុនទៅសាលារៀន ឬមកពីសាលារៀន' },
      { id: 'att_order_11', order: 11, label: 'រាយការណ៍ជាបន្ទាន់ជូននាយក ឬគ្រូបង្រៀនពេលមានបាតុភាពអសកម្ម' },
      { id: 'att_order_12', order: 12, label: 'សិស្សឱ្យចេះសម្អាតខ្លួនប្រាណ' },
      { id: 'att_order_13', order: 13, label: 'សិស្សឱ្យចេះសម្អាតស្លៀកសម្លៀកបំពាក់ ទ្រនាប់ជើង ស្រោមជើង' },
      { id: 'att_order_14', order: 14, label: 'កាត់សក់ខ្លី(បុរស) សិតសក់ ចងឬកៀបសក់ឱ្យមានរបៀប (នារី)' },
      { id: 'att_order_15', order: 15, label: 'រៀបចំផ្ទះសម្បែង បន្ទប់គេង សម្ភារៈប្រើប្រាស់' },
      { id: 'att_order_16', order: 16, label: 'ចេះទុកដាក់សំរាម និងរើសសំរាមដាក់ចូលធុងសំរាម' },
      { id: 'att_order_17', order: 17, label: 'កំណត់បានប្រភេទសម្លៀកបំពាក់ប្រចាំថ្ងៃ និងសម្លៀកបំពាក់សម្រាប់កម្មវិធីផ្សេងៗ' },
      { id: 'att_order_18', order: 18, label: 'ចេះទទួលបដិសណ្ឋារកិច្ចចំពោះភ្ញៀវជាតិ និងអន្តរជាតិ។' },
    ],
  },
  {
    key: 'punctual',
    title: 'ទៀងពេល',
    items: [
      { id: 'att_punctual_1', order: 1, label: 'មករៀនបានទៀងទាត់ និងទាន់ពេល' },
      { id: 'att_punctual_2', order: 2, label: 'ចូលរួមគោរពទង់ជាតិទៀងទាត់' },
      { id: 'att_punctual_3', order: 3, label: 'ពេលឈប់សម្រាកត្រូវមានច្បាប់ទម្លាប់ និងមូលហេតុ' },
      { id: 'att_punctual_4', order: 4, label: 'ខិតខំធ្វើកិច្ចការ និងខិតខំរៀនសូត្រជាប្រចាំ' },
      { id: 'att_punctual_5', order: 5, label: 'មិនឈប់លេងតាមផ្លូវពេលចេញពីសាលារៀនទៅផ្ទះ ឬពីផ្ទះទៅសាលារៀន' },
      { id: 'att_punctual_6', order: 6, label: 'កំណត់ពេលវេលាធ្វើកិច្ចការ និងការធ្វើកិច្ចការជាទៀងទាត់' },
      { id: 'att_punctual_7', order: 7, label: 'គោរពពេលវេលាជាប្រចាំ' },
      { id: 'att_punctual_8', order: 8, label: 'ហាត់ប្រាណថែរក្សាសុខភាពជាប្រចាំ' },
    ],
  },
  {
    key: 'mindful',
    title: 'សមាធិ',
    items: [
      { id: 'att_mindful_1', order: 1, label: 'ប្រមូលអារម្មណ៍ ត្រងត្រាប់ស្តាប់ការណែនាំរបស់លោកគ្រូ អ្នកគ្រូ' },
      { id: 'att_mindful_2', order: 2, label: 'ការតាំងចិត្តស្តាប់សំឡេងខាងក្នុង' },
      { id: 'att_mindful_3', order: 3, label: 'ការអត់ធ្មត់ស្តាប់ខ្យល់ដង្ហើមចេញចូល' },
      { id: 'att_mindful_4', order: 4, label: 'ហ្វឹកហាត់ស្រូប និងបញ្ចេញខ្យល់ដង្ហើមចេញចូលឱ្យវែងៗ យឺតៗ' },
      { id: 'att_mindful_5', order: 5, label: 'ហ្វឹកហាត់ប្រមូលអារម្មណ៍ដោយធ្វើសមាធិពិចារណានូវសកម្មភាពល្អៗដែលបានប្រព្រឹត្តប្រចាំថ្ងៃ' },
      { id: 'att_mindful_6', order: 6, label: 'មានសុខភាពល្អ ស្មារតីភ្លៀវក្លាស្វាហាប់ និងថ្នាលអារម្មណ៍គិតអ្វីៗក្នុងផ្លូវវិជ្ជមានជានិច្ច។' },
      { id: 'att_mindful_7', order: 7, label: 'ស្វែងយល់ពីទង្វើល្អ និងព្យាយាមធ្វើអំពើល្អនោះជាប្រចាំ' },
      { id: 'att_mindful_8', order: 8, label: 'ធ្វើអំពើល្អជានិច្ច' },
      { id: 'att_mindful_9', order: 9, label: 'ធ្វើអ្វីដែលជាគុណប្រយោជន៍ចំពោះខ្លួនឯង គ្រួសារ សាលារៀន និងសង្គម' },
      { id: 'att_mindful_10', order: 10, label: 'ចេះត្រិះរិះពិចារណារកហេតុផល' },
      { id: 'att_mindful_11', order: 11, label: 'ហ៊ានទទួលខុសត្រូវចំពោះទង្វើរបស់ខ្លួន' },
      { id: 'att_mindful_12', order: 12, label: 'ប្រមូលអារម្មណ៍ យកចិត្តទុកដាក់រៀនសូត្រ' },
      { id: 'att_mindful_13', order: 13, label: 'ចេះទប់ និងរម្ងាប់អារម្មណ៍' },
      { id: 'att_mindful_14', order: 14, label: 'ប្រកាន់ខ្ជាប់សីល៥ អប់រំផ្លូវចិត្ត' },
    ],
  },
];

export const ATTITUDE_ITEM_IDS = ATTITUDE_COMPETENCY_SECTIONS.flatMap((sec) =>
  sec.items.map((item) => item.id)
);

export interface CompetencySummary {
  filledCount: number;
  totalCount: number;
  rawSum: number;
  score10: number | undefined;
  status: CompetencyStatus;
  statusLabel: string;
  gradeLabel: 'ល្អ' | 'ល្អបង្គួរ' | 'មធ្យម' | 'ខ្សោយ';
}

export function getCompetencyQualitativeGrade(
  score10: number
): 'ល្អ' | 'ល្អបង្គួរ' | 'មធ្យម' | 'ខ្សោយ' {
  if (score10 >= 0.8) return 'ល្អ';
  if (score10 >= 0.65) return 'ល្អបង្គួរ';
  if (score10 >= 0.5) return 'មធ្យម';
  return 'ខ្សោយ';
}

export function evaluateCompetencyRubric(
  type: CompetencyType,
  scores?: Record<string, number>,
  fallbackScore10?: number
): CompetencySummary {
  const validIds = type === 'skills' ? SKILL_ITEM_IDS : ATTITUDE_ITEM_IDS;
  const maxItemValue = type === 'skills' ? 4 : 1;
  const totalCount = validIds.length;

  let filledCount = 0;
  let rawSum = 0;

  if (scores) {
    for (const id of validIds) {
      const val = scores[id];
      if (typeof val === 'number' && !Number.isNaN(val) && val >= 0 && val <= maxItemValue) {
        filledCount++;
        rawSum += val;
      }
    }
  }

  let status: CompetencyStatus = 'not_started';
  if (filledCount === 0) {
    // Handle case where score was imported directly from Sheet without granular rubric breakdown
    if (typeof fallbackScore10 === 'number' && !Number.isNaN(fallbackScore10)) {
      const clamped = Number(Math.max(0, Math.min(1, fallbackScore10)).toFixed(2));
      return {
        filledCount: 0,
        totalCount,
        rawSum: Math.round(clamped * 100),
        score10: clamped,
        status: 'completed',
        statusLabel: COMPETENCY_STATUS_LABELS.completed,
        gradeLabel: getCompetencyQualitativeGrade(clamped),
      };
    }
    status = 'not_started';
  } else if (filledCount < totalCount) {
    status = 'in_progress';
  } else {
    status = 'completed';
  }

  const score10 =
    filledCount > 0
      ? Number(Math.min(1, rawSum / 100).toFixed(2))
      : undefined;

  return {
    filledCount,
    totalCount,
    rawSum,
    score10,
    status,
    statusLabel: COMPETENCY_STATUS_LABELS[status],
    gradeLabel: getCompetencyQualitativeGrade(score10 ?? 0),
  };
}
