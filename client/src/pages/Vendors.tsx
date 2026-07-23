import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, Phone, Mail, Clock, Package, Plus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const VENDOR_MEDS: Record<string, string[]> = {
  "V001": ["Prolia 保骼麗"],
  "V002": ["Evenity 益穩挺"],
  "V003": ["Durolane 膝舒適"],
  "V004": ["Artzdispo 雅節", "ArtiAid Plus 優節益", "Polyxal 玻麗舒", "Density 特適體", "Probone 補骨立素"],
  "V005": ["Botox 肉毒桿菌素"],
};

const EMPTY_FORM = { companyName: "", contactPerson: "", phone: "", email: "", leadTimeDays: "5", notes: "" };

export default function Vendors() {
  const { toast } = useToast();
  const { data: vendors = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/vendors"] });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/vendors", {
      companyName: form.companyName.trim(),
      contactPerson: form.contactPerson.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      leadTimeDays: Number(form.leadTimeDays) || 5,
      notes: form.notes.trim() || null,
    }).then(r => r.json()),
    onSuccess: (v: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "新增成功", description: `「${v.company_name || v.companyName}」已加入廠商目錄。` });
      setForm(EMPTY_FORM);
      setShowForm(false);
    },
    onError: (e: any) => toast({ title: "新增失敗", description: e?.message || "請確認欄位填寫", variant: "destructive" }),
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">廠商目錄</h1>
          <p className="text-sm text-muted-foreground mt-0.5">藥品供應商聯絡資訊與前置天數</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)} data-testid="btn-add-vendor">
          <Plus className="w-4 h-4 mr-1" />新增廠商
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">廠商名稱 <span className="text-red-500">*</span></Label>
              <Input placeholder="例如：XX 醫療器材有限公司" value={form.companyName} onChange={set("companyName")} data-testid="input-vendor-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">聯絡人（選填）</Label>
                <Input value={form.contactPerson} onChange={set("contactPerson")} data-testid="input-vendor-contact" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">電話（選填）</Label>
                <Input type="tel" value={form.phone} onChange={set("phone")} data-testid="input-vendor-phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Email（選填）</Label>
                <Input type="email" value={form.email} onChange={set("email")} data-testid="input-vendor-email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">前置天數</Label>
                <Input type="number" inputMode="numeric" min={0} value={form.leadTimeDays} onChange={set("leadTimeDays")} data-testid="input-vendor-leadtime" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">備註（選填）</Label>
              <Input placeholder="例如：主要供應玻尿酸" value={form.notes} onChange={set("notes")} data-testid="input-vendor-notes" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" disabled={!form.companyName.trim() || mutation.isPending}
                onClick={() => mutation.mutate()} data-testid="btn-save-vendor">
                {mutation.isPending ? <><Loader2 size={16} className="mr-2 animate-spin" />儲存中...</> : "儲存廠商"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {vendors.map((v: any) => (
            <Card key={v.id} className="hover:border-primary/40 transition-colors" data-testid={`vendor-${v.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{v.company_name}</div>
                      {v.notes && <div className="text-xs text-muted-foreground">{v.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    <Clock size={11} />
                    {v.lead_time_days} 天
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1">
                  {v.contact_person ? (
                    <div className="text-xs text-muted-foreground">{v.contact_person}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground/50 italic">聯絡人待填入</div>
                  )}
                  <div className="flex gap-3">
                    {v.phone ? (
                      <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-xs text-primary">
                        <Phone size={11} />{v.phone}
                      </a>
                    ) : <span className="text-xs text-muted-foreground/50 flex items-center gap-1"><Phone size={11} />待填入</span>}
                    {v.email && (
                      <a href={`mailto:${v.email}`} className="flex items-center gap-1 text-xs text-primary">
                        <Mail size={11} />{v.email}
                      </a>
                    )}
                  </div>
                </div>

                {/* Associated meds */}
                {VENDOR_MEDS[v.id] && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                    {VENDOR_MEDS[v.id].map(m => (
                      <span key={m} className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        <Package size={10} />{m}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
