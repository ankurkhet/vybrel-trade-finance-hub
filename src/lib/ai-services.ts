import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AIAnalysisType = "document_analysis" | "contract_review" | "invoice_contract_match" | "credit_memo";

interface AnalyzeDocumentParams {
  documentId: string;
  organizationId: string;
  borrowerId?: string;
}

interface ReviewContractParams {
  contractId: string;
  organizationId: string;
  borrowerId: string;
}

interface MatchInvoiceParams {
  invoiceId: string;
  organizationId: string;
  borrowerId: string;
}

interface GenerateCreditMemoParams {
  borrowerId: string;
  organizationId: string;
  transactionType: string;
}

async function createAnalysis(
  type: AIAnalysisType,
  organizationId: string,
  borrowerId?: string,
  sourceIds?: { document_id?: string; contract_id?: string; invoice_id?: string }
) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .insert({
      analysis_type: type,
      organization_id: organizationId,
      borrower_id: borrowerId,
      source_document_id: sourceIds?.document_id,
      source_contract_id: sourceIds?.contract_id,
      source_invoice_id: sourceIds?.invoice_id,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function analyzeDocument({ documentId, organizationId, borrowerId }: AnalyzeDocumentParams) {
  try {
    const analysis = await createAnalysis("document_analysis", organizationId, borrowerId, { document_id: documentId });

    const { data, error } = await supabase.functions.invoke("ai-analyze-document", {
      body: { document_id: documentId, analysis_id: analysis.id },
    });

    if (error) throw error;
    toast.success("Document analysis complete");
    return { analysis_id: analysis.id, ...data };
  } catch (e: any) {
    toast.error(e.message || "Document analysis failed");
    throw e;
  }
}

export async function reviewContract({ contractId, organizationId, borrowerId }: ReviewContractParams) {
  try {
    const analysis = await createAnalysis("contract_review", organizationId, borrowerId, { contract_id: contractId });

    const { data, error } = await supabase.functions.invoke("ai-review-contract", {
      body: { contract_id: contractId, analysis_id: analysis.id },
    });

    if (error) throw error;
    toast.success("Contract review complete");
    return { analysis_id: analysis.id, ...data };
  } catch (e: any) {
    toast.error(e.message || "Contract review failed");
    throw e;
  }
}

export async function matchInvoice({ invoiceId, organizationId, borrowerId }: MatchInvoiceParams) {
  try {
    const analysis = await createAnalysis("invoice_contract_match", organizationId, borrowerId, { invoice_id: invoiceId });

    const { data, error } = await supabase.functions.invoke("ai-match-invoice", {
      body: { invoice_id: invoiceId, analysis_id: analysis.id },
    });

    if (error) throw error;
    toast.success("Invoice matching complete");
    return { analysis_id: analysis.id, ...data };
  } catch (e: any) {
    toast.error(e.message || "Invoice matching failed");
    throw e;
  }
}

export async function generateCreditMemo({ borrowerId, organizationId, transactionType }: GenerateCreditMemoParams) {
  try {
    // Create credit memo record first
    const { data: memo, error: memoError } = await supabase
      .from("credit_memos")
      .insert({
        borrower_id: borrowerId,
        organization_id: organizationId,
        status: "draft",
        transaction_type: transactionType,
      })
      .select()
      .single();

    if (memoError) throw memoError;

    const analysis = await createAnalysis("credit_memo", organizationId, borrowerId);

    const { data, error } = await supabase.functions.invoke("ai-credit-memo", {
      body: {
        borrower_id: borrowerId,
        transaction_type: transactionType,
        credit_memo_id: memo.id,
        analysis_id: analysis.id,
      },
    });

    if (error) throw error;
    toast.success("Credit memo draft generated");
    return { credit_memo_id: memo.id, analysis_id: analysis.id, ...data };
  } catch (e: any) {
    toast.error(e.message || "Credit memo generation failed");
    throw e;
  }
}
