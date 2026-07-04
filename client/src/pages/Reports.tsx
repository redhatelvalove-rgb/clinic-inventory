import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, FileBarChart, Thermometer, Package, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { taipeiToday, formatTaipeiDateTime } from "@shared/date-utils";

const TXN_LABEL: Record<string, string> = { IN: "入庫", OUT: "出庫", DISCARD: "報廢", ADJUST: "調整" };

function recentMonths(): string[] {
  const [y0, m0] = taipeiToday().slice(0, 7).split("-").map(Number);
  const months: string[] = [];
  let y = y0, m = m0;
  for (let i = 0; i < 12; i++) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1; if (m === 0) { m = 12; y -= 1; }
  }
  return months;
}

/** 報表共用頁首（列印時呈現正式文件格式） */
function ReportHeader({ title, month }: { title: string; month: string }) {
  return (
    <div className="text-center mb-4">
      <div className="text-xs tracking-widest text-[#8a6d4f] mb-1">骨立診所</div>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground mt-0.5">
        {month.replace("-", " 年 ")} 月
      </div>
    </div>
  );
}

function ReportFooter() {
  return (
    <div className="flex justify-between text-xs text-muted-foreground mt-4 pt-2 border-t">
      <span>製表：CIMS 庫存系統</span>
      <span>列印時間：{formatTaipeiDateTime(new Date().toISOString())}</span>
      <span>核章：＿＿＿＿＿＿＿＿</span>
    </div>
  );
}

const th = "border border-border bg-muted/60 px-2 py-1.5 text-xs font-semibold";
const td = "border border-border px-2 py-1.5 text-xs text-center";

/** ① 玻尿酸（關節注射類）進出庫月報 */
function HaReport({ month }: { month: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/category", month],
    queryFn: () => apiRequest("GET", `/api/reports/category?month=${month}`).then(r => r.json()),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">載入中…</p>;
  if (!data) return null;

  return (
    <div className="print-area bg-background p-2">
      <ReportHeader title="玻尿酸庫存進出月報表" month={month} />

      {/* 批次彙總 */}
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th className={th}>品名</th><th className={th}>批號</th><th className={th}>效期</th>
            <th className={th}>期初庫存</th><th className={th}>本期進貨</th><th className={th}>本期使用</th>
            <th className={th}>本期報廢</th><th className={th}>調整</th><th className={th}>期末庫存</th>
          </tr>
        </thead>
        <tbody>
          {data.meds.map((med: any) => (
            med.batches.length === 0 ? (
              <tr key={med.medId}>
                <td className={`${td} text-left font-medium`}>{med.name}</td>
                <td className={td} colSpan={8}>（無批次資料）</td>
              </tr>
            ) : (
              med.batches.map((b: any, i: number) => (
                <tr key={med.medId + b.batchNumber}>
                  {i === 0 && (
                    <td className={`${td} text-left font-medium`} rowSpan={med.batches.length}>
                      {med.name}<span className="text-muted-foreground">（{med.unit}）</span>
                    </td>
                  )}
                  <td className={`${td} mono`}>{b.batchNumber}</td>
                  <td className={`${td} mono`}>{b.expiryDate}</td>
                  <td className={`${td} mono`}>{b.startStock}</td>
                  <td className={`${td} mono`}>{b.inQty || ""}</td>
                  <td className={`${td} mono`}>{b.outQty || ""}</td>
                  <td className={`${td} mono`}>{b.discardQty || ""}</td>
                  <td className={`${td} mono`}>{b.adjustQty || ""}</td>
                  <td className={`${td} mono font-semibold`}>{b.endStock}</td>
                </tr>
              ))
            )
          ))}
        </tbody>
      </table>

      {/* 交易明細 */}
      <div className="text-sm font-semibold mb-1.5">本月異動明細（共 {data.details.length} 筆）</div>
      {data.details.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-border rounded px-3 py-4 text-center mb-2">本月無異動紀錄</p>
      ) : (
        <table className="w-full border-collapse mb-2">
          <thead>
            <tr>
              <th className={th}>日期時間</th><th className={th}>品名</th><th className={th}>批號</th>
              <th className={th}>類型</th><th className={th}>數量</th><th className={th}>操作人員</th><th className={th}>原因/備註</th>
            </tr>
          </thead>
          <tbody>
            {data.details.map((t: any, i: number) => (
              <tr key={i}>
                <td className={`${td} mono whitespace-nowrap`}>{formatTaipeiDateTime(t.txn_time)}</td>
                <td className={`${td} text-left`}>{t.med_name}</td>
                <td className={`${td} mono`}>{t.batch_number || "—"}</td>
                <td className={td}>{TXN_LABEL[t.txn_type] || t.txn_type}</td>
                <td className={`${td} mono`}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                <td className={td}>{t.performed_by}</td>
                <td className={`${td} text-left`}>{t.reason || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ReportFooter />
    </div>
  );
}

/** ② 冰箱溫度月表（對齊紙本格式） */
function FridgeReport({ month }: { month: string }) {
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fridge-temps", month],
    queryFn: () => apiRequest("GET", `/api/fridge-temps?month=${month}`).then(r => r.json()),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">載入中…</p>;

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const byKey: Record<string, any> = {};
  for (const l of logs) byKey[`${l.log_date}|${l.slot}`] = l;

  const cell = (day: number, slot: "AM" | "PM") => {
    const log = byKey[`${month}-${String(day).padStart(2, "0")}|${slot}`];
    if (!log) return { temp: "", by: "", cls: "" };
    return {
      temp: `${log.temperature}°C`,
      by: log.recorded_by,
      cls: log.abnormal ? "bg-red-50 text-red-700 font-semibold" : "",
      action: log.action_taken,
    };
  };

  const abnormalLogs = logs.filter(l => l.abnormal);

  return (
    <div className="print-area bg-background p-2">
      <ReportHeader title="藥品冰箱溫度紀錄表" month={month} />
      <table className="w-full border-collapse mb-3">
        <thead>
          <tr>
            <th className={th}>日期</th>
            <th className={th}>上午溫度</th><th className={th}>記錄人</th>
            <th className={th}>下午溫度</th><th className={th}>記錄人</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const am = cell(day, "AM"), pm = cell(day, "PM");
            return (
              <tr key={day}>
                <td className={`${td} mono`}>{day}</td>
                <td className={`${td} mono ${am.cls}`}>{am.temp}</td>
                <td className={td}>{am.by}</td>
                <td className={`${td} mono ${pm.cls}`}>{pm.temp}</td>
                <td className={td}>{pm.by}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {abnormalLogs.length > 0 && (
        <div className="mb-3">
          <div className="text-sm font-semibold text-red-600 mb-1">異常紀錄與處理措施</div>
          {abnormalLogs.map((l, i) => (
            <p key={i} className="text-xs border border-red-200 bg-red-50 rounded px-2.5 py-1.5 mb-1">
              {l.log_date} {l.slot === "AM" ? "上午" : "下午"} {l.temperature}°C（{l.recorded_by}）：{l.action_taken}
            </p>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>1. 每日上午 9 點及下午 6 點監測冰箱溫度，一天兩次。</p>
        <p>2. 冰箱溫度應保持在 2°C～8°C，若發現異常請通報主管維修，並先將藥品移至另一個冰箱存放。</p>
        <p>3. 藥品冰箱請勿存放食物或飲料。</p>
      </div>
      <ReportFooter />
    </div>
  );
}

/** ③ 衛材月消耗表 */
function ConsumableReport({ month }: { month: string }) {
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/consumables", month],
    queryFn: () => apiRequest("GET", `/api/reports/consumables?month=${month}`).then(r => r.json()),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">載入中…</p>;

  return (
    <div className="print-area bg-background p-2">
      <ReportHeader title="衛材月進貨／消耗統計表" month={month} />
      <table className="w-full border-collapse mb-2">
        <thead>
          <tr>
            <th className={th}>分類</th><th className={th}>品名</th><th className={th}>單位</th>
            <th className={th}>本月進貨</th><th className={th}>本月消耗</th>
            <th className={th}>目前庫存</th><th className={th}>安全量</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className={r.current_stock <= r.safety_stock ? "bg-amber-50" : ""}>
              <td className={td}>{r.category}</td>
              <td className={`${td} text-left`}>{r.name}</td>
              <td className={td}>{r.unit}</td>
              <td className={`${td} mono`}>{r.restocked || ""}</td>
              <td className={`${td} mono`}>{r.consumed || ""}</td>
              <td className={`${td} mono font-semibold`}>{r.current_stock}</td>
              <td className={`${td} mono`}>{r.safety_stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">消耗量來源：本月盤點結果與進貨紀錄推算（消耗＝盤點前數量−盤點數量）。底色標記＝目前低於安全量。</p>
      <ReportFooter />
    </div>
  );
}

const REPORTS = [
  { key: "ha",     label: "玻尿酸進出庫", icon: Syringe,     hint: "衛生局檢查用" },
  { key: "fridge", label: "冰箱溫度月表", icon: Thermometer, hint: "2–8°C 保存紀錄" },
  { key: "consumables", label: "衛材消耗", icon: Package,   hint: "月進貨/消耗" },
] as const;

export default function Reports() {
  const [month, setMonth] = useState(taipeiToday().slice(0, 7));
  const [report, setReport] = useState<string>("ha");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* 工具列（不列印） */}
      <div className="no-print space-y-3">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold flex-1">報表中心</h1>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-32" data-testid="select-month"><SelectValue /></SelectTrigger>
            <SelectContent>
              {recentMonths().map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => window.print()} data-testid="btn-print">
            <Printer className="w-4 h-4 mr-1.5" />列印
          </Button>
        </div>

        <div className="flex gap-2">
          {REPORTS.map(({ key, label, icon: Icon, hint }) => (
            <button key={key} onClick={() => setReport(key)}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                report === key ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
              data-testid={`report-tab-${key}`}>
              <div className={`flex items-center gap-1.5 text-sm font-medium ${report === key ? "text-primary" : ""}`}>
                <Icon size={15} />{label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 報表本體（列印範圍） */}
      <div className="border border-border rounded-lg p-3 md:p-5 bg-background overflow-x-auto">
        {report === "ha" && <HaReport month={month} />}
        {report === "fridge" && <FridgeReport month={month} />}
        {report === "consumables" && <ConsumableReport month={month} />}
      </div>
    </div>
  );
}
