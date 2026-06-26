import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, RotateCcw, Trash2, Download, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const TXN_ICONS: Record<string, any> = {
  IN:      { icon: ArrowDown,  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", label: "入庫" },
  OUT:     { icon: ArrowUp,    color: "text-red-600 dark:text-red-400",         bg: "bg-red-100 dark:bg-red-900/30",         label: "出庫" },
  ADJUST:  { icon: RotateCcw,  color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-100 dark:bg-blue-900/30",       label: "調整" },
  DISCARD: { icon: Trash2,     color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-100 dark:bg-amber-900/30",     label: "報廢" },
};

// ── 匯出 Excel（純前端，用 CSV 格式，Excel 可直接開啟）──────────────────────────
function exportToExcel(rows: any[], dateFrom: string, dateTo: string) {
  // BOM 讓 Excel 正確顯示中文
  const BOM = "\uFEFF";
  const headers = ["類型", "藥品ID", "藥品名稱", "數量", "病歷號碼", "使用日期", "操作人員", "紀錄時間"];

  const dataRows = rows.map(t => {
    const type = TXN_ICONS[t.txn_type]?.label || t.txn_type;
    // 從 reason 欄位解析病歷號碼和使用日期
    const patientMatch = t.reason?.match(/病歷號碼：([^｜\n]+)/);
    const useDateMatch  = t.reason?.match(/使用日期：([^\n]+)/);
    const patientId = patientMatch ? patientMatch[1].trim() : "—";
    const useDate   = useDateMatch  ? useDateMatch[1].trim()  : "—";

    return [
      type,
      t.med_id,
      t.med_name || "—",
      t.quantity,
      patientId,
      useDate,
      t.performed_by || "—",
      t.txn_time?.slice(0, 16) || "—",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  const csv = BOM + [headers.join(","), ...dataRows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const label = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : "全部";
  a.href = url;
  a.download = `骨立診所_出庫報表_${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Transactions() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo]     = useState(today);
  const [typeFilter, setTypeFilter] = useState("ALL");

  const { data: txns = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/transactions"],
  });

  // 前端篩選（日期 + 類型）
  const filtered = useMemo(() => {
    return txns.filter((t: any) => {
      const txnDate = t.txn_time?.slice(0, 10) || "";
      const inRange = (!dateFrom || txnDate >= dateFrom) && (!dateTo || txnDate <= dateTo);
      const inType  = typeFilter === "ALL" || t.txn_type === typeFilter;
      return inRange && inType;
    });
  }, [txns, dateFrom, dateTo, typeFilter]);

  const outOnly = filtered.filter((t: any) => t.txn_type === "OUT");

  return (
    <div className="space-y-4 max-w-4xl">
      {/* 標題 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-foreground">交易紀錄</h1>
          <p className="text-xs text-muted-foreground mt-0.5">所有入庫、出庫、調整與報廢紀錄</p>
        </div>
        {/* 匯出按鈕 */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => exportToExcel(outOnly, dateFrom, dateTo)}
          data-testid="button-export-excel"
          disabled={outOnly.length === 0}
        >
          <Download size={14} />
          匯出出庫報表 ({outOnly.length} 筆)
        </Button>
      </div>

      {/* 篩選列 */}
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap gap-3 items-end">
        <Filter size={14} className="text-muted-foreground self-center hidden md:block" />

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">開始日期</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 text-sm w-36" data-testid="input-date-from" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">結束日期</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 text-sm w-36" data-testid="input-date-to" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">類型</Label>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none"
            data-testid="select-txn-type">
            <option value="ALL">全部</option>
            <option value="OUT">出庫</option>
            <option value="IN">入庫</option>
            <option value="ADJUST">調整</option>
            <option value="DISCARD">報廢</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground self-end pb-1 ml-auto">
          共 <span className="font-semibold text-foreground">{filtered.length}</span> 筆
        </div>
      </div>

      {/* 表格 */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">類型</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden md:table-cell">藥品 ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">數量</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">病歷號碼</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">使用日期</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">操作人員</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden md:table-cell">紀錄時間</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        此期間無交易紀錄
                      </td>
                    </tr>
                  )
                  : filtered.map((t: any) => {
                    const meta = TXN_ICONS[t.txn_type] || TXN_ICONS.ADJUST;
                    const Icon = meta.icon;
                    // 解析病歷號碼和使用日期
                    const patientMatch = t.reason?.match(/病歷號碼：([^｜\n]+)/);
                    const useDateMatch  = t.reason?.match(/使用日期：([^\n]+)/);
                    const patientId = patientMatch ? patientMatch[1].trim() : (t.reason || "—");
                    const useDate   = useDateMatch  ? useDateMatch[1].trim()  : "—";

                    return (
                      <tr key={t.id} className="border-b border-border hover:bg-muted/30 transition-colors" data-testid={`txn-${t.id}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${meta.bg}`}>
                              <Icon size={11} className={meta.color} />
                            </div>
                            <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground hidden md:table-cell">{t.med_id}</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-mono text-sm font-medium ${t.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {t.quantity > 0 ? "+" : ""}{t.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-foreground font-medium">{patientId}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{useDate}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{t.performed_by || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap hidden md:table-cell">{t.txn_time?.slice(0, 16)}</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
