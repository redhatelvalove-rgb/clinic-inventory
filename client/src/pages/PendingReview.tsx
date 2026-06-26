import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Package, User, Calendar } from "lucide-react";

export default function PendingReview() {
  const { toast } = useToast();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: pending = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/medications/pending"],
    refetchInterval: 30000,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/medications/${id}/approve`, { reviewedBy: "管理者" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "已核准", description: "藥品已上線，護理人員可以使用" });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/pending/count"] });
    },
    onError: () => toast({ title: "操作失敗", variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/medications/${id}/reject`, { reviewedBy: "管理者", reason }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "已拒絕", description: "品項已退回" });
      setRejectId(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/medications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/pending/count"] });
    },
    onError: () => toast({ title: "操作失敗", variant: "destructive" }),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            待審核品項
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">護理人員提交的新品項，請核准或拒絕</p>
        </div>
        {pending.length > 0 && (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">
            {pending.length} 筆待審核
          </Badge>
        )}
      </div>

      {/* 清單 */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">目前沒有待審核的品項</p>
          <p className="text-xs text-muted-foreground mt-1">護理人員提交後會出現在這裡</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((m: any) => (
            <div key={m.id} className="bg-card border border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-sm">
              {/* 品項資訊 */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Package size={16} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{m.name}</div>
                    {m.generic_name && <div className="text-xs text-muted-foreground">{m.generic_name}</div>}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-xs">{m.category}</Badge>
                      <Badge variant="outline" className="text-xs">{m.unit}</Badge>
                      {m.storage_condition && (
                        <Badge variant="outline" className="text-xs">{m.storage_condition}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 shrink-0 text-xs">
                  待審核
                </Badge>
              </div>

              {/* 細節 */}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3 bg-muted/40 rounded-lg p-2.5">
                <div>安全庫存：<span className="text-foreground font-medium">{m.safety_stock} {m.unit}</span></div>
                {m.reorder_point && <div>補貨點：<span className="text-foreground font-medium">{m.reorder_point} {m.unit}</span></div>}
                {m.submitted_by && (
                  <div className="flex items-center gap-1">
                    <User size={10} />{m.submitted_by}
                  </div>
                )}
                {m.submitted_at && (
                  <div className="flex items-center gap-1">
                    <Calendar size={10} />{m.submitted_at?.slice(0, 16)}
                  </div>
                )}
              </div>

              {/* 拒絕原因輸入框 */}
              {rejectId === m.id && (
                <div className="mb-3 space-y-2">
                  <Input
                    placeholder="請輸入拒絕原因（選填）"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="text-sm"
                    data-testid="input-reject-reason"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" className="flex-1"
                      onClick={() => rejectMut.mutate({ id: m.id, reason: rejectReason || "不符合規格" })}
                      disabled={rejectMut.isPending}
                      data-testid="button-confirm-reject">
                      確認拒絕
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1"
                      onClick={() => { setRejectId(null); setRejectReason(""); }}>
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* 操作按鈕 */}
              {rejectId !== m.id && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    onClick={() => approveMut.mutate(m.id)}
                    disabled={approveMut.isPending}
                    data-testid={`button-approve-${m.id}`}>
                    <CheckCircle2 size={14} />核准上線
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 gap-1.5"
                    onClick={() => setRejectId(m.id)}
                    data-testid={`button-reject-${m.id}`}>
                    <XCircle size={14} />拒絕
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
