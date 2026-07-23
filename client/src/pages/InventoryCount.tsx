import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ClipboardList, CheckCircle, Search, Filter, Send,
  AlertTriangle, Minus, Plus, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { sortCategories, MODULE_INFO, moduleOfCategory, type ConsumableModule } from "@/lib/consumableCategories";
import { NURSING_STAFF } from "@/lib/staff";

const NURSES = NURSING_STAFF;

interface Consumable {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  safety_stock: number;
  is_durable: boolean;
  is_active: boolean;
}

type CountMap = Record<string, string>;

// ── 庫存水位圖示 ────────────────────────────────────────────────────────────
function StockBar({
  current, safety, inputVal
}: { current: number; safety: number; inputVal: string }) {
  const val = inputVal !== "" ? Number(inputVal) : null;
  const displayVal = val !== null ? val : current;

  // 最高顯示量：取 safety*3 或 current*2，至少 1
  const maxDisplay = Math.max(safety * 3, current * 2, displayVal * 2, 1);
  const pct = Math.min(100, (displayVal / maxDisplay) * 100);
  const safetyPct = Math.min(100, (safety / maxDisplay) * 100);

  let barColor = "bg-green-500";
  let label = "充足";
  if (val !== null) {
    if (val <= 0) { barColor = "bg-red-500"; label = "缺貨"; }
    else if (val <= safety) { barColor = "bg-amber-500"; label = "偏低"; }
    else { barColor = "bg-green-500"; label = "充足"; }
  } else {
    if (current <= 0) { barColor = "bg-red-400"; label = "缺貨"; }
    else if (current <= safety) { barColor = "bg-amber-400"; label = "偏低"; }
  }

  return (
    <div className="mt-1.5">
      {/* 水位條 */}
      <div className="relative h-2 bg-muted rounded-full overflow-visible">
        {/* 安全水位線 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-orange-400 dark:bg-orange-500 rounded-full z-10"
          style={{ left: `${safetyPct}%` }}
          title={`安全水位 ${safety}`}
        />
        {/* 實際庫存條 */}
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span className={`text-xs font-medium ${
          label === "缺貨" ? "text-red-500" :
          label === "偏低" ? "text-amber-500" : "text-green-600 dark:text-green-400"
        }`}>{label}</span>
        <span className="text-xs text-muted-foreground">
          安全水位 <span className="font-medium text-orange-500">{safety}</span>
        </span>
      </div>
    </div>
  );
}

// ── 單一品項盤點卡片 ────────────────────────────────────────────────────────
function CountCard({
  item, value, onChange
}: { item: Consumable; value: string; onChange: (v: string) => void }) {
  const numVal = value !== "" ? Number(value) : null;
  const isLow = numVal !== null && numVal <= item.safety_stock;
  const isFilled = value !== "";

  const stepDown = () => {
    const cur = numVal !== null ? numVal : item.current_stock;
    if (cur > 0) onChange(String(cur - 1));
  };
  const stepUp = () => {
    const cur = numVal !== null ? numVal : item.current_stock;
    onChange(String(cur + 1));
  };

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        isFilled
          ? isLow
            ? "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10"
            : "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
          : "border-border bg-card"
      }`}
      data-testid={`count-card-${item.id}`}
    >
      {/* 品名列 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{item.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            上次庫存：<span className="font-medium">{item.current_stock}</span> {item.unit}
          </p>
        </div>
        {isFilled && isLow && (
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        )}
      </div>

      {/* 數量輸入：－ 數字 ＋ */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={stepDown}
          className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all flex-shrink-0"
          data-testid={`btn-minus-${item.id}`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={`現在剩？（上次 ${item.current_stock}）`}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`text-center font-semibold text-base h-9 flex-1 ${
            isFilled ? (isLow ? "border-amber-400 focus-visible:ring-amber-400" : "border-green-400 focus-visible:ring-green-400") : ""
          }`}
          data-testid={`input-count-${item.id}`}
        />
        <span className="text-sm text-muted-foreground flex-shrink-0 w-6">{item.unit}</span>
        <button
          type="button"
          onClick={stepUp}
          className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all flex-shrink-0"
          data-testid={`btn-plus-${item.id}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 設為安全水位按鈕 */}
      {item.safety_stock > 0 && (
        <button
          type="button"
          onClick={() => onChange(String(item.safety_stock))}
          className="mt-2 text-xs text-orange-500 dark:text-orange-400 hover:underline"
          data-testid={`btn-safety-${item.id}`}
        >
          填入最低水位 {item.safety_stock} {item.unit}
        </button>
      )}

      {/* 水位視覺 */}
      <StockBar current={item.current_stock} safety={item.safety_stock} inputVal={value} />
    </div>
  );
}

// ── 主頁面 ──────────────────────────────────────────────────────────────────
export default function InventoryCount({ module = "supplies" }: { module?: ConsumableModule }) {
  const info = MODULE_INFO[module];
  const { toast } = useToast();
  const [nurse, setNurse] = useState("");
  const [notes, setNotes] = useState("");
  const [counts, setCounts] = useState<CountMap>({});
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("全部（非器械）");
  const [submitted, setSubmitted] = useState(false);

  const { data: allConsumables = [], isLoading } = useQuery<Consumable[]>({
    queryKey: ["/api/consumables"],
  });
  // 只盤本模組的品項（衛材／清潔用品／文書文具分開盤）
  const consumables = useMemo(
    () => allConsumables.filter(c => moduleOfCategory(c.category) === module),
    [allConsumables, module],
  );

  // 非器械品項
  const nonDurable = consumables.filter(c => !c.is_durable && c.is_active);
  // 器械品項（放最後，僅供顯示）
  const durable = consumables.filter(c => c.is_durable && c.is_active);

  // 分類列表（依 sortCategories 排序，不含器械）
  const categories = useMemo(() => {
    const cats = Array.from(new Set(nonDurable.map(c => c.category)));
    return sortCategories(cats);
  }, [nonDurable]);

  // 篩選後品項
  const filtered = useMemo(() => {
    return nonDurable.filter(c => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCat === "全部（非器械）" || c.category === selectedCat;
      return matchSearch && matchCat;
    });
  }, [nonDurable, search, selectedCat]);

  const filledCount = Object.values(counts).filter(v => v !== "").length;
  const totalNonDurable = nonDurable.length;
  const lowAlerts = filtered.filter(c => {
    const v = counts[c.id];
    return v !== undefined && v !== "" && Number(v) <= c.safety_stock;
  }).length;

  const mutation = useMutation({
    mutationFn: async (payload: { countedBy: string; notes: string; items: { consumableId: string; countedStock: number }[] }) => {
      return apiRequest("POST", "/api/inventory-counts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-counts"] });
      setSubmitted(true);
      toast({ title: "盤點完成", description: "庫存已更新。" });
    },
    onError: () => {
      toast({ title: "提交失敗", description: "請確認已選護理師並至少填寫一項數量。", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!nurse) { toast({ title: "請選擇護理師", variant: "destructive" }); return; }
    const items = Object.entries(counts)
      .filter(([, v]) => v !== "" && !isNaN(Number(v)))
      .map(([consumableId, v]) => ({ consumableId, countedStock: Number(v) }));
    if (items.length === 0) { toast({ title: "請至少填寫一項盤點數量", variant: "destructive" }); return; }
    // 清潔/文書盤點在備註自動加標記，盤點紀錄頁才分得出來
    const taggedNotes = module === "supplies" ? notes : `【${info.title}】${notes}`.trim();
    mutation.mutate({ countedBy: nurse, notes: taggedNotes, items });
  };

  // ── 完成畫面 ─────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">盤點完成！</h2>
        <p className="text-muted-foreground mb-2">庫存數量已更新，本次盤點紀錄已儲存。</p>
        {lowAlerts > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg px-4 py-2 text-sm mb-4">
            <AlertTriangle className="w-4 h-4" />
            <span>{lowAlerts} 項低於安全水位，請盡快補貨。</span>
          </div>
        )}
        <Button onClick={() => { setSubmitted(false); setCounts({}); setNurse(""); setNotes(""); setSearch(""); setSelectedCat("全部（非器械）"); }}
          data-testid="button-new-count">
          開始新一次盤點
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      {/* 頁頭 */}
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">{info.countTitle}</h1>
      </div>

      {/* ── Step 1：護理師 + 備註 ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Step 1 · 盤點資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">執行護理師 <span className="text-red-500">*</span></label>
            <Select value={nurse} onValueChange={setNurse}>
              <SelectTrigger className="h-11" data-testid="select-nurse">
                <SelectValue placeholder="選擇護理師" />
              </SelectTrigger>
              <SelectContent>
                {NURSES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">備註 <span className="text-muted-foreground font-normal">（選填）</span></label>
            <Textarea
              placeholder="例：月底盤點、補貨前清查..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              data-testid="textarea-notes"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Step 2：搜尋 + 分類篩選 ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Step 2 · 填寫庫存量</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 space-y-3">
          {/* 搜尋 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋品名..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10"
              data-testid="input-search"
            />
          </div>
          {/* 分類下拉 */}
          <Select value={selectedCat} onValueChange={setSelectedCat}>
            <SelectTrigger className="h-10" data-testid="select-category">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="全部（非器械）">全部（非器械）</SelectItem>
              {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* 進度 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>已填 {filledCount} / {totalNonDurable} 項</span>
              {lowAlerts > 0 && (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />{lowAlerts} 項低於安全水位
                </span>
              )}
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${totalNonDurable > 0 ? (filledCount / totalNonDurable) * 100 : 0}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 品項卡片清單 ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>查無符合品項</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 按分類排序顯示 */}
          {categories
            .filter(cat => selectedCat === "全部（非器械）" || cat === selectedCat)
            .map(cat => {
              const items = filtered.filter(c => c.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">{items.filter(i => counts[i.id] !== undefined && counts[i.id] !== "").length}/{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(item => (
                      <CountCard
                        key={item.id}
                        item={item}
                        value={counts[item.id] ?? ""}
                        onChange={v => setCounts(prev => ({ ...prev, [item.id]: v }))}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── 器械器具（放最後，折疊，純顯示） ──────────────────────────── */}
      {(selectedCat === "全部（非器械）") && durable.length > 0 && !search && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground py-2 list-none select-none">
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            <span>器械器具（{durable.length} 項）— 不需盤點</span>
          </summary>
          <div className="mt-2 space-y-2 opacity-50">
            {durable.map(item => (
              <div key={item.id} className="rounded-xl border border-dashed border-border p-3">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">器械器具 · 不計入盤點</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── 提交按鈕（黏在底部）────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 mt-4">
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleSubmit}
          disabled={mutation.isPending || !nurse}
          data-testid="button-submit-count"
        >
          <Send className="w-4 h-4 mr-2" />
          {mutation.isPending
            ? "提交中..."
            : nurse
              ? `確認提交盤點（${filledCount} 項）`
              : "請先選擇護理師"
          }
        </Button>
      </div>
      {/* 底部安全間距，避免被手機底部 Tab 遮住 */}
      <div className="h-4" />
    </div>
  );
}
