import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Users } from "lucide-react";

interface FunderAllocation {
  allocation_id: string;
  funder_user_id: string;
  funder_name: string;
  currency: string;
  allocated_limit: number;
  final_discounting_rate: number;
  advance_rate: number;
  // UI-editable settlement amount
  settlement_amount: number;
}

interface SettlementAllocationPanelProps {
  borrowerId: string;
  currency: string;
  grossCollectionAmount: number;
  onAllocationsChange: (allocations: FunderAllocation[]) => void;
}

export function SettlementAllocationPanel({
  borrowerId,
  currency,
  grossCollectionAmount,
  onAllocationsChange,
}: SettlementAllocationPanelProps) {
  const [allocations, setAllocations] = useState<FunderAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAllocated, setTotalAllocated] = useState(0);

  useEffect(() => {
    if (borrowerId) fetchAllocations();
  }, [borrowerId, currency]);

  useEffect(() => {
    const total = allocations.reduce((sum, a) => sum + (a.settlement_amount || 0), 0);
    setTotalAllocated(total);
    onAllocationsChange(allocations);
  }, [allocations]);

  const fetchAllocations = async () => {
    setLoading(true);

    // Get active facilities for this borrower + currency
    const { data: facilities } = await (supabase as any)
      .from("facilities")
      .select("id")
      .eq("borrower_id", borrowerId)
      .eq("currency", currency)
      .eq("status", "active");

    if (!facilities || facilities.length === 0) {
      setAllocations([]);
      setLoading(false);
      return;
    }

    const facilityIds = facilities.map((f: any) => f.id);

    // Get active funder allocations
    const { data: ffas } = await (supabase as any)
      .from("facility_funder_allocations")
      .select("id, funder_user_id, allocated_limit, currency, final_discounting_rate, advance_rate")
      .in("facility_id", facilityIds)
      .eq("status", "active")
      .eq("currency", currency);

    if (!ffas || ffas.length === 0) {
      setAllocations([]);
      setLoading(false);
      return;
    }

    // Fetch funder names
    const funderIds = ffas.map((a: any) => a.funder_user_id);
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", funderIds);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name || "Funder"; });

    // Calculate total allocated_limit to determine proportional split
    const totalLimit = ffas.reduce((sum: number, a: any) => sum + Number(a.allocated_limit), 0);

    const mapped: FunderAllocation[] = ffas.map((a: any) => {
      const proportion = totalLimit > 0 ? Number(a.allocated_limit) / totalLimit : 1 / ffas.length;
      return {
        allocation_id: a.id,
        funder_user_id: a.funder_user_id,
        funder_name: profileMap[a.funder_user_id] || "Funder",
        currency: a.currency || currency,
        allocated_limit: Number(a.allocated_limit),
        final_discounting_rate: Number(a.final_discounting_rate) || 0,
        advance_rate: Number(a.advance_rate) || 80,
        settlement_amount: Math.round(grossCollectionAmount * proportion * 100) / 100,
      };
    });

    setAllocations(mapped);
    setLoading(false);
  };

  const updateAmount = (idx: number, value: string) => {
    const parsed = parseFloat(value) || 0;
    setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, settlement_amount: parsed } : a));
  };

  const applyProportional = () => {
    const totalLimit = allocations.reduce((sum, a) => sum + a.allocated_limit, 0);
    setAllocations(prev => prev.map(a => ({
      ...a,
      settlement_amount: totalLimit > 0
        ? Math.round((grossCollectionAmount * a.allocated_limit / totalLimit) * 100) / 100
        : Math.round((grossCollectionAmount / prev.length) * 100) / 100,
    })));
  };

  const remaining = grossCollectionAmount - totalAllocated;
  const isOverAllocated = remaining < -0.01;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading funder allocations…</p>;
  }

  if (allocations.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        <Users className="mx-auto mb-2 h-5 w-5" />
        No active funder allocations for this currency. Settlement will use standard funding offers.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Multi-Funder Settlement Allocation</Label>
        <Button variant="outline" size="sm" onClick={applyProportional}>
          Auto-split proportionally
        </Button>
      </div>

      <div className="space-y-2">
        {allocations.map((alloc, idx) => (
          <div key={alloc.allocation_id} className="flex items-center gap-3 rounded-md border px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{alloc.funder_name}</p>
              <p className="text-xs text-muted-foreground">
                {alloc.currency} · {alloc.final_discounting_rate.toFixed(2)}% p.a.
                · Limit: {alloc.currency} {Number(alloc.allocated_limit).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{alloc.currency}</span>
              <Input
                type="number"
                className="w-36 h-8 text-sm"
                value={alloc.settlement_amount}
                onChange={e => updateAmount(idx, e.target.value)}
                min={0}
                step={0.01}
              />
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Gross collection:</span>
        <span className="font-medium">{currency} {grossCollectionAmount.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total allocated to funders:</span>
        <span className="font-medium">{currency} {totalAllocated.toLocaleString()}</span>
      </div>
      <div className={`flex items-center justify-between text-sm font-medium ${
        isOverAllocated ? "text-destructive" : remaining > 0 ? "text-muted-foreground" : "text-green-600"
      }`}>
        <span>Remaining (borrower net):</span>
        <span>{currency} {remaining.toLocaleString()}</span>
      </div>

      {isOverAllocated && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Funder allocations exceed gross collection amount. Please adjust.
        </div>
      )}

      {allocations.length > 0 && !isOverAllocated && (
        <p className="text-xs text-muted-foreground">
          Each funder will receive a separate settlement advice and journal entry.
        </p>
      )}
    </div>
  );
}
