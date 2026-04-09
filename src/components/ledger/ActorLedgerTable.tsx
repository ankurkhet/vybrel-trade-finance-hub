import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WalletTransaction } from "@/lib/ledger-types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { downloadAsCSV, triggerPDFPrint } from "./LedgerExportUtils";
import { formatCurrency } from "@/lib/utils";

interface ActorLedgerTableProps {
  actorId: string;
  currency: string;
  systemAccount?: string | null;
}

export const ActorLedgerTable: React.FC<ActorLedgerTableProps> = ({ actorId, currency, systemAccount }) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      let query = supabase
        .from("wallet_transactions")
        .select("*")
        .eq("actor_id", actorId)
        .eq("currency", currency)
        .order("transaction_date", { ascending: false });

      if (systemAccount) {
        query = query.eq("system_account", systemAccount);
      }

      const { data, error } = await query;
      if (!error && data) {
        setTransactions(data as any[]); // bypassing strict types for dynamically generated views
      }
      setLoading(false);
    };

    fetchTransactions();
  }, [actorId, currency, systemAccount]);

  const handleExportCSV = () => {
    if (transactions.length > 0) {
      downloadAsCSV(transactions, `wallet_ledger_${currency}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg border printable-hide print:hidden">
        <h3 className="font-semibold text-lg">{currency} Ledger History</h3>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={triggerPDFPrint}>
            <Printer className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="default" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>
      
      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Loading ledger...</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No transactions found in this wallet.</p>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.journal_id}>
                  <TableCell>{new Date(tx.transaction_date).toLocaleDateString()}</TableCell>
                  <TableCell className="capitalize">{tx.journal_type}</TableCell>
                  <TableCell>{tx.description || "—"}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {tx.direction === "debit" ? formatCurrency(tx.amount) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {tx.direction === "credit" ? formatCurrency(tx.amount) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
