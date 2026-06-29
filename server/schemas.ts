/**
 * server/schemas.ts
 * 所有 API endpoint 的 Zod 輸入驗證 schema
 * 每個 schema 對應一個 POST/PATCH 操作
 */
import { z } from "zod";

// ── 共用工具 ──────────────────────────────────────────────────────────────────

/** 非空白字串 */
const nonEmpty = z.string().trim().min(1, "不可為空白");

/** YYYY-MM-DD 日期字串 */
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式應為 YYYY-MM-DD");

/** 正整數（含 0） */
const nonNegInt = z.number({ coerce: true }).int().min(0);

/** 正數（含 0），允許小數 */
const nonNegNum = z.number({ coerce: true }).min(0);

/** 正數，必須 > 0 */
const positiveNum = z.number({ coerce: true }).positive("金額必須大於 0");

// ── 認證 ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: nonEmpty,
  password: nonEmpty,
});

export const refreshSchema = z.object({
  refreshToken: nonEmpty,
});

// ── 藥品 (Medications) ────────────────────────────────────────────────────────

export const createMedicationSchema = z.object({
  name:             nonEmpty,
  genericName:      z.string().trim().optional().nullable(),
  category:         nonEmpty,
  unit:             nonEmpty,
  safetyStock:      nonNegInt,
  reorderPoint:     nonNegInt.optional().nullable(),
  reorderQty:       nonNegInt.optional().nullable(),
  storageCondition: z.string().trim().optional().nullable(),
  vendorId:         z.string().trim().optional().nullable(),
  barcode:          z.string().trim().optional().nullable(),
  notes:            z.string().trim().optional().nullable(),
  submittedBy:      z.string().trim().optional(),
});

export const updateMedicationSchema = createMedicationSchema.partial();

// ── 入庫 (Stock-in) ────────────────────────────────────────────────────────────

export const stockInSchema = z.object({
  medId:       nonEmpty,
  batchNumber: nonEmpty,
  quantity:    z.number({ coerce: true }).int().positive("數量必須大於 0"),
  expiryDate:  dateStr,
  unitCost:    z.number({ coerce: true }).min(0).optional().nullable(),
  poNumber:    z.string().trim().optional().nullable(),
  performedBy: z.string().trim().optional(),
});

// ── 出庫 (Stock-out) ────────────────────────────────────────────────────────────

export const stockOutSchema = z.object({
  medId:       nonEmpty,
  quantity:    z.number({ coerce: true }).int().positive("數量必須大於 0"),
  reason:      z.string().trim().optional(),
  performedBy: z.string().trim().optional(),
  batchId:     z.string().trim().optional().nullable(), // FEFO 可指定批次
});

// ── 報廢 (Disposal) ──────────────────────────────────────────────────────────────
// 將指定批次的數量報廢（過期、破損、汙染等），扣批次與總庫存並留軌跡。

export const disposalSchema = z.object({
  medId:       nonEmpty,
  batchId:     nonEmpty,
  quantity:    z.number({ coerce: true }).int().positive("數量必須大於 0"),
  reason:      nonEmpty, // 報廢原因必填
  performedBy: z.string().trim().optional(),
});

// ── 手動調整 (Adjustment) ────────────────────────────────────────────────────────
// 將指定批次的剩餘量直接設為新值（盤點修正），差額同步總庫存並留軌跡。

export const adjustmentSchema = z.object({
  medId:           nonEmpty,
  batchId:         nonEmpty,
  newRemainingQty: nonNegInt,
  reason:          nonEmpty, // 調整原因必填
  performedBy:     z.string().trim().optional(),
});

// ── 審核 ────────────────────────────────────────────────────────────────────────

export const approveSchema = z.object({
  reviewedBy: z.string().trim().optional(),
});

export const rejectSchema = z.object({
  reviewedBy: z.string().trim().optional(),
  reason:     z.string().trim().optional(),
});

// ── 衛材 (Consumables) ────────────────────────────────────────────────────────

export const createConsumableSchema = z.object({
  name:        nonEmpty,
  category:    nonEmpty,
  unit:        nonEmpty,
  safetyStock: nonNegNum.optional().default(0),
  vendorId:    z.string().trim().optional().nullable(),
  isDurable:   z.boolean().optional().default(false),
  notes:       z.string().trim().optional().nullable(),
});

export const updateConsumableSchema = createConsumableSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

// ── 盤點 (Inventory Count) ────────────────────────────────────────────────────

const inventoryCountItemSchema = z.object({
  consumableId: nonEmpty,
  countedStock: nonNegNum,
});

export const createInventoryCountSchema = z.object({
  countedBy: nonEmpty,
  notes:     z.string().trim().optional().nullable(),
  items:     z
    .array(inventoryCountItemSchema)
    .min(1, "至少需要一項盤點品項"),
});

// ── 費用 (Expenses) ────────────────────────────────────────────────────────────

/** 費用分類白名單 */
export const VALID_EXPENSE_CATEGORIES = [
  "人事費用", "藥品採購", "復健耗材", "護具採購",
  "衛材採購", "檢驗費用", "通訊費", "餐飲",
  "郵資", "設備維修", "辦公用品", "醫師會費", "其他雜支",
] as const;

export const createExpenseSchema = z.object({
  expenseDate:  dateStr,
  category:     z.enum(VALID_EXPENSE_CATEGORIES, { message: "請選擇有效的費用分類" }),
  subcategory:  z.string().trim().max(50).optional().nullable(),
  amount:       positiveNum,
  description:  z.string().trim().max(500).optional().nullable(),
  vendorName:   z.string().trim().max(100).optional().nullable(),
  receiptPhoto: z
    .string()
    .optional()
    .nullable()
    .refine(
      v => !v || v.startsWith("data:image/"),
      "憑證照片格式不正確（需為 base64 圖片）"
    ),
  recordedBy: nonEmpty,
});

export const updateExpenseSchema = createExpenseSchema.partial();

// ── 月份格式驗證 ─────────────────────────────────────────────────────────────

export const monthParamSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month 格式應為 YYYY-MM"),
});

// ── 通用 helper ──────────────────────────────────────────────────────────────

/**
 * 解析並驗證請求 body，若失敗直接回應 400
 * 使用方式：
 *   const body = parseBody(req, res, createExpenseSchema);
 *   if (!body) return;
 */
export function parseBody<T>(
  req: import("express").Request,
  res: import("express").Response,
  schema: z.ZodSchema<T>
): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "輸入資料格式錯誤",
      details: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
}

/**
 * 解析並驗證 query 參數
 */
export function parseQuery<T>(
  req: import("express").Request,
  res: import("express").Response,
  schema: z.ZodSchema<T>
): T | null {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({
      error: "查詢參數格式錯誤",
      details: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
}
