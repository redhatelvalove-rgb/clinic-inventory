import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Search, Filter, Pill, Thermometer, AlertTriangle, Pencil, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import EditMedicationModal from "@/components/EditMedicationModal";

const CATEGORY_COLORS: Record<string, string> = {
  "關節注射": "badge-info",
  "骨質疏鬆": "badge-success",
  "骨質疏鬆針劑": "badge-purple",
  "神經阻斷劑": "badge-warning",
};

function StorageBadge({ cond }: { cond: string }) {
  const isCold = cond.includes("冷藏");
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${isCold ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
      {isCold && <Thermometer size={10} />}
      {cond}
    </span>
  );
}

function StockStatus({ current, safety, reorder }: { current: number; safety: number; reorder?: number }) {
  const max = Math.max(current, (reorder || safety) * 2, 1);
  const pct = Math.min((current / max) * 100, 100);
  // 兩級警示：低於安全量＝紅（需補貨）、剛好等於＝黃（注意）
  const isBelow = current < safety;
  const isAtSafety = current === safety;
  const isWarning = !isBelow && !isAtSafety && current <= (reorder || safety * 1.5);
  const color = isBelow ? "bg-red-500" : (isAtSafety || isWarning) ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={isBelow ? "text-red-600 dark:text-red-400 font-medium" : isAtSafety ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
          {(isBelow || isAtSafety) && <AlertTriangle size={10} className="inline mr-1" />}
          {current}
        </span>
        <span className="text-muted-foreground">安全 {safety}</span>
      </div>
      <div className="stock-bar-track">
        <div className={`stock-bar-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Medications() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const { data: meds = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/medications"] });
  const { data: expiringBatches = [] } = useQuery<any[]>({ queryKey: ["/api/batches/expiring"] });
  const expiringMedIds = new Set(expiringBatches.map((b: any) => b.med_id));

  const filtered = meds.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.generic_name || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || m.category === category;
    return matchSearch && matchCat;
  });

  const categories = Array.from(new Set(meds.map((m: any) => m.category)));

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">藥品管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">共 {meds.length} 項藥品</p>
        </div>
        <Link href="/add-medication">
          <Button size="sm" data-testid="btn-add-medication">
            <Plus className="w-4 h-4 mr-1" />新增品項
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="搜尋藥品名稱或學名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-category">
            <Filter size={13} className="mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="分類" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分類</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">藥品名稱</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">分類</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-40">庫存狀態</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">補貨點</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">儲存條件</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">單位</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5 w-16">編輯</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
                : filtered.map((m: any) => (
                  <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors" data-testid={`med-row-${m.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Pill size={13} className="text-primary shrink-0" />
                        <div>
                          <Link href={`/medications/${m.id}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline" data-testid={`med-link-${m.id}`}>
                            {m.name}
                          </Link>
                          {expiringMedIds.has(m.id) && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 align-middle">
                              <Clock size={10} />近效期
                            </span>
                          )}
                          {m.generic_name && <div className="text-xs text-muted-foreground">{m.generic_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${CATEGORY_COLORS[m.category] || "badge-info"} border-0 text-xs`}>{m.category}</Badge>
                    </td>
                    <td className="px-4 py-3 w-40">
                      <StockStatus current={m.current_stock} safety={m.safety_stock} reorder={m.reorder_point} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground mono">
                      {m.reorder_point} {m.unit}
                    </td>
                    <td className="px-4 py-3">
                      <StorageBadge cond={m.storage_condition || "室溫"} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{m.unit}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(m)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        data-testid={`med-edit-${m.id}`}
                        aria-label="編輯藥品"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-10 text-sm text-muted-foreground">查無符合條件的藥品</div>
          )}
        </div>
      </Card>

      {editing && <EditMedicationModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
