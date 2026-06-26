import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, AlertTriangle, Search, Filter, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { sortCategories, CATEGORY_ORDER } from "@/lib/consumableCategories";
import EditConsumableModal from "@/components/EditConsumableModal";
import { useHashLocation } from "wouter/use-hash-location";

interface Consumable {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  safety_stock: number;
  is_durable: boolean;
  vendor_id: string | null;
  notes: string | null;
  is_active: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  "消毒清潔":          "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "注射耗材（針具）":  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "針筒":              "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "紗布敷料":          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "固定包紮":          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "手套防護":          "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "輸液注射":          "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  "清潔衛生":          "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "行政文書":          "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  "器械器具":          "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

function StockBadge({ current, safety, isDurable }: { current: number; safety: number; isDurable: boolean }) {
  if (isDurable) return <Badge variant="outline" className="text-xs">器械</Badge>;
  if (current <= 0) return <Badge className="bg-red-500 text-white text-xs">缺貨</Badge>;
  if (current <= safety) return <Badge className="bg-amber-500 text-white text-xs">庫存偏低</Badge>;
  return <Badge className="bg-green-600 text-white text-xs">正常</Badge>;
}

export default function ConsumableList() {
  const [, navigate] = useHashLocation();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<Consumable | null>(null);

  const { data: consumables = [], isLoading } = useQuery<Consumable[]>({
    queryKey: ["/api/consumables"],
  });

  // 從資料中取分類，依正確順序排列
  const categories = useMemo(() => {
    const cats = Array.from(new Set(consumables.map(c => c.category)));
    return sortCategories(cats);
  }, [consumables]);

  const filtered = consumables.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === "全部" || c.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // 按 CATEGORY_ORDER 排序分組
  const sortedGroupKeys = useMemo(() => {
    const keys = Array.from(new Set(filtered.map(c => c.category)));
    return sortCategories(keys);
  }, [filtered]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Consumable[]>>((acc, c) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    }, {});
  }, [filtered]);

  const toggleGroup = (cat: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const lowStockCount = consumables.filter(c => !c.is_durable && c.current_stock <= c.safety_stock).length;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* 頁頭 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Package className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">衛材清單</h1>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-md px-3 py-1.5 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{lowStockCount} 項庫存偏低</span>
          </div>
        )}
        <Button size="sm" onClick={() => navigate("/consumables/add")} data-testid="btn-add-consumable">
          <Plus className="w-4 h-4 mr-1" />新增品項
        </Button>
      </div>

      {/* 搜尋 + 篩選 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋品名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-category">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部">全部分類</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        顯示 {filtered.length} / {consumables.length} 項
      </div>

      {/* 清單（按分類分組，依正確順序）*/}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : sortedGroupKeys.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>查無符合的品項</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedGroupKeys.map(cat => {
            const items = grouped[cat] || [];
            if (items.length === 0) return null;
            const isCollapsed = collapsedGroups.has(cat);
            const catColor = CATEGORY_COLORS[cat] || "bg-gray-100 text-gray-700";
            const lowInGroup = items.filter(i => !i.is_durable && i.current_stock <= i.safety_stock).length;
            return (
              <Card key={cat} className="overflow-hidden">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleGroup(cat)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${catColor}`}>{cat}</span>
                      <span className="text-sm text-muted-foreground">{items.length} 項</span>
                      {lowInGroup > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" />{lowInGroup} 偏低
                        </span>
                      )}
                    </div>
                    {isCollapsed
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    }
                  </div>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                          data-testid={`row-consumable-${item.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.id}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold tabular-nums">
                              {item.is_durable ? "—" : item.current_stock}
                              <span className="text-xs text-muted-foreground font-normal ml-1">{item.unit}</span>
                            </p>
                            {!item.is_durable && (
                              <p className="text-xs text-muted-foreground">安全量 {item.safety_stock}{item.unit}</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <StockBadge current={item.current_stock} safety={item.safety_stock} isDurable={item.is_durable} />
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setEditingItem(item); }}
                              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              data-testid={`btn-edit-${item.id}`}
                              title="編輯品項"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {editingItem && (
        <EditConsumableModal item={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}
