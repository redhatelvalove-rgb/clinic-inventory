import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Pencil, Trash2, SlidersHorizontal, AlertTriangle, Package, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EditMedicationModal from "@/components/EditMedicationModal";
import AdjustBatchModal from "@/components/AdjustBatchModal";

import { taipeiToday, formatTaipeiDateTime } from "@shared/date-utils";

const today = () => taipeiToday();
const daysTo = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

const TXN_LABEL: Record<string, { label: string; cls: string }> = {
  IN:       { label: "入庫", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  OUT:      { label: "出庫", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  DISCARD:  { label: "報廢", cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  ADJUST:   { label: "調整", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
};

function batchStatus(b: any): { label: string; cls: string } | null {
  if (b.expiry_date < today()) return { label: "已過期", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
  if (daysTo(b.expiry_date) <= 30) return { label: `近效期 ${daysTo(b.expiry_date)} 天`, cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  return null;
}

export default function MedicationDetail() {
  const [, params] = useRoute("/medications/:id");
  const id = params?.id || "";
  const [editing, setEditing] = useState(false);
  const [adjustBatch, setAdjustBatch] = useState<any | null>(null);

  const { data: med, isLoading } = useQuery<any>({ queryKey: ["/api/medications", id], enabled: !!id });
  const { data: txns = [] } = useQuery<any[]>({
    // 陣列 key 讓各 mutation 的 ["/api/transactions"] 前綴 invalidate 能命中（字串 key 永遠不會被刷新）
    queryKey: ["/api/transactions", id],
    queryFn: () => apiRequest("GET", `/api/transactions?medId=${id}`).then(r => r.json()),
    enabled: !!id,
  });

  if (isLoading) return <div className="max-w-3xl mx-auto py-10 text-sm text-muted-foreground">載入中…</div>;
  if (!med) return <div className="max-w-3xl mx-auto py-10 text-sm text-muted-foreground">找不到藥品。<Link href="/medications" className="text-primary ml-2">回藥品清單</Link></div>;

  const batches: any[] = (med.batches ?? []).slice().sort((a: any, b: any) => a.expiry_date.localeCompare(b.expiry_date));
  const isLow = med.current_stock <= med.safety_stock;
  const expiredCount = batches.filter(b => b.remaining_qty > 0 && b.expiry_date < today()).length;
  const nearCount = batches.filter(b => b.remaining_qty > 0 && b.expiry_date >= today() && daysTo(b.expiry_date) <= 30).length;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {editing && <EditMedicationModal item={med} onClose={() => setEditing(false)} />}
      {adjustBatch && <AdjustBatchModal medId={id} batch={adjustBatch} unit={med.unit} onClose={() => setAdjustBatch(null)} />}

      {/* 返回 + 標題 */}
      <div className="flex items-center justify-between">
        <Link href="/medications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={15} />藥品清單
        </Link>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="detail-edit"><Pencil size={14} className="mr-1" />編輯主檔</Button>
      </div>

      {/* 主檔 */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{med.name}</h1>
            {med.generic_name && <p className="text-sm text-muted-foreground">{med.generic_name}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className="badge-info border-0">{med.category}</Badge>
              {med.storage_condition && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{med.storage_condition}</span>}
              {med.barcode && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">{med.barcode}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${isLow ? "text-red-500" : "text-foreground"}`}>{med.current_stock}</div>
            <div className="text-xs text-muted-foreground">總庫存 {med.unit}　安全 {med.safety_stock}</div>
          </div>
        </div>
      </Card>

      {/* 警示 */}
      {(isLow || expiredCount > 0 || nearCount > 0) && (
        <div className="space-y-2">
          {isLow && <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"><AlertTriangle size={14} />低於安全庫存（{med.current_stock} ≤ {med.safety_stock}）</div>}
          {expiredCount > 0 && <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"><AlertTriangle size={14} />{expiredCount} 個批次已過期，請報廢</div>}
          {nearCount > 0 && <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"><Clock size={14} />{nearCount} 個批次 30 天內到期</div>}
        </div>
      )}

      {/* 批次清單 */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold"><Package size={15} className="text-primary" />批次清單（{batches.length}）</div>
        {batches.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">尚無批次，請至入庫建立。</div>
        ) : (
          <div className="divide-y divide-border">
            {batches.map(b => {
              const st = batchStatus(b);
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      批號 {b.batch_number}
                      {st && <span className={`text-xs px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">效期 {b.expiry_date}　剩餘 {b.remaining_qty} / {b.quantity} {med.unit}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setAdjustBatch(b)} data-testid={`batch-adjust-${b.id}`}>
                      <SlidersHorizontal size={13} className="mr-1" />調整
                    </Button>
                    <Link href="/disposal">
                      <Button variant="outline" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700" data-testid={`batch-dispose-${b.id}`}>
                        <Trash2 size={13} className="mr-1" />報廢
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 最近異動 */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold"><Clock size={15} className="text-primary" />最近異動</div>
        {txns.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">尚無異動紀錄。</div>
        ) : (
          <div className="divide-y divide-border">
            {txns.slice(0, 20).map((t: any) => {
              const meta = TXN_LABEL[t.txn_type] ?? { label: t.txn_type, cls: "bg-muted text-muted-foreground" };
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${meta.cls}`}>{meta.label}</span>
                  <span className={`font-medium tabular-nums w-12 text-right ${t.quantity < 0 ? "text-red-600" : "text-emerald-600"}`}>{t.quantity > 0 ? "+" : ""}{t.quantity}</span>
                  <span className="flex-1 min-w-0 truncate text-muted-foreground">{t.reason || "—"}</span>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{formatTaipeiDateTime(t.txn_time)}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{t.performed_by || ""}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
