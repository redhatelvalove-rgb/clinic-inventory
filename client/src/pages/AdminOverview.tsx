import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Package, AlertTriangle, Clock } from "lucide-react";

interface ClinicStat {
  clinicId: string;
  clinicName: string;
  totalMeds: number;
  expiringCount: number;
  lowStockCount: number;
}

interface OverviewData {
  stats: ClinicStat[];
  clinics: { id: string; name: string }[];
}

interface Props {
  token: string;
  onSelectClinic: (clinicId: string) => void;
}

export default function AdminOverview({ token, onSelectClinic }: Props) {
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["/api/admin/overview"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/overview").then(r => r.json()),
  });

  const totalAlerts = data?.stats.reduce((s, c) => s + c.expiringCount + c.lowStockCount, 0) || 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">三間診所總覽</h1>
          <p className="text-xs text-muted-foreground mt-0.5">點擊診所名稱可切換進入該診所</p>
        </div>
        {totalAlerts > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle size={11} />
            {totalAlerts} 項警示
          </Badge>
        )}
      </div>

      {/* 診所卡片 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.stats.map(c => {
            const hasAlert = c.expiringCount > 0 || c.lowStockCount > 0;
            return (
              <button
                key={c.clinicId}
                data-testid={`card-clinic-${c.clinicId}`}
                onClick={() => onSelectClinic(c.clinicId)}
                className={`text-left bg-card border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer
                  ${hasAlert ? "border-orange-300 dark:border-orange-700" : "border-border"}`}
              >
                {/* 診所名稱 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 size={18} className="text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{c.clinicName}</div>
                      <div className="text-xs text-muted-foreground">{c.clinicId}</div>
                    </div>
                  </div>
                  {hasAlert && (
                    <AlertTriangle size={15} className="text-orange-500 shrink-0 mt-0.5" />
                  )}
                </div>

                {/* 統計數字 */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <Package size={13} className="mx-auto text-muted-foreground mb-1" />
                    <div className="text-lg font-bold text-foreground">{c.totalMeds}</div>
                    <div className="text-xs text-muted-foreground">藥品種類</div>
                  </div>
                  <div className={`rounded-lg p-2.5 text-center ${c.expiringCount > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted/50"}`}>
                    <Clock size={13} className={`mx-auto mb-1 ${c.expiringCount > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
                    <div className={`text-lg font-bold ${c.expiringCount > 0 ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>{c.expiringCount}</div>
                    <div className="text-xs text-muted-foreground">近效期</div>
                  </div>
                  <div className={`rounded-lg p-2.5 text-center ${c.lowStockCount > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`}>
                    <AlertTriangle size={13} className={`mx-auto mb-1 ${c.lowStockCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                    <div className={`text-lg font-bold ${c.lowStockCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{c.lowStockCount}</div>
                    <div className="text-xs text-muted-foreground">低庫存</div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-primary font-medium">點擊進入管理 →</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
