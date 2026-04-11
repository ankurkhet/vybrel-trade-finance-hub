import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronRight } from "lucide-react";

interface OfferLetterWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  prefillBorrowerId?: string;
}

const PRODUCT_TYPES = [
  { value: "invoice_discounting", label: "Invoice Discounting" },
  { value: "reverse_factoring", label: "Reverse Factoring" },
  { value: "inventory_finance", label: "Inventory Finance" },
  { value: "structured_trade_finance", label: "Structured Trade Finance" },
  { value: "working_capital_revolving", label: "Working Capital Revolving" },
  { value: "other", label: "Other" },
];

const SETTLEMENT_TYPES = [
  { value: "advance", label: "Advance (upfront payment)" },
  { value: "maturity", label: "At Maturity" },
];

const CURRENCIES = ["GBP", "USD", "EUR", "AED", "SGD"];

export function OfferLetterWizard({
  open,
  onClose,
  onCreated,
  prefillBorrowerId,
}: OfferLetterWizardProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [borrowers, setBorrowers] = useState<any[]>([]);

  // Step 1: Basics
  const [borrowerId, setBorrowerId] = useState(prefillBorrowerId || "");
  const [productType, setProductType] = useState("");
  const [settlementType, setSettlementType] = useState("advance");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [notes, setNotes] = useState("");

  // Step 2: Currencies & Limits
  const [currencies, setCurrencies] = useState<
    { currency: string; overallLimit: string; finalAdvanceRate: string; maxInvoiceAmount: string }[]
  >([{ currency: "GBP", overallLimit: "", finalAdvanceRate: "80", maxInvoiceAmount: "" }]);

  // Step 3: Fees
  const [platformFeePct, setPlatformFeePct] = useState("0");
  const [overdueFeePct, setOverdueFeePct] = useState("0");
  const [interoperabilityAllowed, setInteroperabilityAllowed] = useState(false);
  const [interoperabilityMaxPct, setInteroperabilityMaxPct] = useState("0");

  useEffect(() => {
    if (open) {
      fetchBorrowers();
      if (prefillBorrowerId) setBorrowerId(prefillBorrowerId);
    }
  }, [open, prefillBorrowerId]);

  const fetchBorrowers = async () => {
    const { data } = await (supabase as any)
      .from("borrowers")
      .select("id, company_name")
      .eq("organization_id", profile?.organization_id)
      .order("company_name");
    setBorrowers(data || []);
  };

  const addCurrency = () => {
    setCurrencies([...currencies, { currency: "USD", overallLimit: "", finalAdvanceRate: "80", maxInvoiceAmount: "" }]);
  };

  const removeCurrency = (idx: number) => {
    setCurrencies(currencies.filter((_, i) => i !== idx));
  };

  const updateCurrency = (idx: number, field: string, value: string) => {
    setCurrencies(currencies.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = async () => {
    if (!borrowerId || !productType) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Insert offer letter
      const { data: ol, error: olErr } = await (supabase as any)
        .from("offer_letters")
        .insert({
          organization_id: profile?.organization_id,
          borrower_id: borrowerId,
          offer_number: "",      // trigger auto-generates
          product_type: productType,
          settlement_type: settlementType,
          valid_from: validFrom || null,
          valid_to: validTo || null,
          platform_fee_pct: parseFloat(platformFeePct) || 0,
          overdue_fee_pct: parseFloat(overdueFeePct) || 0,
          max_invoice_amount: currencies[0]?.maxInvoiceAmount
            ? parseFloat(currencies[0].maxInvoiceAmount)
            : null,
          notes: notes || null,
          status: "draft",
        })
        .select()
        .single();

      if (olErr) throw olErr;

      // Create a facility row per currency
      for (const cur of currencies) {
        await (supabase as any).from("facilities").insert({
          organization_id: profile?.organization_id,
          borrower_id: borrowerId,
          offer_letter_id: ol.id,
          product_type: productType,
          currency: cur.currency,
          advance_rate: parseFloat(cur.finalAdvanceRate) || 80,
          final_advance_rate: parseFloat(cur.finalAdvanceRate) || 80,
          overall_limit: cur.overallLimit ? parseFloat(cur.overallLimit) : null,
          max_invoice_amount: cur.maxInvoiceAmount ? parseFloat(cur.maxInvoiceAmount) : null,
          settlement_type: settlementType,
          valid_from: validFrom || null,
          valid_to: validTo || null,
          platform_fee_pct: parseFloat(platformFeePct) || 0,
          overdue_fee_pct: parseFloat(overdueFeePct) || 0,
          interoperability_allowed: interoperabilityAllowed,
          interoperability_max_pct: parseFloat(interoperabilityMaxPct) || 0,
          status: "active",
        });
      }

      toast({ title: `Offer letter ${ol.offer_number} created as draft` });
      onCreated();
      handleClose();
    } catch (err: any) {
      toast({ title: "Error creating offer letter", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setBorrowerId(prefillBorrowerId || "");
    setProductType("");
    setSettlementType("advance");
    setValidFrom("");
    setValidTo("");
    setNotes("");
    setCurrencies([{ currency: "GBP", overallLimit: "", finalAdvanceRate: "80", maxInvoiceAmount: "" }]);
    setPlatformFeePct("0");
    setOverdueFeePct("0");
    setInteroperabilityAllowed(false);
    setInteroperabilityMaxPct("0");
    onClose();
  };

  const StepDot = ({ n, label }: { n: number; label: string }) => (
    <div className="flex items-center gap-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
        step > n ? "bg-primary text-primary-foreground" :
        step === n ? "bg-primary text-primary-foreground" :
        "bg-muted text-muted-foreground"
      }`}>
        {step > n ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <span className={`text-sm ${step === n ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Offer Letter</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-3 pb-4">
          <StepDot n={1} label="Basics" />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepDot n={2} label="Currencies & Limits" />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepDot n={3} label="Fees & Preview" />
        </div>

        <Separator className="mb-4" />

        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Borrower *</Label>
              {prefillBorrowerId ? (
                <p className="text-sm text-muted-foreground">
                  {borrowers.find(b => b.id === prefillBorrowerId)?.company_name || "Loading..."}
                </p>
              ) : (
                <Select value={borrowerId} onValueChange={setBorrowerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select borrower" />
                  </SelectTrigger>
                  <SelectContent>
                    {borrowers.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Product Type *</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Settlement Type</Label>
              <Select value={settlementType} onValueChange={setSettlementType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTLEMENT_TYPES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Valid To</Label>
                <Input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Internal notes (not shown to borrower)"
                rows={3}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setStep(2)}
                disabled={!borrowerId || !productType}
              >
                Next: Currencies & Limits
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Currencies & Limits */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define one facility per currency. Each spawns a separate facility record.
            </p>

            {currencies.map((cur, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Facility {idx + 1}</Badge>
                  {currencies.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeCurrency(idx)}>
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={cur.currency} onValueChange={v => updateCurrency(idx, "currency", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Advance Rate (%)</Label>
                    <Input
                      type="number"
                      value={cur.finalAdvanceRate}
                      onChange={e => updateCurrency(idx, "finalAdvanceRate", e.target.value)}
                      placeholder="80"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Overall Facility Limit</Label>
                    <Input
                      type="number"
                      value={cur.overallLimit}
                      onChange={e => updateCurrency(idx, "overallLimit", e.target.value)}
                      placeholder="e.g. 5000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Invoice Amount</Label>
                    <Input
                      type="number"
                      value={cur.maxInvoiceAmount}
                      onChange={e => updateCurrency(idx, "maxInvoiceAmount", e.target.value)}
                      placeholder="e.g. 500000"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addCurrency}>
              + Add Another Currency
            </Button>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next: Fees & Preview</Button>
            </div>
          </div>
        )}

        {/* Step 3: Fees & Preview */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform Fee (%)</Label>
                <Input
                  type="number"
                  value={platformFeePct}
                  onChange={e => setPlatformFeePct(e.target.value)}
                  step="0.01"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Overdue Fee (%)</Label>
                <Input
                  type="number"
                  value={overdueFeePct}
                  onChange={e => setOverdueFeePct(e.target.value)}
                  step="0.01"
                  min={0}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-sm font-medium">Cross-Currency (Interoperability)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={interoperabilityAllowed}
                  onChange={e => setInteroperabilityAllowed(e.target.checked)}
                  id="interop"
                  className="h-4 w-4"
                />
                <label htmlFor="interop" className="text-sm">
                  Allow cross-currency funding
                </label>
              </div>
              {interoperabilityAllowed && (
                <div className="space-y-1 pl-7">
                  <Label className="text-xs">Max cross-currency % of invoice value</Label>
                  <Input
                    type="number"
                    value={interoperabilityMaxPct}
                    onChange={e => setInteroperabilityMaxPct(e.target.value)}
                    className="h-8 w-32"
                    min={0}
                    max={100}
                  />
                </div>
              )}
            </div>

            {/* Preview summary */}
            <Separator />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Review Summary</p>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <span>Borrower:</span>
                <span className="text-foreground">{borrowers.find(b => b.id === borrowerId)?.company_name}</span>
                <span>Product:</span>
                <span className="text-foreground">{PRODUCT_TYPES.find(p => p.value === productType)?.label}</span>
                <span>Settlement:</span>
                <span className="text-foreground">{settlementType}</span>
                <span>Validity:</span>
                <span className="text-foreground">{validFrom || "—"} → {validTo || "—"}</span>
                <span>Currencies:</span>
                <span className="text-foreground">{currencies.map(c => c.currency).join(", ")}</span>
                <span>Platform fee:</span>
                <span className="text-foreground">{platformFeePct}%</span>
                <span>Overdue fee:</span>
                <span className="text-foreground">{overdueFeePct}%</span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Creating..." : "Create Offer Letter (Draft)"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
