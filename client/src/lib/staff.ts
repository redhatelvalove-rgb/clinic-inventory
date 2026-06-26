// 護理人員名單。
// ⚠️ 真實姓名屬個資，不得提交至 git。請放在同目錄下的 staff.local.ts
// （已由 .gitignore 排除），格式：export const NURSING_STAFF = ["王小明", ...]。
// 本機存在 staff.local.ts 時自動優先採用；否則 fallback 為下方代號，
// 確保任何人 clone 後仍可正常建置與執行。
const localModules = import.meta.glob<{ NURSING_STAFF?: string[] }>(
  "./staff.local.ts",
  { eager: true },
);
const localStaff = Object.values(localModules)[0]?.NURSING_STAFF;

export const NURSING_STAFF = localStaff ?? [
  "護理A",
  "護理B",
  "護理C",
  "護理D",
  "護理E",
  "護理F",
];
