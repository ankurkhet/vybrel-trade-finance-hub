import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Plus, ArrowDownUp } from "lucide-react";

type ProductType = "receivables_purchase" | "reverse_factoring" | "payables_finance";
type SettlementTiming = "advance" | "arrears";

interface FeeConfig {
  id?: string;
  organization_id: string;
  product_type: ProductType;
  originator_fee_pct: number;
  platform_fee_pct: number;
  default_discount_rate: number;
  settlement_days: number;
  settlement_timing: SettlementTiming;
  payment_instructions: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    sort_code?: string;
    iban?: string;
    swift?: string;
    reference_prefix?: string;
  };
  notes: string | null;
}

const PRODUCT_LABELS: Record<ProductType, { label: string; description: string }> = {
  receivables_purchase: {
    label: "Receivables Purchase",
    description: "Purchase of trade receivables from borrowers at a discount.",
  },
  reverse_factoring: {
    label: "Reverse Factoring",
    description: "Supplier finance initiated by the buyer / anchor debtor.",
  },
  payables_finance: {
    label: "Payables Finance",
    description: "Early payment to suppliers financed by a third-party funder.",
  },
};

const ALL_PRODUCTS: ProductType[] = ["receivables_purchase", "reverse_factoring", "payables_finance"];

export default function FeeConfigPage() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const [configs, setConfigs] = useState<FeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) fetchConfigs();
  }, [orgId]);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_fee_configs")
      .select("*")
      .eq("organization_id", orgId!)
      .order("product_type");

    if (error) {
      toast.error("Failed to load fee configurations");
    } else {
      setConfigs(
        (data || []).map((d: any) => ({
          ...d,
          payment_instructions: typeof d.payment_instructions === "object" && d.payment_instructions !== null
            ? d.payment_instructions
            : {},
        }))
      );
    }
    setLoading(false);
  };

  const configuredTypes = configs.map((c) => c.product_type);
  const unconfiguredTypes = ALL_PRODUCTS.filter((t) => !configuredTypes.includes(t));

  const addConfig = async (productType: ProductType) => {
    const { data, error } = await supabase
      .from("product_fee_configs")
      .insert({
        organization_id: orgId!,
        product_type: productType,
        originator_fee_pct: 0,
        platform_fee_pct: 0,
        default_discount_rate: 0,
        settlement_days: 1,
        payment_instructions: {} as any,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create config: " + error.message);
    } else if (data) {
      setConfigs((prev) => [
        ...prev,
        { ...data, payment_instructions: {} } as unknown as FeeConfig,
      ]);
      toast.success(`${PRODUCT_LABELS[productType].label} fee config created`);
    }
  };

  const updateField = (id: string, field: string, value: unknown) => {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const updatePaymentField = (id: string, field: string, value: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, payment_instructions: { ...c.payment_instructions, [field]: value } }
          : c
      )
    );
  };

  const saveConfig = async (config: FeeConfig) => {
    if (!config.id) return;

    // Validate
    if (config.originator_fee_pct < 0 || config.originator_fee_pct > 100) {
      toast.error("Originator fee must be between 0 and 100%");
      return;
    }
    if (config.platform_fee_pct < 0 || config.platform_fee_pct > 100) {
      toast.error("Platform fee must be between 0 and 100%");
      return;
    }
    if (config.default_discount_rate < 0 || config.default_discount_rate > 100) {
      toast.error("Discount rate must be between 0 and 100%");
      return;
    }
    if (config.settlement_days < 0 || config.settlement_days > 365) {
      toast.error("Settlement days must be between 0 and 365");
      return;
    }

    setSaving(config.id);
    const { error } = await supabase
      .from("product_fee_configs")
      .update({
        originator_fee_pct: config.originator_fee_pct,
        platform_fee_pct: config.platform_fee_pct,
        default_discount_rate: config.default_discount_rate,
        settlement_days: config.settlement_days,
        payment_instructions: config.payment_instructions as any,
        notes: config.notes,
      })
      .eq("id", config.id);

    setSaving(null);
    if (error) {
      toast.error("Save failed: " + error.message);
    } else {
      toast.success(`${PRODUCT_LABELS[config.product_type].label} config saved`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fee Configuration</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Set fee structures, discount rates, and payment instructions per product type.
            </p>
          </div>
          {unconfiguredTypes.length > 0 && (
            <Select onValueChange={(v) => addConfig(v as ProductType)}>
              <SelectTrigger className="w-auto gap-2">
                <Plus className="h-4 w-4" />
                <SelectValue placeholder="Add product" />
              </SelectTrigger>
              <SelectContent>
                {unconfiguredTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PRODUCT_LABELS[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : configs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ArrowDownUp className="mb-4 h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">No fee configurations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a product type above to configure its fees and settlement terms.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {configs.map((config) => (
              <Card key={config.id} className="border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">
                      {PRODUCT_LABELS[config.product_type].label}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs capitalize">
                      {config.settlement_timing || "arrears"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {PRODUCT_LABELS[config.product_type].description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Fee Structure */}
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-foreground">Fee Structure</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Originator Fee (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={config.originator_fee_pct}
                          onChange={(e) =>
                            updateField(config.id!, "originator_fee_pct", parseFloat(e.target.value) || 0)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Charged to borrower on each settlement
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Platform Fee (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={config.platform_fee_pct}
                          onChange={(e) =>
                            updateField(config.id!, "platform_fee_pct", parseFloat(e.target.value) || 0)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Platform commission deducted from settlement
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Default Discount Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={config.default_discount_rate}
                          onChange={(e) =>
                            updateField(config.id!, "default_discount_rate", parseFloat(e.target.value) || 0)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Applied to invoice face value at purchase
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Settlement Days</Label>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          value={config.settlement_days}
                          onChange={(e) =>
                            updateField(config.id!, "settlement_days", parseInt(e.target.value) || 0)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Days after collection to settle
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Settlement Timing */}
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-foreground">Settlement Timing</h3>
                    <div className="max-w-xs space-y-2">
                      <Label>Advance / Arrears</Label>
                      <Select
                        value={config.settlement_timing || "arrears"}
                        onValueChange={(v) => updateField(config.id!, "settlement_timing", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="advance">
                            Advance — fund borrower before debtor pays
                          </SelectItem>
                          <SelectItem value="arrears">
                            Arrears — settle after debtor payment received
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Payment Instructions */}
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-foreground">Payment Instructions</h3>
                    <p className="mb-4 text-xs text-muted-foreground">
                      Bank details included on settlement advices for this product.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Bank Name</Label>
                        <Input
                          value={config.payment_instructions.bank_name || ""}
                          onChange={(e) => updatePaymentField(config.id!, "bank_name", e.target.value)}
                          placeholder="e.g. Barclays"
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Account Name</Label>
                        <Input
                          value={config.payment_instructions.account_name || ""}
                          onChange={(e) => updatePaymentField(config.id!, "account_name", e.target.value)}
                          placeholder="e.g. Acme Ltd Client Account"
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Account Number</Label>
                        <Input
                          value={config.payment_instructions.account_number || ""}
                          onChange={(e) => updatePaymentField(config.id!, "account_number", e.target.value)}
                          placeholder="12345678"
                          maxLength={20}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sort Code</Label>
                        <Input
                          value={config.payment_instructions.sort_code || ""}
                          onChange={(e) => updatePaymentField(config.id!, "sort_code", e.target.value)}
                          placeholder="12-34-56"
                          maxLength={10}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>IBAN</Label>
                        <Input
                          value={config.payment_instructions.iban || ""}
                          onChange={(e) => updatePaymentField(config.id!, "iban", e.target.value)}
                          placeholder="GB29NWBK60161331926819"
                          maxLength={34}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SWIFT / BIC</Label>
                        <Input
                          value={config.payment_instructions.swift || ""}
                          onChange={(e) => updatePaymentField(config.id!, "swift", e.target.value)}
                          placeholder="NWBKGB2L"
                          maxLength={11}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                        <Label>Reference Prefix</Label>
                        <Input
                          value={config.payment_instructions.reference_prefix || ""}
                          onChange={(e) => updatePaymentField(config.id!, "reference_prefix", e.target.value)}
                          placeholder="e.g. SETTLE-RP-"
                          maxLength={30}
                        />
                        <p className="text-xs text-muted-foreground">
                          Prefix added to payment references on settlement advices
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Internal Notes</Label>
                    <Textarea
                      value={config.notes || ""}
                      onChange={(e) => updateField(config.id!, "notes", e.target.value)}
                      placeholder="Internal notes about this fee configuration..."
                      rows={2}
                      maxLength={500}
                    />
                  </div>

                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/85"
                    onClick={() => saveConfig(config)}
                    disabled={saving === config.id}
                  >
                    {saving === config.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save {PRODUCT_LABELS[config.product_type].label} Config
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
