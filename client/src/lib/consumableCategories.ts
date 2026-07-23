// 耗材分類總表與模組劃分
// 「清潔用品」「文書文具」與藥品、衛材並列為四大區塊（資料同存 consumables 表，用分類劃分視圖）

// 全域排序：最常盤點放最前，器械器具放最後
export const CATEGORY_ORDER = [
  "消毒清潔",          // 每日最常消耗
  "注射耗材（針具）",  // 注射頻率高
  "針筒",
  "紗布敷料",
  "固定包紮",
  "手套防護",
  "輸液注射",
  "清潔衛生",
  "清潔用品",
  "行政文書",
  "文書文具",
  "器械器具",          // 不需盤點，放最後
];

// 模組劃分：各自哪些分類
export const CLEANING_CATEGORIES = ["清潔衛生", "清潔用品"];
export const STATIONERY_CATEGORIES = ["行政文書", "文書文具"];
const NON_SUPPLY = new Set([...CLEANING_CATEGORIES, ...STATIONERY_CATEGORIES]);

// 衛材模組的分類（排除清潔/文書）
export const SUPPLY_CATEGORIES = CATEGORY_ORDER.filter(c => !NON_SUPPLY.has(c));

export type ConsumableModule = "supplies" | "cleaning" | "stationery";

export const MODULE_INFO: Record<ConsumableModule, {
  title: string;
  addTitle: string;
  countTitle: string;
  addPath: string;
  categories: string[];
}> = {
  supplies:   { title: "衛材清單", addTitle: "新增衛材品項", countTitle: "衛材盤點",     addPath: "/consumables/add", categories: SUPPLY_CATEGORIES },
  cleaning:   { title: "清潔用品", addTitle: "新增清潔用品", countTitle: "清潔用品盤點", addPath: "/cleaning/add",    categories: CLEANING_CATEGORIES },
  stationery: { title: "文書文具", addTitle: "新增文書文具", countTitle: "文書文具盤點", addPath: "/stationery/add",  categories: STATIONERY_CATEGORIES },
};

/** 判斷某分類屬於哪個模組 */
export function moduleOfCategory(category: string): ConsumableModule {
  if (CLEANING_CATEGORIES.includes(category)) return "cleaning";
  if (STATIONERY_CATEGORIES.includes(category)) return "stationery";
  return "supplies";
}

export function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, "zh-TW");
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
