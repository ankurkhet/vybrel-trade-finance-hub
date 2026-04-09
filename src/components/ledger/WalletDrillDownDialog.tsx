import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WalletBalance } from "@/lib/ledger-types";
import { formatCurrency } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ActorLedgerTable } from "./ActorLedgerTable";

interface WalletDrillDownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: WalletBalance[];
  actorId: string;
}

export const WalletDrillDownDialog: React.FC<WalletDrillDownDialogProps> = ({
  open,
  onOpenChange,
  wallets,
  actorId
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto print:max-w-full print:max-h-full print:overflow-visible">
        <DialogHeader className="print:hidden">
          <DialogTitle>Wallet Breakdown</DialogTitle>
        </DialogHeader>
        
        {wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No active wallets found.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {wallets.map((wallet, idx) => (
              <AccordionItem key={`${wallet.currency}-${wallet.system_account || 'actor'}-${idx}`} value={`item-${idx}`}>
                <AccordionTrigger className="hover:no-underline hover:bg-muted/30 px-4 rounded-md">
                  <div className="flex justify-between items-center w-full pr-4">
                    <span className="font-medium">
                      {wallet.currency} Wallet {wallet.system_account ? `(${wallet.system_account})` : ""}
                    </span>
                    <span className={`font-bold ${wallet.balance < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                      {formatCurrency(wallet.balance, wallet.currency)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 px-2 print:block">
                  <ActorLedgerTable 
                    actorId={actorId} 
                    currency={wallet.currency} 
                    systemAccount={wallet.system_account} 
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  );
};
