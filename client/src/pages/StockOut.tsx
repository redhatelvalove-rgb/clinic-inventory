import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PackageMinus, CheckCircle2, AlertTriangle } from "lucide-react";
import { NURSING_STAFF } from "@/lib/staff";
import type { Medication } from "@shared/schema";

export default function StockOut() {
  const { toast } = useToast();
  const [medId, setMedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [patientId, setPatientId] = useState("");        // 病歷號碼
  const [useDate, setUseDate] = useState(() => new Date().toISOString().split("T")[0]); // 使用日期
  const [performer, setPerformer] = useState("");          // 操作人員
  const [done, setDone] = useState(false);
  const [lastResult, setLastResult] = useState<{ medName: string; quantity: number; remaining: number } | null>(null);

  const { data: medications = [] } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
  });

  const activeMeds = medications.filter(m => m.isActive);
  const selectedMed = activeMeds.find(m => m.id === medId);

  // 庫存狀態
  const stockRatio = selectedMed ? selectedMed.currentStock / (selectedMed.safetyStock || 1) : 1;
  const isLow = selectedMed && selectedMed.currentStock <= selectedMed.safetyStock;
  const isInsufficient = selectedMed && selectedMed.currentStock < quantity;

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/stock/out", {
        medId,
        quantity,
        reason: `病歷號碼：${patientId}｜使用日期：${useDate}`,
        performedBy: performer.trim() || "未填寫",
      }).then(r => r.json()),
    onSuccess: () => {
      const med = selectedMed!;
      const remaining = med.currentStock - quantity;
      setLastResult({ medName: med.name, quantity, remaining });
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (err: any) => {
      toast({ title: "出庫失敗", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!medId) return toast({ title: "請選擇藥品", variant: "destructive" });
    if (!patientId.trim()) return toast({ title: "請輸入病歷號碼", variant: "destructive" });
    if (!performer) return toast({ title: "請選擇操作人員", variant: "destructive" });
    if (quantity < 1) return toast({ title: "數量至少為 1", variant: "destructive" });
    mutation.mutate();
  }

  function handleReset() {
    setMedId("");
    setQuantity(1);
    setPatientId("");
    setUseDate(new Date().toISOString().split("T")[0]);
    setPerformer("");
    setDone(false);
    setLastResult(null);
  }

  // ── 完成畫面 ─────────────────────────────────────────────────────────────────
  if (done && lastResult) {
    return (
      <div className="max-w-md mx-auto pt-8 px-2">
        <div className="bg-card border border-border rounded-xl p-6 text-center shadow-sm">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">出庫完成</h2>
          <p className="text-muted-foreground text-sm mb-4">
            {lastResult.medName} × {lastResult.quantity}
          </p>
          <div className="bg-muted/50 rounded-lg p-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground">剩餘庫存</span>
              <span className={`font-semibold ${lastResult.remaining <= 0 ? "text-red-500" : "text-foreground"}`}>
                {lastResult.remaining}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">病歷號碼</span>
              <span className="font-medium text-foreground">{patientId}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">使用日期</span>
              <span className="font-medium text-foreground">{useDate}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">操作人員</span>
              <span className="font-medium text-foreground">{performer || "未填寫"}</span>
            </div>
          </div>
          <Button onClick={handleReset} className="w-full" data-testid="button-next-stockout">
            繼續下一筆出庫
          </Button>
        </div>
      </div>
    );
  }

  // ── 出庫表單 ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <PackageMinus size={20} className="text-primary" />
          藥品出庫
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
            onChange={e => { setMedId(e.target.value); setQuantity(1); }}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— 請選擇藥品 —</option>
            {activeMeds.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}（庫存 {m.currentStock} {m.unit}）
              </option>
            ))}
          </select>
        </div>

        {/* 選到藥品後顯示庫存狀態 */}
        {selectedMed && (
          <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2
            ${isLow ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300" : "bg-muted/50 text-muted-foreground"}`}>
            {isLow && <AlertTriangle size={13} />}
            目前庫存：<span className="font-semibold">{selectedMed.currentStock} {selectedMed.unit}</span>
            　安全庫量：{selectedMed.safetyStock} {selectedMed.unit}
            {isLow && "　⚠ 低於安全庫存"}
          </div>
        )}

        {/* 數量 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">出庫數量 <span className="text-red-500">*</span></Label>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-md border border-input bg-background text-lg font-bold flex items-center justify-center hover:bg-muted transition-colors"
              data-testid="button-qty-minus">−</button>
            <Input
              type="number"
              min={1}
              max={selectedMed?.currentStock || 999}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="text-center text-lg font-semibold h-10"
              data-testid="input-quantity"
            />
            <button type="button"
              onClick={() => setQuantity(q => q + 1)}
              className="w-10 h-10 rounded-md border border-input bg-background text-lg font-bold flex items-center justify-center hover:bg-muted transition-colors"
              data-testid="button-qty-plus">+</button>
            {selectedMed && <span className="text-sm text-muted-foreground">{selectedMed.unit}</span>}
          </div>
          {isInsufficient && (
            <p className="text-xs text-red-500">庫存不足，目前只有 {selectedMed?.currentStock} {selectedMed?.unit}</p>
          )}
        </div>

        {/* 病歷號碼 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">病歷號碼 <span className="text-red-500">*</span></Label>
          <Input
            placeholder="例如：A123456"
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            autoCapitalize="characters"
            data-testid="input-patient-id"
          />
        </div>

        {/* 使用日期 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">使用日期 <span className="text-red-500">*</span></Label>
          <Input
            type="date"
            value={useDate}
            onChange={e => setUseDate(e.target.value)}
            data-testid="input-use-date"
          />
        </div>

        {/* 操作人員 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">操作人員 <span className="text-red-500">*</span></Label>
          <select
            value={performer}
            onChange={e => setPerformer(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-performer"
          >
            <option value="">— 請選擇護理師 —</option>
            {NURSING_STAFF.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* 提交 */}
        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={mutation.isPending || !medId || !patientId.trim() || !performer || !!isInsufficient}
          data-testid="button-submit-stockout"
        >
          {mutation.isPending
            ? <><Loader2 size={16} className="mr-2 animate-spin" />處理中...</>
            : <><PackageMinus size={16} className="mr-2" />確認出庫</>
          }
        </Button>
      </form>
    </div>
  );
}
