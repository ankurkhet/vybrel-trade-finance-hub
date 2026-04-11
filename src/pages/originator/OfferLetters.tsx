import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { OfferLetterWizard } from "@/components/offer-letters/OfferLetterWizard";
import { Plus, MoreHorizontal, Send, X, CheckCircle2 } from "lucide-react";

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
  working_capital_revolving: "WC Revolving",
  other: "Other",
};

export default function OfferLetters() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active");
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    fetchLetters();
  }, [profile]);

  const fetchLetters = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("offer_letters")
      .select(`
        *,
        borrowers ( company_name )
      `)
      .eq("organization_id", profile?.organization_id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load offer letters", variant: "destructive" });
    } else {
      setLetters(data || []);
    }
    setLoading(false);
  };

  const handleIssue = async (id: string) => {
    const { error } = await (supabase as any)
      .from("offer_letters")
      .update({ status: "issued", issued_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to issue", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Offer letter issued" });
      fetchLetters();
    }
  };

  const handleCancel = async (id: string) => {
    const { error } = await (supabase as any)
      .from("offer_letters")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to cancel", variant: "destructive" });
    } else {
      toast({ title: "Offer letter cancelled" });
      fetchLetters();
    }
  };

  const TAB_STATUSES: Record<string, string[]> = {
    active: ["active", "issued", "pending_acceptance"],
    draft: ["draft"],
    closed: ["expired", "cancelled"],
  };

  const filtered = letters.filter(l => {
    const matchTab = TAB_STATUSES[tab]?.includes(l.status);
    const matchSearch =
      !search ||
      l.offer_number?.toLowerCase().includes(search.toLowerCase()) ||
      l.borrowers?.company_name?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Offer Letters</h1>
            <p className="text-sm text-muted-foreground">
              Facility offers issued to borrowers. Each offer spawns currency-specific facility records.
            </p>
          </div>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Offer Letter
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="draft">Drafts</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
            <Input
              className="w-64"
              placeholder="Search offer # or borrower…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {(["active", "draft", "closed"] as const).map(t => (
            <TabsContent key={t} value={t}>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Offer #</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Valid Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No offer letters found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-sm">{l.offer_number}</TableCell>
                          <TableCell>{l.borrowers?.company_name || "—"}</TableCell>
                          <TableCell>{PRODUCT_LABELS[l.product_type] || l.product_type}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {l.valid_from ? new Date(l.valid_from).toLocaleDateString() : "—"}
                            {" → "}
                            {l.valid_to ? new Date(l.valid_to).toLocaleDateString() : "Open"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[l.status] || "outline"}>
                              {l.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {l.status === "draft" && (
                                  <DropdownMenuItem onClick={() => handleIssue(l.id)}>
                                    <Send className="mr-2 h-4 w-4" /> Issue to Borrower
                                  </DropdownMenuItem>
                                )}
                                {["draft", "issued", "pending_acceptance"].includes(l.status) && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleCancel(l.id)}
                                  >
                                    <X className="mr-2 h-4 w-4" /> Cancel
                                  </DropdownMenuItem>
                                )}
                                {l.status === "pending_acceptance" && (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      await (supabase as any)
                                        .from("offer_letters")
                                        .update({ status: "active", accepted_at: new Date().toISOString() })
                                        .eq("id", l.id);
                                      fetchLetters();
                                    }}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Accepted
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <OfferLetterWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={fetchLetters}
      />
    </DashboardLayout>
  );
}
