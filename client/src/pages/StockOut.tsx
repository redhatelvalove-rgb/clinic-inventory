import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PackageMinus, CheckCircle2, AlertTriangle } from "lucide-react";
import { NURSING_STAFF } from "@/lib/staff";

import { taipeiToday, formatTaipeiDateTime } from "@shared/date-utils";

const today = () => taipeiToday();

export default function StockOut() {
  const { toast } = useToast();
  const [medId, setMedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [patientId, setPatientId] = useState("");
  const [useDate, setUseDate] = useState(today);
  const [performer, setPerformer] = useState("");
  const [batchId, setBatchId] = useState("");          // 空字串=用 FEFO 建議
  const [overrideReason, setOverrideReason] = useState(""); // 改批次原因
  const [done, setDone] = useState(false);
  const [lastResult, setLastResult] = useState<{ medName: string; quantity: number; remaining: number } | null>(null);

  const { data: medications = [] } = useQuery<any[]>({ queryKey: ["/api/medications"] });
  const activeMeds = medications.filter(m => m.is_active);
  const selectedMed = activeMeds.find(m => m.id === medId);

  // 選到藥品後抓批次（含效期）
  const { data: medDetail } = useQuery<any>({
    queryKey: ["/api/medications", medId],
    enabled: !!medId,
  });
  const batches: any[] = medDetail?.batches ?? [];

  // 可出庫批次：剩餘>0 且未過期，依效期升冪（FEFO）
  const usableBatches = useMemo(
    () => batches
      .filter(b => b.remaining_qty > 0 && b.expiry_date >= today())
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)),
    [batches],
  );
  const fefoBatch = usableBatches[0];
  const isOverride = batchId !== "" && fefoBatch && batchId !== fefoBatch.id;

  const isBelow = selectedMed && selectedMed.current_stock < selectedMed.safety_stock;
  const isLow = selectedMed && selectedMed.current_stock <= selectedMed.safety_stock;
  const isInsufficient = selectedMed && selectedMed.current_stock < quantity;

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/stock/out", {
        medId,
        quantity,
        reason: isOverride
          ? `病歷號碼：${patientId}｜使用日期：${useDate}｜改批次原因：${overrideReason.trim()}`
          : `病歷號碼：${patientId}｜使用日期：${useDate}`,
        performedBy: performer.trim() || "未填寫",
        ...(batchId ? { batchId } : {}),   // 有指定才送，否則後端自動 FEFO
      }).then(r => r.json()),
    onSuccess: () => {
      const med = selectedMed!;
      const remaining = med.current_stock - quantity;
      setLastResult({ medName: med.name, quantity, remaining });
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/expiring"] });
    },
    onError: (err: any) => toast({ title: "出庫失敗", description: err.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!medId) return toast({ title: "請選擇藥品", variant: "destructive" });
    if (usableBatches.length === 0) return toast({ title: "無可用批次", description: "可能全數已過期，請改用報廢。", variant: "destructive" });
    if (!patientId.trim()) return toast({ title: "請輸入病歷號碼", variant: "destructive" });
    if (!performer) return toast({ title: "請選擇操作人員", variant: "destructive" });
    if (quantity < 1) return toast({ title: "數量至少為 1", variant: "destructive" });
    if (isOverride && !overrideReason.trim())
      return toast({ title: "請填寫改批次原因", description: "未依 FEFO 建議出庫需說明原因。", variant: "destructive" });
    mutation.mutate();
  }

  function handleReset() {
    setMedId(""); setQuantity(1); setPatientId(""); setUseDate(today());
    setPerformer(""); setBatchId(""); setOverrideReason("");
    setDone(false); setLastResult(null);
  }

  const fmtBatch = (b: any) =>
    `批號 ${b.batch_number}｜效期 ${b.expiry_date}｜剩 ${b.remaining_qty}`;

  // ── 完成畫面 ─────────────────────────────────────────────────────────────────
  if (done && lastResult) {
    return (
      <div className="max-w-md mx-auto pt-8 px-2">
        <div className="bg-card border border-border rounded-xl p-6 text-center shadow-sm">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">出庫完成</h2>
          <p className="text-muted-foreground text-sm mb-4">{lastResult.medName} × {lastResult.quantity}</p>
          <div className="bg-muted/50 rounded-lg p-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground">剩餘庫存</span>
              <span className={`font-semibold ${lastResult.remaining <= 0 ? "text-red-500" : "text-foreground"}`}>{lastResult.remaining}</span>
            </div>
            <div className="flex justify-between mt-1"><span className="text-muted-foreground">病歷號碼</span><span className="font-medium text-foreground">{patientId}</span></div>
            <div className="flex justify-between mt-1"><span className="text-muted-foreground">使用日期</span><span className="font-medium text-foreground">{useDate}</span></div>
            <div className="flex justify-between mt-1"><span className="text-muted-foreground">操作人員</span><span className="font-medium text-foreground">{performer || "未填寫"}</span></div>
          </div>
          <Button onClick={handleReset} className="w-full" data-testid="button-next-stockout">繼續下一筆出庫</Button>
        </div>
      </div>
    );
  }

  // ── 出庫表單 ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <PackageMinus size={20} className="text-primary" />藥品出庫
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">請填寫病歷號碼與使用資訊</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">

        {/* 選擇藥品 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">藥品名稱 <span className="text-red-500">*</span></Label>
          <select
            data-testid="select-medication"
            value={medId}
            onChange={e => { setMedId(e.target.value); setQuantity(1); setBatchId(""); setOverrideReason(""); }}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— 請選擇藥品 —</option>
            {activeMeds.map(m => (
              <option key={m.id} value={m.id}>{m.name}（庫存 {m.current_stock} {m.unit}）</option>
            ))}
          </select>
        </div>

        {/* 庫存狀態 */}
        {selectedMed && (
          <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2
            ${isLow ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300" : "bg-muted/50 text-muted-foreground"}`}>
            {isLow && <AlertTriangle size={13} />}
            目前庫存：<span className="font-semibold">{selectedMed.current_stock} {selectedMed.unit}</span>
            　安全庫量：{selectedMed.safety_stock} {selectedMed.unit}
            {isLow && (isBelow ? "　⚠ 低於安全庫存" : "　⚠ 已達安全量")}
          </div>
        )}

        {/* FEFO 建議批次 */}
        {selectedMed && (
          usableBatches.length === 0 ? (
            <div className="rounded-lg px-3 py-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle size={13} />無可用批次（可能全數已過期，請改用報廢）
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">出庫批次</Label>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 px-3 py-2 text-xs">
                系統建議（最早到期）：<span className="font-semibold">{fmtBatch(fefoBatch)}</span>
              </div>
              <select
                value={batchId}
                onChange={e => setBatchId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="select-batch"
              >
                <option value="">使用建議批次（FEFO）</option>
                {usableBatches.map(b => (
                  <option key={b.id} value={b.id}>{fmtBatch(b)}{b.id === fefoBatch.id ? "（建議）" : ""}</option>
                ))}
              </select>
              {isOverride && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 space-y-1.5">
                  <Label className="text-sm font-medium">改批次原因 <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">未依系統建議（最早到期）出庫，請說明原因。</p>
                  <Input placeholder="例如：該批次先供應特定療程" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} data-testid="input-override-reason" />
                </div>
              )}
            </div>
          )
        )}

        {/* 數量 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">出庫數量 <span className="text-red-500">*</span></Label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-md border border-input bg-background text-lg font-bold flex items-center justify-center hover:bg-muted transition-colors"
              data-testid="button-qty-minus">−</button>
            <Input type="number" min={1} max={selectedMed?.current_stock || 999} value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="text-center text-lg font-semibold h-10" data-testid="input-quantity" />
            <button type="button" onClick={() => setQuantity(q => q + 1)}
              className="w-10 h-10 rounded-md border border-input bg-background text-lg font-bold flex items-center justify-center hover:bg-muted transition-colors"
              data-testid="button-qty-plus">+</button>
            {selectedMed && <span className="text-sm text-muted-foreground">{selectedMed.unit}</span>}
          </div>
          {isInsufficient && <p className="text-xs text-red-500">庫存不足，目前只有 {selectedMed?.current_stock} {selectedMed?.unit}</p>}
        </div>

        {/* 病歷號碼 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">病歷號碼 <span className="text-red-500">*</span></Label>
          <Input placeholder="例如：A123456" value={patientId} onChange={e => setPatientId(e.target.value)} autoCapitalize="characters" data-testid="input-patient-id" />
        </div>

        {/* 使用日期 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">使用日期 <span className="text-red-500">*</span></Label>
          <Input type="date" value={useDate} onChange={e => setUseDate(e.target.value)} data-testid="input-use-date" />
        </div>

        {/* 操作人員 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">操作人員 <span className="text-red-500">*</span></Label>
          <select value={performer} onChange={e => setPerformer(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-performer">
            <option value="">— 請選擇護理師 —</option>
            {NURSING_STAFF.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        <Button type="submit" className="w-full h-12 text-base"
          disabled={mutation.isPending || !medId || !patientId.trim() || !performer || !!isInsufficient || usableBatches.length === 0}
          data-testid="button-submit-stockout">
          {mutation.isPending
            ? <><Loader2 size={16} className="mr-2 animate-spin" />處理中...</>
            : <><PackageMinus size={16} className="mr-2" />確認出庫</>}
        </Button>
      </form>
    </div>
  );
}
