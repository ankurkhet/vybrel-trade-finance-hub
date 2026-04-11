import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, FileText, Calendar, Percent } from "lucide-react";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  issued: "secondary",
  pending_acceptance: "secondary",
  active: "default",
  expired: "destructive",
  cancelled: "destructive",
};

const PRODUCT_LABELS: Record<string, string> = {
  invoice_discounting: "Invoice Discounting",
  reverse_factoring: "Reverse Factoring",
  inventory_finance: "Inventory Finance",
  structured_trade_finance: "Structured Trade Finance",
  working_capital_revolving: "Working Capital Revolving",
  other: "Other",
};

export default function BorrowerOfferLetters() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [letters, setLetters] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptLetter, setAcceptLetter] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    // Get borrower record
    const { data: borrower } = await (supabase as any)
      .from("borrowers")
      .select("id")
      .eq("user_id", user?.id)
      .single();

    if (!borrower) { setLoading(false); return; }

    // Fetch offer letters (consolidated view — no funder breakdown)
    const { data: ols } = await (supabase as any)
      .from("offer_letters")
      .select(`
        id, offer_number, product_type, status,
        settlement_type, valid_from, valid_to,
        platform_fee_pct, overdue_fee_pct, max_invoice_amount,
        issued_at, accepted_at, notes
      `)
      .eq("borrower_id", borrower.id)
      .in("status", ["issued", "pending_acceptance", "active", "expired"])
      .order("created_at", { ascending: false });

    // Fetch facilities (consolidated — no rate detail shown to borrower)
    const { data: facs } = await (supabase as any)
      .from("facilities")
      .select(`
        id, currency, overall_limit, final_advance_rate,
        valid_from, valid_to, status, offer_letter_id
      `)
      .eq("borrower_id", borrower.id)
      .eq("status", "active");

    setLetters(ols || []);
    setFacilities(facs || []);
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!acceptLetter) return;
    setAccepting(true);
    try {
      await (supabase as any)
        .from("offer_letters")
        .update({
          status: "active",
          accepted_at: new Date().toISOString(),
          accepted_by: user?.id,
        })
        .eq("id", acceptLetter.id);

      toast({ title: `Offer ${acceptLetter.offer_number} accepted` });
      setAcceptLetter(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error accepting offer", description: err.message, variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Loading your offer letters…
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Offer Letters & Facilities</h1>
          <p className="text-sm text-muted-foreground">
            Financing facilities offered to your business. Review and accept active offers.
          </p>
        </div>

        {letters.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No offer letters available yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {letters.map(l => {
              const relatedFacilities = facilities.filter(f => f.offer_letter_id === l.id);
              return (
                <Card key={l.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base font-mono">{l.offer_number}</CardTitle>
                        <Badge variant={STATUS_VARIANTS[l.status] || "outline"}>
                          {l.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {(l.status === "issued" || l.status === "pending_acceptance") && (
                        <Button size="sm" onClick={() => setAcceptLetter(l)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Accept Offer
                        </Button>
                      )}
                    </div>
                    <CardDescription>
                      {PRODUCT_LABELS[l.product_type] || l.product_type}
                      {l.settlement_type === "advance" ? " · Advance payment" : " · Payment at maturity"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Valid From
                        </p>
                        <p className="font-medium">
                          {l.valid_from ? new Date(l.valid_from).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Valid To
                        </p>
                        <p className="font-medium">
                          {l.valid_to ? new Date(l.valid_to).toLocaleDateString() : "Open-ended"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Percent className="h-3 w-3" /> Platform Fee
                        </p>
                        <p className="font-medium">{l.platform_fee_pct}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Percent className="h-3 w-3" /> Overdue Fee
                        </p>
                        <p className="font-medium">{l.overdue_fee_pct}%</p>
                      </div>
                    </div>

                    {/* Currency facilities — no funder rate detail */}
                    {relatedFacilities.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Approved Currencies</p>
                        <div className="flex flex-wrap gap-2">
                          {relatedFacilities.map(f => (
                            <div key={f.id} className="rounded-md border px-3 py-2 text-sm">
                              <span className="font-semibold">{f.currency}</span>
                              {f.overall_limit && (
                                <span className="ml-2 text-muted-foreground">
                                  Limit: {f.currency} {Number(f.overall_limit).toLocaleString()}
                                </span>
                              )}
                              <span className="ml-2 text-muted-foreground">
                                · {f.final_advance_rate}% advance
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {l.notes && (
                      <p className="text-sm text-muted-foreground italic">{l.notes}</p>
                    )}

                    {l.accepted_at && (
                      <p className="text-xs text-muted-foreground">
                        Accepted on {new Date(l.accepted_at).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Accept confirmation dialog */}
      <Dialog open={!!acceptLetter} onOpenChange={() => setAcceptLetter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Offer Letter</DialogTitle>
            <DialogDescription>
              By accepting <strong>{acceptLetter?.offer_number}</strong>, you agree to the terms of this{" "}
              {acceptLetter ? PRODUCT_LABELS[acceptLetter.product_type] : ""} facility.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptLetter(null)}>Cancel</Button>
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting ? "Accepting…" : "Confirm Acceptance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
