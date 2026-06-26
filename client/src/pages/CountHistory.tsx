import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, ChevronDown, ChevronRight, User, Calendar, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

interface CountSummary {
  id: string;
  clinicId: string;
  countedAt: string;
  countedBy: string;
  notes: string | null;
  itemCount: number;
}

interface CountDetail {
  id: string;
  countedAt: string;
  countedBy: string;
  notes: string | null;
  items: {
    id: string;
    consumableId: string;
    consumableName: string;
    unit: string;
    previousStock: number;
    countedStock: number;
    consumed: number;
  }[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }) +
    " " + d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function CountDetailPanel({ countId }: { countId: string }) {
  const { data, isLoading } = useQuery<CountDetail>({
    queryKey: ["/api/inventory-counts", countId],
    queryFn: () => apiRequest("GET", `/api/inventory-counts/${countId}`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="px-4 pb-3 space-y-2">
        {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }

  if (!data) return null;

  // 只顯示有變動的品項（consumed > 0 或 countedStock 與 previousStock 不同）
  const changedItems = data.items.filter(i => i.consumed !== 0 || i.countedStock !== i.previousStock);
  const unchangedItems = data.items.filter(i => i.consumed === 0 && i.countedStock === i.previousStock);

  return (
    <div className="px-4 pb-4 space-y-3">
      {data.notes && (
        <div className="text-sm text-muted-foreground bg-muted/40 rounded px-3 py-2">
          {data.notes}
        </div>
      )}

      {/* 有消耗的品項 */}
      {changedItems.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">消耗紀錄（{changedItems.length} 項）</p>
          <div className="space-y-1">
            {changedItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/30 transition-colors" data-testid={`history-item-${item.id}`}>
                <span className="flex-1 truncate font-medium">{item.consumableName}</span>
                <span className="text-muted-foreground tabular-nums">
                  {item.previousStock} → {item.countedStock} {item.unit}
                </span>
                {item.consumed > 0 && (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 flex-shrink-0">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span className="text-xs">−{item.consumed}</span>
                  </div>
                )}
                {item.countedStock > item.previousStock && (
                  <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 flex-shrink-0">補貨</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 無變動提示 */}
      {unchangedItems.length > 0 && (
        <p className="text-xs text-muted-foreground">另有 {unchangedItems.length} 項無變動</p>
      )}

      {changedItems.length === 0 && unchangedItems.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">此次盤點無品項紀錄</p>
      )}
    </div>
  );
}

export default function CountHistory() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: counts = [], isLoading } = useQuery<CountSummary[]>({
    queryKey: ["/api/inventory-counts"],
  });

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      {/* 頁頭 */}
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">盤點紀錄</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : counts.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>尚無盤點紀錄</p>
          <p className="text-sm mt-1">請前往「衛材盤點」頁面進行首次盤點</p>
        </div>
      ) : (
        <div className="space-y-2">
          {counts.map(count => {
            const isExpanded = expandedId === count.id;
            return (
              <Card key={count.id} className="overflow-hidden" data-testid={`count-card-${count.id}`}>
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggle(count.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {count.countedBy}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {count.itemCount} 項
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(count.countedAt)}
                      </div>
                      {count.notes && (
                        <p className="text-xs text-muted-foreground truncate">{count.notes}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && <CountDetailPanel countId={count.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
