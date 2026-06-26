// 費用分類清單（依實際診所支出整理）
export interface ExpenseCategory {
  label: string;
  subcategories?: string[];
  color: string; // Tailwind bg class
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    label: "人事費用",
    subcategories: ["護理人員 PPF", "兼職治療師 PPF", "醫師 PPF", "清潔人員鐘點費", "兼職人員鐘點費"],
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  {
    label: "藥品採購",
    subcategories: ["祐立康", "赫麗膚", "上好記", "優節益", "破傷風", "膝舒適", "其他藥品"],
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    label: "復健耗材",
    subcategories: ["騰彥", "其他復健耗材"],
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  },
  {
    label: "護具採購",
    subcategories: ["正全", "華莘", "其他護具"],
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  },
  {
    label: "衛材採購",
    subcategories: ["東橋儀器", "大橋醫療", "3M", "其他衛材廠商"],
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  },
  {
    label: "檢驗費用",
    subcategories: ["尚捷", "其他檢驗"],
    color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  },
  {
    label: "通訊費",
    subcategories: ["中華電信", "其他通訊"],
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    label: "餐飲",
    subcategories: ["便當", "飲料", "點心", "全聯採購"],
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  {
    label: "郵資",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  {
    label: "設備維修",
    subcategories: ["X光維修", "X光年費", "洗衣機維修/清潔", "冷氣維修/清潔", "其他設備維修"],
    color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  },
  {
    label: "辦公用品",
    subcategories: ["A4紙張", "清潔用品", "其他文具"],
    color: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  },
  {
    label: "醫師會費",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  {
    label: "其他雜支",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
];

export const CATEGORY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.label, c.color])
);
