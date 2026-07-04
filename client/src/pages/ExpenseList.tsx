import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Receipt, Plus, Search, Filter, TrendingDown,
  ChevronDown, ChevronUp, Trash2, Image, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EXPENSE_CATEGORIES, CATEGORY_COLOR_MAP } from "@/lib/expenseCategories";
import { useHashLocation } from "wouter/use-hash-location";

interface Expense {
  id: string;
  clinic_id: string;
  expense_date: string;
  category: string;
  subcategory: string | null;
  amount: number;
  description: string | null;
  vendor_name: string | null;
  has_photo: number; // 列表 API 不回傳照片本體，展開時另行載入
  recorded_by: string;
  created_at: string;
}

interface MonthlySummary { category: string; total: number; }

// 取得今年當月 YYYY-MM
const thisMonth = () => new Date().toISOString().slice(0, 7);

// 產生最近 12 個月選項
function recentMonths(): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

// 照片燈箱
function PhotoModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20" onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
      <img src={src} alt="憑證" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}

export default function ExpenseList() {
  const [, navigate] = useHashLocation();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(thisMonth());
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const months = recentMonths();

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", selectedMonth, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams({ month: selectedMonth });
      if (selectedCategory !== "全部") params.set("category", selectedCategory);
      const res = await apiRequest("GET", `/api/expenses?${params}`);
      return res.json();
    },
  });

  const { data: summary = [] } = useQuery<MonthlySummary[]>({
    queryKey: ["/api/expenses/summary", selectedMonth],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/expenses/summary?month=${selectedMonth}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/summary"] });
      toast({ title: "已刪除費用紀錄" });
    },
    onError: (e: any) => toast({ title: "刪除失敗", description: e?.message, variant: "destructive" }),
  });

  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const openPhoto = async (id: string) => {
    setPhotoLoadingId(id);
    try {
      const res = await apiRequest("GET", `/api/expenses/${id}/photo`);
      const data = await res.json();
      setLightboxSrc(data.receiptPhoto);
    } catch (e: any) {
      toast({ title: "載入照片失敗", description: e?.message, variant: "destructive" });
    } finally {
      setPhotoLoadingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(e =>
      e.category.includes(q) ||
      (e.subcategory || "").toLowerCase().includes(q) ||
      (e.vendor_name || "").toLowerCase().includes(q) ||
      (e.description || "").toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const monthTotal = summary.reduce((s, r) => s + r.total, 0);

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${m}/${day}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      {/* 頁頭 */}
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold flex-1">費用紀錄</h1>
        <Button size="sm" onClick={() => navigate("/expenses/add")} data-testid="btn-add-expense">
          <Plus className="w-4 h-4 mr-1" />記錄費用
        </Button>
      </div>

      {/* ── 月份 + 分類篩選 ─────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="h-9 w-36" data-testid="select-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-9 flex-1 min-w-32" data-testid="select-category">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground flex-shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部">全部分類</SelectItem>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── 月份總計 + 分類圓餅 ──────────────────────────────────────── */}
      {!isLoading && summary.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-sm text-muted-foreground">{selectedMonth} 總支出</span>
              <span className="text-2xl font-bold tabular-nums">${monthTotal.toLocaleString()}</span>
            </div>
            <div className="space-y-1.5">
              {summary.slice(0, 6).map(row => {
                const pct = monthTotal > 0 ? (row.total / monthTotal) * 100 : 0;
                const color = CATEGORY_COLOR_MAP[row.category] || "bg-gray-100 text-gray-700";
                return (
                  <div key={row.category} className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${color}`}>{row.category}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-16 text-right">${row.total.toLocaleString()}</span>
                  </div>
                );
              })}
              {summary.length > 6 && (
                <p className="text-xs text-muted-foreground pl-1">＋ {summary.length - 6} 個分類...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 搜尋 ─────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜尋分類、廠商、備註..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
          data-testid="input-search"
        />
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} 筆紀錄</div>

      {/* ── 清單 ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>本月尚無費用紀錄</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/expenses/add")}>
            <Plus className="w-4 h-4 mr-1" />立即記錄
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exp => {
            const isExpanded = expandedId === exp.id;
            const catColor = CATEGORY_COLOR_MAP[exp.category] || "bg-gray-100 text-gray-700";
            return (
              <Card key={exp.id} className="overflow-hidden">
                {/* 主行 */}
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                >
                  <CardHeader className="py-3 px-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 text-xs text-muted-foreground w-10 text-center font-medium">
                        {formatDate(exp.expense_date)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${catColor}`}>{exp.category}</span>
                          {exp.subcategory && <span className="text-xs text-muted-foreground">{exp.subcategory}</span>}
                          {exp.vendor_name && <span className="text-xs text-muted-foreground truncate">· {exp.vendor_name}</span>}
                        </div>
                        {exp.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{exp.description}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {!!exp.has_photo && (
                          <Image className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="font-semibold tabular-nums text-sm">${exp.amount.toLocaleString()}</span>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                    </div>
                  </CardHeader>
                </button>

                {/* 展開詳情 */}
                {isExpanded && (
                  <CardContent className="px-4 pb-3 pt-0 border-t border-border">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mt-3">
                      <div><span className="text-muted-foreground">費用日期</span><p className="font-medium">{exp.expense_date}</p></div>
                      <div><span className="text-muted-foreground">記錄人員</span><p className="font-medium">{exp.recorded_by}</p></div>
                      <div><span className="text-muted-foreground">金額</span><p className="font-semibold text-base">${exp.amount.toLocaleString()}</p></div>
                      {exp.vendor_name && <div><span className="text-muted-foreground">廠商/店家</span><p className="font-medium">{exp.vendor_name}</p></div>}
                    </div>
                    {exp.description && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">備註：</span>
                        <span>{exp.description}</span>
                      </div>
                    )}
                    {/* 憑證照片（展開時才載入，列表不傳大檔） */}
                    {!!exp.has_photo && (
                      <div className="mt-3">
                        <button
                          onClick={() => openPhoto(exp.id)}
                          disabled={photoLoadingId === exp.id}
                          className="flex items-center gap-1.5 text-sm px-3 h-9 rounded-md border border-border hover:bg-muted/40 transition-colors"
                          data-testid={`btn-photo-${exp.id}`}
                        >
                          <Image className="w-4 h-4" />
                          {photoLoadingId === exp.id ? "載入中..." : "查看憑證照片"}
                        </button>
                      </div>
                    )}
                    {/* 刪除 */}
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => {
                          if (confirm("確定要刪除這筆費用紀錄？")) {
                            deleteMutation.mutate(exp.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 dark:text-red-400 hover:underline"
                        data-testid={`btn-delete-${exp.id}`}
                      >
                        <Trash2 className="w-3 h-3" />刪除
                      </button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 照片燈箱 */}
      {lightboxSrc && <PhotoModal src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* 底部安全間距 */}
      <div className="h-4" />
    </div>
  );
}
