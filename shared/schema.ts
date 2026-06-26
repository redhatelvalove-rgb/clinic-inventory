import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Clinics ──────────────────────────────────────────────────────────────────
export const clinics = sqliteTable("clinics", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const insertClinicSchema = createInsertSchema(clinics).omit({ id: true });
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinics.$inferSelect;

// ── Users ─────────────────────────────────────────────────────────────────────
// role: "superadmin" 可看全部診所, "staff" 只能看自己的 clinic
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("staff"), // "superadmin" | "staff"
  clinicId: text("clinic_id"),  // null 表示 superadmin（可看全部）
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Medications ───────────────────────────────────────────────────────────────
export const medications = sqliteTable("medications", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  barcode: text("barcode"),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  currentStock: integer("current_stock").notNull().default(0),
  safetyStock: integer("safety_stock").notNull(),
  reorderPoint: integer("reorder_point"),
  reorderQty: integer("reorder_qty"),
  storageCondition: text("storage_condition"),
  vendorId: text("vendor_id"),
  notes: text("notes"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const insertMedicationSchema = createInsertSchema(medications).omit({ id: true });
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medications.$inferSelect;

// ── Batches ───────────────────────────────────────────────────────────────────
export const batches = sqliteTable("med_batches", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  medId: text("med_id").notNull(),
  batchNumber: text("batch_number").notNull(),
  quantity: integer("quantity").notNull(),
  remainingQty: integer("remaining_qty").notNull(),
  expiryDate: text("expiry_date").notNull(),
  receivedDate: text("received_date").notNull(),
  unitCost: real("unit_cost"),
  poNumber: text("po_number"),
});

export const insertBatchSchema = createInsertSchema(batches).omit({ id: true });
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Batch = typeof batches.$inferSelect;

// ── Transactions ──────────────────────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  medId: text("med_id").notNull(),
  batchId: text("batch_id"),
  txnType: text("txn_type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  performedBy: text("performed_by"),
  txnTime: text("txn_time").notNull(),
  notes: text("notes"),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// ── Consumables ──────────────────────────────────────────────────────────────
// 衛材品項主表（盤點式管理，不逐次出庫）
export const consumables = sqliteTable("consumables", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),   // 注射耗材/針筒/消毒清潔/紗布敷料/固定包紮/手套防護/輸液注射/器械器具/行政文書/清潔衛生
  unit: text("unit").notNull(),           // 自由填寫：盒/箱/捲/包/桶...
  currentStock: real("current_stock").notNull().default(0),
  safetyStock: real("safety_stock").notNull().default(0),
  isDurable: integer("is_durable", { mode: "boolean" }).default(false), // 器械器具=true，不參與盤點消耗計算
  vendorId: text("vendor_id"),
  notes: text("notes"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const insertConsumableSchema = createInsertSchema(consumables).omit({ id: true });
export type InsertConsumable = z.infer<typeof insertConsumableSchema>;
export type Consumable = typeof consumables.$inferSelect;

// ── Inventory Counts ──────────────────────────────────────────────────────────
// 每次盤點快照（護理師輸入「現在剩幾個」）
export const inventoryCounts = sqliteTable("inventory_counts", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  countedAt: text("counted_at").notNull(),   // ISO datetime
  countedBy: text("counted_by").notNull(),   // 護理師姓名
  notes: text("notes"),                      // 盤點備註（選填）
});

export const insertInventoryCountSchema = createInsertSchema(inventoryCounts).omit({ id: true });
export type InsertInventoryCount = z.infer<typeof insertInventoryCountSchema>;
export type InventoryCount = typeof inventoryCounts.$inferSelect;

// ── Inventory Count Items ─────────────────────────────────────────────────────
// 每次盤點的每個品項紀錄
export const inventoryCountItems = sqliteTable("inventory_count_items", {
  id: text("id").primaryKey(),
  countId: text("count_id").notNull(),
  consumableId: text("consumable_id").notNull(),
  previousStock: real("previous_stock").notNull(), // 上次盤點量
  countedStock: real("counted_stock").notNull(),   // 本次盤點量
  consumed: real("consumed").notNull(),             // 消耗量（自動計算）
});

export const insertInventoryCountItemSchema = createInsertSchema(inventoryCountItems).omit({ id: true });
export type InsertInventoryCountItem = z.infer<typeof insertInventoryCountItemSchema>;
export type InventoryCountItem = typeof inventoryCountItems.$inferSelect;

// ── Expenses ─────────────────────────────────────────────────────────────────
// 費用憑證記錄（含人事、藥品、耗材、雜支等）
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  expenseDate: text("expense_date").notNull(),       // YYYY-MM-DD
  category: text("category").notNull(),              // 費用大分類
  subcategory: text("subcategory"),                  // 細項（可選）
  amount: real("amount").notNull(),                  // 含稅金額
  description: text("description"),                  // 說明備註
  vendorName: text("vendor_name"),                   // 廠商/店家名稱（自由填）
  receiptPhoto: text("receipt_photo"),               // base64 或檔案路徑
  recordedBy: text("recorded_by").notNull(),         // 護理師/人員姓名
  createdAt: text("created_at").notNull(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// ── Vendors ───────────────────────────────────────────────────────────────────
export const vendors = sqliteTable("vendors", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  leadTimeDays: integer("lead_time_days").default(5),
  notes: text("notes"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;
