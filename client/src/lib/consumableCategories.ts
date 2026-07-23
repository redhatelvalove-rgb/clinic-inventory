// 衛材分類排序：最常盤點放最前，器械器具放最後
export const CATEGORY_ORDER = [
  "消毒清潔",          // 每日最常消耗
  "注射耗材（針具）",  // 注射頻率高
  "針筒",
  "紗布敷料",
  "固定包紮",
  "手套防護",
  "輸液注射",
  "清潔衛生",
  "行政文書",
  "食品",
  "清潔用品",
  "文書文具",
  "器械器具",          // 不需盤點，放最後
];

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
