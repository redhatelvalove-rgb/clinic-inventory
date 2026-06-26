import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, PackageCheck, TrendingDown, ArrowDown, ArrowUp, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function daysUntil(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function ExpiryBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge variant="destructive" className="text-xs">已過期</Badge>;
  if (days <= 7) return <Badge className="badge-danger text-xs border-0">⚠ {days} 天</Badge>;
  if (days <= 30) return <Badge className="badge-warning text-xs border-0">{days} 天</Badge>;
  return <Badge className="badge-info text-xs border-0">{days} 天</Badge>;
}

function StockLevel({ current, safety, reorder }: { current: number; safety: number; reorder?: number }) {
  const max = Math.max(current, (reorder || safety) * 2, 1);
  const pct = Math.min((current / max) * 100, 100);
  const color = current <= safety ? "bg-red-500" : current <= (reorder || safety * 1.5) ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="stock-bar-track w-full">
      <div className={`stock-bar-fill ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/dashboard"], refetchInterval: 30000 });
  const d = data as any;

  if (isLoading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );

  const stats = d?.stats || {};
  const expiring = d?.expiring || [];
  const lowStock = d?.lowStock || [];
  const recentTxns = d?.recentTxns || [];

  const statCards = [
    { label: "藥品種類", value: stats.totalMeds, icon: PackageCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "30天內到期批次", value: stats.expiringCount, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", alert: stats.expiringCount > 0 },
    { label: "低於安全庫存", value: stats.lowStockCount, icon: TrendingDown, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", alert: stats.lowStockCount > 0 },
    { label: "今日入庫", value: stats.todayIn || 0, icon: ArrowUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">儀表板</h1>
        <p className="text-sm text-muted-foreground mt-0.5">庫存狀態總覽</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, alert }) => (
          <Card key={label} className={`border ${alert ? "border-red-200 dark:border-red-800" : "border-border"}`} data-testid={`stat-${label}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-2xl font-bold mono ${color}`}>{value}</p>
                </div>
                <div className={`p-2 rounded-md ${bg}`}>
                  <Icon size={16} className={color} />
                </div>
              </div>
              {alert && <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><AlertTriangle size={10}/> 需要處理</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Expiring batches */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock size={14} className="text-amber-500" />
              30 天內到期批次
              {expiring.length > 0 && <Badge className="badge-warning border-0 text-xs">{expiring.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {expiring.length === 0 ? (
              <div className="px-4 pb-4 text-sm text-muted-foreground">近期無到期批次</div>
            ) : (
              <div className="divide-y divide-border">
                {expiring.map((b: any) => {
                  const days = daysUntil(b.expiry_date);
                  return (
                    <div key={b.id} className="px-4 py-2.5 flex items-center justify-between" data-testid={`expiry-row-${b.id}`}>
                      <div>
                        <div className="text-sm font-medium text-foreground">{b.medName}</div>
                        <div className="text-xs text-muted-foreground mono">批號 {b.batch_number} · 剩 {b.remaining_qty} {b.unit}</div>
                      </div>
                      <div className="text-right">
                        <ExpiryBadge days={days} />
                        <div className="text-xs text-muted-foreground mt-0.5">{b.expiry_date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown size={14} className="text-red-500" />
              低於安全庫存
              {lowStock.length > 0 && <Badge className="badge-danger border-0 text-xs">{lowStock.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lowStock.length === 0 ? (
              <div className="px-4 pb-4 text-sm text-muted-foreground text-green-600 dark:text-green-400">所有藥品庫存充足</div>
            ) : (
              <div className="divide-y divide-border">
                {lowStock.map((m: any) => (
                  <div key={m.id} className="px-4 py-2.5" data-testid={`lowstock-row-${m.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{m.name}</span>
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">建議補貨 {m.reorder_qty || m.reorder_point || m.safety_stock} {m.unit}</span>
                    </div>
                    <StockLevel current={m.current_stock} safety={m.safety_stock} reorder={m.reorder_point} />
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>現有 <span className="mono font-medium text-red-600 dark:text-red-400">{m.current_stock}</span> {m.unit}</span>
                      <span>安全量 <span className="mono">{m.safety_stock}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw size={14} className="text-primary" />
            最近交易紀錄
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentTxns.length === 0 ? (
            <div className="px-4 pb-4 text-sm text-muted-foreground">目前無交易紀錄</div>
          ) : (
            <div className="divide-y divide-border">
              {recentTxns.map((t: any) => (
                <div key={t.id} className="px-4 py-2 flex items-center gap-3 text-sm" data-testid={`txn-row-${t.id}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
                    ${t.txn_type === "IN" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                    {t.txn_type === "IN"
                      ? <ArrowDown size={12} className="text-emerald-600 dark:text-emerald-400" />
                      : <ArrowUp size={12} className="text-red-600 dark:text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{t.med_id}</span>
                    <span className="text-muted-foreground"> · {t.reason}</span>
                  </div>
                  <div className={`mono font-medium text-xs ${t.txn_type === "IN" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {t.txn_type === "IN" ? "+" : ""}{t.quantity}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{t.txn_time?.slice(0,16)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
