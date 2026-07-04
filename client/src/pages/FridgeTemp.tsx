import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Thermometer, Sun, Moon, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { NURSING_STAFF } from "@/lib/staff";
import { taipeiToday, formatTaipeiDateTime } from "@shared/date-utils";

interface TempLog {
  id: string;
  log_date: string;
  slot: "AM" | "PM";
  temperature: number;
  abnormal: number;
  action_taken: string | null;
  recorded_by: string;
  recorded_at: string;
}

/** 台北時區目前小時（決定預設時段） */
function taipeiHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false }).format(new Date()));
}

function SlotStatus({ label, icon: Icon, log }: { label: string; icon: any; log: TempLog | null }) {
  return (
    <div className={`flex-1 rounded-lg border px-3 py-2.5 ${
      !log ? "border-dashed border-border bg-muted/30"
      : log.abnormal ? "border-red-300 bg-red-50 dark:bg-red-900/20"
      : "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20"}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        <Icon size={12} />{label}
      </div>
      {log ? (
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold mono ${log.abnormal ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {log.temperature}°C
          </span>
          <span className="text-xs text-muted-foreground">{log.recorded_by}</span>
          {log.abnormal ? <AlertTriangle size={14} className="text-red-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">尚未量測</span>
      )}
    </div>
  );
}

export default function FridgeTemp() {
  const { toast } = useToast();
  const [slot, setSlot] = useState<"AM" | "PM">(taipeiHour() < 14 ? "AM" : "PM");
  const [temperature, setTemperature] = useState("");
  const [performer, setPerformer] = useState("");
  const [actionTaken, setActionTaken] = useState("");

  const month = taipeiToday().slice(0, 7);

  const { data: today } = useQuery<{ date: string; am: TempLog | null; pm: TempLog | null }>({
    queryKey: ["/api/fridge-temps/today"],
    queryFn: () => apiRequest("GET", "/api/fridge-temps/today").then(r => r.json()),
  });

  const { data: monthLogs = [] } = useQuery<TempLog[]>({
    queryKey: ["/api/fridge-temps", month],
    queryFn: () => apiRequest("GET", `/api/fridge-temps?month=${month}`).then(r => r.json()),
  });

  const temp = Number(temperature);
  const validTemp = temperature !== "" && !isNaN(temp);
  const isAbnormal = validTemp && (temp < 2 || temp > 8);

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/fridge-temps", {
        temperature: temp,
        slot,
        performedBy: performer,
        actionTaken: actionTaken.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fridge-temps/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fridge-temps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: isAbnormal ? "已記錄（溫度異常）" : "已記錄",
        description: `${slot === "AM" ? "上午" : "下午"} ${temp}°C`,
        variant: isAbnormal ? "destructive" : undefined,
      });
      setTemperature(""); setPerformer(""); setActionTaken("");
    },
    onError: (err: any) => {
      toast({ title: "記錄失敗", description: err?.message || "請稍後再試", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!validTemp) { toast({ title: "請輸入溫度", variant: "destructive" }); return; }
    if (!performer) { toast({ title: "請選擇記錄人員", variant: "destructive" }); return; }
    if (isAbnormal && !actionTaken.trim()) {
      toast({ title: "溫度超出 2–8°C", description: "請填寫異常處理措施（通報誰、藥品移置何處）", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  // 本月紀錄按日期分組（新→舊）
  const byDate = monthLogs.reduce<Record<string, TempLog[]>>((acc, l) => {
    (acc[l.log_date] ||= []).push(l);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort().reverse();

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Thermometer className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">冰箱溫度</h1>
        <span className="text-xs text-muted-foreground ml-auto">標準 2–8°C・每日上午/下午各一次</span>
      </div>

      {/* 今日狀態 */}
      <div className="flex gap-2">
        <SlotStatus label="上午（9:00）" icon={Sun} log={today?.am ?? null} />
        <SlotStatus label="下午（18:00）" icon={Moon} log={today?.pm ?? null} />
      </div>

      {/* 記錄表單 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">記錄溫度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 時段 */}
          <div className="grid grid-cols-2 gap-2">
            {(["AM", "PM"] as const).map(s => (
              <button key={s} type="button" onClick={() => setSlot(s)}
                className={`h-11 rounded-md border text-sm font-medium transition-colors ${
                  slot === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                data-testid={`slot-${s}`}>
                {s === "AM" ? "☀️ 上午" : "🌙 下午"}
              </button>
            ))}
          </div>

          {/* 溫度 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">冰箱溫度（°C）<span className="text-red-500"> *</span></label>
            <Input
              type="number" step="0.1" inputMode="decimal" placeholder="例：5.2"
              value={temperature} onChange={e => setTemperature(e.target.value)}
              className={`h-12 text-xl font-semibold mono ${isAbnormal ? "border-red-400 focus-visible:ring-red-400" : ""}`}
              data-testid="input-temperature"
            />
            {isAbnormal && (
              <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-2.5 py-2 mt-1.5">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>超出 2–8°C 標準！請通報主管、將藥品移至另一台冰箱，並在下方填寫處理措施。</span>
              </div>
            )}
          </div>

          {/* 異常處理措施 */}
          {isAbnormal && (
            <div>
              <label className="text-sm font-medium mb-1.5 block text-red-600 dark:text-red-400">異常處理措施 <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="例：已通報院長，藥品移至診間冰箱，已聯絡廠商維修"
                value={actionTaken} onChange={e => setActionTaken(e.target.value)} rows={2}
                data-testid="textarea-action"
              />
            </div>
          )}

          {/* 記錄人員 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">記錄人員 <span className="text-red-500">*</span></label>
            <select value={performer} onChange={e => setPerformer(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="select-performer">
              <option value="">— 請選擇護理師 —</option>
              {NURSING_STAFF.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <Button className="w-full h-12 text-base font-semibold" onClick={handleSubmit}
            disabled={!validTemp || !performer || mutation.isPending} data-testid="button-submit">
            {mutation.isPending ? "記錄中..." : "確認記錄"}
          </Button>
          <p className="text-xs text-muted-foreground">同一時段重複記錄會覆蓋前一筆（打錯直接重送即可）。</p>
        </CardContent>
      </Card>

      {/* 本月紀錄 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">本月紀錄（{month}）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dates.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">本月尚無紀錄</p>
          ) : (
            <div className="divide-y divide-border">
              {dates.map(d => (
                <div key={d} className="px-4 py-2 flex items-center gap-3 text-sm">
                  <span className="w-20 text-xs text-muted-foreground">{d.slice(5)}</span>
                  {(["AM", "PM"] as const).map(sl => {
                    const log = byDate[d].find(l => l.slot === sl);
                    return (
                      <span key={sl} className={`flex-1 mono text-sm ${
                        !log ? "text-muted-foreground/40" : log.abnormal ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}>
                        {sl === "AM" ? "☀" : "🌙"} {log ? `${log.temperature}°C ${log.recorded_by}` : "—"}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
