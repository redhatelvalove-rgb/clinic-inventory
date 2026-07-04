import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, lte, and, gte, sql } from "drizzle-orm";
import { medications, batches, transactions, vendors, users, clinics, consumables, inventoryCounts, inventoryCountItems, expenses } from "@shared/schema";
import type {
  Medication, InsertMedication, Batch, InsertBatch,
  Transaction, InsertTransaction, Vendor, InsertVendor,
  User, InsertUser, Clinic,
  Consumable, InsertConsumable,
  InventoryCount, InsertInventoryCount,
  InventoryCountItem, InsertInventoryCountItem,
  Expense, InsertExpense
} from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

// ── 建立資料表 ─────────────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    clinic_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL DEFAULT 'C001',
    name TEXT NOT NULL,
    generic_name TEXT,
    barcode TEXT,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    safety_stock INTEGER NOT NULL,
    reorder_point INTEGER,
    reorder_qty INTEGER,
    storage_condition TEXT,
    vendor_id TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    submitted_by TEXT,
    submitted_at TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    reject_reason TEXT
  );
  CREATE TABLE IF NOT EXISTS med_batches (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL DEFAULT 'C001',
    med_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    remaining_qty INTEGER NOT NULL,
    expiry_date TEXT NOT NULL,
    received_date TEXT NOT NULL,
    unit_cost REAL,
    po_number TEXT
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL DEFAULT 'C001',
    med_id TEXT NOT NULL,
    batch_id TEXT,
    txn_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT,
    performed_by TEXT,
    txn_time TEXT NOT NULL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL DEFAULT 'C001',
    company_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    lead_time_days INTEGER DEFAULT 5,
    notes TEXT,
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS consumables (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL DEFAULT 'C001',
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_stock REAL NOT NULL DEFAULT 0,
    safety_stock REAL NOT NULL DEFAULT 0,
    is_durable INTEGER DEFAULT 0,
    vendor_id TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS inventory_counts (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL DEFAULT 'C001',
    counted_at TEXT NOT NULL,
    counted_by TEXT NOT NULL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS inventory_count_items (
    id TEXT PRIMARY KEY,
    count_id TEXT NOT NULL,
    consumable_id TEXT NOT NULL,
    previous_stock REAL NOT NULL,
    counted_stock REAL NOT NULL,
    consumed REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    expense_date TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    amount REAL NOT NULL,
    description TEXT,
    vendor_name TEXT,
    receipt_photo TEXT,
    recorded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// ── Seed 三間診所 + 帳號 ─────────────────────────────────────────────────────
const clinicCount = (sqlite.prepare("SELECT COUNT(*) as c FROM clinics").get() as any).c;
if (clinicCount === 0) {
  const clinicList = [
    { id: "C001", name: "骨立診所" },
    { id: "C002", name: "華榮骨科" },
    { id: "C003", name: "大興骨科" },
  ];
  for (const c of clinicList) {
    sqlite.prepare("INSERT OR IGNORE INTO clinics VALUES (?,?,1)").run(c.id, c.name);
  }

  const now = new Date().toISOString();
  const adminHash = bcrypt.hashSync("guli2026", 10);
  const hw_hash = bcrypt.hashSync("hwarong2026", 10);
  const dx_hash = bcrypt.hashSync("daxing2026", 10);
  const superHash = bcrypt.hashSync("admin2026", 10);

  const userList = [
    { id: "U001", username: "admin", password_hash: superHash,    display_name: "系統管理員",  role: "superadmin", clinic_id: null },
    { id: "U002", username: "guli",  password_hash: adminHash,    display_name: "骨立診所",    role: "staff",      clinic_id: "C001" },
    { id: "U003", username: "hwarong", password_hash: hw_hash,   display_name: "華榮骨科",    role: "staff",      clinic_id: "C002" },
    { id: "U004", username: "daxing",  password_hash: dx_hash,   display_name: "大興骨科",    role: "staff",      clinic_id: "C003" },
  ];
  for (const u of userList) {
    sqlite.prepare("INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?,1,?)").run(
      u.id, u.username, u.password_hash, u.display_name, u.role, u.clinic_id, now
    );
  }
}

// ── Seed 藥品資料（僅骨立診所 C001）────────────────────────────────────────────
const seedCount = (sqlite.prepare("SELECT COUNT(*) as count FROM medications").get() as any).count;
if (seedCount === 0) {
  const seedVendors = [
    { id: "V001", clinic_id: "C001", company_name: "安進生技藥品（台灣）", lead_time_days: 7, notes: "Prolia 代理" },
    { id: "V002", clinic_id: "C001", company_name: "台灣安進 / 安斯泰來",  lead_time_days: 7, notes: "Evenity 代理" },
    { id: "V003", clinic_id: "C001", company_name: "Eulogiums / Bioventus 台灣", lead_time_days: 5, notes: "Durolane 代理" },
    { id: "V004", clinic_id: "C001", company_name: "待確認廠商",            lead_time_days: 5, notes: "多品項代理" },
    { id: "V005", clinic_id: "C001", company_name: "艾爾建（AbbVie）台灣", lead_time_days: 7, notes: "Botox 代理" },
  ];
  for (const v of seedVendors) {
    sqlite.prepare("INSERT OR IGNORE INTO vendors VALUES (?,?,?,NULL,NULL,NULL,?,?,1)").run(
      v.id, v.clinic_id, v.company_name, v.lead_time_days, v.notes
    );
  }

  const meds = [
    { id: "MED-001", name: "Artzdispo 雅節",       generic_name: "Sodium Hyaluronate",         category: "關節注射",    unit: "支", current_stock: 20, safety_stock: 8,  reorder_point: 12, reorder_qty: 10, storage_condition: "室溫 15–30°C，避光",    vendor_id: "V004" },
    { id: "MED-002", name: "ArtiAid Plus 優節益",  generic_name: "Sodium Hyaluronate",         category: "關節注射",    unit: "支", current_stock: 25, safety_stock: 10, reorder_point: 14, reorder_qty: 12, storage_condition: "室溫 15–30°C，避光",    vendor_id: "V004" },
    { id: "MED-003", name: "Durolane 膝舒適",      generic_name: "NASHA Hyaluronic Acid",      category: "關節注射",    unit: "支", current_stock: 5,  safety_stock: 2,  reorder_point: 3,  reorder_qty: 5,  storage_condition: "室溫 15–25°C，避光勿凍", vendor_id: "V003" },
    { id: "MED-004", name: "Polyxal 玻麗舒",       generic_name: "Sodium Hyaluronate",         category: "關節注射",    unit: "條", current_stock: 20, safety_stock: 8,  reorder_point: 10, reorder_qty: 10, storage_condition: "室溫，避光",             vendor_id: "V004" },
    { id: "MED-005", name: "Density 特適體",       generic_name: null,                         category: "骨質疏鬆",    unit: "盒", current_stock: 10, safety_stock: 4,  reorder_point: 5,  reorder_qty: 5,  storage_condition: "室溫，避光",             vendor_id: "V004" },
    { id: "MED-006", name: "Probone 補骨立素",     generic_name: null,                         category: "骨質疏鬆",    unit: "盒", current_stock: 10, safety_stock: 4,  reorder_point: 5,  reorder_qty: 5,  storage_condition: "室溫，避光",             vendor_id: "V004" },
    { id: "MED-007", name: "Prolia 保骼麗",        generic_name: "Denosumab 60mg/mL",          category: "骨質疏鬆針劑", unit: "支", current_stock: 18, safety_stock: 10, reorder_point: 15, reorder_qty: 15, storage_condition: "冷藏 2–8°C，禁凍避光",  vendor_id: "V001" },
    { id: "MED-008", name: "Evenity 益穩挺",       generic_name: "Romosozumab 105mg/1.17mL",   category: "骨質疏鬆針劑", unit: "盒", current_stock: 4,  safety_stock: 4,  reorder_point: 6,  reorder_qty: 5,  storage_condition: "冷藏 2–8°C，禁凍避光",  vendor_id: "V002" },
    { id: "MED-009", name: "Botox 肉毒桿菌素",    generic_name: "Botulinum Toxin Type A",      category: "神經阻斷劑",  unit: "瓶", current_stock: 2,  safety_stock: 1,  reorder_point: 2,  reorder_qty: 2,  storage_condition: "冷藏 2–8°C，禁凍",      vendor_id: "V005" },
  ];

  const today = new Date().toISOString().split("T")[0];
  const expiryMap: Record<string, string> = {
    "MED-001": "2027-03-15", "MED-002": "2027-06-20", "MED-003": "2026-09-10",
    "MED-004": "2027-02-28", "MED-005": "2027-08-31", "MED-006": "2026-08-15",
    "MED-007": "2026-08-01", "MED-008": "2026-07-25", "MED-009": "2026-08-30",
  };

  for (const m of meds) {
    sqlite.prepare("INSERT OR IGNORE INTO medications VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,NULL,1,'active',NULL,NULL,NULL,NULL,NULL)").run(
      m.id, "C001", m.name, m.generic_name,
      m.category, m.unit, m.current_stock, m.safety_stock,
      m.reorder_point, m.reorder_qty, m.storage_condition, m.vendor_id
    );
    const expiry = expiryMap[m.id] || "2027-12-31";
    sqlite.prepare("INSERT OR IGNORE INTO med_batches VALUES (?,?,?,?,?,?,?,?,NULL,NULL)").run(
      `BAT-${m.id}-A`, "C001", m.id, "INIT-2026",
      m.current_stock, m.current_stock, expiry, today
    );
  }
}

// ── Seed 衛材資料（骨立診所 C001）────────────────────────────────────────────
const supCount = (sqlite.prepare("SELECT COUNT(*) as c FROM consumables").get() as any).c;
if (supCount === 0) {
  // 衛材廠商（獨立 ID 空間 SV001–SV005，避免與藥品廠商 V001-V005 混淆）
  const supVendors = [
    { id: "SV001", clinic_id: "C001", company_name: "東橋醫療", lead_time_days: 3, notes: "主要衛材供應商" },
    { id: "SV002", clinic_id: "C001", company_name: "昱誠衛材", lead_time_days: 3, notes: "清潔用品主供應商" },
    { id: "SV003", clinic_id: "C001", company_name: "信東生技", lead_time_days: 5, notes: "輸液注射品" },
    { id: "SV004", clinic_id: "C001", company_name: "森華紙業", lead_time_days: 5, notes: "行政文書用品" },
    { id: "SV005", clinic_id: "C001", company_name: "立人醫材", lead_time_days: 5, notes: "抽血管、器械" },
  ];
  for (const v of supVendors) {
    sqlite.prepare("INSERT OR IGNORE INTO vendors VALUES (?,?,?,NULL,NULL,NULL,?,?,1)").run(
      v.id, v.clinic_id, v.company_name, v.lead_time_days, v.notes
    );
  }

  // 95 項衛材品項
  // 格式: [id, name, category, unit, current_stock, safety_stock, is_durable(0/1), vendor_id]
  const sups: [string, string, string, string, number, number, number, string][] = [
    // ── 注射耗材（針具）15 項 ────────────────────────────────────
    ["SUP-001", "蝴蝶針 23G",        "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-002", "蝴蝶針 24G",        "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-003", "蝴蝶針 25G",        "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-004", "針頭 18G（粉）",    "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-005", "針頭 20G（黃）",    "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-006", "針頭 21G 長針（綠）","注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-007", "針頭 22G（黑）",    "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-008", "針頭 23G（藍）",    "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-009", "針頭 23G 長針（藍）","注射耗材（針具）", "盒", 3, 1, 0, "SV001"],
    ["SUP-010", "針頭 25G 短（橘）", "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-011", "針頭 25G 長（橘）", "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-012", "針頭 27G（灰）",    "注射耗材（針具）", "盒", 5, 2, 0, "SV001"],
    ["SUP-013", "BD 針",             "注射耗材（針具）", "盒", 3, 1, 0, "SV001"],
    ["SUP-014", "TOP 針 18G",        "注射耗材（針具）", "盒", 3, 1, 0, "SV001"],
    ["SUP-015", "TOP 針 20G",        "注射耗材（針具）", "盒", 3, 1, 0, "SV001"],
    // ── 針筒 5 項 ────────────────────────────────────────────────
    ["SUP-016", "針筒 20CC",         "針筒",             "箱", 2, 1, 0, "SV001"],
    ["SUP-017", "針筒 10CC 螺旋",    "針筒",             "箱", 2, 1, 0, "SV001"],
    ["SUP-018", "針筒 10CC 直接",    "針筒",             "箱", 2, 1, 0, "SV001"],
    ["SUP-019", "針筒 5CC 螺旋",     "針筒",             "箱", 2, 1, 0, "SV001"],
    ["SUP-020", "針筒 3CC 螺旋",     "針筒",             "箱", 2, 1, 0, "SV001"],
    // ── 消毒清潔 10 項 ────────────────────────────────────────────
    ["SUP-021", "酒精 4000cc",       "消毒清潔",         "瓶", 4, 2, 0, "SV002"],
    ["SUP-022", "酒精性優碘（優點）","消毒清潔",         "瓶", 3, 1, 0, "SV001"],
    ["SUP-023", "普通優碘（優點）",  "消毒清潔",         "瓶", 3, 1, 0, "SV001"],
    ["SUP-024", "克菌寧 200ml",      "消毒清潔",         "瓶", 3, 1, 0, "SV001"],
    ["SUP-025", "好貼雙氧水 450CC",  "消毒清潔",         "瓶", 2, 1, 0, "SV001"],
    ["SUP-026", "安碘酒精液 4000cc", "消毒清潔",         "瓶", 2, 1, 0, "SV001"],
    ["SUP-027", "安碘液 4000cc",     "消毒清潔",         "瓶", 2, 1, 0, "SV001"],
    ["SUP-028", "沖洗棉棒（大）",    "消毒清潔",         "包", 5, 2, 0, "SV001"],
    ["SUP-029", "普通棉棒（小）",    "消毒清潔",         "包", 5, 2, 0, "SV001"],
    ["SUP-030", "棉球 100粒",        "消毒清潔",         "包", 5, 2, 0, "SV001"],
    // ── 紗布敷料 6 項 ────────────────────────────────────────────
    ["SUP-031", "大紗布 3X3",        "紗布敷料",         "包", 5, 2, 0, "SV001"],
    ["SUP-032", "小紗布 2X2",        "紗布敷料",         "包", 5, 2, 0, "SV001"],
    ["SUP-033", "不沾紗（大）",      "紗布敷料",         "包", 3, 1, 0, "SV001"],
    ["SUP-034", "不沾紗（小）",      "紗布敷料",         "包", 3, 1, 0, "SV001"],
    ["SUP-035", "親水性滅菌人工皮 15x15cm", "紗布敷料", "包", 2, 1, 0, "SV001"],
    ["SUP-036", "親水性抗菌人工皮 10x10cm", "紗布敷料", "包", 2, 1, 0, "SV001"],
    // ── 固定包紮 18 項 ───────────────────────────────────────────
    ["SUP-037", "三吋石膏",          "固定包紮",         "個", 3, 1, 0, "SV001"],
    ["SUP-038", "四吋石膏",          "固定包紮",         "個", 3, 1, 0, "SV001"],
    ["SUP-039", "五吋石膏",          "固定包紮",         "個", 3, 1, 0, "SV001"],
    ["SUP-040", "四吋棉捲",          "固定包紮",         "個", 5, 2, 0, "SV001"],
    ["SUP-041", "五吋棉捲",          "固定包紮",         "個", 5, 2, 0, "SV001"],
    ["SUP-042", "石膏襪套",          "固定包紮",         "個", 5, 2, 0, "SV001"],
    ["SUP-043", "3M 紗捲",           "固定包紮",         "捲", 5, 2, 0, "SV001"],
    ["SUP-044", "網狀繃帶 #1",       "固定包紮",         "盒", 2, 1, 0, "SV001"],
    ["SUP-045", "網狀繃帶 #4",       "固定包紮",         "盒", 2, 1, 0, "SV001"],
    ["SUP-046", "網狀繃帶 #6",       "固定包紮",         "盒", 2, 1, 0, "SV001"],
    ["SUP-047", "彈性繃帶 3x5Y",     "固定包紮",         "盒", 3, 1, 0, "SV001"],
    ["SUP-048", "彈性繃帶 4x5Y",     "固定包紮",         "盒", 3, 1, 0, "SV001"],
    ["SUP-049", "彈性紗捲 3切",      "固定包紮",         "捲", 5, 2, 0, "SV001"],
    ["SUP-050", "彈性紗捲 4切",      "固定包紮",         "捲", 5, 2, 0, "SV001"],
    ["SUP-051", "3M 紙膠",           "固定包紮",         "盒", 3, 1, 0, "SV001"],
    ["SUP-052", "透氣紙膠（白）",    "固定包紮",         "盒", 3, 1, 0, "SV001"],
    ["SUP-053", "手臂吊帶 S",        "固定包紮",         "個", 3, 1, 0, "SV001"],
    ["SUP-054", "手臂吊帶 M",        "固定包紮",         "個", 3, 1, 0, "SV001"],
    // ── 手套防護 7 項 ────────────────────────────────────────────
    ["SUP-055", "檢診手套（無粉）S", "手套防護",         "盒", 3, 1, 0, "SV001"],
    ["SUP-056", "檢診手套（無粉）M", "手套防護",         "盒", 3, 1, 0, "SV001"],
    ["SUP-057", "檢診手套（無粉）L", "手套防護",         "盒", 3, 1, 0, "SV001"],
    ["SUP-058", "無菌手套 6.5",      "手套防護",         "個", 5, 2, 0, "SV001"],
    ["SUP-059", "無菌手套 7.5",      "手套防護",         "個", 5, 2, 0, "SV001"],
    ["SUP-060", "口罩",              "手套防護",         "盒", 3, 1, 0, "SV001"],
    ["SUP-061", "紙洞巾",            "手套防護",         "個", 5, 2, 0, "SV001"],
    // ── 輸液注射 4 項 ────────────────────────────────────────────
    ["SUP-062", "20% 葡萄糖水",      "輸液注射",         "支", 5, 2, 0, "SV003"],
    ["SUP-063", "N/S 生理食鹽水",    "輸液注射",         "支", 5, 2, 0, "SV003"],
    ["SUP-064", "Diswater 注射用水", "輸液注射",         "支", 5, 2, 0, "SV003"],
    ["SUP-065", "換藥用生理食鹽水",  "輸液注射",         "瓶", 3, 1, 0, "SV003"],
    // ── 器械器具（isDurable=1）13 項 ─────────────────────────────
    ["SUP-066", "彎盆（小）20cm",    "器械器具",         "個", 2, 1, 1, "SV001"],
    ["SUP-067", "彎盆（中）21cm",    "器械器具",         "個", 2, 1, 1, "SV001"],
    ["SUP-068", "彎盆（大）22cm",    "器械器具",         "個", 2, 1, 1, "SV001"],
    ["SUP-069", "止血鉗（直）14cm", "器械器具",         "支", 2, 1, 1, "SV001"],
    ["SUP-070", "蚊式止血鉗（彎）",  "器械器具",         "支", 2, 1, 1, "SV001"],
    ["SUP-071", "外科剪刀 14cm 直雙尖","器械器具",       "支", 2, 1, 1, "SV001"],
    ["SUP-072", "外科剪刀 14cm 直尖圓","器械器具",       "支", 2, 1, 1, "SV001"],
    ["SUP-073", "眼科剪 11cm 直雙尖","器械器具",         "支", 2, 1, 1, "SV001"],
    ["SUP-074", "繃帶剪刀 18cm",     "器械器具",         "支", 2, 1, 1, "SV001"],
    ["SUP-075", "美式持針器 12cm",   "器械器具",         "支", 2, 1, 1, "SV001"],
    ["SUP-076", "美式持針器 14cm",   "器械器具",         "支", 2, 1, 1, "SV001"],
    ["SUP-077", "4吋夾子",           "器械器具",         "支", 2, 1, 1, "SV001"],
    ["SUP-078", "8吋夾子",           "器械器具",         "支", 2, 1, 1, "SV001"],
    // ── 行政文書 8 項 ────────────────────────────────────────────
    ["SUP-079", "A4 紙",             "行政文書",         "包", 5, 2, 0, "SV004"],
    ["SUP-080", "A6 紙",             "行政文書",         "包", 3, 1, 0, "SV004"],
    ["SUP-081", "名片",              "行政文書",         "盒", 2, 1, 0, "SV004"],
    ["SUP-082", "初診單",            "行政文書",         "包", 3, 1, 0, "SV004"],
    ["SUP-083", "PT 單（物理治療）", "行政文書",         "包", 3, 1, 0, "SV004"],
    ["SUP-084", "自費同意書",        "行政文書",         "份", 5, 2, 0, "SV004"],
    ["SUP-085", "印表機墨水",        "行政文書",         "瓶", 2, 1, 0, "SV004"],
    ["SUP-086", "印章墨水",          "行政文書",         "瓶", 2, 1, 0, "SV004"],
    // ── 清潔衛生 9 項 ────────────────────────────────────────────
    ["SUP-087", "衛生紙",            "清潔衛生",         "串", 3, 1, 0, "SV002"],
    ["SUP-088", "擦手紙",            "清潔衛生",         "箱", 2, 1, 0, "SV002"],
    ["SUP-089", "洗手乳",            "清潔衛生",         "桶", 2, 1, 0, "SV002"],
    ["SUP-090", "垃圾袋（大）",      "清潔衛生",         "包", 3, 1, 0, "SV002"],
    ["SUP-091", "垃圾袋（中）",      "清潔衛生",         "包", 3, 1, 0, "SV002"],
    ["SUP-092", "垃圾袋（小）",      "清潔衛生",         "包", 3, 1, 0, "SV002"],
    ["SUP-093", "感染性垃圾袋",      "清潔衛生",         "包", 3, 1, 0, "SV002"],
    ["SUP-094", "塑膠手提袋（3斤）", "清潔衛生",         "包", 2, 1, 0, "SV002"],
    ["SUP-095", "洗衣精",            "清潔衛生",         "桶", 2, 1, 0, "SV002"],
  ];

  for (const [id, name, category, unit, current_stock, safety_stock, is_durable, vendor_id] of sups) {
    sqlite.prepare(
      "INSERT OR IGNORE INTO consumables (id, clinic_id, name, category, unit, current_stock, safety_stock, is_durable, vendor_id, notes, is_active) VALUES (?,?,?,?,?,?,?,?,?,NULL,1)"
    ).run(id, "C001", name, category, unit, current_stock, safety_stock, is_durable, vendor_id);
  }
}

// ── Storage Interface ─────────────────────────────────────────────────────────
export interface IStorage {
  // Transaction：多步驟寫入必須包在同一個交易內，任一步失敗全部回滾
  runInTransaction<T>(fn: () => T): T;
  // Auth
  getUserByUsername(username: string): User | undefined;
  // Clinics
  getClinics(): Clinic[];
  // Medications
  getMedications(clinicId: string): Medication[];
  getMedicationById(id: string, clinicId: string): Medication | undefined;
  createMedication(data: InsertMedication): Medication;
  updateMedication(id: string, clinicId: string, data: Partial<InsertMedication>): Medication | undefined;
  // Batches
  getBatches(clinicId: string, medId?: string): Batch[];
  updateBatchRemaining(batchId: string, remainingQty: number): void;
  getExpiringBatches(clinicId: string, days: number): (Batch & { medName: string; unit: string })[];
  getLowStockMedications(clinicId: string): Medication[];
  createBatch(data: InsertBatch): Batch;
  // Transactions
  getTransactions(clinicId: string, medId?: string): Transaction[];
  createTransaction(data: InsertTransaction): Transaction;
  // Vendors
  getVendors(clinicId: string): Vendor[];
  // Dashboard
  getDashboardStats(clinicId: string): { totalMeds: number; expiringCount: number; lowStockCount: number; todayIn: number; todayOut: number; lowStockConsumables: number };
  // 待審核藥品
  getPendingMedications(clinicId: string): Medication[];
  submitMedication(data: InsertMedication & { submittedBy: string }): Medication;
  approveMedication(id: string, clinicId: string, reviewedBy: string): Medication | undefined;
  rejectMedication(id: string, clinicId: string, reviewedBy: string, reason: string): Medication | undefined;
  getPendingCount(clinicId: string): number;
  // Superadmin: 跨診所統計
  getAllClinicsStats(): { clinicId: string; clinicName: string; totalMeds: number; expiringCount: number; lowStockCount: number }[];

  // ── 衛材 (Consumables) ──────────────────────────────────────────────────────
  getConsumables(clinicId: string, category?: string): Consumable[];
  getConsumableById(id: string, clinicId: string): Consumable | undefined;
  getLowStockConsumables(clinicId: string): Consumable[];
  updateConsumableStock(id: string, clinicId: string, newStock: number): Consumable | undefined;
  createConsumable(data: InsertConsumable): Consumable;
  updateConsumable(id: string, clinicId: string, data: Partial<InsertConsumable>): Consumable | undefined;
  getConsumableCategories(clinicId: string): string[];

  // ── 盤點 (Inventory Counts) ──────────────────────────────────────────────────
  getInventoryCounts(clinicId: string, limit?: number): (InventoryCount & { itemCount: number })[];
  getInventoryCountById(id: string, clinicId: string): (InventoryCount & { items: (InventoryCountItem & { consumableName: string; unit: string })[] }) | undefined;
  createInventoryCount(data: { clinicId: string; countedBy: string; notes?: string; items: { consumableId: string; countedStock: number }[] }): InventoryCount;

  // ── 費用記錄 (Expenses) ──────────────────────────────────────────
  getExpenses(clinicId: string, opts?: { month?: string; category?: string; limit?: number }): Expense[];
  getExpenseById(id: string, clinicId: string): Expense | undefined;
  createExpense(data: Omit<Expense, 'id' | 'createdAt'>): Expense;
  updateExpense(id: string, clinicId: string, data: Partial<Omit<Expense, 'id' | 'clinicId' | 'createdAt'>>): Expense | undefined;
  deleteExpense(id: string, clinicId: string): boolean;
  getExpenseSummaryByMonth(clinicId: string, month: string): { category: string; total: number }[];
}

export const storage: IStorage = {
  runInTransaction(fn) {
    return sqlite.transaction(fn)();
  },

  getUserByUsername(username) {
    return sqlite.prepare("SELECT * FROM users WHERE username = ? AND is_active = 1").get(username) as User | undefined;
  },

  getClinics() {
    return sqlite.prepare("SELECT * FROM clinics WHERE is_active = 1").all() as Clinic[];
  },

  getMedications(clinicId) {
    return sqlite.prepare("SELECT * FROM medications WHERE clinic_id = ? AND is_active = 1").all(clinicId) as Medication[];
  },
  getMedicationById(id, clinicId) {
    return sqlite.prepare("SELECT * FROM medications WHERE id = ? AND clinic_id = ?").get(id, clinicId) as Medication | undefined;
  },
  createMedication(data) {
    const id = "MED-" + randomUUID().slice(0, 8).toUpperCase();
    return db.insert(medications).values({ ...data, id }).returning().get()!;
  },
  updateMedication(id, clinicId, data) {
    return sqlite.prepare(
      `UPDATE medications SET ${Object.keys(data).map(k => `${toSnake(k)} = ?`).join(", ")} WHERE id = ? AND clinic_id = ? RETURNING *`
    ).get(...Object.values(data), id, clinicId) as Medication | undefined;
  },

  updateBatchRemaining(batchId, remainingQty) {
    sqlite.prepare("UPDATE med_batches SET remaining_qty=? WHERE id=?").run(remainingQty, batchId);
  },

  getBatches(clinicId, medId) {
    if (medId) return sqlite.prepare("SELECT * FROM med_batches WHERE clinic_id = ? AND med_id = ?").all(clinicId, medId) as Batch[];
    return sqlite.prepare("SELECT * FROM med_batches WHERE clinic_id = ?").all(clinicId) as Batch[];
  },
  getExpiringBatches(clinicId, days) {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
    return sqlite.prepare(`
      SELECT b.*, m.name as medName, m.unit
      FROM med_batches b
      JOIN medications m ON b.med_id = m.id
      WHERE b.clinic_id = ? AND b.expiry_date BETWEEN ? AND ? AND b.remaining_qty > 0
      ORDER BY b.expiry_date ASC
    `).all(clinicId, today, future) as any[];
  },
  getLowStockMedications(clinicId) {
    return sqlite.prepare("SELECT * FROM medications WHERE clinic_id = ? AND current_stock <= safety_stock AND is_active = 1").all(clinicId) as Medication[];
  },
  createBatch(data) {
    const id = "BAT-" + randomUUID().slice(0, 8).toUpperCase();
    return db.insert(batches).values({ ...data, id }).returning().get()!;
  },

  getTransactions(clinicId, medId) {
    // LEFT JOIN 帶出藥品名稱（med_name），前端交易頁與 CSV 匯出需要
    if (medId) return sqlite.prepare("SELECT t.*, m.name AS med_name FROM transactions t LEFT JOIN medications m ON m.id = t.med_id WHERE t.clinic_id = ? AND t.med_id = ? ORDER BY t.txn_time DESC LIMIT 50").all(clinicId, medId) as Transaction[];
    return sqlite.prepare("SELECT t.*, m.name AS med_name FROM transactions t LEFT JOIN medications m ON m.id = t.med_id WHERE t.clinic_id = ? ORDER BY t.txn_time DESC LIMIT 100").all(clinicId) as Transaction[];
  },
  createTransaction(data) {
    const id = "TXN-" + randomUUID().slice(0, 8).toUpperCase();
    return db.insert(transactions).values({ ...data, id }).returning().get()!;
  },

  getVendors(clinicId) {
    return sqlite.prepare("SELECT * FROM vendors WHERE clinic_id = ? AND is_active = 1").all(clinicId) as Vendor[];
  },

  // ── 待審核藥品 ──────────────────────────────────────────────────────────────
  getPendingMedications(clinicId) {
    return sqlite.prepare("SELECT * FROM medications WHERE clinic_id = ? AND status = 'pending'").all(clinicId) as Medication[];
  },

  submitMedication(data) {
    const id = "MED-" + randomUUID().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO medications (id, clinic_id, name, generic_name, barcode, category, unit,
        current_stock, safety_stock, reorder_point, reorder_qty, storage_condition, vendor_id,
        notes, is_active, status, submitted_by, submitted_at)
      VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?,?,1,'pending',?,?)
    `).run(
      id, data.clinicId, data.name, data.genericName || null, data.barcode || null,
      data.category, data.unit, data.safetyStock,
      data.reorderPoint || null, data.reorderQty || null,
      data.storageCondition || null, data.vendorId || null,
      data.notes || null, data.submittedBy, now
    );
    return sqlite.prepare("SELECT * FROM medications WHERE id = ?").get(id) as Medication;
  },

  approveMedication(id, clinicId, reviewedBy) {
    const now = new Date().toISOString();
    return sqlite.prepare(`
      UPDATE medications SET status='active', is_active=1, reviewed_by=?, reviewed_at=?
      WHERE id=? AND clinic_id=? AND status='pending' RETURNING *
    `).get(reviewedBy, now, id, clinicId) as Medication | undefined;
  },

  rejectMedication(id, clinicId, reviewedBy, reason) {
    const now = new Date().toISOString();
    return sqlite.prepare(`
      UPDATE medications SET status='rejected', is_active=0, reviewed_by=?, reviewed_at=?, reject_reason=?
      WHERE id=? AND clinic_id=? AND status='pending' RETURNING *
    `).get(reviewedBy, now, reason, id, clinicId) as Medication | undefined;
  },

  getPendingCount(clinicId) {
    return (sqlite.prepare("SELECT COUNT(*) as c FROM medications WHERE clinic_id=? AND status='pending'").get(clinicId) as any).c;
  },

  getDashboardStats(clinicId) {
    const today = new Date().toISOString().split("T")[0];
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const totalMeds     = (sqlite.prepare("SELECT COUNT(*) as c FROM medications WHERE clinic_id=? AND is_active=1").get(clinicId) as any).c;
    const expiringCount = (sqlite.prepare("SELECT COUNT(*) as c FROM med_batches WHERE clinic_id=? AND expiry_date BETWEEN ? AND ? AND remaining_qty > 0").get(clinicId, today, in30) as any).c;
    const lowStockCount = (sqlite.prepare("SELECT COUNT(*) as c FROM medications WHERE clinic_id=? AND current_stock <= safety_stock AND is_active=1").get(clinicId) as any).c;
    const todayIn  = (sqlite.prepare("SELECT COALESCE(SUM(quantity),0) as c FROM transactions WHERE clinic_id=? AND txn_type='IN' AND DATE(txn_time)=?").get(clinicId, today) as any).c;
    const todayOut = (sqlite.prepare("SELECT COALESCE(SUM(ABS(quantity)),0) as c FROM transactions WHERE clinic_id=? AND txn_type='OUT' AND DATE(txn_time)=?").get(clinicId, today) as any).c;
    const lowStockConsumables = (sqlite.prepare("SELECT COUNT(*) as c FROM consumables WHERE clinic_id=? AND current_stock <= safety_stock AND is_active=1 AND is_durable=0").get(clinicId) as any).c;
    return { totalMeds, expiringCount, lowStockCount, todayIn, todayOut, lowStockConsumables };
  },

  getAllClinicsStats() {
    const today = new Date().toISOString().split("T")[0];
    const in30  = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const clinicList = sqlite.prepare("SELECT * FROM clinics WHERE is_active=1").all() as Clinic[];
    return clinicList.map(c => ({
      clinicId: c.id,
      clinicName: c.name,
      totalMeds:     (sqlite.prepare("SELECT COUNT(*) as n FROM medications WHERE clinic_id=? AND is_active=1").get(c.id) as any).n,
      expiringCount: (sqlite.prepare("SELECT COUNT(*) as n FROM med_batches WHERE clinic_id=? AND expiry_date BETWEEN ? AND ? AND remaining_qty>0").get(c.id, today, in30) as any).n,
      lowStockCount: (sqlite.prepare("SELECT COUNT(*) as n FROM medications WHERE clinic_id=? AND current_stock<=safety_stock AND is_active=1").get(c.id) as any).n,
    }));
  },

  // ── 衛材方法 ────────────────────────────────────────────────────────────────
  getConsumables(clinicId, category) {
    if (category) {
      return sqlite.prepare("SELECT * FROM consumables WHERE clinic_id=? AND category=? AND is_active=1 ORDER BY category, name").all(clinicId, category) as Consumable[];
    }
    return sqlite.prepare("SELECT * FROM consumables WHERE clinic_id=? AND is_active=1 ORDER BY category, name").all(clinicId) as Consumable[];
  },

  getConsumableById(id, clinicId) {
    return sqlite.prepare("SELECT * FROM consumables WHERE id=? AND clinic_id=?").get(id, clinicId) as Consumable | undefined;
  },

  getLowStockConsumables(clinicId) {
    return sqlite.prepare(
      "SELECT * FROM consumables WHERE clinic_id=? AND is_active=1 AND is_durable=0 AND current_stock <= safety_stock ORDER BY category, name"
    ).all(clinicId) as Consumable[];
  },

  updateConsumableStock(id, clinicId, newStock) {
    return sqlite.prepare(
      "UPDATE consumables SET current_stock=? WHERE id=? AND clinic_id=? RETURNING *"
    ).get(newStock, id, clinicId) as Consumable | undefined;
  },

  createConsumable(data) {
    const id = "SUP-" + randomUUID().slice(0, 8).toUpperCase();
    return db.insert(consumables).values({ ...data, id }).returning().get()!;
  },

  updateConsumable(id, clinicId, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return storage.getConsumableById(id, clinicId);
    return sqlite.prepare(
      `UPDATE consumables SET ${keys.map(k => `${toSnake(k)} = ?`).join(", ")} WHERE id=? AND clinic_id=? RETURNING *`
    ).get(...Object.values(data), id, clinicId) as Consumable | undefined;
  },

  getConsumableCategories(clinicId) {
    const rows = sqlite.prepare(
      "SELECT DISTINCT category FROM consumables WHERE clinic_id=? AND is_active=1 ORDER BY category"
    ).all(clinicId) as { category: string }[];
    return rows.map(r => r.category);
  },

  // ── 盤點方法 ────────────────────────────────────────────────────────────────
  getInventoryCounts(clinicId, limit = 50) {
    const counts = sqlite.prepare(
      "SELECT ic.*, COUNT(ici.id) as itemCount FROM inventory_counts ic LEFT JOIN inventory_count_items ici ON ic.id = ici.count_id WHERE ic.clinic_id=? GROUP BY ic.id ORDER BY ic.counted_at DESC LIMIT ?"
    ).all(clinicId, limit) as any[];
    return counts;
  },

  getInventoryCountById(id, clinicId) {
    const count = sqlite.prepare("SELECT * FROM inventory_counts WHERE id=? AND clinic_id=?").get(id, clinicId) as InventoryCount | undefined;
    if (!count) return undefined;
    const items = sqlite.prepare(`
      SELECT ici.*, c.name as consumableName, c.unit
      FROM inventory_count_items ici
      JOIN consumables c ON ici.consumable_id = c.id
      WHERE ici.count_id=?
      ORDER BY c.category, c.name
    `).all(id) as any[];
    return { ...count, items };
  },

  createInventoryCount(data) {
    // 主檔＋逐項寫入包在同一交易，避免中途失敗留下半套盤點
    return sqlite.transaction(() => {
      const countId = "CNT-" + randomUUID().slice(0, 8).toUpperCase();
      const now = new Date().toISOString();

      sqlite.prepare(
        "INSERT INTO inventory_counts (id, clinic_id, counted_at, counted_by, notes) VALUES (?,?,?,?,?)"
      ).run(countId, data.clinicId, now, data.countedBy, data.notes || null);

      for (const item of data.items) {
        const prev = (sqlite.prepare("SELECT current_stock FROM consumables WHERE id=?").get(item.consumableId) as any)?.current_stock ?? 0;
        const consumed = Math.max(0, prev - item.countedStock);
        const itemId = "ITM-" + randomUUID().slice(0, 8).toUpperCase();
        sqlite.prepare(
          "INSERT INTO inventory_count_items (id, count_id, consumable_id, previous_stock, counted_stock, consumed) VALUES (?,?,?,?,?,?)"
        ).run(itemId, countId, item.consumableId, prev, item.countedStock, consumed);
        // 更新衛材現存量
        sqlite.prepare("UPDATE consumables SET current_stock=? WHERE id=?").run(item.countedStock, item.consumableId);
      }

      return sqlite.prepare("SELECT * FROM inventory_counts WHERE id=?").get(countId) as InventoryCount;
    })();
  },

  // ── 費用記錄實作 ───────────────────────────────────────────────────────
  getExpenses(clinicId, opts = {}) {
    let q = "SELECT * FROM expenses WHERE clinic_id=?";
    const params: any[] = [clinicId];
    if (opts.month) { q += " AND substr(expense_date,1,7)=?"; params.push(opts.month); }
    if (opts.category) { q += " AND category=?"; params.push(opts.category); }
    q += " ORDER BY expense_date DESC, created_at DESC";
    if (opts.limit) { q += " LIMIT ?"; params.push(opts.limit); }
    return sqlite.prepare(q).all(...params) as Expense[];
  },

  getExpenseById(id, clinicId) {
    return sqlite.prepare("SELECT * FROM expenses WHERE id=? AND clinic_id=?").get(id, clinicId) as Expense | undefined;
  },

  createExpense(data) {
    const id = "EXP-" + randomUUID().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    sqlite.prepare(
      "INSERT INTO expenses (id, clinic_id, expense_date, category, subcategory, amount, description, vendor_name, receipt_photo, recorded_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).run(id, data.clinicId, data.expenseDate, data.category, data.subcategory || null, data.amount, data.description || null, data.vendorName || null, data.receiptPhoto || null, data.recordedBy, now);
    return sqlite.prepare("SELECT * FROM expenses WHERE id=?").get(id) as Expense;
  },

  updateExpense(id, clinicId, data) {
    const fields = Object.entries(data).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.getExpenseById(id, clinicId);
    const setClause = fields.map(([k]) => `${toSnake(k)} = ?`).join(", ");
    const values = fields.map(([, v]) => v);
    sqlite.prepare(`UPDATE expenses SET ${setClause} WHERE id=? AND clinic_id=?`).run(...values, id, clinicId);
    return sqlite.prepare("SELECT * FROM expenses WHERE id=?").get(id) as Expense | undefined;
  },

  deleteExpense(id, clinicId) {
    const result = sqlite.prepare("DELETE FROM expenses WHERE id=? AND clinic_id=?").run(id, clinicId);
    return result.changes > 0;
  },

  getExpenseSummaryByMonth(clinicId, month) {
    return sqlite.prepare(
      "SELECT category, SUM(amount) as total FROM expenses WHERE clinic_id=? AND substr(expense_date,1,7)=? GROUP BY category ORDER BY total DESC"
    ).all(clinicId, month) as { category: string; total: number }[];
  },
};

// 小工具：camelCase → snake_case
function toSnake(s: string) {
  return s.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
}
